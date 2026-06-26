// ============================================================
// ai-code - Search Tools Tests
// ============================================================

import { describe, it, expect } from 'bun:test';
import { createGrepTool, createGlobTool } from '../../src/tools/search/tools';
import { join } from 'node:path';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';

describe('Search Tools', () => {
  describe('grep tool', () => {
    it('should find matching pattern in files', async () => {
      const dir = mkdtempSync(join(tmpdir(), 'aic-test-'));
      writeFileSync(join(dir, 'test.ts'), 'const x = 1;\nconsole.log("test");\n', 'utf-8');

      const tool = createGrepTool();
      const result = await tool.invoke({
        pattern: 'console',
        path: dir,
        maxResults: 10,
      }) as string;

      expect(result).toContain('Found');
      expect(result).toContain('console');
    });

    it('should return no matches for absent pattern', async () => {
      const dir = mkdtempSync(join(tmpdir(), 'aic-test-no-match-'));
      const tool = createGrepTool();
      const result = await tool.invoke({
        pattern: 'XYZ_UNIQUE_PATTERN_123456789',
        path: dir,
        maxResults: 5,
      }) as string;

      expect(result).toContain('No matches');
    });
  });

  describe('glob tool', () => {
    it('should find files matching pattern', async () => {
      const dir = mkdtempSync(join(tmpdir(), 'aic-test-'));
      writeFileSync(join(dir, 'test.ts'), '', 'utf-8');
      writeFileSync(join(dir, 'test.json'), '', 'utf-8');

      const tool = createGlobTool();
      const result = await tool.invoke({
        pattern: '*.ts',
        path: dir,
      }) as string;

      expect(result).toContain('Found');
      expect(result).toContain('test.ts');
    });

    it('should return no matches for absent pattern', async () => {
      const tool = createGlobTool();
      const result = await tool.invoke({
        pattern: '*.nonexistent',
        maxResults: 5,
      }) as string;

      expect(result).toContain('No files found');
    });
  });

  describe('tool schemas', () => {
    it('should define grep tool with proper metadata', () => {
      const tool = createGrepTool();
      expect(tool.name).toBe('grep');
      expect(tool.description).toBeTruthy();
    });

    it('should define glob tool with proper metadata', () => {
      const tool = createGlobTool();
      expect(tool.name).toBe('glob');
      expect(tool.description).toBeTruthy();
    });
  });
});
