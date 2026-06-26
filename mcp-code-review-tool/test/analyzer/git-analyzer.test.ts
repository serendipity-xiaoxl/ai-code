// ============================================================
// MCP Code Review Tool - Git Analyzer Tests
// ============================================================

import { describe, it, expect } from 'bun:test';
import { GitAnalyzer } from '../../src/analyzer/git-analyzer';

describe('GitAnalyzer', () => {
  describe('parseDiff', () => {
    it('should parse an empty diff', () => {
      const analyzer = new GitAnalyzer();
      const result = analyzer.parseDiff('');

      expect(result.diffFiles).toBeArray();
      expect(result.diffFiles.length).toBe(0);
      expect(result.rawDiff).toBe('');
      expect(result.files).toBeArray();
      expect(result.files.length).toBe(0);
      expect(result.totalLines).toBe(0);
    });

    it('should parse a simple file addition diff', () => {
      const diff = [
        'diff --git a/test.ts b/test.ts',
        'new file mode 100644',
        'index 0000000..abc1234',
        '--- /dev/null',
        '+++ b/test.ts',
        '@@ -0,0 +1,3 @@',
        '+const x = 1;',
        '+const y = 2;',
        '+const z = x + y;',
      ].join('\n');

      const analyzer = new GitAnalyzer();
      const result = analyzer.parseDiff(diff);

      expect(result.diffFiles.length).toBe(1);
      expect(result.files[0]).toBe('test.ts');
      expect(result.totalLines).toBe(3);
    });

    it('should parse a diff with multiple files', () => {
      const diff = [
        'diff --git a/file1.ts b/file1.ts',
        'index abc..def 100644',
        '--- a/file1.ts',
        '+++ b/file1.ts',
        '@@ -1,2 +1,3 @@',
        ' unchanged',
        '-removed',
        '+added',
        '+another',
        '',
        'diff --git a/file2.ts b/file2.ts',
        'index ghi..jkl 100644',
        '--- a/file2.ts',
        '+++ b/file2.ts',
        '@@ -1,1 +1,1 @@',
        '-old',
        '+new',
      ].join('\n');

      const analyzer = new GitAnalyzer();
      const result = analyzer.parseDiff(diff);

      expect(result.diffFiles.length).toBe(2);
      expect(result.files[0]).toBe('file1.ts');
      expect(result.files[1]).toBe('file2.ts');
    });

    it('should handle deleted files', () => {
      const diff = [
        'diff --git a/old.ts b/old.ts',
        'deleted file mode 100644',
        'index abc..0000000',
        '--- a/old.ts',
        '+++ /dev/null',
        '@@ -1,4 +0,0 @@',
        '-line1',
        '-line2',
        '-line3',
        '-line4',
      ].join('\n');

      const analyzer = new GitAnalyzer();
      const result = analyzer.parseDiff(diff);

      expect(result.diffFiles.length).toBe(1);
      expect(result.diffFiles[0].status).toBe('deleted');
      expect(result.totalLines).toBe(4);
    });

    it('should handle renamed files', () => {
      const diff = [
        'diff --git a/old.ts b/new.ts',
        'rename from old.ts',
        'rename to new.ts',
      ].join('\n');

      const analyzer = new GitAnalyzer();
      const result = analyzer.parseDiff(diff);

      expect(result.diffFiles.length).toBe(1);
      if (result.diffFiles[0]) {
        expect(result.diffFiles[0].status).toBe('renamed');
        expect(result.diffFiles[0].oldPath).toBe('old.ts');
        expect(result.diffFiles[0].path).toBe('new.ts');
      }
    });

    it('should count additions and deletions correctly', () => {
      const diff = [
        'diff --git a/count.ts b/count.ts',
        'index abc..def 100644',
        '--- a/count.ts',
        '+++ b/count.ts',
        '@@ -1,5 +1,6 @@',
        ' keep1',
        '-remove1',
        '+add1',
        ' keep2',
        '-remove2',
        '+add2',
        '+add3',
      ].join('\n');

      const analyzer = new GitAnalyzer();
      const result = analyzer.parseDiff(diff);

      expect(result.diffFiles.length).toBe(1);
      const file = result.diffFiles[0];
      if (file) {
        expect(file.additions).toBe(3);
        expect(file.deletions).toBe(2);
      }
    });

    it('should parse hunk headers correctly', () => {
      const diff = [
        'diff --git a/parse.ts b/parse.ts',
        'index abc..def 100644',
        '--- a/parse.ts',
        '+++ b/parse.ts',
        '@@ -10,7 +8,6 @@ some context',
        ' unchanged',
        '-line',
        '+newline',
      ].join('\n');

      const analyzer = new GitAnalyzer();
      const result = analyzer.parseDiff(diff);

      expect(result.diffFiles.length).toBe(1);
      const file = result.diffFiles[0];
      if (file) {
        expect(file.hunks.length).toBe(1);
        const hunk = file.hunks[0];
        if (hunk) {
          expect(hunk.oldStart).toBe(10);
          expect(hunk.oldLines).toBe(7);
          expect(hunk.newStart).toBe(8);
          expect(hunk.newLines).toBe(6);
        }
      }
    });
  });
});
