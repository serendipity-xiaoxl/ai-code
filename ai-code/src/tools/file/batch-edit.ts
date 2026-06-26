// ============================================================
// ai-code - Batch Edit Tool
//
// LangChain DynamicStructuredTool implementation for performing
// a regex-based find-and-replace across multiple files at once.
//
// Supports two modes:
//   preview  - Show matched files, occurrence counts, and diffs
//   apply    - Apply replacements and write files
//
// REQUIRES APPROVAL: always prompts the user before executing,
// regardless of preview mode.
//
// CRITICAL: All output uses ONLY ASCII characters and ANSI
// escape codes for coloring (no Unicode, no emoji).
// ============================================================

import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { readTextFile, writeTextFile, pathExists, listDir } from '../../utils/os-compat';
import { getLogger } from '../../utils/logger';
import { relative, resolve } from 'node:path';

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
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
} as const;

// ============================================================
// Directories to skip during file traversal
// ============================================================

const SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', '.next', '.nuxt',
  'coverage', '.cache', '__pycache__', '.venv', 'venv',
  '.claude', '.ai-code', '.idea', '.vscode', '.DS_Store',
]);

// ============================================================
// Glob matching utilities
// ============================================================

/**
 * Test whether a single path segment matches a glob part.
 * Supports * (any characters), ? (single character), and literals.
 */
function matchSegment(part: string, name: string): boolean {
  if (part === '**' || part === '*') return true;

  const escaped = part.replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.');

  return new RegExp('^' + escaped + '$').test(name);
}

/**
 * Recursively collect all files under a directory.
 */
async function collectAllFiles(
  dirPath: string,
  results: string[],
  cwd: string,
): Promise<void> {
  let entries: Array<{ name: string; path: string; isDirectory: boolean }>;
  try {
    entries = await listDir(dirPath);
  } catch {
    return;
  }

  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue;
    if (entry.name.startsWith('.')) continue;

    if (entry.isDirectory) {
      await collectAllFiles(entry.path, results, cwd);
    } else {
      results.push(relative(cwd, entry.path));
    }
  }
}

/**
 * Walk the filesystem and collect paths matching a glob pattern.
 *
 * Supports standard glob syntax:
 *   **     - zero or more directory levels
 *   *      - any sequence of non-separator characters
 *   ?      - any single non-separator character
 *   literals - exact matches
 */
async function findFiles(
  rootDir: string,
  pattern: string,
): Promise<string[]> {
  const parts = pattern.split('/').filter(Boolean);
  if (parts.length === 0) return [];

  const results: string[] = [];
  const cwd = process.cwd();

  async function walk(currentDir: string, partIndex: number): Promise<void> {
    if (partIndex >= parts.length) return;

    const currentPart = parts[partIndex] as string;

    // Handle ** (zero or more directory levels)
    if (currentPart === '**') {
      if (partIndex === parts.length - 1) {
        // ** at the end: collect everything recursively
        await collectAllFiles(currentDir, results, cwd);
        return;
      }

      // Try matching remaining parts at this level, then recurse deeper
      await walk(currentDir, partIndex + 1);

      let entries: Array<{ name: string; path: string; isDirectory: boolean }>;
      try {
        entries = await listDir(currentDir);
      } catch {
        return;
      }

      for (const entry of entries) {
        if (SKIP_DIRS.has(entry.name)) continue;
        if (entry.name.startsWith('.')) continue;
        if (entry.isDirectory) {
          await walk(entry.path, partIndex);
        }
      }
      return;
    }

    // Regular segment: list directory and filter entries
    let entries: Array<{ name: string; path: string; isDirectory: boolean }>;
    try {
      entries = await listDir(currentDir);
    } catch {
      return;
    }

    for (const entry of entries) {
      if (SKIP_DIRS.has(entry.name)) continue;
      if (entry.name.startsWith('.')) continue;
      if (!matchSegment(currentPart, entry.name)) continue;

      if (partIndex === parts.length - 1) {
        // Last pattern part: add file or directory
        results.push(relative(cwd, entry.path));
      } else if (entry.isDirectory) {
        await walk(entry.path, partIndex + 1);
      }
    }
  }

  await walk(rootDir, 0);
  return results;
}

// ============================================================
// Line-level diff for preview
// ============================================================

/** A single operation in the diff output. */
interface DiffOp {
  type: 'equal' | 'delete' | 'insert';
  line: string;
}

/**
 * Compute a simple LCS-based line diff between two strings.
 * Returns an array of DiffOps describing how to transform oldText into newText.
 */
function computeLineDiff(oldText: string, newText: string): DiffOp[] {
  if (oldText === newText) return [];

  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');
  const m = oldLines.length;
  const n = newLines.length;

  // Build LCS table
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

  // Backtrack through the table to build the diff
  const reversed: DiffOp[] = [];
  let i = m;
  let j = n;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      reversed.push({ type: 'equal', line: oldLines[i - 1] as string });
      i--;
      j--;
    } else if (
      j > 0 &&
      (i === 0 || (dp[i]?.[j - 1] as number) >= (dp[i - 1]?.[j] as number))
    ) {
      reversed.push({ type: 'insert', line: newLines[j - 1] as string });
      j--;
    } else if (i > 0) {
      reversed.push({ type: 'delete', line: oldLines[i - 1] as string });
      i--;
    }
  }

  // Reverse to get chronological order
  const result: DiffOp[] = [];
  for (let k = reversed.length - 1; k >= 0; k--) {
    result.push(reversed[k] as DiffOp);
  }

  return result;
}

// ============================================================
// Output formatting
// ============================================================

/** Maximum diff lines shown per file in preview mode. */
const MAX_DIFF_LINES = 60;

/**
 * Format a file's diff for preview display.
 */
function formatFileDiff(filePath: string, ops: DiffOp[]): string {
  if (ops.length === 0) {
    return C.dim + '  No changes.' + C.reset;
  }

  const lines: string[] = [];
  lines.push('');
  lines.push(C.cyan + '  --- a/' + filePath + C.reset);
  lines.push(C.cyan + '  +++ b/' + filePath + C.reset);

  const display = ops.length > MAX_DIFF_LINES
    ? ops.slice(0, MAX_DIFF_LINES)
    : ops;

  for (const op of display) {
    switch (op.type) {
      case 'equal':
        lines.push('   ' + op.line);
        break;
      case 'delete':
        lines.push(C.red + '-  ' + op.line + C.reset);
        break;
      case 'insert':
        lines.push(C.green + '+  ' + op.line + C.reset);
        break;
    }
  }

  if (ops.length > MAX_DIFF_LINES) {
    lines.push(
      C.dim + '  ... (' + (ops.length - MAX_DIFF_LINES) + ' more lines)' + C.reset,
    );
  }

  return lines.join('\n');
}

// ============================================================
// Schema
// ============================================================

const BatchEditSchema = z.object({
  pattern: z
    .string()
    .min(1)
    .describe('Regex pattern to search for in file contents'),
  replacement: z
    .string()
    .describe('Replacement text for matched pattern'),
  glob: z
    .string()
    .min(1)
    .describe('File glob pattern (e.g., "src/**/*.ts" or "**/*.json")'),
  preview: z
    .boolean()
    .optional()
    .default(true)
    .describe(
      'If true (default), preview changes with occurrence counts and diffs ' +
      'before applying. Set to false to apply changes directly.',
    ),
});

// ============================================================
// Result types
// ============================================================

/** Status for a single file in the batch result. */
type FileStatus = 'preview' | 'changed' | 'skipped' | 'error';

/** Per-file result data. */
interface FileResult {
  file: string;
  occurrences: number;
  status: FileStatus;
  errorMessage?: string;
  diffOps?: DiffOp[];
}

// ============================================================
// TOOL: batch_edit
// ============================================================

/**
 * Create the batch_edit tool.
 *
 * Performs a regex find-and-replace across files matching a glob pattern.
 * In preview mode (default), shows a table of matched files with occurrence
 * counts and per-file diffs without modifying anything.
 * In apply mode, writes the replacements to disk.
 *
 * ALWAYS requires user approval before execution.
 *
 * Error handling:
 * - No files matching the glob returns an informative message.
 * - Invalid regex pattern returns an error message.
 * - Files that cannot be read or written are reported per-file.
 * - Binary/skip dirs (node_modules, .git, etc.) are automatically excluded.
 */
export function createBatchEditTool(): DynamicStructuredTool<typeof BatchEditSchema> {
  return new DynamicStructuredTool({
    name: 'batch_edit',
    description:
      'Perform a batch find-and-replace across multiple files using regex. ' +
      'Provide a regex pattern, replacement text, and a glob to match files. ' +
      'By default, shows a preview with occurrence counts and diffs. ' +
      'Set preview=false to apply changes directly. ' +
      'REQUIRES USER APPROVAL before executing. ' +
      'Use this for refactoring, renaming, or bulk edits across the codebase.',
    schema: BatchEditSchema,
    func: async ({
      pattern,
      replacement,
      glob,
      preview,
    }: z.infer<typeof BatchEditSchema>) => {
      logger.info('batch_edit:', pattern, '->', replacement, 'glob:', glob);

      // ---- Step 1: Compile the regex ----
      let regex: RegExp;
      try {
        regex = new RegExp(pattern, 'g');
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return C.red + 'Error: Invalid regex pattern: ' + msg + C.reset;
      }

      // ---- Step 2: Find matching files ----
      const cwd = process.cwd();
      let matchedFiles: string[];

      try {
        matchedFiles = await findFiles(cwd, glob);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return C.red + 'Error searching for files: ' + msg + C.reset;
      }

      if (matchedFiles.length === 0) {
        return C.yellow + 'No files found matching: ' + glob + C.reset;
      }

      // ---- Step 3: Process each file ----
      const results: FileResult[] = [];

      for (const filePath of matchedFiles) {
        const fullPath = resolve(cwd, filePath);

        if (!pathExists(fullPath)) {
          results.push({ file: filePath, occurrences: 0, status: 'skipped' });
          continue;
        }

        try {
          const content = await readTextFile(fullPath);

          // Count occurrences
          regex.lastIndex = 0;
          const matches = content.match(regex);
          const count = matches ? matches.length : 0;

          if (count === 0) {
            results.push({ file: filePath, occurrences: 0, status: 'skipped' });
            continue;
          }

          if (preview) {
            // Preview mode: compute diff, do not write
            const newContent = content.replace(regex, replacement);
            const diffOps = computeLineDiff(content, newContent);
            results.push({
              file: filePath,
              occurrences: count,
              status: 'preview',
              diffOps,
            });
          } else {
            // Apply mode: write modified content
            const newContent = content.replace(regex, replacement);
            await writeTextFile(fullPath, newContent);
            results.push({
              file: filePath,
              occurrences: count,
              status: 'changed',
            });
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          results.push({
            file: filePath,
            occurrences: 0,
            status: 'error',
            errorMessage: msg,
          });
        }
      }

      // ---- Step 4: Build output ----
      const statusLabel: Record<FileStatus, string> = {
        preview: 'preview',
        changed: 'changed',
        skipped: 'skipped',
        error: 'error',
      };

      // Calculate column widths
      let maxFileLen = 4; // width of "File" header
      for (const r of results) {
        if (r.file.length > maxFileLen) maxFileLen = r.file.length;
      }

      const fileColWidth = maxFileLen + 2; // 1 space padding on each side
      const occColWidth = 13; // " Occurrences " fits 11-char header
      const statusColWidth = 9; // " changed  " fits longest status

      // Helper: horizontal rule
      const hr =
        '+' +
        '-'.repeat(fileColWidth) +
        '+' +
        '-'.repeat(occColWidth) +
        '+' +
        '-'.repeat(statusColWidth) +
        '+';

      // Helper: format a row
      // Each column between pipes: space + padded_content + space = colWidth
      const row = (file: string, occ: string, status: string): string =>
        '| ' +
        file.padEnd(fileColWidth - 2) +
        ' | ' +
        occ.padStart(occColWidth - 2) +
        ' | ' +
        status.padEnd(statusColWidth - 2) +
        '|';

      // Build table
      const headerRow = row('File', 'Occurrences', 'Status');
      const modeIndicator = preview ? 'preview' : 'apply';

      const tableLines: string[] = [
        '',
        C.bold + '[BATCH EDIT] ' + C.reset +
          C.cyan + pattern + C.reset + ' -> ' +
          C.green + replacement + C.reset + ' in ' +
          C.yellow + glob + C.reset +
          C.dim + ' (' + modeIndicator + ' mode)' + C.reset,
        hr,
        headerRow,
        hr,
      ];

      for (const r of results) {
        const occStr = String(r.occurrences);
        const coloredFile = r.status === 'error'
          ? C.red + r.file + C.reset
          : r.status === 'changed'
            ? C.green + r.file + C.reset
            : r.file;

        // Build the row with proper widths (ANSI codes don't count in width)
        const plainRow = row(r.file, occStr, statusLabel[r.status]);
        // Insert ANSI coloring into the row for file column
        const coloredRow = r.status === 'error' || r.status === 'changed'
          ? plainRow.replace(r.file, coloredFile)
          : plainRow;

        tableLines.push(coloredRow);

        // Add error detail line
        if (r.status === 'error' && r.errorMessage) {
          tableLines.push(C.dim + '  ! ' + r.errorMessage + C.reset);
        }
      }

      tableLines.push(hr);

      // ---- Step 5: Add diffs for preview mode ----
      if (preview) {
        const previewFiles = results.filter(
          (r) => r.status === 'preview' && r.diffOps && r.diffOps.length > 0,
        );

        if (previewFiles.length > 0) {
          tableLines.push('');
          tableLines.push(C.bold + 'Changes:' + C.reset);

          for (const pf of previewFiles) {
            tableLines.push(formatFileDiff(pf.file, pf.diffOps!));
          }
        }
      }

      // ---- Step 6: Summary ----
      const changedCount = results.filter((r) => r.status === 'changed').length;
      const previewCount = results.filter((r) => r.status === 'preview').length;
      const skippedCount = results.filter((r) => r.status === 'skipped').length;
      const errorCount = results.filter((r) => r.status === 'error').length;
      const totalReplacements = results.reduce(
        (sum, r) => sum + r.occurrences,
        0,
      );

      const summaryParts: string[] = [];
      if (changedCount > 0) {
        summaryParts.push(C.green + String(changedCount) + ' file(s) changed' + C.reset);
      }
      if (previewCount > 0) {
        summaryParts.push(C.cyan + String(previewCount) + ' file(s) would change' + C.reset);
      }
      if (skippedCount > 0) {
        summaryParts.push(C.dim + String(skippedCount) + ' file(s) skipped' + C.reset);
      }
      if (errorCount > 0) {
        summaryParts.push(C.red + String(errorCount) + ' file(s) errored' + C.reset);
      }
      summaryParts.push(String(totalReplacements) + ' total replacement(s)');

      const summaryLine = 'Summary: ' + summaryParts.join(', ');

      tableLines.push('');
      tableLines.push(summaryLine);

      return tableLines.join('\n');
    },
  });
}
