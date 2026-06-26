// ============================================================
// ai-code - File Tools Tests
// ============================================================

import { describe, it, expect } from 'bun:test';
import { createReadTool, createWriteTool, createEditTool } from '../../src/tools/file/tools';
import { join } from 'node:path';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';

describe('File Tools', () => {
  describe('read tool', () => {
    it('should return error for non-existent file', async () => {
      const tool = createReadTool();
      const result = await tool.invoke({
        filePath: '/tmp/nonexistent-file-12345',
      });
      expect(result as string).toContain('Error');
    });

    it('should read an existing file', async () => {
      const dir = mkdtempSync(join(tmpdir(), 'aic-test-'));
      const filePath = join(dir, 'test.txt');
      writeFileSync(filePath, 'line 1\nline 2\nline 3\n', 'utf-8');

      const tool = createReadTool();
      const result = await tool.invoke({ filePath }) as string;
      expect(result).toContain('test.txt');
      expect(result).toContain('line 2');
    });
  });

  describe('write tool', () => {
    it('should create a new file', async () => {
      const dir = mkdtempSync(join(tmpdir(), 'aic-test-'));
      const filePath = join(dir, 'new-file.txt');

      const tool = createWriteTool();
      const result = await tool.invoke({
        filePath,
        content: 'hello world',
      }) as string;

      expect(result).toContain('Successfully wrote');
      expect(result).toContain('1 lines (11 bytes)');
    });
  });

  describe('edit tool', () => {
    it('should replace text in a file', async () => {
      const dir = mkdtempSync(join(tmpdir(), 'aic-test-'));
      const filePath = join(dir, 'edit-test.txt');
      writeFileSync(filePath, 'hello world\nthis is a test\n', 'utf-8');

      const tool = createEditTool();
      const result = await tool.invoke({
        filePath,
        oldString: 'world',
        newString: 'there',
      }) as string;

      expect(result).toContain('Successfully edited');
    });

    it('should return error if oldString not found', async () => {
      const dir = mkdtempSync(join(tmpdir(), 'aic-test-'));
      const filePath = join(dir, 'notfound.txt');
      writeFileSync(filePath, 'hello', 'utf-8');

      const tool = createEditTool();
      const result = await tool.invoke({
        filePath,
        oldString: 'nonexistent',
        newString: 'replacement',
      }) as string;

      expect(result).toContain('Error');
    });

    it('should create file when createIfMissing is true', async () => {
      const dir = mkdtempSync(join(tmpdir(), 'aic-test-'));
      const filePath = join(dir, 'missing.txt');

      const tool = createEditTool();
      const result = await tool.invoke({
        filePath,
        oldString: '',
        newString: 'new content',
        createIfMissing: true,
      }) as string;

      expect(result).toContain('Created new file');
    });
  });

  describe('tool schemas', () => {
    it('should define read tool with proper metadata', () => {
      const tool = createReadTool();
      expect(tool.name).toBe('read');
      expect(tool.description).toBeTruthy();
    });

    it('should define write tool with proper metadata', () => {
      const tool = createWriteTool();
      expect(tool.name).toBe('write');
      expect(tool.description).toBeTruthy();
    });

    it('should define edit tool with proper metadata', () => {
      const tool = createEditTool();
      expect(tool.name).toBe('edit');
      expect(tool.description).toBeTruthy();
    });
  });
});
