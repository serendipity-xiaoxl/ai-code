// ============================================================
// ai-code - File Reference Parser
//
// Parses @file references in user input and injects file
// contents for LLM context.
//
// Runtime: Bun (primary) and Node.js (via tsx or build).
// ============================================================

import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve } from '../utils/os-compat';

import { getLogger } from '../utils/logger';

const logger = getLogger();

/**
 * Represents a parsed @file reference in user input.
 */
export interface FileRef {
  raw: string;              // The raw @reference text
  filePath: string;         // Resolved absolute file path
  line?: number;            // Optional line number (@file.ts:42)
  exists: boolean;          // Whether the file exists
  content?: string;         // File content (if exists)
  size: number;             // File size in bytes
  error?: string;           // Error message if read failed
}

const FILE_REF_REGEX = /@([^\s:@]+[^\s:]+)(?::(\d+))?/g;
const MAX_FILE_SIZE = 10 * 1024; // 10KB

/**
 * Find all @file references in the input string.
 *
 * Matches patterns like @file.ts or @file.ts:42.
 * Resolves file paths relative to the project directory.
 * Reads file contents up to 10KB (truncates with warning if larger).
 * Deduplicates repeated references to the same file.
 *
 * @param input      - The raw user input string.
 * @param projectDir - Absolute path to the project root.
 * @returns An array of FileRef objects for each unique reference.
 */
export function parseFileRefs(input: string, projectDir: string): FileRef[] {
  const refs: FileRef[] = [];
  const seen = new Set<string>();

  FILE_REF_REGEX.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = FILE_REF_REGEX.exec(input)) !== null) {
    const raw = match[0];
    const fileMatch = match[1];
    const lineStr = match[2];

    const resolvedPath = resolve(projectDir, fileMatch);
    const dedupKey = resolvedPath + (lineStr ? ':' + lineStr : '');

    if (seen.has(dedupKey)) {
      continue;
    }
    seen.add(dedupKey);

    const ref: FileRef = {
      raw,
      filePath: resolvedPath,
      line: lineStr ? parseInt(lineStr, 10) : undefined,
      exists: false,
      size: 0,
    };

    if (!existsSync(resolvedPath)) {
      ref.error = 'File not found';
      refs.push(ref);
      continue;
    }

    ref.exists = true;

    try {
      const stats = statSync(resolvedPath);
      ref.size = stats.size;

      if (stats.size === 0) {
        ref.content = '';
      } else if (stats.size > MAX_FILE_SIZE) {
        const content = readFileSync(resolvedPath, 'utf-8');
        ref.content = content.slice(0, MAX_FILE_SIZE);
        ref.error = 'Truncated: file exceeds 10KB limit (' + stats.size + ' bytes)';
      } else {
        ref.content = readFileSync(resolvedPath, 'utf-8');
      }
    } catch (err) {
      ref.error = err instanceof Error ? err.message : String(err);
      logger.debug('Failed to read file: ' + resolvedPath, err);
    }

    refs.push(ref);
  }

  return refs;
}

/**
 * Replace each @file reference in the input string with the
 * file content wrapped in a markdown code block.
 *
 * The original reference is augmented with line count and size,
 * followed by the file content in a code block:
 *
 *   @file.ts (124 lines, 3.2KB):
 *   ```
 *   [file content]
 *   ```
 *
 * References to files that do not exist or could not be read
 * are left unchanged in the output.
 *
 * @param input - The raw user input string.
 * @param refs  - FileRef array from parseFileRefs().
 * @returns The augmented input string with file content injected.
 */
export function injectFileRefs(input: string, refs: FileRef[]): string {
  const refMap = new Map<string, FileRef>();
  for (const ref of refs) {
    if (!refMap.has(ref.raw)) {
      refMap.set(ref.raw, ref);
    }
  }

  FILE_REF_REGEX.lastIndex = 0;

  return input.replace(FILE_REF_REGEX, (match: string) => {
    const ref = refMap.get(match);
    if (!ref || !ref.exists || typeof ref.content !== 'string') {
      return match;
    }

    const lines = ref.content.length === 0 ? 0 : ref.content.split('\n').length;
    const sizeKB = (ref.size / 1024).toFixed(1);

    return (
      match +
      ' (' + lines + ' lines, ' + sizeKB + 'KB):\n' +
      '```\n' +
      ref.content +
      '\n```'
    );
  });
}

// ============================================================
// ANSI color codes for terminal highlighting.
// Only uses ASCII escape sequences (no Unicode).
// ============================================================

const C = {
  reset: '\x1b[0m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m',
  underline: '\x1b[4m',
} as const;

const HIGHLIGHT_REGEX = /@([^\s:@]+[^\s:]+)(?::(\d+))?/g;

/**
 * Wrap @file references with ANSI color codes for terminal
 * display highlighting.
 *
 * - @file.ts       -> cyan + underline
 * - @file.ts:42    -> cyan + underline with :42 in yellow
 *
 * @param input - The raw user input string.
 * @returns The input string with ANSI-highlighted file references.
 */
export function highlightFileRefs(input: string): string {
  return input.replace(
    HIGHLIGHT_REGEX,
    (_match: string, _filePath: string, lineNum: string | undefined) => {
      if (lineNum) {
        return (
          C.cyan + C.underline + '@' + _filePath + C.reset +
          C.yellow + ':' + lineNum + C.reset
        );
      }
      return C.cyan + C.underline + '@' + _filePath + C.reset;
    },
  );
}
