// ============================================================
// MCP Code Review Tool - HTML Report Generator
//
// Generates standalone HTML code review reports with
// embedded CSS styling.
// ============================================================

import type { CodeReview, ReviewIssue } from '../types';
import { getLogger } from '../utils/logger';

/**
 * Generates standalone HTML code review reports.
 */
export class HtmlReporter {
  private logger;

  constructor() {
    this.logger = getLogger();
  }

  /**
   * Generate a complete HTML report.
   */
  generate(review: CodeReview): string {
    this.logger.info('Generating HTML report');

    const summary = review.summary;
    const score = summary.overallScore;

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Code Review Report - ${this.escapeHtml(review.id)}</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    line-height: 1.6; color: #1a1a2e; background: #f5f5f5; padding: 20px;
  }
  .container { max-width: 960px; margin: 0 auto; }
  .header {
    background: linear-gradient(135deg, #16213e, #1a1a2e);
    color: #fff; padding: 30px; border-radius: 8px; margin-bottom: 24px;
  }
  .header h1 { font-size: 24px; margin-bottom: 8px; }
  .header .meta { color: #a0a0b0; font-size: 14px; }

  .card {
    background: #fff; border-radius: 8px; padding: 24px; margin-bottom: 20px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  }
  .card h2 { font-size: 18px; color: #16213e; margin-bottom: 16px; }

  .score-display { text-align: center; padding: 24px; }
  .score-circle {
    display: inline-block; width: 120px; height: 120px; border-radius: 50%;
    background: conic-gradient(${this.scoreColor(score)} ${score}%, #e0e0e0 ${score}%);
    display: flex; align-items: center; justify-content: center; margin: 0 auto 16px;
  }
  .score-inner {
    width: 90px; height: 90px; border-radius: 50%; background: #fff;
    display: flex; align-items: center; justify-content: center;
    font-size: 28px; font-weight: bold; color: ${this.scoreColor(score)};
  }

  .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 12px; }
  .stat-item { text-align: center; padding: 12px; background: #f8f9fa; border-radius: 6px; }
  .stat-value { font-size: 24px; font-weight: bold; color: #16213e; }
  .stat-label { font-size: 12px; color: #666; text-transform: uppercase; letter-spacing: 0.5px; }

  .issue-list { list-style: none; }
  .issue-item {
    padding: 16px; border-left: 4px solid #ccc; margin-bottom: 12px;
    background: #f8f9fa; border-radius: 0 6px 6px 0;
  }
  .issue-critical { border-left-color: #e74c3c; }
  .issue-warning { border-left-color: #f39c12; }
  .issue-info { border-left-color: #3498db; }

  .severity-badge {
    display: inline-block; padding: 2px 8px; border-radius: 3px;
    font-size: 11px; font-weight: bold; text-transform: uppercase;
  }
  .sev-critical { background: #e74c3c; color: #fff; }
  .sev-warning { background: #f39c12; color: #fff; }
  .sev-info { background: #3498db; color: #fff; }

  .category-tag {
    display: inline-block; padding: 2px 6px; border-radius: 3px;
    background: #e0e0e0; font-size: 11px; margin-left: 6px;
  }
  .issue-location { font-family: monospace; font-size: 13px; color: #666; margin: 6px 0; }
  .issue-message { font-weight: 600; margin: 4px 0; }
  .issue-suggestion { color: #27ae60; font-size: 14px; margin-top: 4px; }
  .issue-rule { color: #999; font-size: 12px; margin-top: 2px; }

  .explanation { font-size: 15px; line-height: 1.7; color: #333; }
  .footer { text-align: center; color: #999; font-size: 12px; padding: 20px; }
</style>
</head>
<body>
<div class="container">

  <div class="header">
    <h1>Code Review Report</h1>
    <div class="meta">
      ID: ${this.escapeHtml(review.id)} |
      Date: ${this.escapeHtml(review.timestamp)} |
      Files: ${summary.filesReviewed} |
      Duration: ${summary.durationMs}ms
    </div>
  </div>

  <div class="card score-display">
    <div class="score-circle"><div class="score-inner">${score}</div></div>
    <h2>Quality Score: ${score}/100</h2>
  </div>

  <div class="card">
    <h2>Summary</h2>
    <div class="stats-grid">
      <div class="stat-item">
        <div class="stat-value">${summary.totalIssues}</div>
        <div class="stat-label">Total Issues</div>
      </div>
      <div class="stat-item">
        <div class="stat-value" style="color: ${summary.criticalCount > 0 ? '#e74c3c' : '#27ae60'}">
          ${summary.criticalCount}
        </div>
        <div class="stat-label">Critical</div>
      </div>
      <div class="stat-item">
        <div class="stat-value" style="color: ${summary.warningCount > 0 ? '#f39c12' : '#27ae60'}">
          ${summary.warningCount}
        </div>
        <div class="stat-label">Warnings</div>
      </div>
      <div class="stat-item">
        <div class="stat-value">${summary.infoCount}</div>
        <div class="stat-label">Info</div>
      </div>
      <div class="stat-item">
        <div class="stat-value">${summary.filesReviewed}</div>
        <div class="stat-label">Files</div>
      </div>
      <div class="stat-item">
        <div class="stat-value">${summary.totalLines}</div>
        <div class="stat-label">Lines</div>
      </div>
    </div>
  </div>

  ${this.issuesHtml(review)}
  ${this.changesHtml(review)}
  ${this.categoriesHtml(review)}

  ${review.explanation ? `
  <div class="card">
    <h2>Overall Assessment</h2>
    <div class="explanation">${this.escapeHtml(review.explanation)}</div>
  </div>
  ` : ''}

  <div class="footer">
    Generated by MCP Code Review Tool
  </div>

</div>
</body>
</html>`;
  }

  /**
   * Generate the issues section HTML.
   */
  private issuesHtml(review: CodeReview): string {
    if (review.issues.length === 0) {
      return `<div class="card"><h2>Issues</h2><p>No issues found. The code looks clean.</p></div>`;
    }

    const critical = review.issues.filter((i) => i.severity === 'critical');
    const warnings = review.issues.filter((i) => i.severity === 'warning');
    const info = review.issues.filter((i) => i.severity === 'info');

    let html = '<div class="card"><h2>Issues (' + review.issues.length + ' total)</h2>';

    if (critical.length > 0) {
      html += '<h3 style="color:#e74c3c;margin-bottom:12px;">Critical (' + critical.length + ')</h3>';
      html += this.issueGroupHtml(critical);
    }
    if (warnings.length > 0) {
      html += '<h3 style="color:#f39c12;margin-bottom:12px;">Warnings (' + warnings.length + ')</h3>';
      html += this.issueGroupHtml(warnings);
    }
    if (info.length > 0) {
      html += '<h3 style="color:#3498db;margin-bottom:12px;">Info (' + info.length + ')</h3>';
      html += this.issueGroupHtml(info);
    }

    html += '</div>';
    return html;
  }

  /**
   * HTML for a group of issues.
   */
  private issueGroupHtml(issues: ReviewIssue[]): string {
    const items = issues.map(
      (issue) => `
    <div class="issue-item issue-${issue.severity}">
      <div>
        <span class="severity-badge sev-${issue.severity}">${issue.severity}</span>
        <span class="category-tag">${issue.category.replace(/_/g, ' ')}</span>
      </div>
      <div class="issue-location">${this.escapeHtml(issue.file)}${issue.line ? ':' + issue.line : ''}${issue.column ? ':' + issue.column : ''}</div>
      <div class="issue-message">${this.escapeHtml(issue.message)}</div>
      <div class="issue-suggestion">Suggestion: ${this.escapeHtml(issue.suggestion)}</div>
      ${issue.ruleId ? '<div class="issue-rule">Rule: ' + issue.ruleId + '</div>' : ''}
    </div>`,
    );

    return '<div class="issue-list">' + items.join('') + '</div>';
  }

  /**
   * Generate changes overview HTML.
   */
  private changesHtml(review: CodeReview): string {
    if (review.diff.length === 0) return '';

    const rows = review.diff
      .map(
        (f) => `
    <tr>
      <td style="padding:6px 8px;border-bottom:1px solid #eee;font-family:monospace">${this.escapeHtml(f.path)}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #eee">${f.status}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #eee;color:#27ae60">+${f.additions}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #eee;color:#e74c3c">-${f.deletions}</td>
    </tr>`,
      )
      .join('');

    return `
    <div class="card">
      <h2>Changes Overview</h2>
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr style="background:#f0f0f0;text-align:left">
            <th style="padding:8px;border-bottom:2px solid #ddd">File</th>
            <th style="padding:8px;border-bottom:2px solid #ddd">Status</th>
            <th style="padding:8px;border-bottom:2px solid #ddd">Additions</th>
            <th style="padding:8px;border-bottom:2px solid #ddd">Deletions</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
  }

  /**
   * Generate categories section HTML.
   */
  private categoriesHtml(review: CodeReview): string {
    const categories = Object.entries(review.summary.categories);
    if (categories.length === 0) return '';

    const rows = categories
      .sort(([, a], [, b]) => b - a)
      .map(
        ([cat, count]) => `
    <tr>
      <td style="padding:6px 8px;border-bottom:1px solid #eee">${cat.replace(/_/g, ' ')}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #eee;font-weight:bold">${count}</td>
    </tr>`,
      )
      .join('');

    return `
    <div class="card">
      <h2>Issues by Category</h2>
      <table style="width:auto;border-collapse:collapse;">
        <thead>
          <tr style="background:#f0f0f0;text-align:left">
            <th style="padding:8px;border-bottom:2px solid #ddd">Category</th>
            <th style="padding:8px;border-bottom:2px solid #ddd">Count</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
  }

  /**
   * Map score to a color.
   */
  private scoreColor(score: number): string {
    if (score >= 90) return '#27ae60';
    if (score >= 70) return '#f39c12';
    if (score >= 50) return '#e67e22';
    return '#e74c3c';
  }

  /**
   * Escape HTML special characters.
   */
  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
