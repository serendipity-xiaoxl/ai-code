// ============================================================
// MCP Code Review Tool - Fix Chain Tests
//
// Tests parseFixResponse and constructor logic without
// making actual LLM API calls.
// ============================================================

import { describe, it, expect } from 'bun:test';
import { FixChain } from '../../src/agent/fix-chain';
import type { ReviewConfig, ReviewIssue } from '../../src/types';

describe('FixChain', () => {
  const testConfig: ReviewConfig = {
    modelProvider: 'openai',
    modelName: 'gpt-4o',
    apiKey: 'test-key',
  };

  it('should construct with valid config', () => {
    const chain = new FixChain(testConfig);
    expect(chain).toBeDefined();
  });

  describe('parseFixResponse', () => {
    it('should parse valid JSON response', () => {
      const chain = new FixChain(testConfig);
      const issue: ReviewIssue = {
        severity: 'warning',
        category: 'best_practice',
        file: 'src/test.ts',
        line: 10,
        message: 'Unused variable',
        suggestion: 'Remove or use the variable',
      };

      const raw = JSON.stringify({
        original: 'const x = 1;',
        suggested: 'const x = 1; console.log(x);',
        reasoning: 'Use the variable instead of leaving it unused',
      });

      const result = (chain as unknown as {
        parseFixResponse(raw: string, issue: ReviewIssue): { file: string; original: string; suggested: string; reasoning: string };
      }).parseFixResponse(raw, issue);

      expect(result.file).toBe('src/test.ts');
      expect(result.original).toBe('const x = 1;');
      expect(result.suggested).toContain('console.log');
    });

    it('should strip markdown code fences from JSON', () => {
      const chain = new FixChain(testConfig);
      const issue: ReviewIssue = {
        severity: 'critical',
        category: 'security',
        file: 'src/test.ts',
        line: 5,
        message: 'Hardcoded secret',
        suggestion: 'Use env variable',
      };

      const raw = '```json\n{"original":"password: \\"secret\\"","suggested":"password: process.env.SECRET","reasoning":"Use env vars"}\n```';

      const result = (chain as unknown as {
        parseFixResponse(raw: string, issue: ReviewIssue): { file: string; original: string; suggested: string; reasoning: string };
      }).parseFixResponse(raw, issue);

      expect(result.original).toContain('password');
      expect(result.suggested).toContain('process.env');
    });

    it('should treat unparseable response as suggestion text', () => {
      const chain = new FixChain(testConfig);
      const issue: ReviewIssue = {
        severity: 'info',
        category: 'code_style',
        file: 'src/test.ts',
        line: 1,
        message: 'Style issue',
        suggestion: 'Format properly',
      };

      const result = (chain as unknown as {
        parseFixResponse(raw: string, issue: ReviewIssue): { file: string; original: string; suggested: string; reasoning: string };
      }).parseFixResponse('Fix this by formatting the code properly', issue);

      expect(result.original).toBe('');
      expect(result.suggested).toBe('Fix this by formatting the code properly');
      expect(result.reasoning).toBe('AI-generated fix suggestion');
    });

    it('should provide default reasoning when missing', () => {
      const chain = new FixChain(testConfig);
      const issue: ReviewIssue = {
        severity: 'warning',
        category: 'bug',
        file: 'src/test.ts',
        line: 3,
        message: 'Bug',
        suggestion: 'Fix it',
      };

      const raw = JSON.stringify({
        original: 'x + y;',
        suggested: 'x + y + z;',
      });

      const result = (chain as unknown as {
        parseFixResponse(raw: string, issue: ReviewIssue): { file: string; original: string; suggested: string; reasoning: string };
      }).parseFixResponse(raw, issue);

      expect(result.reasoning).toBe('No reasoning provided');
    });
  });

  describe('generateFixes', () => {
    it('should handle missing file content gracefully (no LLM call)', async () => {
      const chain = new FixChain(testConfig);
      const contents = new Map<string, string>();
      const issues: ReviewIssue[] = [{
        severity: 'warning', category: 'best_practice', file: 'nonexistent.ts',
        line: 1, message: 'Issue', suggestion: 'Fix',
      }];

      const fixes = await chain.generateFixes(contents, issues);
      expect(fixes).toBeArray();
      expect(fixes.length).toBe(0);
    });
  });
});
