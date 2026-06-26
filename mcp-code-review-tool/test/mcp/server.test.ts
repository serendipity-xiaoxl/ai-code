// ============================================================
// MCP Code Review Tool - MCP Server Tests
//
// Tests server construction, formatting, and resource methods
// without requiring MCP transport connections.
// ============================================================

import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import type { CodeReview, ReportFormat } from '../../src/types';

describe('McpReviewServer', () => {
  describe('constructor', () => {
    it('should construct with config', async () => {
      const { McpReviewServer } = await import('../../src/mcp/server');

      const server = new McpReviewServer({
        modelProvider: 'openai',
        modelName: 'gpt-4o',
        apiKey: 'test-key',
      });
      expect(server).toBeDefined();
    });

    it('should construct without config', async () => {
      const { McpReviewServer } = await import('../../src/mcp/server');

      const server = new McpReviewServer();
      expect(server).toBeDefined();
    });
  });

  describe('formatReport', () => {
    it('should format terminal report by default', async () => {
      const { McpReviewServer } = await import('../../src/mcp/server');

      const server = new McpReviewServer({
        modelProvider: 'openai',
        modelName: 'gpt-4o',
        apiKey: 'test-key',
      });

      const review: CodeReview = {
        id: 'test-1',
        timestamp: '2026-06-26T00:00:00.000Z',
        config: { modelProvider: 'openai', modelName: 'gpt-4o', apiKey: 'test-key' },
        files: [],
        diff: [],
        issues: [],
        summary: {
          totalIssues: 0, criticalCount: 0, warningCount: 0, infoCount: 0,
          categories: {}, filesReviewed: 0, totalLines: 0, overallScore: 100, durationMs: 0,
        },
        explanation: '',
      };

      const result = (server as unknown as {
        formatReport(review: CodeReview, format: ReportFormat): string;
      }).formatReport(review, 'terminal');

      expect(result).toBeString();
      expect(result.length).toBeGreaterThan(0);
    });

    it('should format JSON report', async () => {
      const { McpReviewServer } = await import('../../src/mcp/server');

      const server = new McpReviewServer({
        modelProvider: 'openai',
        modelName: 'gpt-4o',
        apiKey: 'test-key',
      });

      const review: CodeReview = {
        id: 'test-json',
        timestamp: '2026-06-26T00:00:00.000Z',
        config: { modelProvider: 'openai', modelName: 'gpt-4o', apiKey: 'test-key' },
        files: [],
        diff: [],
        issues: [],
        summary: {
          totalIssues: 0, criticalCount: 0, warningCount: 0, infoCount: 0,
          categories: {}, filesReviewed: 0, totalLines: 0, overallScore: 100, durationMs: 0,
        },
        explanation: '',
      };

      const result = (server as unknown as {
        formatReport(review: CodeReview, format: ReportFormat): string;
      }).formatReport(review, 'json');

      const parsed = JSON.parse(result);
      expect(parsed.id).toBe('test-json');
    });

    it('should format markdown report', async () => {
      const { McpReviewServer } = await import('../../src/mcp/server');

      const server = new McpReviewServer({
        modelProvider: 'openai',
        modelName: 'gpt-4o',
        apiKey: 'test-key',
      });

      const review: CodeReview = {
        id: 'test-md',
        timestamp: '2026-06-26T00:00:00.000Z',
        config: { modelProvider: 'openai', modelName: 'gpt-4o', apiKey: 'test-key' },
        files: [],
        diff: [],
        issues: [],
        summary: {
          totalIssues: 0, criticalCount: 0, warningCount: 0, infoCount: 0,
          categories: {}, filesReviewed: 0, totalLines: 0, overallScore: 100, durationMs: 0,
        },
        explanation: '',
      };

      const result = (server as unknown as {
        formatReport(review: CodeReview, format: ReportFormat): string;
      }).formatReport(review, 'markdown');

      expect(result).toContain('# Code Review Report');
    });
  });

  describe('resource handlers', () => {
    it('should return not-found for unknown review summary', async () => {
      const { McpReviewServer } = await import('../../src/mcp/server');

      const server = new McpReviewServer({
        modelProvider: 'openai',
        modelName: 'gpt-4o',
        apiKey: 'test-key',
      });

      const result = (server as unknown as {
        getReviewSummaryResource(reviewId: string): { contents: Array<{ uri: string; text: string }> };
      }).getReviewSummaryResource('nonexistent');

      expect(result.contents[0]?.text).toContain('Review not found');
    });

    it('should return not-found for unknown review issues', async () => {
      const { McpReviewServer } = await import('../../src/mcp/server');

      const server = new McpReviewServer({
        modelProvider: 'openai',
        modelName: 'gpt-4o',
        apiKey: 'test-key',
      });

      const result = (server as unknown as {
        getReviewIssuesResource(reviewId: string): { contents: Array<{ uri: string; text: string }> };
      }).getReviewIssuesResource('nonexistent');

      expect(result.contents[0]?.text).toContain('Review not found');
    });

    it('should return rules resource', async () => {
      const { McpReviewServer } = await import('../../src/mcp/server');

      const server = new McpReviewServer({
        modelProvider: 'openai',
        modelName: 'gpt-4o',
        apiKey: 'test-key',
      });

      const result = (server as unknown as {
        getRulesResource(): { contents: Array<{ uri: string; text: string }> };
      }).getRulesResource();

      expect(result.contents[0]?.uri).toBe('review://rules');
      expect(result.contents[0]?.text).toContain('R001');
    });
  });
});
