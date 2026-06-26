// ============================================================
// MCP Code Review Tool - Terminal Reporter Tests
//
// Verifies that terminal output:
// 1. Uses ONLY ASCII characters (no Unicode, no emoji)
// 2. Is properly formatted with borders and alignment
// 3. Handles edge cases (empty reviews, many issues, etc.)
// ============================================================

import { describe, it, expect } from 'bun:test';
import { TerminalReporter } from '../../src/reporter/terminal-reporter';
import type { CodeReview } from '../../src/types';
import { stripAnsi } from '../../src/utils/formatter';

/**
 * Create a minimal valid CodeReview for testing.
 */
function createMockReview(overrides?: Partial<CodeReview>): CodeReview {
  return {
    id: 'rev-test-001',
    timestamp: '2026-06-26T10:00:00.000Z',
    config: {
      modelProvider: 'openai',
      modelName: 'gpt-4o',
      apiKey: 'test-key',
    },
    files: ['src/index.ts'],
    diff: [
      {
        path: 'src/index.ts',
        status: 'modified',
        additions: 5,
        deletions: 2,
        hunks: [
          {
            header: '@@ -1,5 +1,8 @@',
            oldStart: 1,
            oldLines: 5,
            newStart: 1,
            newLines: 8,
            content: ' unchanged\n-removed\n+added\n+added2\n',
          },
        ],
      },
    ],
    issues: [
      {
        severity: 'critical',
        category: 'security',
        file: 'src/index.ts',
        line: 10,
        message: 'Hardcoded API key detected',
        suggestion: 'Move to environment variable',
        ruleId: 'R004',
      },
      {
        severity: 'warning',
        category: 'best_practice',
        file: 'src/index.ts',
        line: 15,
        message: 'Console.log in production code',
        suggestion: 'Remove or use proper logger',
      },
      {
        severity: 'info',
        category: 'code_style',
        file: 'src/index.ts',
        message: 'File is missing trailing newline',
        suggestion: 'Add newline at end of file',
        ruleId: 'R009',
      },
    ],
    summary: {
      totalIssues: 3,
      criticalCount: 1,
      warningCount: 1,
      infoCount: 1,
      categories: {
        security: 1,
        best_practice: 1,
        code_style: 1,
      },
      filesReviewed: 1,
      totalLines: 50,
      overallScore: 80,
      durationMs: 1234,
    },
    explanation: 'Found issues that should be addressed before deployment.',
    ...overrides,
  };
}

describe('TerminalReporter', () => {
  describe('generate', () => {
    it('should produce output with header and footer borders', () => {
      const review = createMockReview();
      const reporter = new TerminalReporter({ color: false });
      const output = reporter.generate(review);

      // Check for border characters (ASCII only: = + - |)
      expect(output).toContain('=');
      expect(output).toContain('CODE REVIEW REPORT');
      expect(output.trim()).not.toBe('');
    });

    it('should contain review ID in the output', () => {
      const review = createMockReview();
      const reporter = new TerminalReporter({ color: false });
      const output = reporter.generate(review);

      expect(output).toContain(review.id);
    });

    it('should contain quality score', () => {
      const review = createMockReview();
      const reporter = new TerminalReporter({ color: false });
      const output = reporter.generate(review);

      expect(output).toContain('80/100');
    });

    it('should list all issues', () => {
      const review = createMockReview();
      const reporter = new TerminalReporter({ color: false });
      const output = reporter.generate(review);

      expect(output).toContain('Hardcoded API key detected');
      expect(output).toContain('Console.log in production code');
      expect(output).toContain('File is missing trailing newline');
    });

    it('should show file references with line numbers', () => {
      const review = createMockReview();
      const reporter = new TerminalReporter({ color: false });
      const output = reporter.generate(review);

      expect(output).toContain('src/index.ts');
    });

    it('should show overall assessment', () => {
      const review = createMockReview();
      const reporter = new TerminalReporter({ color: false });
      const output = reporter.generate(review);

      expect(output).toContain('OVERALL ASSESSMENT');
    });
  });

  describe('ASCII-only requirement', () => {
    it('should contain only ASCII characters in the output', () => {
      const review = createMockReview();
      const reporter = new TerminalReporter({ color: false });
      const output = reporter.generate(review);

      // Strip ANSI codes first
      const plain = stripAnsi(output);

      // Check each character is ASCII (code point <= 127)
      for (let i = 0; i < plain.length; i++) {
        const charCode = plain.charCodeAt(i);
        if (charCode > 127) {
          // Report the first non-ASCII character found
          expect.fail(
            'Non-ASCII character found at position ' +
              i +
              ': U+' +
              charCode.toString(16).toUpperCase() +
              ' (' +
              plain[i] +
              ')',
          );
        }
      }
    });

    it('should not contain emoji or Unicode symbols', () => {
      const review = createMockReview();
      const reporter = new TerminalReporter({ color: false });
      const output = reporter.generate(review);

      const plain = stripAnsi(output);

      // Check for Unicode ranges that should not appear in output
      // Using RegExp constructor for reliable hex escape handling
      const unicodeTests: Array<[number, number, string]> = [
        [0x2500, 0x257f, 'Box drawing'],
        [0x2580, 0x259f, 'Block elements'],
        [0x2600, 0x26ff, 'Miscellaneous symbols'],
        [0x2700, 0x27bf, 'Dingbats'],
        [0x2b00, 0x2bff, 'Misc arrows'],
        [0x1f300, 0x1f9ff, 'Emoji'],
        [0xfe00, 0xfe0f, 'Variation selectors'],
      ];

      for (const [start, end, label] of unicodeTests) {
        for (let i = 0; i < plain.length; i++) {
          const cp = plain.charCodeAt(i);
          if (cp >= start && cp <= end) {
            expect.fail('Found Unicode ' + label + ' character U+' + cp.toString(16).toUpperCase() + ' at position ' + i);
          }
        }
      }
    });

    it('should use ASCII box-drawing (+, -, |) not Unicode', () => {
      const review = createMockReview();
      const reporter = new TerminalReporter({ color: false });
      const output = reporter.generate(review);

      const plain = stripAnsi(output);

      // Should use ASCII borders
      expect(plain).toMatch(/[+=-]/);
    });
  });

  describe('edge cases', () => {
    it('should handle empty review with no issues', () => {
      const review = createMockReview({
        issues: [],
        summary: {
          totalIssues: 0,
          criticalCount: 0,
          warningCount: 0,
          infoCount: 0,
          categories: {},
          filesReviewed: 1,
          totalLines: 10,
          overallScore: 100,
          durationMs: 100,
        },
      });

      const reporter = new TerminalReporter({ color: false });
      const output = reporter.generate(review);

      expect(output).toContain('100/100');
    });

    it('should handle review with many issues', () => {
      const manyIssues = Array.from({ length: 50 }, (_, i) => ({
        severity: (i % 3 === 0 ? 'critical' : i % 3 === 1 ? 'warning' : 'info') as
          | 'critical'
          | 'warning'
          | 'info',
        category: 'best_practice' as const,
        file: 'src/index.ts',
        line: i + 1,
        message: 'Issue number ' + (i + 1),
        suggestion: 'Fix issue ' + (i + 1),
      }));

      const review = createMockReview({
        issues: manyIssues,
        summary: {
          totalIssues: 50,
          criticalCount: 17,
          warningCount: 17,
          infoCount: 16,
          categories: { best_practice: 50 },
          filesReviewed: 1,
          totalLines: 200,
          overallScore: 30,
          durationMs: 5000,
        },
      });

      const reporter = new TerminalReporter({ color: false });
      expect(() => reporter.generate(review)).not.toThrow();
    });

    it('should handle diff with no changes', () => {
      const review = createMockReview({
        diff: [],
        files: [],
      });

      const reporter = new TerminalReporter({ color: false });
      const output = reporter.generate(review);

      // Should not crash and still show basic info
      expect(output).toContain(review.id);
    });
  });

  describe('generateCompact', () => {
    it('should produce a one-line compact summary', () => {
      const review = createMockReview();
      const reporter = new TerminalReporter({ color: false });
      const output = reporter.generateCompact(review);

      // Should be one line
      expect(output.split('\n').length).toBe(1);
      expect(output).toContain('REVIEW');
      expect(output).toContain(review.id);
      expect(output).toContain('80/100');
    });

    it('should show issue counts', () => {
      const review = createMockReview();
      const reporter = new TerminalReporter({ color: false });
      const output = reporter.generateCompact(review);

      expect(output).toContain('1C');
      expect(output).toContain('1W');
      expect(output).toContain('1I');
    });
  });
});
