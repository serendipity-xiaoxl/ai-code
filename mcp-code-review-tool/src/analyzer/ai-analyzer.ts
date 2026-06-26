// ============================================================
// MCP Code Review Tool - AI-Powered Code Analyzer
//
// Uses LangChain with an LLM to perform intelligent code review.
// Supports OpenAI-compatible API and Anthropic models.
// ============================================================

import { ChatPromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { ChatOpenAI } from '@langchain/openai';
import { ChatAnthropic } from '@langchain/anthropic';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import type { ReviewConfig, ReviewIssue } from '../types';
import { getLogger } from '../utils/logger';

/**
 * Parsed JSON response from the LLM review.
 * Used internally to structure the LLM output before mapping to ReviewIssue.
 */
interface LlmReviewResult {
  issues: Array<{
    severity: string;
    category: string;
    file: string;
    line: number | null;
    column: number | null;
    message: string;
    suggestion: string;
  }>;
  explanation: string;
}

/**
 * AI-powered code reviewer using LangChain.
 * Delegates code analysis to configured LLM.
 */
export class AiAnalyzer {
  private model: BaseChatModel;
  private config: ReviewConfig;
  private logger;

  constructor(config: ReviewConfig) {
    this.config = config;
    this.logger = getLogger();
    this.model = this.createModel(config);
  }

  /**
   * Create the appropriate LangChain chat model based on config.
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
        this.logger.warn(
          'Unknown provider:',
          config.modelProvider,
          ', defaulting to OpenAI',
        );
        return new ChatOpenAI(params);
    }
  }

  /**
   * Perform AI-powered code review on the given code.
   *
   * @param code The full code content to review
   * @param filePath The file path for context
   * @returns Array of review issues found
   */
  async reviewCode(
    code: string,
    filePath: string,
  ): Promise<{ issues: ReviewIssue[]; explanation: string }> {
    this.logger.info('Running AI review on:', filePath);

    const prompt = ChatPromptTemplate.fromMessages([
      [
        'system',
        `You are an expert code reviewer. Analyze the provided code for:

1. SECURITY: Vulnerabilities, injection risks, unsafe practices
2. BUGS: Logic errors, incorrect assumptions, edge cases
3. PERFORMANCE: Inefficient algorithms, unnecessary allocations
4. BEST PRACTICES: Violations of language idioms and conventions
5. MAINTAINABILITY: Code clarity, complexity, testability
6. TYPE SAFETY: Potential type-related issues

Respond with a valid JSON object containing:
- "issues": array of objects with fields: severity ("critical"/"warning"/"info"), category ("security"/"performance"/"bug"/"code_style"/"best_practice"/"maintainability"/"potential_error"/"type_safety"/"logic_error"), file (string), line (number or null), column (number or null), message (string), suggestion (string)
- "explanation": a brief overall assessment string

Focus on concrete, actionable issues. Be thorough but relevant.
Return ONLY valid JSON, no other text.`,
      ],
      ['human', 'Review the following code from file "{filePath}":\n\n```\n{code}\n```'],
    ]);

    const chain = prompt.pipe(this.model).pipe(new StringOutputParser());

    try {
      const result = await chain.invoke({
        filePath,
        code,
      });

      return this.parseLlmResponse(result, filePath);
    } catch (error) {
      this.logger.error('AI review failed for', filePath, error);
      return {
        issues: [],
        explanation: 'AI review failed: ' + String(error),
      };
    }
  }

  /**
   * Perform AI review on a git diff.
   *
   * @param diff The git diff content
   * @returns Issues and explanation
   */
  async reviewDiff(
    diff: string,
  ): Promise<{ issues: ReviewIssue[]; explanation: string }> {
    this.logger.info('Running AI review on diff');

    const prompt = ChatPromptTemplate.fromMessages([
      [
        'system',
        `You are an expert code reviewer. Analyze the provided git diff for:

1. SECURITY: Vulnerabilities introduced by the changes
2. BUGS: Logic errors in the modifications
3. PERFORMANCE: Efficiency of new code
4. BEST PRACTICES: Code quality of additions
5. MAINTAINABILITY: Impact on codebase health

Respond with a valid JSON object containing:
- "issues": array of objects with fields: severity, category, file, line (number or null), column (number or null), message, suggestion
- "explanation": brief overall assessment string

Return ONLY valid JSON, no other text.`,
      ],
      ['human', 'Review this git diff:\n\n```diff\n{diff}\n```'],
    ]);

    const chain = prompt.pipe(this.model).pipe(new StringOutputParser());

    try {
      const result = await chain.invoke({ diff });
      return this.parseLlmResponse(result, 'diff');
    } catch (error) {
      this.logger.error('AI diff review failed', error);
      return {
        issues: [],
        explanation: 'AI diff review failed: ' + String(error),
      };
    }
  }

  /**
   * Suggest fixes for a given issue in a codebase.
   */
  async suggestFix(
    code: string,
    filePath: string,
    issueDescription: string,
  ): Promise<string> {
    this.logger.info('Getting fix suggestion for', filePath);

    const prompt = ChatPromptTemplate.fromMessages([
      [
        'system',
        `You are an expert developer. Given a code file and a description of an issue,
provide a specific, correct fix for the issue. Output the fixed code block only.
Use proper formatting with file path headers.`,
      ],
      [
        'human',
        'File: {filePath}\n\nIssue: {issue}\n\nCode:\n```\n{code}\n```\n\nProvide the fix:',
      ],
    ]);

    const chain = prompt.pipe(this.model).pipe(new StringOutputParser());

    try {
      return await chain.invoke({
        filePath,
        issue: issueDescription,
        code,
      });
    } catch (error) {
      this.logger.error('Fix suggestion failed', error);
      return 'Failed to generate fix: ' + String(error);
    }
  }

  /**
   * Parse and validate the LLM's JSON response.
   */
  private parseLlmResponse(
    raw: string,
    defaultFile: string,
  ): { issues: ReviewIssue[]; explanation: string } {
    // Try to extract JSON from the response (handles markdown code blocks)
    let jsonStr = raw.trim();

    // Strip markdown code fences if present
    const jsonMatch = jsonStr.match(/```(?:json)?\s*\n([\s\S]*?)\n```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1] as string;
    }

    let parsed: LlmReviewResult;

    try {
      parsed = JSON.parse(jsonStr) as LlmReviewResult;
    } catch {
      // If the LLM didn't return valid JSON, try a more lenient parse
      this.logger.warn('Failed to parse LLM JSON response, using fallback');

      return {
        issues: [],
        explanation:
          'Unable to parse AI review result. The model returned an unexpected format.',
      };
    }

    const issues: ReviewIssue[] = (parsed.issues ?? []).map((item) => ({
      severity: this.normalizeSeverity(item.severity),
      category: this.normalizeCategory(item.category),
      file: item.file || defaultFile,
      line: item.line ?? undefined,
      column: item.column ?? undefined,
      message: item.message || 'No description provided',
      suggestion: item.suggestion || 'No suggestion provided',
    }));

    return {
      issues,
      explanation: parsed.explanation ?? 'No overall assessment provided.',
    };
  }

  /**
   * Normalize severity to valid values.
   */
  private normalizeSeverity(
    severity: string,
  ): 'critical' | 'warning' | 'info' {
    const lower = severity.toLowerCase();
    if (lower === 'critical' || lower === 'high') return 'critical';
    if (lower === 'warning' || lower === 'medium') return 'warning';
    return 'info';
  }

  /**
   * Normalize category to valid values.
   */
  private normalizeCategory(category: string): ReviewIssue['category'] {
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
