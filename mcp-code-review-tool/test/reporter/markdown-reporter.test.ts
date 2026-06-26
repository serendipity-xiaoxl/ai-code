// ============================================================
// MCP Code Review Tool - Markdown Reporter Tests
// ============================================================

import { describe, it, expect } from 'bun:test';
import { MarkdownReporter } from '../../src/reporter/markdown-reporter';
import type { CodeReview } from '../../src/types';

function createMockReview(overrides?: Partial<CodeReview>): CodeReview {
  return {
    id: 'rev-test-001',
    timestamp: '2026-06-26T10:00:00.000Z',
    config: {
      modelProvider: 'openai',
      modelName: 'gpt-4o',
      apiKey: 'test-key',
    },
    files: ['src/index.ts'],
    diff: [
      {
        path: 'src/index.ts',
        status: 'modified',
        additions: 5,
        deletions: 2,
        hunks: [],
      },
    ],
    issues: [
      {
        severity: 'critical',
        category: 'security',
        file: 'src/index.ts',
        line: 10,
        message: 'Hardcoded API key',
        suggestion: 'Use env variable',
        ruleId: 'R004',
      },
    ],
    summary: {
      totalIssues: 1,
      criticalCount: 1,
      warningCount: 0,
      infoCount: 0,
      categories: { security: 1 },
      filesReviewed: 1,
      totalLines: 50,
      overallScore: 85,
      durationMs: 1234,
    },
    explanation: 'Good code with minor issues.',
    ...overrides,
  };
}

describe('MarkdownReporter', () => {
  it('should generate a markdown report with title', () => {
    const review = createMockReview();
    const reporter = new MarkdownReporter();
    const output = reporter.generate(review);

    expect(output).toContain('# Code Review Report');
    expect(output).toContain('Review ID: rev-test-001');
  });

  it('should include issue details', () => {
    const review = createMockReview();
    const reporter = new MarkdownReporter();
    const output = reporter.generate(review);

    expect(output).toContain('Hardcoded API key');
    expect(output).toContain('Use env variable');
    expect(output).toContain('security');
  });

  it('should include quality score', () => {
    const review = createMockReview();
    const reporter = new MarkdownReporter();
    const output = reporter.generate(review);

    expect(output).toContain('85/100');
  });

  it('should include summary table', () => {
    const review = createMockReview();
    const reporter = new MarkdownReporter();
    const output = reporter.generate(review);

    expect(output).toContain('| Metric | Value |');
    expect(output).toContain('| Files Reviewed | 1 |');
  });

  it('should handle empty issues', () => {
    const review = createMockReview({
      issues: [],
      summary: {
        totalIssues: 0,
        criticalCount: 0,
        warningCount: 0,
        infoCount: 0,
        categories: {},
        filesReviewed: 1,
        totalLines: 10,
        overallScore: 100,
        durationMs: 100,
      },
    });

    const reporter = new MarkdownReporter();
    const output = reporter.generate(review);

    expect(output).toContain('No issues found');
  });

  it('should include overall assessment', () => {
    const review = createMockReview();
    const reporter = new MarkdownReporter();
    const output = reporter.generate(review);

    expect(output).toContain('## Overall Assessment');
    expect(output).toContain('Good code with minor issues.');
  });
});
