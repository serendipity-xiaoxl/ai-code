// ============================================================
// MCP Code Review Tool - LangChain Fix Suggestion Chain
//
// Generates specific code fixes for review issues identified
// during the review process.
// ============================================================

import { ChatPromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { ChatOpenAI } from '@langchain/openai';
import { ChatAnthropic } from '@langchain/anthropic';
import type { ReviewConfig, FixSuggestion, ReviewIssue } from '../types';
import { getLogger } from '../utils/logger';

/**
 * Chain that generates fix suggestions for code review issues.
 * Takes a code context and issue description, returns a concrete fix.
 */
export class FixChain {
  private model: BaseChatModel;
  private logger;

  constructor(config: ReviewConfig) {
    this.logger = getLogger();
    this.model = this.createModel(config);
  }

  /**
   * Generate a fix suggestion for a single issue.
   */
  async generateFix(
    fileContent: string,
    issue: ReviewIssue,
  ): Promise<FixSuggestion> {
    this.logger.info('Generating fix for', issue.file, '-', issue.message);

    const prompt = ChatPromptTemplate.fromMessages([
      [
        'system',
        `You are an expert developer. Given a code file and a review issue, provide a specific fix.

Return a JSON object with these fields:
- "original": the exact code snippet that needs to change (from the file)
- "suggested": the replacement code that fixes the issue
- "reasoning": a brief explanation of why this fix works

Return ONLY valid JSON.`,
      ],
      [
        'human',
        'File: {filePath}\nLine: {line}\nIssue: {message}\nSuggestion: {suggestion}\n\nCode:\n```\n{code}\n```\n\nProvide the fix:',
      ],
    ]);

    const chain = prompt.pipe(this.model).pipe(new StringOutputParser());

    try {
      const result = await chain.invoke({
        filePath: issue.file,
        line: issue.line ?? 0,
        message: issue.message,
        suggestion: issue.suggestion,
        code: fileContent,
      });

      return this.parseFixResponse(result, issue);
    } catch (error) {
      this.logger.error('Fix generation failed', error);
      return {
        file: issue.file,
        line: issue.line,
        original: '',
        suggested: '',
        reasoning: 'Failed to generate fix: ' + String(error),
      };
    }
  }

  /**
   * Generate fixes for multiple issues, optionally filtered by file.
   */
  async generateFixes(
    fileContents: Map<string, string>,
    issues: ReviewIssue[],
    fileFilter?: string,
  ): Promise<FixSuggestion[]> {
    const filtered = fileFilter
      ? issues.filter((i) => i.file === fileFilter)
      : issues;

    const fixes: FixSuggestion[] = [];

    for (const issue of filtered) {
      const content = fileContents.get(issue.file);
      if (!content) {
        this.logger.debug('No content available for', issue.file);
        continue;
      }

      const fix = await this.generateFix(content, issue);
      fixes.push(fix);
    }

    return fixes;
  }

  /**
   * Create the appropriate chat model based on config.
   */
  private createModel(config: ReviewConfig): BaseChatModel {
    const params = {
      model: config.modelName,
      temperature: config.temperature ?? 0.2,
      maxTokens: config.maxTokens ?? 2048,
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
   * Parse the LLM's JSON fix response.
   */
  private parseFixResponse(
    raw: string,
    issue: ReviewIssue,
  ): FixSuggestion {
    let jsonStr = raw.trim();

    // Strip markdown code fences if present
    const jsonMatch = jsonStr.match(/```(?:json)?\s*\n([\s\S]*?)\n```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1] as string;
    }

    try {
      const parsed = JSON.parse(jsonStr) as {
        original?: string;
        suggested?: string;
        reasoning?: string;
      };

      return {
        file: issue.file,
        line: issue.line,
        original: parsed.original ?? '',
        suggested: parsed.suggested ?? '',
        reasoning: parsed.reasoning ?? 'No reasoning provided',
      };
    } catch {
      // If JSON parsing fails, treat the whole response as the suggestion
      return {
        file: issue.file,
        line: issue.line,
        original: '',
        suggested: raw,
        reasoning: 'AI-generated fix suggestion',
      };
    }
  }
}
