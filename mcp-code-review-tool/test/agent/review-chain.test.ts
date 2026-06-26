// ============================================================
// MCP Code Review Tool - Review Chain Tests
//
// Tests the core orchestration logic without LLM calls.
// ============================================================

import { describe, it, expect } from 'bun:test';
import { ReviewChain } from '../../src/agent/review-chain';
import type { ReviewConfig, ReviewIssue } from '../../src/types';

describe('ReviewChain', () => {
  const testConfig: ReviewConfig = {
    modelProvider: 'openai',
    modelName: 'gpt-4o',
    apiKey: 'test-key',
  };

  it('should construct with valid config', () => {
    const chain = new ReviewChain(testConfig);
    expect(chain).toBeDefined();
  });

  it('should get git analyzer instance', () => {
    const chain = new ReviewChain(testConfig, process.cwd());
    const gitAnalyzer = chain.getGitAnalyzer();
    expect(gitAnalyzer).toBeDefined();
  });

  describe('reviewFiles', () => {
    it('should handle empty files map (no AI call needed)', async () => {
      const chain = new ReviewChain(testConfig);
      const result = await chain.reviewFiles(new Map());
      expect(result.issues).toBeArray();
      expect(result.summary.totalIssues).toBe(0);
      expect(result.files).toBeArray();
      expect(result.files.length).toBe(0);
    });

    // Note: reviewFiles with actual file content triggers AI analysis (LLM API call).
    // AI analysis tests are covered in ai-analyzer.test.ts.
    // Integration tests with real LLM should use --timeout flag or mock.
  });

  describe('generateSummary', () => {
    it('should calculate summary stats correctly', () => {
      const chain = new ReviewChain(testConfig);
      const startTime = Date.now();
      const summary = (chain as unknown as {
        generateSummary(
          issues: ReviewIssue[],
          filesReviewed: number,
          totalLines: number,
          startTime: number,
        ): {
          totalIssues: number;
          criticalCount: number;
          warningCount: number;
          infoCount: number;
          categories: Record<string, number>;
          filesReviewed: number;
          totalLines: number;
          overallScore: number;
          durationMs: number;
        };
      }).generateSummary(
        [
          { severity: 'critical', category: 'security', file: 'a.ts', line: 1, message: 'C1', suggestion: 'Fix' },
          { severity: 'critical', category: 'security', file: 'b.ts', line: 2, message: 'C2', suggestion: 'Fix' },
          { severity: 'warning', category: 'performance', file: 'c.ts', line: 3, message: 'W1', suggestion: 'Fix' },
          { severity: 'info', category: 'code_style', file: 'd.ts', line: 4, message: 'I1', suggestion: 'Fix' },
        ],
        4,
        200,
        startTime,
      );

      expect(summary.totalIssues).toBe(4);
      expect(summary.criticalCount).toBe(2);
      expect(summary.warningCount).toBe(1);
      expect(summary.infoCount).toBe(1);
      expect(summary.filesReviewed).toBe(4);
      expect(summary.totalLines).toBe(200);
      expect(summary.categories).toHaveProperty('security', 2);
      expect(summary.categories).toHaveProperty('performance', 1);
      expect(summary.categories).toHaveProperty('code_style', 1);
      // Score: 100 - (2*15) - (1*5) - (1*1) = 100 - 30 - 5 - 1 = 64
      expect(summary.overallScore).toBe(64);
    });

    it('should return 100 score for no issues', () => {
      const chain = new ReviewChain(testConfig);
      const summary = (chain as unknown as {
        generateSummary(
          issues: ReviewIssue[],
          filesReviewed: number,
          totalLines: number,
          startTime: number,
        ): { overallScore: number };
      }).generateSummary([], 0, 0, Date.now());

      expect(summary.overallScore).toBe(100);
    });

    it('should floor score at 0', () => {
      const chain = new ReviewChain(testConfig);
      const summary = (chain as unknown as {
        generateSummary(
          issues: ReviewIssue[],
          filesReviewed: number,
          totalLines: number,
          startTime: number,
        ): { overallScore: number };
      }).generateSummary(
        Array(10).fill({
          severity: 'critical' as const,
          category: 'bug' as const,
          file: 'a.ts',
          line: 1,
          message: 'Bug',
          suggestion: 'Fix',
        }),
        1,
        100,
        Date.now(),
      );

      // 100 - (10 * 15) = -50, floored to 0
      expect(summary.overallScore).toBe(0);
    });
  });

  describe('generateExplanation', () => {
    it('should return clean message when no issues found', async () => {
      const chain = new ReviewChain(testConfig);
      const result = await (chain as unknown as {
        generateExplanation(
          issues: ReviewIssue[],
          summary: { totalIssues: number; criticalCount: number; warningCount: number; infoCount: number; overallScore: number },
        ): Promise<string>;
      }).generateExplanation([], {
        totalIssues: 0, criticalCount: 0, warningCount: 0, infoCount: 0, overallScore: 100,
      });
      expect(result).toContain('No issues found');
    });

    it('should generate simple explanation for few issues', async () => {
      const chain = new ReviewChain(testConfig);
      const issues: ReviewIssue[] = [{
        severity: 'critical', category: 'security', file: 'test.ts', line: 1,
        message: 'Critical bug', suggestion: 'Fix it',
      }];
      const result = await (chain as unknown as {
        generateExplanation(
          issues: ReviewIssue[],
          summary: { totalIssues: number; criticalCount: number; warningCount: number; infoCount: number; overallScore: number },
        ): Promise<string>;
      }).generateExplanation(issues, {
        totalIssues: 1, criticalCount: 1, warningCount: 0, infoCount: 0, overallScore: 85,
      });
      expect(result).toContain('critical');
      expect(result).toContain('85');
    });
  });

  describe('generateReviewId', () => {
    it('should generate unique review IDs', () => {
      const chain = new ReviewChain(testConfig);
      const id1 = (chain as unknown as { generateReviewId(): string }).generateReviewId();
      const id2 = (chain as unknown as { generateReviewId(): string }).generateReviewId();
      expect(id1).toMatch(/^rev-/);
      expect(id1).not.toBe(id2);
    });
  });

  describe('deduplicateIssues', () => {
    it('should remove duplicates based on file, line, and message', () => {
      const chain = new ReviewChain(testConfig);
      const issues: ReviewIssue[] = [
        { severity: 'info', category: 'code_style', file: 'a.ts', line: 1, message: 'Same issue', suggestion: 'A' },
        { severity: 'warning', category: 'code_style', file: 'a.ts', line: 1, message: 'Same issue', suggestion: 'B' },
        { severity: 'info', category: 'code_style', file: 'b.ts', line: 2, message: 'Different', suggestion: 'C' },
      ];
      const deduped = (chain as unknown as {
        deduplicateIssues(issues: ReviewIssue[]): ReviewIssue[];
      }).deduplicateIssues(issues);

      expect(deduped.length).toBe(2);
      // Should keep the higher severity (warning > info)
      expect(deduped[0]?.severity).toBe('warning');
    });
  });

  describe('normalize methods', () => {
    it('should normalize severity values', () => {
      const chain = new ReviewChain(testConfig);
      const normalize = (chain as unknown as {
        normalizeSeverity(severity: string): 'critical' | 'warning' | 'info';
      }).normalizeSeverity;

      expect(normalize('critical')).toBe('critical');
      expect(normalize('high')).toBe('critical');
      expect(normalize('warning')).toBe('warning');
      expect(normalize('medium')).toBe('warning');
      expect(normalize('info')).toBe('info');
      expect(normalize('unknown')).toBe('info');
    });

    it('should normalize category values', () => {
      const chain = new ReviewChain(testConfig);
      const normalizeCat = (chain as unknown as {
        normalizeCategory(category: string): string;
      }).normalizeCategory;

      expect(normalizeCat('security')).toBe('security');
      expect(normalizeCat('performance')).toBe('performance');
      expect(normalizeCat('code_style')).toBe('code_style');
      expect(normalizeCat('unknown-cat')).toBe('best_practice');
      expect(normalizeCat('type safety')).toBe('type_safety');
    });

    it('should order severity by weight', () => {
      const chain = new ReviewChain(testConfig);
      const weight = (chain as unknown as {
        severityWeight(severity: ReviewIssue['severity']): number;
      }).severityWeight;

      expect(weight('critical')).toBe(3);
      expect(weight('warning')).toBe(2);
      expect(weight('info')).toBe(1);
    });
  });
});
