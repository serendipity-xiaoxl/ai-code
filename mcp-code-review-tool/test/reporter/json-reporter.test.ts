// ============================================================
// MCP Code Review Tool - JSON Reporter Tests
// ============================================================

import { describe, it, expect } from 'bun:test';
import { JsonReporter } from '../../src/reporter/json-reporter';
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
    diff: [],
    issues: [
      {
        severity: 'critical',
        category: 'security',
        file: 'src/index.ts',
        line: 10,
        message: 'Hardcoded API key',
        suggestion: 'Use env variable',
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
    explanation: 'Good code.',
    ...overrides,
  };
}

describe('JsonReporter', () => {
  it('should generate valid JSON', () => {
    const review = createMockReview();
    const reporter = new JsonReporter();
    const output = reporter.generate(review);

    const parsed = JSON.parse(output);
    expect(parsed.id).toBe('rev-test-001');
    expect(parsed.issues.length).toBe(1);
  });

  it('should include all review fields', () => {
    const review = createMockReview();
    const reporter = new JsonReporter();
    const output = reporter.generate(review);

    const parsed = JSON.parse(output);
    expect(parsed).toHaveProperty('id');
    expect(parsed).toHaveProperty('timestamp');
    expect(parsed).toHaveProperty('config');
    expect(parsed).toHaveProperty('files');
    expect(parsed).toHaveProperty('diff');
    expect(parsed).toHaveProperty('issues');
    expect(parsed).toHaveProperty('summary');
    expect(parsed).toHaveProperty('explanation');
  });

  it('should generate compact JSON', () => {
    const review = createMockReview();
    const reporter = new JsonReporter();
    const output = reporter.generateCompact(review);

    // Compact JSON has no whitespace
    expect(output).not.toContain('\n');
    JSON.parse(output); // Should still be valid
  });

  it('should generate critical-only report', () => {
    const review = createMockReview({
      issues: [
        { severity: 'critical', category: 'bug', file: 'a.ts', line: 1, message: 'Bug', suggestion: 'Fix' },
        { severity: 'warning', category: 'code_style', file: 'a.ts', line: 2, message: 'Style', suggestion: 'Format' },
      ],
      summary: {
        totalIssues: 2,
        criticalCount: 1,
        warningCount: 1,
        infoCount: 0,
        categories: { bug: 1, code_style: 1 },
        filesReviewed: 1,
        totalLines: 20,
        overallScore: 80,
        durationMs: 500,
      },
    });

    const reporter = new JsonReporter();
    const output = reporter.generateCriticalOnly(review);

    const parsed = JSON.parse(output);
    expect(parsed.issues.length).toBe(1);
    expect(parsed.issues[0]?.severity).toBe('critical');
  });

  it('should generate grouped report', () => {
    const review = createMockReview();
    const reporter = new JsonReporter();
    const output = reporter.generateGrouped(review);

    const parsed = JSON.parse(output);
    expect(parsed).toHaveProperty('meta');
    expect(parsed).toHaveProperty('bySeverity');
    expect(parsed).toHaveProperty('byCategory');
    expect(parsed.bySeverity.critical.length).toBe(1);
  });
});
