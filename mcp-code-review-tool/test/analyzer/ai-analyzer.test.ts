// ============================================================
// MCP Code Review Tool - AI Analyzer Tests
//
// Tests parsing and normalization logic without calling an LLM.
// ============================================================

import { describe, it, expect } from 'bun:test';
import { AiAnalyzer } from '../../src/analyzer/ai-analyzer';
import type { ReviewConfig } from '../../src/types';

describe('AiAnalyzer', () => {
  const testConfig: ReviewConfig = {
    modelProvider: 'openai',
    modelName: 'gpt-4o',
    apiKey: 'test-key',
  };

  it('should construct with valid config', () => {
    const analyzer = new AiAnalyzer(testConfig);
    expect(analyzer).toBeDefined();
  });

  describe('parseLlmResponse', () => {
    it('should handle non-JSON LLM response', () => {
      const analyzer = new AiAnalyzer(testConfig);
      const result = (analyzer as unknown as {
        parseLlmResponse(raw: string, defaultFile: string): { issues: Array<{ severity: string }>; explanation: string };
      }).parseLlmResponse('This is not JSON at all', 'test.ts');

      expect(result.issues).toBeArray();
      expect(result.issues.length).toBe(0);
      expect(result.explanation).toContain('Unable to parse');
    });

    it('should strip markdown code fences from JSON', () => {
      const analyzer = new AiAnalyzer(testConfig);
      const rawResponse = '```json\n{"issues":[],"explanation":"All good"}\n```';
      const result = (analyzer as unknown as {
        parseLlmResponse(raw: string, defaultFile: string): { issues: Array<unknown>; explanation: string };
      }).parseLlmResponse(rawResponse, 'test.ts');

      expect(result.explanation).toBe('All good');
    });

    it('should parse plain JSON without code fences', () => {
      const analyzer = new AiAnalyzer(testConfig);
      const rawResponse = '{"issues":[],"explanation":"Clean code"}';
      const result = (analyzer as unknown as {
        parseLlmResponse(raw: string, defaultFile: string): { issues: Array<unknown>; explanation: string };
      }).parseLlmResponse(rawResponse, 'test.ts');

      expect(result.explanation).toBe('Clean code');
    });

    it('should parse issues from JSON response', () => {
      const analyzer = new AiAnalyzer(testConfig);
      const rawResponse = JSON.stringify({
        issues: [
          {
            severity: 'critical',
            category: 'security',
            file: 'src/index.ts',
            line: 10,
            column: 5,
            message: 'Hardcoded API key',
            suggestion: 'Use env variable',
          },
        ],
        explanation: 'Found 1 issue',
      });

      const result = (analyzer as unknown as {
        parseLlmResponse(raw: string, defaultFile: string): { issues: Array<unknown>; explanation: string };
      }).parseLlmResponse(rawResponse, 'src/index.ts');

      expect(result.issues.length).toBe(1);
      expect(result.explanation).toBe('Found 1 issue');
    });

    it('should normalize severity values in parsed response', () => {
      const analyzer = new AiAnalyzer(testConfig);
      const rawResponse = JSON.stringify({
        issues: [
          { severity: 'HIGH', category: 'security', file: 'a.ts', message: 'High severity', suggestion: 'Fix' },
          { severity: 'medium', category: 'bug', file: 'b.ts', message: 'Medium severity', suggestion: 'Fix' },
          { severity: 'low', category: 'code_style', file: 'c.ts', message: 'Low severity', suggestion: 'Fix' },
        ],
        explanation: 'Issues found',
      });

      const result = (analyzer as unknown as {
        parseLlmResponse(raw: string, defaultFile: string): { issues: Array<{ severity: string }>; explanation: string };
      }).parseLlmResponse(rawResponse, 'test.ts');

      expect(result.issues[0]?.severity).toBe('critical');
      expect(result.issues[1]?.severity).toBe('warning');
      expect(result.issues[2]?.severity).toBe('info');
    });

    it('should normalize category values', () => {
      const analyzer = new AiAnalyzer(testConfig);
      const rawResponse = JSON.stringify({
        issues: [
          { severity: 'warning', category: 'type safety', file: 'a.ts', message: 'Type issue', suggestion: 'Fix' },
          { severity: 'warning', category: 'unknown-cat', file: 'b.ts', message: 'Unknown cat', suggestion: 'Fix' },
        ],
        explanation: '',
      });

      const result = (analyzer as unknown as {
        parseLlmResponse(raw: string, defaultFile: string): { issues: Array<{ category: string }>; explanation: string };
      }).parseLlmResponse(rawResponse, 'test.ts');

      expect(result.issues[0]?.category).toBe('type_safety');
      expect(result.issues[1]?.category).toBe('best_practice');
    });

    it('should handle missing issues array', () => {
      const analyzer = new AiAnalyzer(testConfig);
      const rawResponse = JSON.stringify({ explanation: 'No issues' });
      const result = (analyzer as unknown as {
        parseLlmResponse(raw: string, defaultFile: string): { issues: Array<unknown>; explanation: string };
      }).parseLlmResponse(rawResponse, 'test.ts');

      expect(result.issues).toBeArray();
      expect(result.issues.length).toBe(0);
    });

    it('should provide default explanation when missing', () => {
      const analyzer = new AiAnalyzer(testConfig);
      const rawResponse = JSON.stringify({ issues: [] });
      const result = (analyzer as unknown as {
        parseLlmResponse(raw: string, defaultFile: string): { issues: Array<unknown>; explanation: string };
      }).parseLlmResponse(rawResponse, 'test.ts');

      expect(result.explanation).toBe('No overall assessment provided.');
    });

    it('should fill missing fields with defaults', () => {
      const analyzer = new AiAnalyzer(testConfig);
      const rawResponse = JSON.stringify({
        issues: [{ severity: 'warning', category: 'bug', message: 'Bug' }],
        explanation: '',
      });

      const result = (analyzer as unknown as {
        parseLlmResponse(raw: string, defaultFile: string): { issues: Array<{ file: string; message: string; suggestion: string }>; explanation: string };
      }).parseLlmResponse(rawResponse, 'default-file.ts');

      expect(result.issues[0]?.file).toBe('default-file.ts');
      expect(result.issues[0]?.message).toBe('Bug');
      expect(result.issues[0]?.suggestion).toBe('No suggestion provided');
    });
  });
});
