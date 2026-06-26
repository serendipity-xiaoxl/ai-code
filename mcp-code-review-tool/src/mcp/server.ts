// ============================================================
// MCP Code Review Tool - MCP Protocol Server
//
// Implements the Model Context Protocol server for code review.
// Exposes tools and resources via MCP protocol using
// the @modelcontextprotocol/sdk.
// ============================================================

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import type { ReviewConfig, CodeReview, ReportFormat, ReviewIssue } from '../types';
import { ReviewChain } from '../agent/review-chain';
import { FixChain } from '../agent/fix-chain';
import { AstAnalyzer } from '../analyzer/ast-analyzer';
import { MarkdownReporter } from '../reporter/markdown-reporter';
import { TerminalReporter } from '../reporter/terminal-reporter';
import { JsonReporter } from '../reporter/json-reporter';
import { HtmlReporter } from '../reporter/html-reporter';
import {
  ALL_TOOLS,
  REVIEW_CODE_TOOL,
  REVIEW_GIT_DIFF_TOOL,
  GET_FIX_TOOL,
  LIST_RULES_TOOL,
  parseToolArgs,
  getConfigFromEnv,
} from './tools';
import { getLogger } from '../utils/logger';
import { readFile } from 'node:fs/promises';
import { existsSync, statSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { join, extname } from 'node:path';

/**
 * Reviewer state - maps review IDs to their results for later access.
 */
const reviewStore = new Map<string, CodeReview>();

/**
 * MCP protocol server for code review functionality.
 */
export class McpReviewServer {
  private server: Server;
  private config: ReviewConfig | null;
  private logger;
  private reviewChain: ReviewChain | null = null;
  private fixChain: FixChain | null = null;
  private astAnalyzer: AstAnalyzer;
  private mdReporter: MarkdownReporter;
  private termReporter: TerminalReporter;
  private jsonReporter: JsonReporter;
  private htmlReporter: HtmlReporter;

  constructor(config?: ReviewConfig) {
    this.config = config ?? getConfigFromEnv();
    this.logger = getLogger();
    this.astAnalyzer = new AstAnalyzer();
    this.mdReporter = new MarkdownReporter();
    this.termReporter = new TerminalReporter();
    this.jsonReporter = new JsonReporter();
    this.htmlReporter = new HtmlReporter();

    // Initialize chains if config is available
    if (this.config) {
      this.reviewChain = new ReviewChain(this.config);
      this.fixChain = new FixChain(this.config);
    }

    // Create MCP server instance
    this.server = new Server(
      {
        name: 'mcp-code-review-tool',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
          resources: {},
        },
      },
    );

    this.setupHandlers();
  }

  /**
   * Start the MCP server using stdio transport.
   */
  async start(): Promise<void> {
    const transport = new StdioServerTransport();

    this.logger.info('Starting MCP Code Review server...');

    if (!this.config) {
      this.logger.warn(
        'No LLM configuration provided. Only static analysis will be available.',
      );
      this.logger.warn(
        'Set OPENAI_API_KEY or ANTHROPIC_API_KEY and MCP_REVIEW_PROVIDER environment variables.',
      );
    }

    await this.server.connect(transport);
    this.logger.info('MCP Code Review server running on stdio');
  }

  /**
   * Set up request handlers for MCP tools and resources.
   */
  private setupHandlers(): void {
    this.setupToolHandlers();
    this.setupResourceHandlers();
  }

  /**
   * Set up tool request handlers.
   */
  private setupToolHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      this.logger.debug('Listing tools');

      return {
        tools: ALL_TOOLS.map((tool) => ({
          name: tool.name,
          description: tool.description,
          inputSchema: {
            type: 'object',
            properties: Object.fromEntries(
              tool.parameters.map((p) => [
                p.name,
                { type: p.type, description: p.description },
              ]),
            ),
            required: tool.parameters
              .filter((p) => p.required)
              .map((p) => p.name),
          },
        })),
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      this.logger.info('Tool called:', name);

      try {
        switch (name) {
          case 'review_code':
            return await this.handleReviewCode(args as Record<string, unknown>);
          case 'review_git_diff':
            return await this.handleReviewGitDiff(
              args as Record<string, unknown>,
            );
          case 'get_fix_suggestion':
            return await this.handleGetFix(args as Record<string, unknown>);
          case 'list_rules':
            return await this.handleListRules();
          default:
            return {
              content: [
                {
                  type: 'text' as const,
                  text: 'Unknown tool: ' + name,
                },
              ],
              isError: true,
            };
        }
      } catch (error) {
        this.logger.error('Tool execution failed:', name, error);
        return {
          content: [
            {
              type: 'text' as const,
              text: 'Error executing ' + name + ': ' + String(error),
            },
          ],
          isError: true,
        };
      }
    });
  }

  /**
   * Set up resource request handlers.
   */
  private setupResourceHandlers(): void {
    // List available resources
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
      const resources = [];

      for (const [id, review] of reviewStore) {
        resources.push({
          uri: 'review://' + id + '/summary',
          name: 'Review Summary: ' + id,
          description: 'Summary of review ' + id + ' (score: ' + review.summary.overallScore + '/100)',
        });

        resources.push({
          uri: 'review://' + id + '/issues',
          name: 'Review Issues: ' + id,
          description: 'All issues found in review ' + id,
        });
      }

      // Always provide the rules listing resource
      resources.push({
        uri: 'review://rules',
        name: 'Code Review Rules',
        description: 'Static analysis rules used in code review',
      });

      return { resources };
    });

    // Read a specific resource
    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const uri = request.params.uri;

      this.logger.debug('Reading resource:', uri);

      // Match review://{id}/summary
      const summaryMatch = uri.match(/^review:\/\/([^/]+)\/summary$/);
      if (summaryMatch) {
        const reviewId = summaryMatch[1] as string;
        return this.getReviewSummaryResource(reviewId);
      }

      // Match review://{id}/issues
      const issuesMatch = uri.match(/^review:\/\/([^/]+)\/issues$/);
      if (issuesMatch) {
        const reviewId = issuesMatch[1] as string;
        return this.getReviewIssuesResource(reviewId);
      }

      // Match review://rules
      if (uri === 'review://rules') {
        return this.getRulesResource();
      }

      return {
          contents: [
            {
              uri,
              text: 'Resource not found: ' + uri,
            },
          ],
        };
    });
  }

  /**
   * Handle the review_code tool call.
   */
  private async handleReviewCode(
    args: Record<string, unknown>,
  ) {
    const params = parseToolArgs(REVIEW_CODE_TOOL.parameters, args);

    const targetPath = params['targetPath'] as string;
    const instructions = params['instructions'] as string | undefined;
    const format = (params['format'] as ReportFormat) ?? 'terminal';

    this.logger.info('Reviewing code at:', targetPath);

    // Read files from path
    const files = await this.readFiles(targetPath);

    if (files.size === 0) {
      return {
        content: [
          {
            type: 'text' as const,
            text: 'No files found at path: ' + targetPath,
          },
        ],
        isError: true,
      };
    }

    // If no LLM config, only do static analysis
    if (!this.reviewChain) {
      return this.runStaticAnalysisOnly(files, format);
    }

    // Full review with AI
    const review = await this.reviewChain.reviewFiles(files, instructions);

    // Store for later access
    reviewStore.set(review.id, review);

    // Generate output in requested format
    const output = this.formatReport(review, format);

    return {
      content: [
        {
          type: 'text' as const,
          text: output,
        },
      ],
    };
  }

  /**
   * Handle the review_git_diff tool call.
   */
  private async handleReviewGitDiff(
    args: Record<string, unknown>,
  ) {
    const params = parseToolArgs(REVIEW_GIT_DIFF_TOOL.parameters, args);

    const target = params['target'] as string | undefined;
    const base = params['base'] as string | undefined;
    const instructions = params['instructions'] as string | undefined;
    const format = (params['format'] as ReportFormat) ?? 'terminal';

    this.logger.info('Reviewing git diff');

    if (!this.reviewChain) {
      return {
        content: [
          {
            type: 'text' as const,
            text: 'LLM configuration required for diff review. Set API key and provider environment variables.',
          },
        ],
        isError: true,
      };
    }

    const review = await this.reviewChain.reviewGitDiff(base, target, instructions);

    // Store for later access
    reviewStore.set(review.id, review);

    const output = this.formatReport(review, format);

    return {
      content: [
        {
          type: 'text' as const,
          text: output,
        },
      ],
    };
  }

  /**
   * Handle the get_fix_suggestion tool call.
   */
  private async handleGetFix(args: Record<string, unknown>) {
    const params = parseToolArgs(GET_FIX_TOOL.parameters, args);

    const reviewId = params['reviewId'] as string;
    const filePath = params['filePath'] as string | undefined;
    const issueIndex = params['issueIndex'] as number | undefined;

    const review = reviewStore.get(reviewId);

    if (!review) {
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Review not found: ' + reviewId,
          },
        ],
        isError: true,
      };
    }

    if (!this.fixChain || !this.config) {
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Fix suggestions require LLM configuration.',
          },
        ],
        isError: true,
      };
    }

    // Filter issues
    let issues = review.issues;
    if (filePath) {
      issues = issues.filter((i) => i.file === filePath);
    }
    if (issueIndex !== undefined) {
      if (issueIndex < 0 || issueIndex >= issues.length) {
        return {
          content: [
            {
              type: 'text' as const,
              text:
                'Issue index ' +
                issueIndex +
                ' out of range (0-' +
                (issues.length - 1) +
                ')',
            },
          ],
          isError: true,
        };
      }
      issues = [issues[issueIndex] as ReviewIssue];
    }

    if (issues.length === 0) {
      return {
        content: [
          {
            type: 'text' as const,
            text: 'No matching issues found.',
          },
        ],
      };
    }

    // Read file contents for fix generation
    const fileContents = new Map<string, string>();
    for (const issue of issues) {
      if (!fileContents.has(issue.file)) {
        try {
          const content = await readFile(issue.file, 'utf-8');
          fileContents.set(issue.file, content);
        } catch {
          this.logger.debug('Cannot read file for fix:', issue.file);
        }
      }
    }

    const fixes = await this.fixChain.generateFixes(fileContents, issues, filePath);

    const fixText = fixes
      .map(
        (fix) =>
          'File: ' +
          fix.file +
          (fix.line ? ':' + fix.line : '') +
          '\n' +
          '--- Original ---\n' +
          fix.original +
          '\n--- Suggested ---\n' +
          fix.suggested +
          '\n--- Reasoning ---\n' +
          fix.reasoning,
      )
      .join('\n\n');

    return {
      content: [
        {
          type: 'text' as const,
          text: fixText || 'No fixes generated.',
        },
      ],
    };
  }

  /**
   * Handle the list_rules tool call.
   */
  private async handleListRules() {
    const rules = this.astAnalyzer.getRules();

    const rulesText = rules
      .map(
        (r) =>
          '  ' +
          r.id +
          ': ' +
          r.name +
          '\n    ' +
          r.description,
      )
      .join('\n');

    return {
      content: [
        {
          type: 'text' as const,
          text:
            'Available Static Analysis Rules (' +
            rules.length +
            ' total):\n\n' +
            rulesText,
        },
      ],
    };
  }

  /**
   * Read source files from a file path or directory.
   * Returns a map of file path to file content.
   */
  private async readFiles(targetPath: string): Promise<Map<string, string>> {
    const files = new Map<string, string>();

    try {
      const resolvedPath = join(process.cwd(), targetPath);
      const stats = statSync(resolvedPath);

      if (stats.isFile()) {
        const content = await readFile(resolvedPath, 'utf-8');
        files.set(resolvedPath, content);
      } else if (stats.isDirectory()) {
        await this.readDirRecursive(resolvedPath, files);
      }
    } catch (error) {
      this.logger.error('Error reading path:', targetPath, error);
    }

    return files;
  }

  /**
   * Recursively read files from a directory.
   */
  private async readDirRecursive(
    dirPath: string,
    files: Map<string, string>,
    depth: number = 0,
  ): Promise<void> {
    if (depth > 10) return; // Safety limit

    const sourceExtensions = [
      '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
      '.py', '.go', '.rs', '.java', '.kt', '.swift',
      '.rb', '.php', '.cs', '.cpp', '.c', '.h', '.hpp',
      '.vue', '.svelte', '.css', '.scss', '.less',
      '.json', '.yaml', '.yml', '.toml', '.md',
    ];

    const skipDirs = new Set([
      'node_modules', '.git', 'dist', 'build', 'target',
      '.next', '.nuxt', 'coverage', '.cache', '.claude',
      '__pycache__', '.venv', 'venv', '.idea', '.vscode',
    ]);

    try {
      const entries = await readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        if (skipDirs.has(entry.name)) continue;

        const fullPath = join(dirPath, entry.name);

        if (entry.isDirectory()) {
          await this.readDirRecursive(fullPath, files, depth + 1);
        } else if (entry.isFile()) {
          const ext = extname(entry.name).toLowerCase();
          if (sourceExtensions.includes(ext)) {
            try {
              const content = await readFile(fullPath, 'utf-8');
              files.set(fullPath, content);
            } catch {
              // Skip files we can't read
            }
          }
        }
      }
    } catch (error) {
      this.logger.debug('Error reading directory:', dirPath, error);
    }
  }

  /**
   * Run static analysis only (no LLM config available).
   */
  private async runStaticAnalysisOnly(
    files: Map<string, string>,
    format: ReportFormat,
  ): Promise<Record<string, unknown>> {
    const astIssues = this.astAnalyzer.analyzeFiles(files);

    // Build a basic review result
    const summary = {
      totalIssues: astIssues.length,
      criticalCount: astIssues.filter((i) => i.severity === 'critical').length,
      warningCount: astIssues.filter((i) => i.severity === 'warning').length,
      infoCount: astIssues.filter((i) => i.severity === 'info').length,
      categories: {} as Record<string, number>,
      filesReviewed: files.size,
      totalLines: Array.from(files.values()).reduce(
        (sum, content) => sum + content.split('\n').length,
        0,
      ),
      overallScore: 0,
      durationMs: 0,
    };

    // Calculate categories
    for (const issue of astIssues) {
      const cat = issue.category;
      summary.categories[cat] = (summary.categories[cat] ?? 0) + 1;
    }

    // Calculate score
    summary.overallScore = Math.max(
      0,
      100 -
        summary.criticalCount * 15 -
        summary.warningCount * 5 -
        summary.infoCount * 1,
    );

    const review: CodeReview = {
      id: 'static-' + Date.now().toString(36),
      timestamp: new Date().toISOString(),
      config: {
        modelProvider: 'custom',
        modelName: 'none',
        apiKey: '',
      },
      files: Array.from(files.keys()),
      diff: [],
      issues: astIssues,
      summary,
      explanation:
        'Static analysis only (no LLM configured). Set MCP_REVIEW_PROVIDER and API key for AI-powered review.',
    };

    const output = this.formatReport(review, format);

    return {
      content: [
        {
          type: 'text' as const,
          text: output,
        },
      ],
    };
  }

  /**
   * Format a review report in the requested output format.
   */
  private formatReport(review: CodeReview, format: ReportFormat): string {
    switch (format) {
      case 'markdown':
        return this.mdReporter.generate(review);
      case 'json':
        return this.jsonReporter.generate(review);
      case 'html':
        return this.htmlReporter.generate(review);
      case 'terminal':
      default:
        return this.termReporter.generate(review);
    }
  }

  /**
   * Get the summary resource for a review.
   */
  private getReviewSummaryResource(reviewId: string) {
    const review = reviewStore.get(reviewId);
    if (!review) {
      return {
        contents: [
          {
            uri: 'review://' + reviewId + '/summary',
            text: 'Review not found: ' + reviewId,
          },
        ],
      };
    }

    const s = review.summary;
    const text = [
      'Review: ' + review.id,
      'Date: ' + review.timestamp,
      'Score: ' + s.overallScore + '/100',
      'Files: ' + s.filesReviewed,
      'Issues: ' + s.totalIssues + ' (C:' + s.criticalCount + ' W:' + s.warningCount + ' I:' + s.infoCount + ')',
      'Duration: ' + s.durationMs + 'ms',
      '',
      'Explanation: ' + review.explanation,
    ].join('\n');

    return {
      contents: [
        {
          uri: 'review://' + reviewId + '/summary',
          text,
        },
      ],
    };
  }

  /**
   * Get the issues resource for a review.
   */
  private getReviewIssuesResource(reviewId: string) {
    const review = reviewStore.get(reviewId);
    if (!review) {
      return {
        contents: [
          {
            uri: 'review://' + reviewId + '/issues',
            text: 'Review not found: ' + reviewId,
          },
        ],
      };
    }

    const text = review.issues
      .map(
        (issue, index) =>
          index +
          '. [' +
          issue.severity.toUpperCase() +
          '] ' +
          issue.file +
          ':' +
          (issue.line ?? '?') +
          '\n   ' +
          issue.message +
          '\n   Suggestion: ' +
          issue.suggestion,
      )
      .join('\n\n');

    return {
      contents: [
        {
          uri: 'review://' + reviewId + '/issues',
          text: text || 'No issues found.',
        },
      ],
    };
  }

  /**
   * Get the rules resource.
   */
  private getRulesResource() {
    const rules = this.astAnalyzer.getRules();

    const text = rules
      .map(
        (r) =>
          '## ' +
          r.id +
          ': ' +
          r.name +
          '\n\n' +
          r.description,
      )
      .join('\n\n');

    return {
      contents: [
        {
          uri: 'review://rules',
          text: text || 'No rules configured.',
        },
      ],
    };
  }
}
