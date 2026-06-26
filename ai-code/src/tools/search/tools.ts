// ============================================================
// ai-code - Search Tools
//
// LangChain DynamicStructuredTool implementations for searching:
// - grep: Search file contents with regex patterns
// - glob: Find files matching a pattern
// ============================================================

import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { readTextFile, listDir } from '../../utils/os-compat';
import { getLogger } from '../../utils/logger';
import { relative } from 'node:path';

const logger = getLogger();

/**
 * Directories to skip when searching.
 */
const SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', '.next', '.nuxt',
  'coverage', '.cache', '__pycache__', '.venv', 'venv',
  '.claude', '.ai-code', '.idea', '.vscode', '.DS_Store',
]);

/**
 * File extensions considered text/source files.
 */
const TEXT_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.mts', '.cts',
  '.json', '.yaml', '.yml', '.toml', '.md', '.txt', '.html',
  '.css', '.scss', '.less', '.vue', '.svelte',
  '.py', '.go', '.rs', '.java', '.kt', '.swift',
  '.rb', '.php', '.cs', '.cpp', '.c', '.h', '.hpp',
  '.sh', '.bash', '.zsh', '.env', '.gitignore',
  '.sql', '.graphql', '.proto',
]);

// ============================================================
// TOOL: grep
// ============================================================

const GrepSchema = z.object({
  pattern: z
    .string()
    .min(1)
    .describe('The text or regex pattern to search for'),
  path: z
    .string()
    .optional()
    .default('.')
    .describe('Directory path to search in (default: current directory)'),
  include: z
    .string()
    .optional()
    .describe('File pattern to include (e.g., "*.ts")'),
  maxResults: z
    .number()
    .int()
    .positive()
    .optional()
    .default(50)
    .describe('Maximum number of results to return (default: 50)'),
  ignoreCase: z
    .boolean()
    .optional()
    .default(false)
    .describe('Case-insensitive search'),
});

/**
 * Create the grep tool.
 * Searches file contents for a pattern.
 */
export function createGrepTool(): DynamicStructuredTool<typeof GrepSchema> {
  return new DynamicStructuredTool({
    name: 'grep',
    description: 'Search for a pattern across files in the project. ' +
      'Returns matching lines with file paths and line numbers. ' +
      'Use this to find where functions are defined, find imports, ' +
      'or search for specific text across the codebase.',
    schema: GrepSchema,
    func: async ({
      pattern,
      path,
      include: _include,
      maxResults,
      ignoreCase,
    }: z.infer<typeof GrepSchema>) => {
      logger.info('grep:', pattern, 'in', path);

      const results: Array<{ file: string; line: number; content: string }> = [];
      const flags = ignoreCase ? 'gi' : 'g';
      let regex: RegExp;

      try {
        regex = new RegExp(pattern, flags);
      } catch {
        // If pattern is not a valid regex, treat as literal string
        regex = new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags);
      }

      try {
        await searchFiles(path, regex, results, maxResults, 0);
      } catch (error) {
        logger.debug('grep error:', error);
      }

      if (results.length === 0) {
        return 'No matches found for: ' + pattern;
      }

      const lines = results.map(
        (r) =>
          r.file +
          ':' +
          r.line +
          ' |' +
          r.content.trim(),
      );

      const truncated = results.length >= maxResults ? '\n(Results truncated at ' + maxResults + ')' : '';
      return 'Found ' + results.length + ' matches for: ' + pattern + '\n' +
        lines.join('\n') + truncated;
    },
  });
}

/**
 * Recursively search files for a pattern.
 */
async function searchFiles(
  dirPath: string,
  regex: RegExp,
  results: Array<{ file: string; line: number; content: string }>,
  maxResults: number,
  depth: number,
): Promise<void> {
  if (depth > 8 || results.length >= maxResults) return;

  let entries: Array<{ name: string; path: string; isDirectory: boolean }>;

  try {
    entries = await listDir(dirPath);
  } catch {
    return;
  }

  const cwd = process.cwd();

  for (const entry of entries) {
    if (results.length >= maxResults) break;
    if (SKIP_DIRS.has(entry.name)) continue;
    if (entry.name.startsWith('.')) continue;

    if (entry.isDirectory) {
      await searchFiles(entry.path, regex, results, maxResults, depth + 1);
    } else {
      const ext = entry.name.includes('.')
        ? entry.name.slice(entry.name.lastIndexOf('.'))
        : '';

      if (!TEXT_EXTENSIONS.has(ext)) continue;

      try {
        const content = await readTextFile(entry.path);
        const relPath = relative(cwd, entry.path);
        const lines = content.split('\n');

        for (let i = 0; i < lines.length; i++) {
          if (results.length >= maxResults) break;
          const line = lines[i] as string;
          if (regex.test(line)) {
            results.push({ file: relPath, line: i + 1, content: line });
          }
        }
      } catch {
        // Skip files we can't read
      }
    }
  }
}

// ============================================================
// TOOL: glob
// ============================================================

const GlobSchema = z.object({
  pattern: z
    .string()
    .min(1)
    .describe('Glob pattern to match (e.g., "src/**/*.ts", "**/*.json")'),
  path: z
    .string()
    .optional()
    .default('.')
    .describe('Root directory to search in (default: current directory)'),
  maxResults: z
    .number()
    .int()
    .positive()
    .optional()
    .default(200)
    .describe('Maximum number of results (default: 200)'),
});

/**
 * Simple glob matching implementation.
 * Supports * (single level), ** (recursive), and ? (single char).
 */
function matchGlob(parts: string[], name: string): boolean {
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i] as string;

    if (part === '**') {
      // ** matches everything including subdirectories
      return true;
    }

    if (part === '*') {
      // * matches any single name
      return true;
    }

    // Simple wildcard matching
    const regex = new RegExp(
      '^' + part.replace(/\./g, '\\.').replace(/\*/g, '.*').replace(/\?/g, '.') + '$',
    );
    if (regex.test(name)) {
      continue;
    }

    return false;
  }

  return true;
}

/**
 * Find files matching a simple glob pattern.
 * Uses recursive directory traversal.
 */
async function findFiles(
  dirPath: string,
  pattern: string,
  maxResults: number,
  depth: number,
): Promise<string[]> {
  if (depth > 10) return [];

  const results: string[] = [];
  const cwd = process.cwd();

  // Split pattern into directory part and file part
  const parts = pattern.split('/');

  async function walk(
    currentDir: string,
    patternIndex: number,
    currentDepth: number,
  ): Promise<void> {
    if (results.length >= maxResults || currentDepth > 10) return;

    const currentPart = parts[patternIndex];
    if (!currentPart) return;

    let entries: Array<{ name: string; path: string; isDirectory: boolean }>;
    try {
      entries = await listDir(currentDir);
    } catch {
      return;
    }

    for (const entry of entries) {
      if (results.length >= maxResults) return;
      if (SKIP_DIRS.has(entry.name)) continue;

      if (currentPart === '**') {
        // ** matches zero or more directories
        if (patternIndex + 1 < parts.length) {
          // Try to match the next part in this directory
          await walk(currentDir, patternIndex + 1, currentDepth + 1);
          // Also recurse into subdirectories
          if (entry.isDirectory) {
            await walk(entry.path, patternIndex, currentDepth + 1);
          }
        } else {
          // ** at the end matches everything
          results.push(relative(cwd, entry.path));
        }
        continue;
      }

      if (!matchGlob([currentPart], entry.name)) continue;

      if (entry.isDirectory) {
        if (patternIndex + 1 < parts.length) {
          await walk(entry.path, patternIndex + 1, currentDepth + 1);
        } else {
          results.push(relative(cwd, entry.path));
        }
      } else if (patternIndex === parts.length - 1) {
        // Only add files if we're at the last pattern part
        results.push(relative(cwd, entry.path));
      }
    }
  }

  await walk(dirPath, 0, 0);
  return results.slice(0, maxResults);
}

/**
 * Create the glob tool.
 * Finds files matching a glob pattern.
 */
export function createGlobTool(): DynamicStructuredTool<typeof GlobSchema> {
  return new DynamicStructuredTool({
    name: 'glob',
    description: 'Find files matching a glob pattern in the project. ' +
      'Use this to discover project structure, find files by type, ' +
      'or locate configuration files. ' +
      'Supports patterns like "src/**\/*.ts", "**\/*.json", or "*".' +
      'Skips node_modules, .git, dist, and other generated directories.',
    schema: GlobSchema,
    func: async ({ pattern, path, maxResults }: z.infer<typeof GlobSchema>) => {
      logger.info('glob:', pattern);

      try {
        const results = await findFiles(path, pattern, maxResults, 0);

        if (results.length === 0) {
          return 'No files found matching: ' + pattern;
        }

        const truncated = results.length >= maxResults ? '\n(Results truncated at ' + maxResults + ')' : '';
        return 'Found ' + results.length + ' files matching: ' + pattern + '\n' +
          results.join('\n') + truncated;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return 'Error searching: ' + message;
      }
    },
  });
}
