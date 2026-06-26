// ============================================================
// MCP Code Review Tool - Formatter Utility Tests
// ============================================================

import { describe, it, expect } from 'bun:test';
import {
  centerText,
  padRight,
  padLeft,
  truncate,
  wrapText,
  horizontalLine,
  doubleLine,
  textBox,
  createTable,
  formatDuration,
  progressBar,
  stripAnsi,
  indent,
} from '../../src/utils/formatter';

describe('Formatter Utilities', () => {
  describe('centerText', () => {
    it('should center text within given width', () => {
      const result = centerText('hello', 11);
      expect(result).toBe('   hello   ');
    });

    it('should not modify text that exceeds width', () => {
      const result = centerText('hello world', 5);
      expect(result).toBe('hello world');
    });
  });

  describe('padRight', () => {
    it('should pad text to specified width', () => {
      expect(padRight('hello', 8)).toBe('hello   ');
    });

    it('should truncate text that exceeds width', () => {
      expect(padRight('hello world', 5)).toBe('hello');
    });
  });

  describe('padLeft', () => {
    it('should left-pad text to specified width', () => {
      expect(padLeft('hello', 8)).toBe('   hello');
    });
  });

  describe('truncate', () => {
    it('should not modify short text', () => {
      expect(truncate('hello', 10)).toBe('hello');
    });

    it('should truncate and add ellipsis', () => {
      expect(truncate('hello world', 8)).toBe('hello...');
    });

    it('should handle very small max length', () => {
      expect(truncate('hello', 2)).toBe('he');
    });
  });

  describe('wrapText', () => {
    it('should wrap text at specified width', () => {
      const result = wrapText('a b c d e f g', 5);
      expect(result.length).toBeGreaterThan(1);
    });

    it('should handle single word longer than width', () => {
      const result = wrapText('hello', 3);
      expect(result[0]).toBe('hello');
    });

    it('should handle empty text', () => {
      expect(wrapText('')).toEqual([]);
    });
  });

  describe('horizontalLine', () => {
    it('should create a line of plus signs', () => {
      expect(horizontalLine(5)).toBe('+++++');
    });

    it('should default to 72 characters', () => {
      expect(horizontalLine().length).toBe(72);
    });
  });

  describe('doubleLine', () => {
    it('should create a line of equals signs', () => {
      expect(doubleLine(5)).toBe('=====');
    });
  });

  describe('textBox', () => {
    it('should create a box around text', () => {
      const result = textBox(['hello', 'world'], 10);
      expect(result).toContain('+');
      expect(result).toContain('|');
      expect(result).toContain('hello');
      expect(result).toContain('world');
    });

    it('should include title in top border', () => {
      const result = textBox(['content'], 15, 'Title');
      expect(result).toContain('Title');
    });
  });

  describe('createTable', () => {
    it('should create an ASCII table', () => {
      const result = createTable(['Name', 'Value'], [['a', '1'], ['b', '2']]);
      expect(result).toContain('+');
      expect(result).toContain('|');
      expect(result).toContain('Name');
      expect(result).toContain('Value');
      expect(result).toContain('a');
      expect(result).toContain('1');
    });

    it('should handle empty headers', () => {
      expect(createTable([], [])).toBe('');
    });
  });

  describe('formatDuration', () => {
    it('should format milliseconds', () => {
      expect(formatDuration(500)).toBe('500ms');
    });

    it('should format seconds', () => {
      expect(formatDuration(1500)).toBe('1.5s');
    });

    it('should format minutes and seconds', () => {
      expect(formatDuration(125000)).toBe('2m 5s');
    });
  });

  describe('progressBar', () => {
    it('should create a visible progress bar', () => {
      const result = progressBar(50, 100, 10);
      expect(result).toContain('[');
      expect(result).toContain(']');
      expect(result).toContain('50%');
    });

    it('should handle zero total', () => {
      const result = progressBar(0, 0, 5);
      expect(result).toContain('0%');
    });

    it('should show 100% for completed', () => {
      const result = progressBar(100, 100, 10);
      expect(result).toContain('100%');
    });
  });

  describe('stripAnsi', () => {
    it('should remove ANSI escape codes', () => {
      const input = '\x1b[31mhello\x1b[0m';
      expect(stripAnsi(input)).toBe('hello');
    });

    it('should handle plain text without ANSI', () => {
      expect(stripAnsi('hello')).toBe('hello');
    });
  });

  describe('indent', () => {
    it('should indent each line', () => {
      const result = indent('hello\nworld', 2);
      expect(result).toBe('  hello\n  world');
    });

    it('should not indent empty lines', () => {
      const result = indent('hello\n\nworld', 2);
      expect(result).toContain('\n\n');
    });
  });
});
