// ============================================================
// MCP Code Review Tool - Git Diff Analyzer
//
// Parses git diffs and extracts structured file change information.
// Supports both direct git execution and raw diff string parsing.
// ============================================================

import simpleGit from 'simple-git';
import type { DiffFile, DiffFileStatus, DiffHunk, AnalysisResult } from '../types';
import { getLogger } from '../utils/logger';

/**
 * Pattern to match a diff hunk header.
 * Example: "@@ -1,3 +1,4 @@"
 */
const HUNK_HEADER_RE = /^@@\s+-(\d+)(?:,(\d+))?\s+\+(\d+)(?:,(\d+))?\s+@@/;

/**
 * Git diff analyzer that extracts structured change data.
 */
export class GitAnalyzer {
  private git;
  private logger;

  constructor(repoPath?: string) {
    this.git = repoPath ? simpleGit(repoPath) : simpleGit();
    this.logger = getLogger();
  }

  /**
   * Get the git diff between two references.
   * If base is not provided, compares against HEAD (working tree).
   */
  async getDiff(base?: string, target?: string): Promise<AnalysisResult> {
    this.logger.info('Getting git diff...');

    let rawDiff: string;

    if (target && base) {
      // Diff between two specific references
      this.logger.debug('Comparing', base, 'vs', target);
      rawDiff = await this.git.diff([base, target]);
    } else if (target) {
      // Diff against a specific reference from HEAD
      this.logger.debug('Diffing HEAD against', target);
      rawDiff = await this.git.diff([target, 'HEAD']);
    } else if (base) {
      // Diff from base to working tree
      this.logger.debug('Diffing working tree against', base);
      rawDiff = await this.git.diff([base]);
    } else {
      // Default: unstaged changes
      this.logger.debug('Getting unstaged changes');
      rawDiff = await this.git.diff([]);
    }

    return this.parseDiff(rawDiff);
  }

  /**
   * Get the git diff for staged changes.
   */
  async getStagedDiff(): Promise<AnalysisResult> {
    this.logger.info('Getting staged diff...');
    const rawDiff = await this.git.diff(['--cached']);
    return this.parseDiff(rawDiff);
  }

  /**
   * Parse a raw git diff string into structured data.
   */
  parseDiff(rawDiff: string): AnalysisResult {
    const files: DiffFile[] = [];
    const lines = rawDiff.split('\n');
    let i = 0;

    this.logger.debug('Parsing diff of', lines.length, 'lines');

    while (i < lines.length) {
      const line = lines[i] as string;

      // Detect file header: "diff --git a/path b/path"
      if (line.startsWith('diff --git ')) {
        const { file, status, oldPath } = this.parseFileHeader(line, lines, i);
        const hunks: DiffHunk[] = [];
        let additions = 0;
        let deletions = 0;

        i += 1;

        // Skip metadata lines (index, ---, +++, new mode, etc.)
        while (i < lines.length) {
          const currentLine = lines[i] as string;

          if (currentLine.startsWith('diff --git ')) {
            // Next file starts
            break;
          }

          if (HUNK_HEADER_RE.test(currentLine)) {
            const hunk = this.parseHunkHeader(currentLine);
            const hunkContent: string[] = [];
            i += 1;

            // Collect hunk content lines
            while (i < lines.length) {
              const contentLine = lines[i] as string;

              if (
                contentLine.startsWith('diff --git ') ||
                HUNK_HEADER_RE.test(contentLine)
              ) {
                break;
              }

              hunkContent.push(contentLine);

              if (contentLine.startsWith('+') && !contentLine.startsWith('+++')) {
                additions += 1;
              } else if (
                contentLine.startsWith('-') &&
                !contentLine.startsWith('---')
              ) {
                deletions += 1;
              }

              i += 1;
            }

            hunks.push({
              ...hunk,
              content: hunkContent.join('\n'),
            });
          } else {
            i += 1;
          }
        }

        files.push({
          path: file,
          status,
          oldPath,
          additions,
          deletions,
          hunks,
        });
      } else {
        i += 1;
      }
    }

    const totalLines = files.reduce(
      (sum, f) => sum + f.additions + f.deletions,
      0,
    );

    return {
      diffFiles: files,
      rawDiff,
      files: files.map((f) => f.path),
      totalLines,
    };
  }

  /**
   * Parse a "diff --git" header line to extract file information.
   */
  private parseFileHeader(
    header: string,
    lines: string[],
    currentIndex: number,
  ): { file: string; status: DiffFileStatus; oldPath?: string } {
    // Extract file paths from "diff --git a/path b/path"
    const parts = header.split(' ');
    const aPath = parts[2]?.replace(/^a\//, '') ?? '';
    const bPath = parts[3]?.replace(/^b\//, '') ?? '';

    // Determine file status by looking ahead
    let status: DiffFileStatus = 'modified';
    let oldPath: string | undefined;

    for (let j = currentIndex + 1; j < Math.min(currentIndex + 10, lines.length); j++) {
      const line = lines[j] as string;

      if (line.startsWith('new file mode')) {
        status = 'added';
      } else if (line.startsWith('deleted file mode')) {
        status = 'deleted';
      } else if (line.startsWith('rename from ')) {
        status = 'renamed';
        oldPath = line.replace('rename from ', '');
      }

      // Stop at the first hunk or next file
      if (HUNK_HEADER_RE.test(line) || line.startsWith('diff --git ')) {
        break;
      }
    }

    return {
      file: bPath || aPath,
      status,
      oldPath,
    };
  }

  /**
   * Parse a hunk header line like "@@ -1,3 +1,4 @@".
   */
  private parseHunkHeader(header: string): DiffHunk {
    const match = header.match(HUNK_HEADER_RE);

    if (!match) {
      return {
        header,
        oldStart: 0,
        oldLines: 0,
        newStart: 0,
        newLines: 0,
        content: '',
      };
    }

    return {
      header,
      oldStart: parseInt(match[1] ?? '0', 10),
      oldLines: match[2] ? parseInt(match[2], 10) : 1,
      newStart: parseInt(match[3] ?? '0', 10),
      newLines: match[4] ? parseInt(match[4], 10) : 1,
      content: '',
    };
  }

  /**
   * Check if the current directory is a git repository.
   */
  async isRepo(): Promise<boolean> {
    try {
      return await this.git.checkIsRepo();
    } catch {
      return false;
    }
  }
}
