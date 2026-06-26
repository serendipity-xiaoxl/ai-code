// ============================================================
// MCP Code Review Tool - Markdown Report Generator
//
// Generates well-formatted Markdown code review reports.
// ============================================================

import type { CodeReview, ReviewIssue, IssueCategory } from '../types';
import { getLogger } from '../utils/logger';

/**
 * Generates Markdown-format code review reports.
 */
export class MarkdownReporter {
  private logger;

  constructor() {
    this.logger = getLogger();
  }

  /**
   * Generate a complete Markdown report from a review.
   */
  generate(review: CodeReview): string {
    this.logger.info('Generating Markdown report');

    const sections: string[] = [];

    // Title
    sections.push('# Code Review Report');
    sections.push('');
    sections.push(
      '> Review ID: ' + review.id + ' | Date: ' + review.timestamp,
    );
    sections.push('');

    // Summary section
    sections.push(this.generateSummarySection(review));
    sections.push('');

    // Score section
    sections.push(this.generateScoreSection(review));
    sections.push('');

    // Issues section
    sections.push(this.generateIssuesSection(review));
    sections.push('');

    // File breakdown
    if (review.diff.length > 0) {
      sections.push(this.generateDiffSection(review));
      sections.push('');
    }

    // Explanation
    if (review.explanation) {
      sections.push('## Overall Assessment');
      sections.push('');
      sections.push(review.explanation);
      sections.push('');
    }

    return sections.join('\n');
  }

  /**
   * Generate the summary information section.
   */
  private generateSummarySection(review: CodeReview): string {
    const s = review.summary;
    const lines: string[] = ['## Summary', ''];

    const metadata: Array<[string, string]> = [
      ['Files Reviewed', String(s.filesReviewed)],
      ['Total Lines', String(s.totalLines)],
      ['Total Issues', String(s.totalIssues)],
      ['Critical', String(s.criticalCount)],
      ['Warnings', String(s.warningCount)],
      ['Info', String(s.infoCount)],
      ['Duration', s.durationMs + 'ms'],
    ];

    lines.push('| Metric | Value |');
    lines.push('|--------|-------|');
    for (const [key, value] of metadata) {
      lines.push('| ' + key + ' | ' + value + ' |');
    }

    return lines.join('\n');
  }

  /**
   * Generate score display section.
   */
  private generateScoreSection(review: CodeReview): string {
    const score = review.summary.overallScore;
    let badge: string;

    if (score >= 90) badge = 'excellent';
    else if (score >= 70) badge = 'good';
    else if (score >= 50) badge = 'fair';
    else badge = 'poor';

    return '## Quality Score: ' + score + '/100 (' + badge + ')\n';
  }

  /**
   * Generate the issues list section.
   */
  private generateIssuesSection(review: CodeReview): string {
    if (review.issues.length === 0) {
      return '## Issues\n\nNo issues found. The code looks clean.\n';
    }

    const sections: string[] = ['## Issues (' + review.issues.length + ' total)', ''];

    // Group issues by severity
    const critical = review.issues.filter((i) => i.severity === 'critical');
    const warnings = review.issues.filter((i) => i.severity === 'warning');
    const info = review.issues.filter((i) => i.severity === 'info');

    if (critical.length > 0) {
      sections.push('### Critical (' + critical.length + ')');
      sections.push('');
      sections.push(critical.map((i) => this.formatIssueMd(i)).join('\n'));
      sections.push('');
    }

    if (warnings.length > 0) {
      sections.push('### Warnings (' + warnings.length + ')');
      sections.push('');
      sections.push(warnings.map((i) => this.formatIssueMd(i)).join('\n'));
      sections.push('');
    }

    if (info.length > 0) {
      sections.push('### Info (' + info.length + ')');
      sections.push('');
      sections.push(info.map((i) => this.formatIssueMd(i)).join('\n'));
      sections.push('');
    }

    // Category breakdown
    sections.push('### By Category');
    sections.push('');
    const categoryLines = Object.entries(review.summary.categories)
      .sort(([, a], [, b]) => b - a)
      .map(([cat, count]) => '- **' + cat.replace(/_/g, ' ') + '**: ' + count);

    sections.push(categoryLines.join('\n'));

    return sections.join('\n');
  }

  /**
   * Generate diff overview section.
   */
  private generateDiffSection(review: CodeReview): string {
    const sections: string[] = ['## Changes Overview', ''];

    const rows: Array<[string, string, string, string]> = [
      ['File', 'Status', '++', '--'],
    ];

    for (const file of review.diff) {
      rows.push([
        file.path,
        file.status,
        '+' + file.additions,
        '-' + file.deletions,
      ]);
    }

    // Simple pipe table
    const table: string[] = [];
    if (rows.length > 0) {
      table.push('| ' + rows[0].join(' | ') + ' |');
      table.push('|' + rows[0].map(() => '---').join('|') + '|');
      for (let i = 1; i < rows.length; i++) {
        table.push('| ' + rows[i].join(' | ') + ' |');
      }
    }

    sections.push(table.join('\n'));
    return sections.join('\n');
  }

  /**
   * Format a single issue in Markdown.
   */
  private formatIssueMd(issue: ReviewIssue): string {
    const location = issue.line
      ? '**' + issue.file + ':' + issue.line + '**'
      : '**' + issue.file + '**';

    const cat = issue.category.replace(/_/g, ' ');

    return (
      '- [' +
      cat +
      '] ' +
      location +
      '\n  - ' +
      issue.message +
      '\n  - *Suggestion:* ' +
      issue.suggestion +
      (issue.ruleId ? '\n  - *Rule:* ' + issue.ruleId : '')
    );
  }

  /**
   * Get the category label for display.
   */
  private categoryLabel(category: IssueCategory): string {
    return category.replace(/_/g, ' ');
  }
}
