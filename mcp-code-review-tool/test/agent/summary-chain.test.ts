// ============================================================
// MCP Code Review Tool - Summary Chain Tests
// ============================================================

import { describe, it, expect } from 'bun:test';
import { SummaryChain } from '../../src/agent/summary-chain';
import type { CodeReview } from '../../src/types';

describe('SummaryChain', () => {
  it('should construct without config', () => {
    const chain = new SummaryChain();
    expect(chain).toBeDefined();
  });

  describe('getReviewStatus', () => {
    it('should return PASS for high scores', () => {
      const chain = new SummaryChain();
      expect(chain.getReviewStatus({ overallScore: 95 } as never)).toBe('PASS');
      expect(chain.getReviewStatus({ overallScore: 90 } as never)).toBe('PASS');
    });

    it('should return PASS_WITH_WARNINGS for medium scores', () => {
      const chain = new SummaryChain();
      expect(chain.getReviewStatus({ overallScore: 85 } as never)).toBe('PASS_WITH_WARNINGS');
      expect(chain.getReviewStatus({ overallScore: 70 } as never)).toBe('PASS_WITH_WARNINGS');
    });

    it('should return FAIL for low scores', () => {
      const chain = new SummaryChain();
      expect(chain.getReviewStatus({ overallScore: 69 } as never)).toBe('FAIL');
      expect(chain.getReviewStatus({ overallScore: 0 } as never)).toBe('FAIL');
    });
  });

  describe('getQualityLabel', () => {
    it('should return Excellent for 95+', () => {
      const chain = new SummaryChain();
      expect(chain.getQualityLabel(100)).toBe('Excellent');
      expect(chain.getQualityLabel(95)).toBe('Excellent');
    });

    it('should return Good for 85+', () => {
      const chain = new SummaryChain();
      expect(chain.getQualityLabel(90)).toBe('Good');
      expect(chain.getQualityLabel(85)).toBe('Good');
    });

    it('should return Fair for 70+', () => {
      const chain = new SummaryChain();
      expect(chain.getQualityLabel(75)).toBe('Fair');
      expect(chain.getQualityLabel(70)).toBe('Fair');
    });

    it('should return Needs Improvement for 50+', () => {
      const chain = new SummaryChain();
      expect(chain.getQualityLabel(60)).toBe('Needs Improvement');
      expect(chain.getQualityLabel(50)).toBe('Needs Improvement');
    });

    it('should return Poor for <50', () => {
      const chain = new SummaryChain();
      expect(chain.getQualityLabel(30)).toBe('Poor');
      expect(chain.getQualityLabel(0)).toBe('Poor');
    });
  });

  describe('getTopIssues', () => {
    it('should return top N most severe issues', () => {
      const chain = new SummaryChain();
      const review: CodeReview = {
        id: 'test',
        timestamp: '2026-01-01',
        config: { modelProvider: 'openai', modelName: 'gpt-4o', apiKey: 'key' },
        files: [],
        diff: [],
        issues: [
          { severity: 'info', category: 'code_style', file: 'a.ts', line: 1, message: 'Info', suggestion: 'Fix' },
          { severity: 'warning', category: 'best_practice', file: 'b.ts', line: 2, message: 'Warning', suggestion: 'Fix' },
          { severity: 'critical', category: 'security', file: 'c.ts', line: 3, message: 'Critical', suggestion: 'Fix' },
        ],
        summary: {
          totalIssues: 3, criticalCount: 1, warningCount: 1, infoCount: 1,
          categories: { security: 1, best_practice: 1, code_style: 1 },
          filesReviewed: 3, totalLines: 100, overallScore: 70, durationMs: 100,
        },
        explanation: '',
      };

      const top = chain.getTopIssues(review, 2);
      expect(top.length).toBe(2);
      expect(top[0]?.severity).toBe('critical');
      expect(top[1]?.severity).toBe('warning');
    });

    it('should handle empty issues', () => {
      const chain = new SummaryChain();
      const review: CodeReview = {
        id: 'test',
        timestamp: '2026-01-01',
        config: { modelProvider: 'openai', modelName: 'gpt-4o', apiKey: 'key' },
        files: [],
        diff: [],
        issues: [],
        summary: {
          totalIssues: 0, criticalCount: 0, warningCount: 0, infoCount: 0,
          categories: {}, filesReviewed: 0, totalLines: 0, overallScore: 100, durationMs: 0,
        },
        explanation: '',
      };

      const top = chain.getTopIssues(review, 5);
      expect(top).toBeArray();
      expect(top.length).toBe(0);
    });
  });

  describe('generateSummary', () => {
    it('should return original summary when no model configured', async () => {
      const chain = new SummaryChain();
      const review: CodeReview = {
        id: 'test',
        timestamp: '2026-01-01',
        config: { modelProvider: 'openai', modelName: 'gpt-4o', apiKey: 'key' },
        files: [],
        diff: [],
        issues: [],
        summary: {
          totalIssues: 0, criticalCount: 0, warningCount: 0, infoCount: 0,
          categories: {}, filesReviewed: 0, totalLines: 0, overallScore: 100, durationMs: 0,
        },
        explanation: '',
      };

      const result = await chain.generateSummary(review);
      expect(result).toBe(review.summary);
    });
  });
});
