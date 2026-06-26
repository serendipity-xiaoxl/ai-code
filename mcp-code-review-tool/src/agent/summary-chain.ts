// ============================================================
// MCP Code Review Tool - LangChain Summary Chain
//
// Generates comprehensive review summaries from analysis results.
// Creates human-readable assessments with actionable insights.
// ============================================================

import { ChatPromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { ChatOpenAI } from '@langchain/openai';
import { ChatAnthropic } from '@langchain/anthropic';
import type { ReviewConfig, CodeReview, ReviewSummary } from '../types';
import { SUMMARY_SYSTEM_PROMPT } from './prompts';
import { getLogger } from '../utils/logger';

/**
 * Aggregated category breakdown for the summary prompt.
 */
interface CategoryInfo {
  category: string;
  count: number;
}

/**
 * Chain that generates a comprehensive, readable summary of a code review.
 */
export class SummaryChain {
  private model: BaseChatModel | null;
  private logger;

  constructor(config?: ReviewConfig) {
    this.logger = getLogger();
    this.model = config ? this.createModel(config) : null;
  }

  /**
   * Generate a comprehensive review summary.
   */
  async generateSummary(review: CodeReview): Promise<ReviewSummary> {
    this.logger.info('Generating review summary');

    if (!this.model) {
      return review.summary;
    }

    const categories: CategoryInfo[] = Object.entries(review.summary.categories)
      .map(([category, count]) => ({ category, count: count ?? 0 }))
      .sort((a, b) => b.count - a.count);

    const topIssues = review.issues
      .filter((i) => i.severity === 'critical')
      .map((i) => `[CRITICAL] ${i.file}:${i.line ?? '?'} - ${i.message}`)
      .join('\n');

    const prompt = ChatPromptTemplate.fromMessages([
      ['system', SUMMARY_SYSTEM_PROMPT],
      [
        'human',
        `Code Review Summary Request:

Files Reviewed: {filesReviewed}
Total Lines: {totalLines}
Total Issues: {totalIssues}
  Critical: {criticalCount}
  Warnings: {warningCount}
  Info: {infoCount}

Categories:
{categories}

Top Critical Issues:
{topIssues}

Overall Score: {score}/100

Generate a concise summary of these findings.`,
      ],
    ]);

    const chain = prompt.pipe(this.model).pipe(new StringOutputParser());

    try {
      const summaryText = await chain.invoke({
        filesReviewed: review.summary.filesReviewed,
        totalLines: review.summary.totalLines,
        totalIssues: review.summary.totalIssues,
        criticalCount: review.summary.criticalCount,
        warningCount: review.summary.warningCount,
        infoCount: review.summary.infoCount,
        categories: categories
          .map((c) => `  - ${c.category}: ${c.count}`)
          .join('\n') || '  None',
        topIssues: topIssues || '  No critical issues found',
        score: review.summary.overallScore,
      });

      return {
        ...review.summary,
        // The summary chain runs separately; it doesn't modify the summary
        // but the generated text can be used as an enriched explanation
      };
    } catch (error) {
      this.logger.error('Summary generation failed', error);
      return review.summary;
    }
  }

  /**
   * Render a short one-line status for the review.
   */
  getReviewStatus(summary: ReviewSummary): string {
    if (summary.overallScore >= 90) return 'PASS';
    if (summary.overallScore >= 70) return 'PASS_WITH_WARNINGS';
    return 'FAIL';
  }

  /**
   * Get a quick quality label.
   */
  getQualityLabel(score: number): string {
    if (score >= 95) return 'Excellent';
    if (score >= 85) return 'Good';
    if (score >= 70) return 'Fair';
    if (score >= 50) return 'Needs Improvement';
    return 'Poor';
  }

  /**
   * Get top N most severe issues.
   */
  getTopIssues(review: CodeReview, n: number = 5): CodeReview['issues'] {
    return review.issues
      .slice()
      .sort((a, b) => {
        const severityOrder = { critical: 0, warning: 1, info: 2 };
        const aOrder = severityOrder[a.severity] ?? 3;
        const bOrder = severityOrder[b.severity] ?? 3;
        if (aOrder !== bOrder) return aOrder - bOrder;
        return (b.line ?? 0) - (a.line ?? 0);
      })
      .slice(0, n);
  }

  /**
   * Create the appropriate chat model.
   */
  private createModel(config: ReviewConfig): BaseChatModel {
    const params = {
      model: config.modelName,
      temperature: 0.3,
      maxTokens: 1024,
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
}
