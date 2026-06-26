// ============================================================
// ai-code - Diff Tool
//
// LangChain DynamicStructuredTool implementation for computing
// and displaying a unified diff between a file's current content
// and proposed new content.
//
// CRITICAL: All output uses ONLY ASCII characters and ANSI
// escape codes for coloring (no Unicode, no emoji).
// ============================================================

import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { readTextFile, pathExists } from '../../utils/os-compat';
import { getLogger } from '../../utils/logger';

const logger = getLogger();

// ============================================================
// ANSI color codes
// ============================================================

const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
} as const;

// ============================================================
// Diff Algorithm: LCS-based line diff
// ============================================================

/**
 * Result of comparing a single line.
 */
type DiffOp =
  | { type: 'equal'; line: string }
  | { type: 'delete'; line: string }
  | { type: 'insert'; line: string };

/**
 * Compute the longest common subsequence table for two arrays of lines.
 *
 * Uses the standard dynamic programming approach.
 * dp[i][j] = length of LCS of oldLines[0..i) and newLines[0..j)
 */
function lcsTable(
  oldLines: string[],
  newLines: string[],
): number[][] {
  const m = oldLines.length;
  const n = newLines.length;
  const dp: number[][] = new Array(m + 1);

  for (let i = 0; i <= m; i++) {
    dp[i] = new Array(n + 1).fill(0);
  }

  for (let i = 1; i <= m; i++) {
    const oldLine = oldLines[i - 1] as string;
    for (let j = 1; j <= n; j++) {
      if (oldLine === newLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j] as number, dp[i][j - 1] as number);
      }
    }
  }

  return dp;
}

/**
 * Backtrack through the LCS table to produce a sequence of DiffOps.
 */
function backtrack(
  dp: number[][],
  oldLines: string[],
  newLines: string[],
): DiffOp[] {
  const reversed: DiffOp[] = [];
  let i = oldLines.length;
  let j = newLines.length;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      reversed.push({ type: 'equal', line: oldLines[i - 1] as string });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || (dp[i]?.[j - 1] ?? 0) >= (dp[i - 1]?.[j] ?? 0))) {
      reversed.push({ type: 'insert', line: newLines[j - 1] as string });
      j--;
    } else if (i > 0) {
      reversed.push({ type: 'delete', line: oldLines[i - 1] as string });
      i--;
    }
  }

  // Reverse to get chronological order
  const ops: DiffOp[] = [];
  for (let k = reversed.length - 1; k >= 0; k--) {
    ops.push(reversed[k] as DiffOp);
  }

  return ops;
}

// ============================================================
// Hunk construction
// ============================================================

/**
 * A hunk in a unified diff.
 */
interface Hunk {
  oldStart: number;
  oldCount: number;
  newStart: number;
  newCount: number;
  lines: DiffOp[];
}

// ============================================================
// Hunk builder
// ============================================================

/**
 * Group DiffOps into hunks. A cleaner, more maintainable implementation.
 *
 * Approach:
 * 1. Mark change regions (runs of non-equal ops).
 * 2. Merge close regions into hunks with context.
 * 3. Compute line numbers by walking the ops.
 */
function computeHunks(
  ops: DiffOp[],
  contextLines: number,
): Hunk[] {
  if (ops.length === 0) return [];

  // Step 1: Find change regions
  interface ChangeRegion {
    start: number; // inclusive index into ops
    end: number;   // exclusive index into ops
  }

  const regions: ChangeRegion[] = [];
  let inChange = false;
  let regionStart = 0;

  for (let i = 0; i < ops.length; i++) {
    const op = ops[i] as DiffOp;
    const isChange = op.type === 'delete' || op.type === 'insert';

    if (isChange && !inChange) {
      regionStart = i;
      inChange = true;
    } else if (!isChange && inChange) {
      regions.push({ start: regionStart, end: i });
      inChange = false;
    }
  }

  if (inChange) {
    regions.push({ start: regionStart, end: ops.length });
  }

  if (regions.length === 0) return [];

  // Step 2: Merge regions that are close enough
  const mergedRegions: Array<{ start: number; end: number }> = [];
  let currentStart = regions[0]!.start;
  let currentEnd = regions[0]!.end;

  for (let r = 1; r < regions.length; r++) {
    const region = regions[r]!;
    const gap = region.start - currentEnd;

    if (gap <= 2 * contextLines + 1) {
      // Merge: extend current region
      currentEnd = region.end;
    } else {
      // Close current region, start new one
      mergedRegions.push({
        start: Math.max(0, currentStart - contextLines),
        end: Math.min(ops.length, currentEnd + contextLines),
      });
      currentStart = region.start;
      currentEnd = region.end;
    }
  }

  // Close the last region
  mergedRegions.push({
    start: Math.max(0, currentStart - contextLines),
    end: Math.min(ops.length, currentEnd + contextLines),
  });

  // Step 3: Build hunks with line numbers
  const hunks: Hunk[] = [];

  for (const merged of mergedRegions) {
    const hunkOps = ops.slice(merged.start, merged.end);
    if (hunkOps.length === 0) continue;

    // Compute line numbers by simulating a walk through the ops
    // from the beginning up to `merged.start`
    let oldPos = 1;
    let newPos = 1;

    for (let i = 0; i < merged.start; i++) {
      const op = ops[i] as DiffOp;
      if (op.type === 'equal' || op.type === 'delete') oldPos++;
      if (op.type === 'equal' || op.type === 'insert') newPos++;
    }

    // Count old/new lines in this hunk
    let oldCount = 0;
    let newCount = 0;

    for (const op of hunkOps) {
      switch (op.type) {
        case 'equal':
          oldCount++;
          newCount++;
          break;
        case 'delete':
          oldCount++;
          break;
        case 'insert':
          newCount++;
          break;
      }
    }

    hunks.push({
      oldStart: oldPos,
      oldCount,
      newStart: newPos,
      newCount,
      lines: hunkOps,
    });
  }

  return hunks;
}

// ============================================================
// Output formatting
// ============================================================

/**
 * Maximum characters in diff output to prevent context overflow.
 */
const MAX_DIFF_SIZE = 50 * 1024; // 50KB

/**
 * Format hunks as a colored unified diff string.
 */
function formatDiff(
  filePath: string,
  hunks: Hunk[],
): string {
  const lines: string[] = [];

  // Header
  lines.push(C.dim + '--- a/' + filePath + C.reset);
  lines.push(C.dim + '+++ b/' + filePath + C.reset);

  let charCount = 0;

  for (const hunk of hunks) {
    if (charCount >= MAX_DIFF_SIZE) break;

    // Hunk header
    const header =
      C.cyan +
      '@@ -' + hunk.oldStart + ',' + hunk.oldCount +
      ' +' + hunk.newStart + ',' + hunk.newCount +
      ' @@' +
      C.reset;
    lines.push(header);
    charCount += header.length;

    for (const op of hunk.lines) {
      if (charCount >= MAX_DIFF_SIZE) {
        lines.push(C.dim + '... (diff truncated at ' + MAX_DIFF_SIZE + ' bytes)' + C.reset);
        break;
      }

      let formatted: string;

      switch (op.type) {
        case 'equal':
          formatted = ' ' + op.line;
          break;
        case 'delete':
          formatted = C.red + '-' + op.line + C.reset;
          break;
        case 'insert':
          formatted = C.green + '+' + op.line + C.reset;
          break;
      }

      lines.push(formatted);
      charCount += formatted.length;
    }
  }

  return lines.join('\n');
}

// ============================================================
// Schema
// ============================================================

const DiffSchema = z.object({
  filePath: z
    .string()
    .describe('Absolute or relative path to the file to compare'),
  newContent: z
    .string()
    .describe('The proposed new content to compare against the current file content'),
  contextLines: z
    .number()
    .int()
    .nonnegative()
    .optional()
    .default(3)
    .describe('Number of context lines to show around changes (default: 3)'),
});

// ============================================================
// TOOL: diff
// ============================================================

/**
 * Create the diff tool.
 *
 * Reads the current content of a file and compares it with the provided
 * new content, producing a unified diff with color-coded output.
 *
 * - If the file does not exist: all new lines are shown as additions.
 * - If the file is empty: all new lines are shown as additions.
 * - If content is identical: returns a "no differences" message.
 * - Output is limited to ~50 KB to prevent context overflow.
 */
export function createDiffTool(): DynamicStructuredTool<typeof DiffSchema> {
  return new DynamicStructuredTool({
    name: 'diff',
    description:
      'Compare the current content of a file with proposed new content ' +
      'and display the differences as a unified diff. ' +
      'Use this to preview changes before applying them. ' +
      'Shows additions in green, deletions in red, ' +
      'with context lines around each change. ' +
      'If the file does not exist, all content is shown as new. ' +
      'If the content is identical, reports no differences.',
    schema: DiffSchema,
    func: async ({
      filePath,
      newContent,
      contextLines,
    }: z.infer<typeof DiffSchema>) => {
      logger.info('diff:', filePath);

      // Read current file content
      let oldContent: string;

      if (!pathExists(filePath)) {
        logger.debug('diff: file does not exist, treating as empty:', filePath);
        oldContent = '';
      } else {
        try {
          oldContent = await readTextFile(filePath);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          return 'Error reading file: ' + message;
        }
      }

      // Normalize line endings for comparison
      const normalize = (text: string): string => text.replace(/\r\n/g, '\n');
      const normalizedOld = normalize(oldContent);
      const normalizedNew = normalize(newContent);

      // If identical, report early
      if (normalizedOld === normalizedNew) {
        return C.dim + 'No differences found. File content is identical.' + C.reset;
      }

      // Split into lines
      const oldLines = normalizedOld === '' ? [] : normalizedOld.split('\n');
      const newLines = normalizedNew === '' ? [] : normalizedNew.split('\n');

      // Compute the diff
      let hunks: Hunk[];

      if (oldLines.length === 0) {
        // File is empty or doesn't exist -- all new lines are additions
        hunks = [
          {
            oldStart: 0,
            oldCount: 0,
            newStart: 1,
            newCount: newLines.length,
            lines: newLines.map((line) => ({ type: 'insert' as const, line })),
          },
        ];
      } else if (newLines.length === 0) {
        // All lines deleted
        hunks = [
          {
            oldStart: 1,
            oldCount: oldLines.length,
            newStart: 0,
            newCount: 0,
            lines: oldLines.map((line) => ({ type: 'delete' as const, line })),
          },
        ];
      } else {
        const dp = lcsTable(oldLines, newLines);
        const ops = backtrack(dp, oldLines, newLines);
        hunks = computeHunks(ops, contextLines);
      }

      if (hunks.length === 0) {
        return C.dim + 'No differences found. File content is identical.' + C.reset;
      }

      // Format output
      const output = formatDiff(filePath, hunks);

      // Summary line
      const addedChars = newContent.length;
      const removedChars = oldContent.length;
      const summary =
        '\n' +
        C.dim +
        '--- ' + oldLines.length + ' lines, ' + removedChars + ' chars -> ' +
        newLines.length + ' lines, ' + addedChars + ' chars' +
        C.reset;

      return output + summary;
    },
  });
}
