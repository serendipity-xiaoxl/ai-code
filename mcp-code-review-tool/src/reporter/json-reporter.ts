// ============================================================
// MCP Code Review Tool - JSON Report Generator
//
// Generates machine-readable JSON code review reports.
// ============================================================

import type { CodeReview } from '../types';
import { getLogger } from '../utils/logger';

/**
 * Generates JSON-format code review reports for programmatic consumption.
 */
export class JsonReporter {
  private logger;

  constructor() {
    this.logger = getLogger();
  }

  /**
   * Generate a complete JSON report.
   */
  generate(review: CodeReview): string {
    this.logger.info('Generating JSON report');
    return JSON.stringify(review, null, 2);
  }

  /**
   * Generate a compact (no whitespace) JSON report.
   */
  generateCompact(review: CodeReview): string {
    return JSON.stringify(review);
  }

  /**
   * Generate a JSON report filtered to only critical issues.
   */
  generateCriticalOnly(review: CodeReview): string {
    const filtered = {
      ...review,
      issues: review.issues.filter((i) => i.severity === 'critical'),
      summary: {
        ...review.summary,
        totalIssues: review.issues.filter((i) => i.severity === 'critical')
          .length,
      },
    };

    return JSON.stringify(filtered, null, 2);
  }

  /**
   * Generate a JSON report grouped by severity.
   */
  generateGrouped(review: CodeReview): string {
    const grouped = {
      meta: {
        id: review.id,
        timestamp: review.timestamp,
        score: review.summary.overallScore,
        durationMs: review.summary.durationMs,
      },
      summary: review.summary,
      bySeverity: {
        critical: review.issues.filter((i) => i.severity === 'critical'),
        warning: review.issues.filter((i) => i.severity === 'warning'),
        info: review.issues.filter((i) => i.severity === 'info'),
      },
      byCategory: this.groupByCategory(review.issues),
      files: review.files,
      changes: review.diff,
      explanation: review.explanation,
    };

    return JSON.stringify(grouped, null, 2);
  }

  /**
   * Group issues by category.
   */
  private groupByCategory(
    issues: CodeReview['issues'],
  ): Record<string, CodeReview['issues']> {
    const grouped: Record<string, CodeReview['issues']> = {};

    for (const issue of issues) {
      const cat = issue.category;
      if (!grouped[cat]) {
        grouped[cat] = [];
      }
      grouped[cat].push(issue);
    }

    return grouped;
  }
}
