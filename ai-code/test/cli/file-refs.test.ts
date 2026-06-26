// ============================================================
// ai-code - File Reference Parser Tests
//
// Tests @file reference parsing, content injection, and
// ANSI highlighting.
// ============================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resolve } from 'node:path';

// Mock node:fs to control file system behavior
vi.mock('node:fs');

import { existsSync, readFileSync, statSync } from 'node:fs';
import { parseFileRefs, injectFileRefs, highlightFileRefs } from '../../src/cli/file-refs';

describe('File Refs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /** Assert ASCII-only output. */
  function assertASCII(output: string): void {
    for (let i = 0; i < output.length; i++) {
      expect(output.charCodeAt(i)).toBeLessThanOrEqual(127);
    }
  }

  // -----------------------------------------------------------------------
  // parseFileRefs
  // -----------------------------------------------------------------------
  describe('parseFileRefs', () => {
    it('should parse @file references', () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(statSync).mockReturnValue({ size: 50 } as any);
      vi.mocked(readFileSync).mockReturnValue('content');

      const result = parseFileRefs('check @test.ts', '/project');

      expect(result).toHaveLength(1);
      expect(result[0].raw).toBe('@test.ts');
      expect(result[0].filePath).toBe(resolve('/project', 'test.ts'));
      expect(result[0].exists).toBe(true);
      expect(result[0].content).toBe('content');
      expect(result[0].size).toBe(50);
    });

    it('should parse @file references with line numbers', () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(statSync).mockReturnValue({ size: 50 } as any);
      vi.mocked(readFileSync).mockReturnValue('content');

      const result = parseFileRefs('@test.ts:42', '/project');

      expect(result).toHaveLength(1);
      expect(result[0].raw).toBe('@test.ts:42');
      expect(result[0].line).toBe(42);
    });

    it('should mark non-existent files with exists=false', () => {
      vi.mocked(existsSync).mockReturnValue(false);

      const result = parseFileRefs('@missing.ts', '/project');

      expect(result).toHaveLength(1);
      expect(result[0].exists).toBe(false);
      expect(result[0].error).toBe('File not found');
      expect(result[0].content).toBeUndefined();
    });

    it('should handle empty file content', () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(statSync).mockReturnValue({ size: 0 } as any);

      const result = parseFileRefs('@empty.ts', '/project');

      expect(result).toHaveLength(1);
      expect(result[0].exists).toBe(true);
      expect(result[0].content).toBe('');
      // readFileSync should not be called for empty files
      expect(readFileSync).not.toHaveBeenCalled();
    });

    it('should truncate files exceeding 10KB', () => {
      const largeContent = 'x'.repeat(15 * 1024); // 15KB
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(statSync).mockReturnValue({ size: 15 * 1024 } as any);
      vi.mocked(readFileSync).mockReturnValue(largeContent);

      const result = parseFileRefs('@large.ts', '/project');

      expect(result).toHaveLength(1);
      expect(result[0].content).toHaveLength(10 * 1024); // truncated to 10KB
      expect(result[0].error).toContain('Truncated');
      expect(result[0].error).toContain('10KB');
    });

    it('should handle read errors gracefully', () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(statSync).mockReturnValue({ size: 50 } as any);
      vi.mocked(readFileSync).mockImplementation(() => {
        throw new Error('Permission denied');
      });

      const result = parseFileRefs('@test.ts', '/project');

      expect(result).toHaveLength(1);
      expect(result[0].error).toContain('Permission denied');
      expect(result[0].exists).toBe(true);
    });

    it('should deduplicate repeated @file references', () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(statSync).mockReturnValue({ size: 50 } as any);
      vi.mocked(readFileSync).mockReturnValue('content');

      const result = parseFileRefs('@test.ts @test.ts', '/project');

      expect(result).toHaveLength(1);
    });

    it('should return empty array when no references found', () => {
      const result = parseFileRefs('no references here', '/project');
      expect(result).toHaveLength(0);
    });
  });

  // -----------------------------------------------------------------------
  // injectFileRefs
  // -----------------------------------------------------------------------
  describe('injectFileRefs', () => {
    it('should replace @file reference with code block', () => {
      const refs = [
        {
          raw: '@test.ts',
          filePath: resolve('/project', 'test.ts'),
          exists: true,
          content: 'hello world',
          size: 11,
        },
      ];

      const result = injectFileRefs('check @test.ts', refs);

      expect(result).toContain('@test.ts');
      expect(result).toContain('```');
      expect(result).toContain('hello world');
      expect(result).toContain('lines');
      expect(result).toContain('KB');
    });

    it('should leave non-existent references unchanged', () => {
      const refs = [
        {
          raw: '@missing.ts',
          filePath: resolve('/project', 'missing.ts'),
          exists: false,
          size: 0,
          error: 'File not found',
        },
      ];

      const result = injectFileRefs('check @missing.ts', refs);

      expect(result).toBe('check @missing.ts');
    });

    it('should leave unmatched @patterns unchanged', () => {
      const result = injectFileRefs('check @unknown.ts', []);
      expect(result).toBe('check @unknown.ts');
    });

    it('should handle input with no @file references', () => {
      const result = injectFileRefs('plain text', []);
      expect(result).toBe('plain text');
    });

    it('should replace all occurrences of known references', () => {
      const refs = [
        {
          raw: '@test.ts',
          filePath: resolve('/project', 'test.ts'),
          exists: true,
          content: 'hello',
          size: 5,
        },
      ];

      const result = injectFileRefs('@test.ts and @test.ts', refs);

      // Both occurrences should be replaced:
      // each replacement adds 2 ``` occurrences (opening + closing), so 2 x 2 = 4 total
      const backtickMatches = result.match(/```/g);
      expect(backtickMatches).toHaveLength(4);
    });
  });

  // -----------------------------------------------------------------------
  // highlightFileRefs
  // -----------------------------------------------------------------------
  describe('highlightFileRefs', () => {
    it('should wrap @file references with ANSI codes', () => {
      const result = highlightFileRefs('check @test.ts');
      expect(result).toContain('\x1b[36m');  // cyan
      expect(result).toContain('\x1b[4m');   // underline
      expect(result).toContain('@test.ts');
    });

    it('should highlight line numbers in yellow', () => {
      const result = highlightFileRefs('@test.ts:42');
      expect(result).toContain('\x1b[36m');  // cyan (file path)
      expect(result).toContain('\x1b[33m');  // yellow (line number)
      expect(result).toContain(':42');
    });

    it('should leave non-matching input unchanged', () => {
      const result = highlightFileRefs('hello world');
      expect(result).toBe('hello world');
    });

    it('should handle multiple references', () => {
      const result = highlightFileRefs('@a.ts and @b.ts');
      expect(result).toContain('@a.ts');
      expect(result).toContain('@b.ts');
      // Both should be wrapped in ANSI codes
      const cyanCount = result.split('\x1b[36m').length - 1;
      expect(cyanCount).toBe(2);
    });

    it('should return ASCII-only output', () => {
      assertASCII(highlightFileRefs('@test.ts'));
      assertASCII(highlightFileRefs('@test.ts:42'));
      assertASCII(highlightFileRefs('plain text'));
    });
  });
});
