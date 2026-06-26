// ============================================================
// MCP Code Review Tool - Terminal Report Generator
//
// CRITICAL REQUIREMENT: All output uses ONLY ASCII characters.
// NO Unicode, NO emoji, NO special box-drawing characters.
// Colors use ANSI escape codes only.
// ============================================================

import type { CodeReview, ReviewIssue, IssueCategory, DiffFile } from '../types';
import {
  ANSI,
  horizontalLine,
  doubleLine,
  centerText,
  padRight,
  padLeft,
  wrapText,
  textBox,
  formatSeverityBadge,
  formatCategoryLabel,
  formatScore,
  formatFileRef,
  formatDuration,
  createTable,
  progressBar as fmtProgressBar,
} from '../utils/formatter';
import { getLogger } from '../utils/logger';

/**
 * Configuration for terminal output width.
 */
export interface TerminalConfig {
  /** Maximum line width for output (default: 80) */
  width: number;
  /** Whether to use ANSI colors (default: true) */
  color: boolean;
  /** Whether to show debug/trace info (default: false) */
  verbose: boolean;
}

const DEFAULT_CONFIG: TerminalConfig = {
  width: 80,
  color: true,
  verbose: false,
};

/**
 * Generates beautiful terminal-formatted code review output
 * using ONLY ASCII characters and ANSI escape codes.
 * No Unicode or special box-drawing characters are used.
 */
export class TerminalReporter {
  private config: TerminalConfig;
  private logger;

  constructor(config?: Partial<TerminalConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.logger = getLogger();
  }

  /**
   * Generate a complete terminal report for a code review.
   */
  generate(review: CodeReview): string {
    this.logger.info('Generating terminal report');

    const sections: string[] = [];
    const width = this.config.width;

    // Header
    sections.push(this.formatHeader(review, width));

    // Summary block
    sections.push(this.formatSummary(review, width));

    // Score
    sections.push(this.formatScoreArea(review, width));

    // Issues by severity
    sections.push(this.formatIssues(review, width));

    // Diff overview (if available)
    if (review.diff.length > 0) {
      sections.push(this.formatDiffSummary(review.diff, width));
    }

    // Category breakdown
    sections.push(this.formatCategoryBreakdown(review, width));

    // Explanation
    if (review.explanation) {
      sections.push(this.formatExplanation(review.explanation, width));
    }

    // Footer
    sections.push(this.formatFooter(width));

    return sections.join('\n');
  }

  /**
   * Generate a compact one-line summary for quick display.
   */
  generateCompact(review: CodeReview): string {
    const s = review.summary;
    const score = s.overallScore;

    const scoreColor =
      score >= 90 ? ANSI.green : score >= 70 ? ANSI.yellow : ANSI.red;

    const parts: string[] = [
      ANSI.bold + 'REVIEW' + ANSI.reset,
      review.id,
      '|',
      'Score:',
      scoreColor + ANSI.bold + score + '/100' + ANSI.reset,
      '|',
      'Issues:',
      s.criticalCount > 0 ? ANSI.red + ANSI.bold + String(s.criticalCount) + 'C' + ANSI.reset : '0C',
      '/',
      s.warningCount > 0 ? ANSI.yellow + String(s.warningCount) + 'W' + ANSI.reset : '0W',
      '/',
      String(s.infoCount) + 'I',
      '|',
      'Files:',
      String(s.filesReviewed),
      '|',
      formatDuration(s.durationMs),
    ];

    return parts.join(' ');
  }

  /**
   * Format the report header with ASCII border.
   */
  private formatHeader(review: CodeReview, width: number): string {
    const lines: string[] = [];

    // Top border
    lines.push(doubleLine(width));

    // Title
    lines.push(centerText('CODE REVIEW REPORT', width));
    lines.push(centerText('Review ID: ' + review.id, width));
    lines.push(centerText('Date: ' + review.timestamp, width));

    // Bottom border
    lines.push(doubleLine(width));

    return lines.join('\n');
  }

  /**
   * Format the summary statistics section.
   */
  private formatSummary(review: CodeReview, width: number): string {
    const s = review.summary;
    const lines: string[] = [];

    // Section header
    lines.push('');
    lines.push(ANSI.bold + '  SUMMARY' + ANSI.reset);
    lines.push('  ' + horizontalLine(width - 4));

    // Summary items
    const items: Array<[string, string]> = [
      ['Files Reviewed', String(s.filesReviewed)],
      ['Total Lines', String(s.totalLines)],
      ['Total Issues', String(s.totalIssues)],
      ['Duration', formatDuration(s.durationMs)],
    ];

    for (const [label, value] of items) {
      const paddedLabel = padRight(label + ':', 20);
      lines.push('    ' + ANSI.cyan + paddedLabel + ANSI.reset + value);
    }

    // Issue count badges
    const issueLine = [
      '    ' + padRight('Issues:', 20),
      s.criticalCount > 0
        ? ANSI.red + ANSI.bold + 'CRITICAL: ' + s.criticalCount + ANSI.reset
        : ANSI.gray + 'CRITICAL: 0' + ANSI.reset,
      '  ',
      s.warningCount > 0
        ? ANSI.yellow + 'WARNINGS: ' + s.warningCount + ANSI.reset
        : ANSI.gray + 'WARNINGS: 0' + ANSI.reset,
      '  ',
      ANSI.blue + 'INFO: ' + s.infoCount + ANSI.reset,
    ].join('');

    lines.push(issueLine);
    lines.push('');

    return lines.join('\n');
  }

  /**
   * Format the overall score area.
   */
  private formatScoreArea(review: CodeReview, width: number): string {
    const score = review.summary.overallScore;
    const label =
      score >= 90
        ? 'Excellent'
        : score >= 70
          ? 'Good'
          : score >= 50
            ? 'Fair'
            : 'Needs Improvement';

    const scoreColor =
      score >= 90
        ? ANSI.green
        : score >= 70
          ? ANSI.yellow
          : ANSI.red;

    const bar = fmtProgressBar(score, 100, 30);

    return [
      '',
      '  ' + ANSI.bold + 'QUALITY SCORE' + ANSI.reset,
      '  ' + horizontalLine(width - 4),
      '    ' + scoreColor + ANSI.bold + 'Score: ' + score + '/100' + ANSI.reset + '  ' + label,
      '    ' + bar,
      '',
    ].join('\n');
  }

  /**
   * Format all issues grouped by severity.
   */
  private formatIssues(review: CodeReview, width: number): string {
    if (review.issues.length === 0) {
      return [
        '',
        '  ' + ANSI.bold + 'ISSUES' + ANSI.reset,
        '  ' + horizontalLine(width - 4),
        '    ' + ANSI.green + 'No issues found. The code looks clean.' + ANSI.reset,
        '',
      ].join('\n');
    }

    const lines: string[] = [
      '',
      '  ' + ANSI.bold + 'ISSUES (' + review.issues.length + ' total)' + ANSI.reset,
      '  ' + horizontalLine(width - 4),
      '',
    ];

    // Sort: critical first, then warnings, then info
    const sorted = [...review.issues].sort((a, b) => {
      const order = { critical: 0, warning: 1, info: 2 };
      return (order[a.severity] ?? 3) - (order[b.severity] ?? 3);
    });

    for (const issue of sorted) {
      lines.push(this.formatIssueTerm(issue, width));
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Format a single issue for terminal display.
   */
  private formatIssueTerm(issue: ReviewIssue, width: number): string {
    const lines: string[] = [];

    // Severity badge + category
    const badge = formatSeverityBadge(issue.severity);
    const cat = formatCategoryLabel(issue.category);
    lines.push('    ' + badge + '  ' + cat);

    // File reference with line number
    const fileRef = formatFileRef(issue.file, issue.line);
    lines.push('      ' + ANSI.dim + 'Location: ' + ANSI.reset + fileRef);

    // Message (wrapped)
    const msgLines = wrapText(issue.message, width - 8);
    lines.push('      ' + ANSI.bold + 'Issue: ' + ANSI.reset + msgLines.join('\n          '));

    // Suggestion (wrapped)
    const sugLines = wrapText(issue.suggestion, width - 8);
    lines.push('      ' + ANSI.green + 'Suggestion: ' + ANSI.reset + sugLines.join('\n             '));

    // Rule ID if present
    if (issue.ruleId) {
      lines.push('      ' + ANSI.gray + 'Rule: ' + issue.ruleId + ANSI.reset);
    }

    return lines.join('\n');
  }

  /**
   * Format the diff/file changes summary as an ASCII table.
   */
  private formatDiffSummary(diff: DiffFile[], width: number): string {
    const lines: string[] = [];

    lines.push('  ' + ANSI.bold + 'CHANGES OVERVIEW' + ANSI.reset);
    lines.push('  ' + horizontalLine(width - 4));

    for (const file of diff) {
      const statusColor =
        file.status === 'added'
          ? ANSI.green
          : file.status === 'deleted'
            ? ANSI.red
            : file.status === 'renamed'
              ? ANSI.magenta
              : ANSI.yellow;

      const statusLabel = file.status.toUpperCase();

      const addStr =
        file.additions > 0
          ? ANSI.green + '+' + file.additions + ANSI.reset
          : '';
      const delStr =
        file.deletions > 0
          ? ANSI.red + '-' + file.deletions + ANSI.reset
          : '';

      lines.push(
        '    ' +
          statusColor +
          padRight(statusLabel, 10) +
          ANSI.reset +
          file.path +
          '  ' +
          addStr +
          ' ' +
          delStr,
      );
    }

    lines.push('');
    return lines.join('\n');
  }

  /**
   * Format category breakdown as a table.
   */
  private formatCategoryBreakdown(review: CodeReview, width: number): string {
    const categories = Object.entries(review.summary.categories);
    if (categories.length === 0) return '';

    const lines: string[] = [];

    lines.push('  ' + ANSI.bold + 'ISSUES BY CATEGORY' + ANSI.reset);
    lines.push('  ' + horizontalLine(width - 4));

    const sorted = categories.sort(([, a], [, b]) => b - a);
    const headers = ['Category', 'Count'];
    const rows = sorted.map(([cat, count]) => [
      cat.replace(/_/g, ' '),
      String(count),
    ]);

    lines.push(createTable(headers, rows));
    lines.push('');

    return lines.join('\n');
  }

  /**
   * Format the overall assessment explanation.
   */
  private formatExplanation(explanation: string, width: number): string {
    const lines: string[] = [];

    lines.push('  ' + ANSI.bold + 'OVERALL ASSESSMENT' + ANSI.reset);
    lines.push('  ' + horizontalLine(width - 4));

    const wrapped = wrapText(explanation, width - 6);
    for (const w of wrapped) {
      lines.push('    ' + w);
    }

    lines.push('');
    return lines.join('\n');
  }

  /**
   * Format the report footer.
   */
  private formatFooter(width: number): string {
    return [
      doubleLine(width),
      centerText('Generated by MCP Code Review Tool', width),
      doubleLine(width),
    ].join('\n');
  }
}
