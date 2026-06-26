// ============================================================
// MCP Code Review Tool - LangChain Review Chain
//
// Orchestrates the full code review pipeline:
// 1. AST-based pattern analysis (fast, no LLM)
// 2. AI-powered analysis (LLM)
// 3. Issue merging and deduplication
// 4. Summary generation
// ============================================================

import { ChatPromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { ChatOpenAI } from '@langchain/openai';
import { ChatAnthropic } from '@langchain/anthropic';
import type {
  ReviewConfig,
  ReviewIssue,
  ReviewSummary,
  CodeReview,
  AnalysisResult,
  DiffFile,
} from '../types';
import { AstAnalyzer } from '../analyzer/ast-analyzer';
import { AiAnalyzer } from '../analyzer/ai-analyzer';
import { GitAnalyzer } from '../analyzer/git-analyzer';
import { buildReviewPrompt, buildDiffReviewPrompt } from './prompts';
import { getLogger } from '../utils/logger';

/**
 * Orchestrates the complete code review process.
 * Combines AST-based static analysis with LLM-powered review.
 */
export class ReviewChain {
  private config: ReviewConfig;
  private astAnalyzer: AstAnalyzer;
  private aiAnalyzer: AiAnalyzer;
  private gitAnalyzer: GitAnalyzer;
  private logger;

  constructor(config: ReviewConfig, repoPath?: string) {
    this.config = config;
    this.astAnalyzer = new AstAnalyzer();
    this.aiAnalyzer = new AiAnalyzer(config);
    this.gitAnalyzer = new GitAnalyzer(repoPath);
    this.logger = getLogger();
  }

  /**
   * Review a set of source code files.
   *
   * @param files Map of file path to file content
   * @param customInstructions Optional additional review instructions
   * @returns Complete CodeReview result
   */
  async reviewFiles(
    files: Map<string, string>,
    customInstructions?: string,
  ): Promise<CodeReview> {
    const startTime = Date.now();
    this.logger.info('Starting code review for', files.size, 'files');

    const allIssues: ReviewIssue[] = [];
    let totalLines = 0;

    // Phase 1: AST-based analysis (fast parallel)
    this.logger.info('Phase 1: Running static analysis...');
    const astIssues = this.astAnalyzer.analyzeFiles(files);
    allIssues.push(...astIssues);
    this.logger.debug('Static analysis found', astIssues.length, 'issues');

    // Phase 2: AI-powered analysis (per file)
    this.logger.info('Phase 2: Running AI analysis...');
    for (const [filePath, content] of files) {
      const lines = content.split('\n').length;
      totalLines += lines;

      // Skip files that are too large for the LLM
      if (content.length > 50000) {
        this.logger.debug('Skipping AI review for large file:', filePath);
        continue;
      }

      const aiResult = await this.aiAnalyzer.reviewCode(content, filePath);
      allIssues.push(...aiResult.issues);
    }

    // Phase 3: Merge and deduplicate
    this.logger.info('Phase 3: Merging results...');
    const mergedIssues = this.deduplicateIssues(allIssues);

    // Phase 4: Generate summary
    this.logger.info('Phase 4: Generating summary...');
    const summary = this.generateSummary(mergedIssues, files.size, totalLines, startTime);

    // Phase 5: Generate explanation
    const explanation = await this.generateExplanation(
      mergedIssues,
      summary,
      customInstructions,
    );

    return {
      id: this.generateReviewId(),
      timestamp: new Date().toISOString(),
      config: this.config,
      files: Array.from(files.keys()),
      diff: [],
      issues: mergedIssues,
      summary,
      explanation,
    };
  }

  /**
   * Review a git diff.
   *
   * @param base Base git reference
   * @param target Target git reference (defaults to working tree)
   * @param customInstructions Optional additional review instructions
   * @returns Complete CodeReview result
   */
  async reviewGitDiff(
    base?: string,
    target?: string,
    customInstructions?: string,
  ): Promise<CodeReview> {
    const startTime = Date.now();
    this.logger.info('Starting git diff review');

    // Get the diff
    const analysisResult = await this.gitAnalyzer.getDiff(base, target);

    if (analysisResult.diffFiles.length === 0) {
      this.logger.info('No changes found in diff');

      return {
        id: this.generateReviewId(),
        timestamp: new Date().toISOString(),
        config: this.config,
        files: [],
        diff: [],
        issues: [],
        summary: {
          totalIssues: 0,
          criticalCount: 0,
          warningCount: 0,
          infoCount: 0,
          categories: {},
          filesReviewed: 0,
          totalLines: 0,
          overallScore: 100,
          durationMs: Date.now() - startTime,
        },
        explanation: 'No changes found to review. The working tree is clean.',
      };
    }

    // Phase 1: AST analysis on diff content
    this.logger.info('Phase 1: Running static analysis on diff...');
    const allIssues: ReviewIssue[] = [];

    for (const diffFile of analysisResult.diffFiles) {
      if (diffFile.status === 'deleted') continue;

      const hunkContent = diffFile.hunks
        .map((h) => h.content)
        .join('\n');

      const astIssues = this.astAnalyzer.analyze(hunkContent, diffFile.path);
      allIssues.push(...astIssues);
    }

    // Phase 2: AI analysis on the diff
    this.logger.info('Phase 2: Running AI analysis on diff...');

    const systemPrompt = buildDiffReviewPrompt(customInstructions);
    const prompt = ChatPromptTemplate.fromMessages([
      ['system', systemPrompt],
      ['human', 'Review this git diff:\n\n```diff\n{diff}\n```'],
    ]);

    // Use the same model as the config
    const model = this.createModel(this.config);
    const chain = prompt.pipe(model).pipe(new StringOutputParser());

    try {
      const response = await chain.invoke({
        diff: analysisResult.rawDiff,
      });

      const parsedIssues = this.parseAiResponse(response, analysisResult.diffFiles);
      allIssues.push(...parsedIssues.issues);
    } catch (error) {
      this.logger.error('AI diff analysis failed', error);
    }

    // Phase 3: Merge and deduplicate
    const mergedIssues = this.deduplicateIssues(allIssues);

    // Phase 4: Generate summary
    const summary = this.generateSummary(
      mergedIssues,
      analysisResult.files.length,
      analysisResult.totalLines,
      startTime,
    );

    // Phase 5: Generate explanation
    const explanation = await this.generateExplanation(
      mergedIssues,
      summary,
      customInstructions,
    );

    return {
      id: this.generateReviewId(),
      timestamp: new Date().toISOString(),
      config: this.config,
      files: analysisResult.files,
      diff: analysisResult.diffFiles,
      issues: mergedIssues,
      summary,
      explanation,
    };
  }

  /**
   * Remove duplicate issues based on file, line, and message similarity.
   */
  private deduplicateIssues(issues: ReviewIssue[]): ReviewIssue[] {
    const unique = new Map<string, ReviewIssue>();

    for (const issue of issues) {
      const key = [
        issue.file,
        issue.line ?? 0,
        issue.message.slice(0, 80),
      ].join(':');

      // Keep the higher severity issue when duplicates exist
      const existing = unique.get(key);
      if (!existing || this.severityWeight(issue.severity) > this.severityWeight(existing.severity)) {
        unique.set(key, issue);
      }
    }

    return Array.from(unique.values());
  }

  /**
   * Generate a review summary from collected issues.
   */
  private generateSummary(
    issues: ReviewIssue[],
    filesReviewed: number,
    totalLines: number,
    startTime: number,
  ): ReviewSummary {
    const critical = issues.filter((i) => i.severity === 'critical').length;
    const warnings = issues.filter((i) => i.severity === 'warning').length;
    const info = issues.filter((i) => i.severity === 'info').length;

    const categories: Partial<Record<ReviewIssue['category'], number>> = {};
    for (const issue of issues) {
      categories[issue.category] = (categories[issue.category] ?? 0) + 1;
    }

    // Calculate score based on issues
    // Start at 100, deduct points for issues weighted by severity
    const score = Math.max(
      0,
      Math.min(
        100,
        100 -
          critical * 15 -
          warnings * 5 -
          info * 1,
      ),
    );

    return {
      totalIssues: issues.length,
      criticalCount: critical,
      warningCount: warnings,
      infoCount: info,
      categories,
      filesReviewed,
      totalLines,
      overallScore: score,
      durationMs: Date.now() - startTime,
    };
  }

  /**
   * Generate an overall explanation using the LLM (if available).
   */
  private async generateExplanation(
    issues: ReviewIssue[],
    summary: ReviewSummary,
    _customInstructions?: string,
  ): Promise<string> {
    if (issues.length === 0) {
      return 'No issues found. The code looks clean and follows good practices.';
    }

    // For small reviews, just build a summary text
    if (issues.length < 5) {
      const parts: string[] = [];
      const criticalIssues = issues.filter((i) => i.severity === 'critical');

      if (criticalIssues.length > 0) {
        parts.push(
          'Found ' +
            criticalIssues.length +
            ' critical issue(s) that require immediate attention.',
        );
      }

      if (summary.warningCount > 0) {
        parts.push(
          'Additionally, ' +
            summary.warningCount +
            ' warning(s) should be addressed.',
        );
      }

      parts.push('Overall quality score: ' + summary.overallScore + '/100.');
      return parts.join(' ');
    }

    // For larger reviews, use LLM for a comprehensive summary
    try {
      const model = this.createModel(this.config);
      const prompt = ChatPromptTemplate.fromMessages([
        [
          'system',
          'Summarize the following code review findings in 2-4 concise sentences. Be constructive and specific.',
        ],
        [
          'human',
          'Review results:\n- Total issues: {total}\n- Critical: {critical}\n- Warnings: {warnings}\n- Score: {score}/100\n\nIssues: {issues}',
        ],
      ]);

      const chain = prompt.pipe(model).pipe(new StringOutputParser());

      const issuesSummary = issues
        .slice(0, 10) // Only send top 10 issues for summarization
        .map(
          (i) =>
            '[' +
            i.severity +
            '] ' +
            i.file +
            ':' +
            (i.line ?? '?') +
            ' - ' +
            i.message,
        )
        .join('\n');

      return await chain.invoke({
        total: summary.totalIssues,
        critical: summary.criticalCount,
        warnings: summary.warningCount,
        score: summary.overallScore,
        issues: issuesSummary,
      });
    } catch {
      // Fallback
      const criticalText =
        summary.criticalCount > 0
          ? summary.criticalCount + ' critical, '
          : '';
      return (
        'Found ' +
        criticalText +
        summary.warningCount +
        ' warnings, and ' +
        summary.infoCount +
        ' info items. ' +
        'Overall score: ' +
        summary.overallScore +
        '/100.'
      );
    }
  }

  /**
   * Get the underlying git analyzer instance.
   */
  getGitAnalyzer(): GitAnalyzer {
    return this.gitAnalyzer;
  }

  /**
   * Create an LLM model from config.
   */
  private createModel(config: ReviewConfig): BaseChatModel {
    const params = {
      model: config.modelName,
      temperature: config.temperature ?? 0.1,
      maxTokens: config.maxTokens ?? 4096,
      apiKey: config.apiKey,
    };

    switch (config.modelProvider) {
      case 'anthropic':
        return new ChatAnthropic(params);
      case 'openai':
      case 'custom': {
        const openaiParams: Record<string, unknown> = { ...params };
        if (config.apiBaseUrl) {
          openaiParams['configuration'] = {
            baseURL: config.apiBaseUrl,
          };
        }
        return new ChatOpenAI(openaiParams);
      }
      default:
        return new ChatOpenAI(params);
    }
  }

  /**
   * Parse AI response from a diff review.
   */
  private parseAiResponse(
    raw: string,
    diffFiles: DiffFile[],
  ): { issues: ReviewIssue[]; explanation: string } {
    let jsonStr = raw.trim();
    const jsonMatch = jsonStr.match(/```(?:json)?\s*\n([\s\S]*?)\n```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1] as string;
    }

    try {
      const parsed = JSON.parse(jsonStr) as {
        issues?: Array<{
          severity?: string;
          category?: string;
          file?: string;
          line?: number | null;
          column?: number | null;
          message?: string;
          suggestion?: string;
        }>;
        explanation?: string;
      };

      if (!parsed.issues || !Array.isArray(parsed.issues)) {
        return { issues: [], explanation: parsed.explanation ?? '' };
      }

      const knownFiles = new Set(diffFiles.map((f) => f.path));

      const issues: ReviewIssue[] = parsed.issues
        .filter((item) => item.message)
        .map((item) => {
          // Try to match file from diff files
          let file = item.file ?? '';
          if (!file || !knownFiles.has(file)) {
            file = diffFiles[0]?.path ?? 'unknown';
          }

          return {
            severity: this.normalizeSeverity(item.severity ?? 'warning'),
            category: this.normalizeCategory(item.category ?? 'best_practice'),
            file,
            line: item.line ?? undefined,
            column: item.column ?? undefined,
            message: item.message ?? 'No description',
            suggestion: item.suggestion ?? 'No suggestion provided',
          };
        });

      return {
        issues,
        explanation: parsed.explanation ?? '',
      };
    } catch {
      this.logger.warn('Failed to parse AI diff review response');
      return { issues: [], explanation: '' };
    }
  }

  /**
   * Generate a unique review ID.
   */
  private generateReviewId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).slice(2, 8);
    return 'rev-' + timestamp + '-' + random;
  }

  /**
   * Severity weight for deduplication.
   */
  private severityWeight(severity: ReviewIssue['severity']): number {
    switch (severity) {
      case 'critical': return 3;
      case 'warning': return 2;
      case 'info': return 1;
    }
  }

  /**
   * Normalize severity string to valid type.
   */
  private normalizeSeverity(severity: string): 'critical' | 'warning' | 'info' {
    const lower = severity.toLowerCase();
    if (lower === 'critical' || lower === 'high') return 'critical';
    if (lower === 'warning' || lower === 'medium') return 'warning';
    return 'info';
  }

  /**
   * Normalize category string to valid type.
   */
  private normalizeCategory(
    category: string,
  ): ReviewIssue['category'] {
    const validCategories: ReviewIssue['category'][] = [
      'security',
      'performance',
      'bug',
      'code_style',
      'best_practice',
      'maintainability',
      'potential_error',
      'type_safety',
      'logic_error',
    ];

    const lower = category.toLowerCase().replace(/[\s-]/g, '_');
    if (validCategories.includes(lower as ReviewIssue['category'])) {
      return lower as ReviewIssue['category'];
    }

    return 'best_practice';
  }
}
