// ============================================================
// MCP Code Review Tool - MCP Tools Tests
// ============================================================

import { describe, it, expect, afterEach } from 'bun:test';
import {
  REVIEW_CODE_TOOL,
  REVIEW_GIT_DIFF_TOOL,
  GET_FIX_TOOL,
  LIST_RULES_TOOL,
  ALL_TOOLS,
  parseToolArgs,
  getConfigFromEnv,
} from '../../src/mcp/tools';

describe('MCP Tools', () => {
  describe('Tool Definitions', () => {
    it('should define review_code tool', () => {
      expect(REVIEW_CODE_TOOL.name).toBe('review_code');
      expect(REVIEW_CODE_TOOL.description).toBeTruthy();
      expect(REVIEW_CODE_TOOL.parameters.length).toBeGreaterThan(0);
    });

    it('should define review_git_diff tool', () => {
      expect(REVIEW_GIT_DIFF_TOOL.name).toBe('review_git_diff');
      expect(REVIEW_GIT_DIFF_TOOL.parameters.length).toBeGreaterThan(0);
    });

    it('should define get_fix_suggestion tool', () => {
      expect(GET_FIX_TOOL.name).toBe('get_fix_suggestion');
      expect(GET_FIX_TOOL.parameters.length).toBeGreaterThan(0);
    });

    it('should define list_rules tool', () => {
      expect(LIST_RULES_TOOL.name).toBe('list_rules');
      expect(LIST_RULES_TOOL.description).toBeTruthy();
    });

    it('should have all tools in the ALL_TOOLS array', () => {
      expect(ALL_TOOLS.length).toBe(4);
      expect(ALL_TOOLS.map((t) => t.name)).toEqual([
        'review_code',
        'review_git_diff',
        'get_fix_suggestion',
        'list_rules',
      ]);
    });
  });

  describe('parseToolArgs', () => {
    it('should parse string parameters', () => {
      const params = [
        { name: 'name', type: 'string' as const, description: 'test', required: true },
      ];
      const result = parseToolArgs(params, { name: 'test-value' });
      expect(result['name']).toBe('test-value');
    });

    it('should parse number parameters', () => {
      const params = [
        { name: 'count', type: 'number' as const, description: 'test', required: true },
      ];
      const result = parseToolArgs(params, { count: 42 });
      expect(result['count']).toBe(42);
    });

    it('should parse string to number', () => {
      const params = [
        { name: 'count', type: 'number' as const, description: 'test', required: true },
      ];
      const result = parseToolArgs(params, { count: '42' });
      expect(result['count']).toBe(42);
    });

    it('should parse boolean parameters', () => {
      const params = [
        { name: 'flag', type: 'boolean' as const, description: 'test', required: true },
      ];
      const result = parseToolArgs(params, { flag: true });
      expect(result['flag']).toBe(true);
    });

    it('should apply defaults for missing optional parameters', () => {
      const params = [
        { name: 'opt', type: 'string' as const, description: 'test', required: false, default: 'default-val' },
      ];
      const result = parseToolArgs(params, {});
      expect(result['opt']).toBe('default-val');
    });

    it('should throw for missing required parameters', () => {
      const params = [
        { name: 'required', type: 'string' as const, description: 'test', required: true },
      ];
      expect(() => parseToolArgs(params, {})).toThrow('Missing required parameter: required');
    });

    it('should throw for invalid number', () => {
      const params = [
        { name: 'num', type: 'number' as const, description: 'test', required: true },
      ];
      expect(() => parseToolArgs(params, { num: 'not-a-number' })).toThrow('must be a number');
    });
  });

  describe('getConfigFromEnv', () => {
    const originalEnv = { ...process.env };

    afterEach(() => {
      process.env = { ...originalEnv };
    });

    it('should return null when no env vars set', () => {
      delete process.env['OPENAI_API_KEY'];
      delete process.env['ANTHROPIC_API_KEY'];
      delete process.env['MCP_REVIEW_API_KEY'];
      delete process.env['MCP_REVIEW_PROVIDER'];

      const config = getConfigFromEnv();
      expect(config).toBeNull();
    });

    it('should detect OpenAI config', () => {
      process.env['MCP_REVIEW_PROVIDER'] = 'openai';
      process.env['OPENAI_API_KEY'] = 'sk-test';
      process.env['MCP_REVIEW_MODEL'] = 'gpt-4o';

      const config = getConfigFromEnv();
      expect(config).not.toBeNull();
      expect(config?.modelProvider).toBe('openai');
      expect(config?.modelName).toBe('gpt-4o');
      expect(config?.apiKey).toBe('sk-test');
    });

    it('should detect Anthropic config', () => {
      process.env['MCP_REVIEW_PROVIDER'] = 'anthropic';
      process.env['ANTHROPIC_API_KEY'] = 'sk-ant-test';

      const config = getConfigFromEnv();
      expect(config).not.toBeNull();
      expect(config?.modelProvider).toBe('anthropic');
      expect(config?.apiKey).toBe('sk-ant-test');
    });
  });
});
