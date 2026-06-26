// ============================================================
// ai-code - Git Tools
//
// LangChain DynamicStructuredTool implementations for Git operations:
// - git_diff: Show differences between commits, working tree, and index
// - git_status: Show working tree status
// - git_log: Show commit logs
// - git_commit: Stage and commit changes
//
// CRITICAL: All output uses ONLY ASCII characters and ANSI
// escape codes for coloring (no Unicode, no emoji).
// ============================================================

import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { execSync, type ExecSyncOptions } from 'node:child_process';
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
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
} as const;

// ============================================================
// Constants
// ============================================================

const MAX_OUTPUT_LINES = 2000;

// ============================================================
// Helper: runGit
//
// Executes a git command synchronously and returns the result.
// Handles common errors: git not found, not a git repo.
// ============================================================

interface GitResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/**
 * Execute a git command and return stdout, stderr, exitCode.
 * Commands are executed in the current working directory.
 */
function runGit(args: string[]): GitResult {
  // Build the command string, quoting args that contain spaces
  const cmd =
    'git ' +
    args
      .map((a) => {
        if (/[ "']/.test(a)) {
          return a.includes('"') ? "'" + a + "'" : '"' + a + '"';
        }
        return a;
      })
      .join(' ');

  const opts: ExecSyncOptions = {
    cwd: process.cwd(),
    encoding: 'utf-8',
    maxBuffer: 10 * 1024 * 1024,
  };

  try {
    const stdout = execSync(cmd, opts) as string;
    return { stdout: stdout.trimEnd(), stderr: '', exitCode: 0 };
  } catch (e: unknown) {
    const err = e as {
      code?: string;
      stdout?: string | Buffer;
      stderr?: string | Buffer;
      status?: number;
      message?: string;
    };

    // Git not installed / not in PATH
    if (err.code === 'ENOENT') {
      return {
        stdout: '',
        stderr: 'Git is not installed or not available in PATH.',
        exitCode: 127,
      };
    }

    const stderr = (err.stderr ?? '').toString().trim();
    const stdout = (err.stdout ?? '').toString().trim();

    return {
      stdout,
      stderr: stderr || err.message || 'Git command failed.',
      exitCode: err.status ?? 1,
    };
  }
}

/**
 * Check if a GitResult indicates a "not a git repository" error.
 */
function isNotRepoError(result: GitResult): boolean {
  return (
    result.exitCode !== 0 &&
    (result.stderr.includes('not a git repository') ||
      result.stderr.includes('fatal: not a git repository') ||
      result.stderr.includes('Not a git repository'))
  );
}

/**
 * Format a "not a git repository" error message.
 */
function notRepoError(): string {
  return C.red + 'Error: Not a git repository.' + C.reset;
}

/**
 * Format a "git not installed" error message.
 */
function gitNotFoundError(): string {
  return C.red + 'Error: Git is not installed or not available in PATH.' + C.reset;
}

/**
 * Format a generic git error message.
 */
function gitError(result: GitResult): string {
  return C.red + 'Git error: ' + result.stderr + C.reset;
}

// ============================================================
// Helper: colorizeDiff
//
// Parses unified diff output and applies ANSI colors:
// - Green for additions (lines starting with +)
// - Red for deletions (lines starting with -)
// - Cyan for hunk headers (lines starting with @@)
// - Dim for metadata lines (diff --git, index, ---, +++)
// ============================================================

function colorizeDiff(output: string): string {
  const lines = output.split('\n');
  const result: string[] = [];

  for (const line of lines) {
    if (
      line.startsWith('diff --git ') ||
      line.startsWith('index ') ||
      line.startsWith('--- ') ||
      line.startsWith('+++ ')
    ) {
      result.push(C.dim + line + C.reset);
    } else if (line.startsWith('@@')) {
      result.push(C.cyan + line + C.reset);
    } else if (line.startsWith('-') && !line.startsWith('--- ')) {
      result.push(C.red + line + C.reset);
    } else if (line.startsWith('+') && !line.startsWith('+++ ')) {
      result.push(C.green + line + C.reset);
    } else {
      result.push(line);
    }
  }

  return result.join('\n');
}

// ============================================================
// Helper: colorizeStatusLong
//
// Applies ANSI colors to the long-format `git status` output:
// - "Changes to be committed:" section header in green
// - "Changes not staged for commit:" section header in yellow
// - "Untracked files:" section header in yellow
// - Status messages like "nothing to commit" in green
// ============================================================

function colorizeStatusLong(output: string): string {
  let result = output;

  // Section headers
  result = result.replace(
    /^(Changes to be committed:)$/gm,
    C.green + C.bold + '$1' + C.reset,
  );
  result = result.replace(
    /^(Changes not staged for commit:)$/gm,
    C.yellow + C.bold + '$1' + C.reset,
  );
  result = result.replace(
    /^(Untracked files:)$/gm,
    C.yellow + C.bold + '$1' + C.reset,
  );

  // Sub-section hints
  result = result.replace(
    /^(  \(use "git .+? to .+?\))$/gm,
    C.dim + '$1' + C.reset,
  );

  // Status summary messages
  result = result.replace(
    /^(nothing to commit, .+)$/gm,
    C.green + '$1' + C.reset,
  );
  result = result.replace(
    /^(no changes added to commit .+)$/gm,
    C.yellow + '$1' + C.reset,
  );
  result = result.replace(
    /^(nothing added to commit .+)$/gm,
    C.yellow + C.bold + '$1' + C.reset,
  );

  return result;
}

// ============================================================
// Helper: colorizeStatusPorcelain
//
// Applies ANSI colors to short/porcelain `git status --porcelain`
// output based on the XY status codes:
// - ' ' (first column empty) = unmodified staging area (normal)
// - 'M' = modified (yellow)
// - 'A' = added (green)
// - 'D' = deleted (red)
// - 'R' = renamed (yellow)
// - 'C' = copied (yellow)
// - '?' = untracked (yellow)
// - '!' = ignored (dim)
// - 'U' = unmerged (red)
// ============================================================

function statusColorFor(code: string): string {
  switch (code) {
    case 'A':
      return C.green;
    case 'M':
    case 'R':
    case 'C':
      return C.yellow;
    case 'D':
    case 'U':
      return C.red;
    case '?':
      return C.yellow;
    case '!':
      return C.dim;
    default:
      return C.reset;
  }
}

function colorizeStatusPorcelain(output: string): string {
  const lines = output.split('\n');
  const result: string[] = [];

  for (const line of lines) {
    if (line.length < 2) {
      result.push(line);
      continue;
    }

    // Porcelain format: XY <path>[ -> <renamed_path>]
    const x = line[0] as string;
    const y = line[1] as string;
    const pathPart = line.slice(3);

    // Pick the color based on the "most significant" status
    // Staging area (X) takes priority over working tree (Y)
    const color = x !== ' ' && x !== '?' && x !== '!'
      ? statusColorFor(x)
      : statusColorFor(y);

    result.push(color + '[' + x + y + ']' + C.reset + '  ' + pathPart);
  }

  return result.join('\n');
}

// ============================================================
// Helper: colorizeLog
//
// Applies ANSI colors to git log output:
// - Oneline format: commit hash in yellow, message in normal
// - Full format: "commit" line in yellow,
//   "Author:" and "Date:" lines in cyan,
//   message body in normal
// ============================================================

/**
 * Colorize one line of git log --oneline output.
 */
function colorizeLogOneline(output: string): string {
  return output
    .split('\n')
    .map((line) => {
      // Oneline format: <hash> <message>
      const match = line.match(/^([a-f0-9]{7,40}) (.+)$/);
      if (match) {
        return C.yellow + (match[1] as string) + C.reset + ' ' + (match[2] as string);
      }
      return line;
    })
    .join('\n');
}

/**
 * Colorize full git log output.
 */
function colorizeLogFull(output: string): string {
  return output
    .split('\n')
    .map((line) => {
      if (line.startsWith('commit ')) {
        return C.yellow + line + C.reset;
      }
      if (line.startsWith('Author:')) {
        return C.cyan + line + C.reset;
      }
      if (line.startsWith('Date:')) {
        return C.cyan + line + C.reset;
      }
      return line;
    })
    .join('\n');
}

// ============================================================
// TOOL: git_diff
// ============================================================

const GitDiffSchema = z.object({
  staged: z
    .boolean()
    .optional()
    .default(false)
    .describe(
      'If true, show staged changes (--staged). Default: show working tree changes.',
    ),
  file: z
    .string()
    .optional()
    .describe('Optional file path to restrict the diff to a specific file.'),
});

/**
 * Create the git_diff tool.
 *
 * Shows differences between the working tree and the index (default),
 * or between the index and the last commit (staged).
 * Output is colorized and truncated at 2000 lines.
 */
export function createGitDiffTool(): DynamicStructuredTool<typeof GitDiffSchema> {
  return new DynamicStructuredTool({
    name: 'git_diff',
    description:
      'Show changes in the working tree or staging area. ' +
      'Use this to inspect what has changed before committing. ' +
      'Can show staged changes (--staged) or working tree changes. ' +
      'Optionally restrict to a specific file. ' +
      'Output is truncated at 2000 lines for performance.',
    schema: GitDiffSchema,
    func: async ({ staged, file }: z.infer<typeof GitDiffSchema>) => {
      logger.info('git_diff:', staged ? '(staged)' : '(working tree)', file ?? '');

      const args: string[] = ['diff'];
      if (staged) args.push('--cached');
      if (file) args.push('--', file);

      const result = runGit(args);

      if (result.exitCode !== 0) {
        if (isNotRepoError(result)) return notRepoError();
        if (result.exitCode === 127) return gitNotFoundError();
        return gitError(result);
      }

      if (!result.stdout) {
        return C.dim + 'No changes found.' + C.reset;
      }

      const lines = result.stdout.split('\n');
      let output = lines.slice(0, MAX_OUTPUT_LINES).join('\n');

      if (lines.length > MAX_OUTPUT_LINES) {
        output +=
          '\n' +
          C.dim +
          '...(output truncated at ' +
          MAX_OUTPUT_LINES +
          ' lines)' +
          C.reset;
      }

      return colorizeDiff(output);
    },
  });
}

// ============================================================
// TOOL: git_status
// ============================================================

const GitStatusSchema = z.object({
  porcelain: z
    .boolean()
    .optional()
    .default(false)
    .describe(
      'If true, use --porcelain format (machine-readable). ' +
        'Default: human-readable long format.',
    ),
});

/**
 * Create the git_status tool.
 *
 * Shows the working tree status. In default mode, output is
 * colorized with section headers. In porcelain mode, status
 * codes are displayed with ANSI colors.
 */
export function createGitStatusTool(): DynamicStructuredTool<typeof GitStatusSchema> {
  return new DynamicStructuredTool({
    name: 'git_status',
    description:
      'Show the current state of the working tree and staging area. ' +
      'Use this to see which files are modified, staged, or untracked. ' +
      'Supports both human-readable and --porcelain machine formats.',
    schema: GitStatusSchema,
    func: async ({ porcelain }: z.infer<typeof GitStatusSchema>) => {
      logger.info('git_status:', porcelain ? '(porcelain)' : '(long)');

      const args: string[] = ['status'];
      if (porcelain) args.push('--porcelain');

      const result = runGit(args);

      if (result.exitCode !== 0) {
        if (isNotRepoError(result)) return notRepoError();
        if (result.exitCode === 127) return gitNotFoundError();
        return gitError(result);
      }

      if (!result.stdout) {
        return C.green + 'Nothing to commit, working tree clean.' + C.reset;
      }

      if (porcelain) {
        return colorizeStatusPorcelain(result.stdout);
      }

      return colorizeStatusLong(result.stdout);
    },
  });
}

// ============================================================
// TOOL: git_log
// ============================================================

const GitLogSchema = z.object({
  count: z
    .number()
    .int()
    .positive()
    .optional()
    .default(10)
    .describe('Number of commits to show (default: 10).'),
  oneline: z
    .boolean()
    .optional()
    .default(false)
    .describe(
      'If true, show each commit on a single line (--oneline). ' +
        'Default: show full commit details.',
    ),
});

/**
 * Create the git_log tool.
 *
 * Shows commit history. Can display full commit details or
 * one-line-per-commit summary. Output is colorized.
 */
export function createGitLogTool(): DynamicStructuredTool<typeof GitLogSchema> {
  return new DynamicStructuredTool({
    name: 'git_log',
    description:
      'Show commit history for the current branch. ' +
      'Use this to review recent commits, find commit hashes, ' +
      'or see what changed. ' +
      'Defaults to the last 10 commits. ' +
      'Use --oneline for a compact summary view.',
    schema: GitLogSchema,
    func: async ({ count, oneline }: z.infer<typeof GitLogSchema>) => {
      logger.info('git_log:', count, 'commits', oneline ? '(oneline)' : '(full)');

      const args: string[] = ['log', '-n', String(count)];
      if (oneline) args.push('--oneline');

      const result = runGit(args);

      if (result.exitCode !== 0) {
        if (isNotRepoError(result)) return notRepoError();
        if (result.exitCode === 127) return gitNotFoundError();

        // Empty commit history (orphan branch, etc.)
        if (
          result.stderr.includes('does not have any commits') ||
          result.stderr.includes('fatal: your current branch')
        ) {
          return C.yellow + 'No commits yet in this repository.' + C.reset;
        }

        return gitError(result);
      }

      if (!result.stdout) {
        return C.dim + 'No commits found.' + C.reset;
      }

      if (oneline) {
        return colorizeLogOneline(result.stdout);
      }

      return colorizeLogFull(result.stdout);
    },
  });
}

// ============================================================
// TOOL: git_commit
// ============================================================

const GitCommitSchema = z.object({
  message: z
    .string()
    .min(1)
    .describe('The commit message. Must be at least 1 character.'),
  files: z
    .array(z.string())
    .optional()
    .describe(
      'Optional list of file paths to stage and commit. ' +
        'If omitted, all changes (including untracked files) are staged.',
    ),
});

/**
 * Create the git_commit tool.
 *
 * Stages the specified files (or all changes if no files specified),
 * then creates a commit with the given message.
 *
 * REQUIRES APPROVAL: This tool modifies the git history and working tree.
 */
export function createGitCommitTool(): DynamicStructuredTool<typeof GitCommitSchema> {
  return new DynamicStructuredTool({
    name: 'git_commit',
    description:
      'Stage files and create a commit with the given message. ' +
      'If no files are specified, all changes including untracked files ' +
      'are staged (git add -A). ' +
      'REQUIRES USER APPROVAL before executing.',
    schema: GitCommitSchema,
    func: async ({ message, files }: z.infer<typeof GitCommitSchema>) => {
      logger.info('git_commit:', message.slice(0, 60) + (message.length > 60 ? '...' : ''));

      // ---- Step 1: Verify this is a git repo ----
      const repoCheck = runGit(['rev-parse', '--git-dir']);
      if (repoCheck.exitCode !== 0) {
        if (repoCheck.exitCode === 127) return gitNotFoundError();
        return notRepoError();
      }

      // ---- Step 2: Stage files ----
      const addArgs: string[] = ['add'];
      if (files && files.length > 0) {
        // Stage specified files
        for (const f of files) {
          addArgs.push(f);
        }
      } else {
        // Stage all changes
        addArgs.push('-A');
      }

      const addResult = runGit(addArgs);

      if (addResult.exitCode !== 0) {
        if (addResult.exitCode === 127) return gitNotFoundError();

        // Check for file-specific errors
        if (addResult.stderr.includes('did not match any files')) {
          return (
            C.red +
            'Error: Some specified files do not exist or are not tracked. ' +
            addResult.stderr +
            C.reset
          );
        }

        return C.red + 'Failed to stage files: ' + addResult.stderr + C.reset;
      }

      // ---- Step 3: Create the commit ----
      const commitResult = runGit(['commit', '-m', message]);

      if (commitResult.exitCode !== 0) {
        // Empty commit: everything is already committed
        if (
          commitResult.stderr.includes('nothing to commit') ||
          commitResult.stderr.includes('nothing added to commit')
        ) {
          return C.yellow + 'Nothing to commit. Working tree is clean.' + C.reset;
        }

        return C.red + 'Commit failed: ' + commitResult.stderr + C.reset;
      }

      // ---- Step 4: Format success output ----
      const output = commitResult.stdout || 'Commit created successfully.';

      return C.green + output + C.reset;
    },
  });
}

// ============================================================
// Convenience: create all git tools at once
// ============================================================

/**
 * Create all four git tools as an array.
 *
 * Order: git_diff, git_status, git_log, git_commit
 */
export function createGitTools() {
  return [
    createGitDiffTool(),
    createGitStatusTool(),
    createGitLogTool(),
    createGitCommitTool(),
  ] as const;
}

/**
 * Type representing the tuple of all git tools.
 */
export type GitTools = ReturnType<typeof createGitTools>;
