// ============================================================
// ai-code - Input Renderer Tests
//
// Verifies ASCII-only output, ANSI formatting, and
// all InputRenderer methods.
// ============================================================

import { describe, it, expect } from 'vitest';
import { createInputRenderer } from '../../src/renderer/input';

describe('Input Renderer', () => {
  const renderer = createInputRenderer();

  /** Assert that a string contains only ASCII characters (0-127). */
  function assertASCII(output: string): void {
    for (let i = 0; i < output.length; i++) {
      expect(output.charCodeAt(i)).toBeLessThanOrEqual(127);
    }
  }

  // -----------------------------------------------------------------------
  // prompt()
  // -----------------------------------------------------------------------
  describe('prompt', () => {
    it('should return a prompt with aic prefix and > symbol', () => {
      const result = renderer.prompt();
      expect(result).toContain('aic');
      expect(result).toContain('>');
    });

    it('should append text when argument is provided', () => {
      const result = renderer.prompt('type a command');
      expect(result).toContain('type a command');
    });

    it('should include ANSI bold and cyan codes', () => {
      const result = renderer.prompt();
      expect(result).toContain('\x1b[1m'); // bold
      expect(result).toContain('\x1b[36m'); // cyan
      expect(result).toContain('\x1b[0m'); // reset
    });

    it('should return ASCII-only output', () => {
      assertASCII(renderer.prompt());
      assertASCII(renderer.prompt('hello'));
    });
  });

  // -----------------------------------------------------------------------
  // highlightInput()
  // -----------------------------------------------------------------------
  describe('highlightInput', () => {
    it('should highlight slash commands with bold magenta', () => {
      const result = renderer.highlightInput('/help');
      expect(result).toContain('\x1b[1m');  // bold
      expect(result).toContain('\x1b[35m'); // magenta
      expect(result).toContain('\x1b[0m');  // reset
      expect(result).toContain('/help');
    });

    it('should highlight @file references with cyan underline', () => {
      const result = renderer.highlightInput('check @file.ts');
      expect(result).toContain('\x1b[36m');  // cyan
      expect(result).toContain('\x1b[4m');   // underline
      expect(result).toContain('\x1b[0m');   // reset
      expect(result).toContain('@file.ts');
    });

    it('should leave normal text unmodified', () => {
      const result = renderer.highlightInput('hello world');
      expect(result).toContain('hello world');
    });

    it('should not highlight a bare @ symbol', () => {
      const result = renderer.highlightInput('@');
      expect(result).toBe('@');
    });

    it('should return ASCII-only output', () => {
      assertASCII(renderer.highlightInput('/status'));
      assertASCII(renderer.highlightInput('hello @file.ts'));
      assertASCII(renderer.highlightInput('plain text'));
    });

    it('should handle empty input', () => {
      expect(renderer.highlightInput('')).toBe('');
    });

    it('should handle multiple lines with mixed content', () => {
      const result = renderer.highlightInput('/status\nhello @file.ts\nplain');
      expect(result).toContain('/status');
      expect(result).toContain('@file.ts');
      expect(result).toContain('plain');
      // First line is a slash command (bold magenta)
      // Second line has file reference (cyan underline)
      // Third line is plain
    });
  });

  // -----------------------------------------------------------------------
  // inputBox()
  // -----------------------------------------------------------------------
  describe('inputBox', () => {
    it('should include a left border with gray color', () => {
      const result = renderer.inputBox('test content');
      expect(result).toContain('\x1b[90m'); // gray
      expect(result).toContain('|');
      expect(result).toContain('test content');
    });

    it('should return ASCII-only output', () => {
      assertASCII(renderer.inputBox('test'));
    });

    it('should handle empty text', () => {
      const result = renderer.inputBox('');
      expect(result).toContain('|');
    });
  });

  // -----------------------------------------------------------------------
  // refFile()
  // -----------------------------------------------------------------------
  describe('refFile', () => {
    it('should format file path with cyan and underline', () => {
      const result = renderer.refFile('src/file.ts');
      expect(result).toContain('\x1b[36m');  // cyan
      expect(result).toContain('\x1b[4m');   // underline
      expect(result).toContain('src/file.ts');
    });

    it('should append line number when provided', () => {
      const result = renderer.refFile('src/file.ts', 42);
      expect(result).toContain(':42');
    });

    it('should not include colon when line number is omitted', () => {
      const result = renderer.refFile('src/file.ts');
      expect(result).not.toContain(':');
    });

    it('should return ASCII-only output', () => {
      assertASCII(renderer.refFile('src/file.ts'));
      assertASCII(renderer.refFile('src/file.ts', 42));
    });
  });

  // -----------------------------------------------------------------------
  // commandBadge()
  // -----------------------------------------------------------------------
  describe('commandBadge', () => {
    it('should wrap name in square brackets', () => {
      const result = renderer.commandBadge('help');
      expect(result).toContain('[help]');
    });

    it('should use bold magenta ANSI codes', () => {
      const result = renderer.commandBadge('help');
      expect(result).toContain('\x1b[1m');   // bold
      expect(result).toContain('\x1b[35m');  // magenta
    });

    it('should return ASCII-only output', () => {
      assertASCII(renderer.commandBadge('help'));
    });
  });

  // -----------------------------------------------------------------------
  // sectionHeader()
  // -----------------------------------------------------------------------
  describe('sectionHeader', () => {
    it('should include the title text', () => {
      const result = renderer.sectionHeader('Output');
      expect(result).toContain('Output');
    });

    it('should include separator dashes', () => {
      const result = renderer.sectionHeader('Output');
      expect(result).toContain('--');
    });

    it('should return ASCII-only output', () => {
      assertASCII(renderer.sectionHeader('Output'));
      assertASCII(renderer.sectionHeader(''));
    });
  });
});
