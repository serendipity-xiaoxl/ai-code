// ============================================================
// MCP Code Review Tool - HTML Reporter Tests
// ============================================================

import { describe, it, expect } from 'bun:test';
import { HtmlReporter } from '../../src/reporter/html-reporter';
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
        message: 'Hardcoded API key detected',
        suggestion: 'Use environment variable',
        ruleId: 'R004',
      },
      {
        severity: 'warning',
        category: 'best_practice',
        file: 'src/index.ts',
        line: 15,
        message: 'Console.log in production',
        suggestion: 'Remove or use proper logger',
      },
    ],
    summary: {
      totalIssues: 2,
      criticalCount: 1,
      warningCount: 1,
      infoCount: 0,
      categories: { security: 1, best_practice: 1 },
      filesReviewed: 1,
      totalLines: 50,
      overallScore: 80,
      durationMs: 1234,
    },
    explanation: 'Found issues that should be addressed.',
    ...overrides,
  };
}

describe('HtmlReporter', () => {
  it('should generate valid HTML document', () => {
    const review = createMockReview();
    const reporter = new HtmlReporter();
    const output = reporter.generate(review);

    expect(output).toContain('<!DOCTYPE html>');
    expect(output).toContain('<html');
    expect(output).toContain('</html>');
  });

  it('should include review ID in title', () => {
    const review = createMockReview();
    const reporter = new HtmlReporter();
    const output = reporter.generate(review);

    expect(output).toContain('rev-test-001');
  });

  it('should include quality score', () => {
    const review = createMockReview();
    const reporter = new HtmlReporter();
    const output = reporter.generate(review);

    expect(output).toContain('80');
    expect(output).toContain('Quality Score');
  });

  it('should include issue details', () => {
    const review = createMockReview();
    const reporter = new HtmlReporter();
    const output = reporter.generate(review);

    expect(output).toContain('Hardcoded API key detected');
    expect(output).toContain('Console.log in production');
  });

  it('should include severity badges', () => {
    const review = createMockReview();
    const reporter = new HtmlReporter();
    const output = reporter.generate(review);

    expect(output).toContain('sev-critical');
    expect(output).toContain('sev-warning');
  });

  it('should include summary stats', () => {
    const review = createMockReview();
    const reporter = new HtmlReporter();
    const output = reporter.generate(review);

    expect(output).toContain('Critical');
    expect(output).toContain('Warnings');
    expect(output).toContain('Total Issues');
  });

  it('should include overall assessment section', () => {
    const review = createMockReview();
    const reporter = new HtmlReporter();
    const output = reporter.generate(review);

    expect(output).toContain('Overall Assessment');
    expect(output).toContain('Found issues that should be addressed.');
  });

  it('should handle empty issues', () => {
    const review = createMockReview({
      issues: [],
      summary: {
        totalIssues: 0, criticalCount: 0, warningCount: 0, infoCount: 0,
        categories: {}, filesReviewed: 1, totalLines: 10, overallScore: 100, durationMs: 100,
      },
    });

    const reporter = new HtmlReporter();
    const output = reporter.generate(review);
    expect(output).toContain('No issues found');
  });

  it('should handle missing explanation', () => {
    const review = createMockReview({ explanation: undefined } as never);
    const reporter = new HtmlReporter();
    const output = reporter.generate(review);

    // Should not crash, and should still render other sections
    expect(output).toContain('Code Review Report');
  });

  it('should render changes overview when diff exists', () => {
    const review = createMockReview();
    const reporter = new HtmlReporter();
    const output = reporter.generate(review);

    expect(output).toContain('Changes Overview');
    expect(output).toContain('src/index.ts');
    expect(output).toContain('+5');
    expect(output).toContain('-2');
  });

  it('should skip changes overview when diff is empty', () => {
    const review = createMockReview({
      diff: [],
      files: [],
    });
    const reporter = new HtmlReporter();
    const output = reporter.generate(review);

    expect(output).not.toContain('Changes Overview');
  });

  it('should render issues by category when categories exist', () => {
    const review = createMockReview();
    const reporter = new HtmlReporter();
    const output = reporter.generate(review);

    expect(output).toContain('Issues by Category');
    expect(output).toContain('security');
    expect(output).toContain('best practice');
  });

  it('should skip categories section when no categories', () => {
    const review = createMockReview({
      issues: [],
      summary: {
        totalIssues: 0, criticalCount: 0, warningCount: 0, infoCount: 0,
        categories: {}, filesReviewed: 0, totalLines: 0, overallScore: 100, durationMs: 0,
      },
    });
    const reporter = new HtmlReporter();
    const output = reporter.generate(review);

    expect(output).not.toContain('Issues by Category');
  });

  it('should include footer', () => {
    const review = createMockReview();
    const reporter = new HtmlReporter();
    const output = reporter.generate(review);

    expect(output).toContain('Generated by MCP Code Review Tool');
  });

  it('should include embedded CSS styles', () => {
    const review = createMockReview();
    const reporter = new HtmlReporter();
    const output = reporter.generate(review);

    expect(output).toContain('<style>');
    expect(output).toContain('</style>');
    expect(output).toContain('font-family');
    expect(output).toContain('background');
  });
});
