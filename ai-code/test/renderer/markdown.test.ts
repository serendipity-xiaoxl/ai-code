// ============================================================
// ai-code - Markdown Renderer Tests
//
// Verifies ASCII-only output and proper formatting.
// ============================================================

import { describe, it, expect } from 'bun:test';
import { createRenderer } from '../../src/renderer/markdown';

describe('Markdown Renderer', () => {
  const renderer = createRenderer({ color: false, width: 60 });

  describe('ASCII-only requirement', () => {
    const outputs: Array<[string, string]> = [];

    it('header should be ASCII-only', () => {
      const out = renderer.header('TEST');
      outputs.push(['header', out]);
      for (const ch of out) {
        expect(ch.charCodeAt(0)).toBeLessThanOrEqual(127);
      }
    });

    it('aiResponse should be ASCII-only', () => {
      const out = renderer.aiResponse('Hello, this is a **test** response.\n\nWith a code block.');
      outputs.push(['aiResponse', out]);
      for (const ch of out) {
        expect(ch.charCodeAt(0)).toBeLessThanOrEqual(127);
      }
    });

    it('error should be ASCII-only', () => {
      const out = renderer.error('Something went wrong');
      outputs.push(['error', out]);
      for (const ch of out) {
        expect(ch.charCodeAt(0)).toBeLessThanOrEqual(127);
      }
    });

    it('table should be ASCII-only', () => {
      const out = renderer.table(
        ['Name', 'Value'],
        [['a', '1'], ['b', '2']],
      );
      outputs.push(['table', out]);
      for (const ch of out) {
        expect(ch.charCodeAt(0)).toBeLessThanOrEqual(127);
      }
    });

    it('help should be ASCII-only', () => {
      const out = renderer.help();
      outputs.push(['help', out]);
      for (const ch of out) {
        expect(ch.charCodeAt(0)).toBeLessThanOrEqual(127);
      }
    });
  });

  describe('formatting', () => {
    it('should render header with borders', () => {
      const out = renderer.header('TEST');
      expect(out).toContain('=');
      expect(out).toContain('TEST');
    });

    it('should render metadata key-value pairs', () => {
      const out = renderer.metadata([
        ['Model', 'gpt-4o'],
        ['Project', '/test'],
      ]);
      expect(out).toContain('Model');
      expect(out).toContain('gpt-4o');
      expect(out).toContain('Project');
      expect(out).toContain('/test');
    });

    it('should render error message', () => {
      const out = renderer.error('test error');
      expect(out).toContain('[ERROR]');
      expect(out).toContain('test error');
    });

    it('should render success message', () => {
      const out = renderer.success('all good');
      expect(out).toContain('[OK]');
      expect(out).toContain('all good');
    });

    it('should render warning message', () => {
      const out = renderer.warning('be careful');
      expect(out).toContain('[WARN]');
      expect(out).toContain('be careful');
    });

    it('should render info message', () => {
      const out = renderer.info('info here');
      expect(out).toContain('[INFO]');
      expect(out).toContain('info here');
    });

    it('should render tool call', () => {
      const out = renderer.toolCall('read', 'test.ts');
      expect(out).toContain('TOOL:');
      expect(out).toContain('read');
    });

    it('should render file reference', () => {
      const out = renderer.fileRef('src/index.ts', 42);
      expect(out).toContain('src/index.ts');
      expect(out).toContain(':42');
    });

    it('should render table with borders', () => {
      const out = renderer.table(
        ['A', 'B'],
        [['1', '2']],
      );
      expect(out).toContain('+');
      expect(out).toContain('|');
      expect(out).toContain('A');
      expect(out).toContain('B');
    });

    it('should handle empty table headers', () => {
      const out = renderer.table([], []);
      expect(out).toBe('');
    });

    it('should render AI response with headers', () => {
      const out = renderer.aiResponse('# Title\n## Subtitle\n### Section\nRegular text.');
      expect(out).toContain('Title');
      expect(out).toContain('---');
      expect(out).toContain('Regular text.');
    });

    it('should render AI response with lists', () => {
      const out = renderer.aiResponse('- item 1\n- item 2');
      expect(out).toContain('item 1');
      expect(out).toContain('item 2');
    });

    it('should render AI response with blockquotes', () => {
      const out = renderer.aiResponse('> quoted text');
      expect(out).toContain('>');
      expect(out).toContain('quoted text');
    });
  });

  describe('edge cases', () => {
    it('should handle empty strings', () => {
      expect(() => renderer.aiResponse('')).not.toThrow();
    });

    it('should handle very long text', () => {
      const long = 'word '.repeat(100);
      expect(() => renderer.aiResponse(long)).not.toThrow();
    });

    it('should handle code blocks in AI response', () => {
      const out = renderer.aiResponse('Some text\n```\ncode here\n```\nMore text');
      expect(out).toContain('code here');
      expect(out).toContain('More text');
    });
  });
});
