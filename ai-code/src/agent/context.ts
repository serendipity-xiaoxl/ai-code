// ============================================================
// ai-code - Project Context Builder
//
// Builds a hierarchical understanding of the project:
// L1 - Root directory listing + key config files
// L2 - Directory tree structure
// L3 - On-demand file reading (handled by read tool)
// L4 - Search capabilities (handled by grep/glob tools)
// L5 - Project instructions (.ai-code/instructions.md)
// ============================================================

import { listDir, readTextFile, pathExists } from '../utils/os-compat';
import { getLogger } from '../utils/logger';
import { join } from 'node:path';

const logger = getLogger();

/**
 * Directories to skip when scanning.
 */
const SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', '.next', '.nuxt',
  'coverage', '.cache', '__pycache__', '.venv', 'venv',
  '.claude', '.ai-code', '.idea', '.vscode',
]);

/**
 * Project context data.
 */
export interface ProjectContext {
  projectDir: string;
  rootFiles: string[];
  directories: string[];
  files: string[];
  totalLines: number;
  keyFiles: Record<string, string | null>;
}

/**
 * Key configuration files to check for project info.
 */
const KEY_CONFIG_FILES = [
  'package.json',
  'tsconfig.json',
  'tsconfig.app.json',
  'pyproject.toml',
  'Cargo.toml',
  'go.mod',
  'Gemfile',
  'composer.json',
  'Makefile',
  'Dockerfile',
  'docker-compose.yml',
  'docker-compose.yaml',
  '.gitignore',
  '.env.example',
  'README.md',
  'CLAUDE.md',
];

/**
 * Build project context by scanning the project directory.
 * This provides L1 context (overview) to the agent.
 * Deeper levels are handled on-demand via tools.
 */
export async function buildProjectContext(
  projectDir: string,
): Promise<ProjectContext> {
  logger.info('Building project context for:', projectDir);

  const context: ProjectContext = {
    projectDir,
    rootFiles: [],
    directories: [],
    files: [],
    totalLines: 0,
    keyFiles: {},
  };

  try {
    const entries = await listDir(projectDir);

    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;

      if (entry.isDirectory) {
        if (!SKIP_DIRS.has(entry.name)) {
          context.directories.push(entry.name);
        }
      } else {
        context.rootFiles.push(entry.name);
        context.files.push(entry.name);
      }
    }

    // Sort for consistent output
    context.rootFiles.sort();
    context.directories.sort();

    // Read key config files
    for (const configFile of KEY_CONFIG_FILES) {
      const configPath = join(projectDir, configFile);
      if (pathExists(configPath)) {
        try {
          const content = await readTextFile(configPath);
          context.keyFiles[configFile] = content;
          // Count lines
          context.totalLines += content.split('\n').length;
        } catch {
          context.keyFiles[configFile] = null;
        }
      }
    }
  } catch (error) {
    logger.error('Failed to build project context', error);
  }

  return context;
}

/**
 * Read project instructions from .ai-code/instructions.md.
 */
export async function readProjectInstructions(
  projectDir: string,
): Promise<string | null> {
  const instructionsPath = join(projectDir, '.ai-code', 'instructions.md');

  try {
    if (pathExists(instructionsPath)) {
      const content = await readTextFile(instructionsPath);
      return content;
    }
  } catch {
    // File doesn't exist or can't be read
  }

  return null;
}

/**
 * Collect structured directory overview (L2).
 */
export async function getDirectoryOverview(
  projectDir: string,
  maxDepth: number = 3,
): Promise<string> {
  const lines: string[] = ['Project structure:'];

  async function walk(dir: string, depth: number): Promise<void> {
    if (depth > maxDepth) return;

    try {
      const entries = await listDir(dir);

      // Sort: directories first, then files, alphabetical
      entries.sort((a, b) => {
        if (a.isDirectory !== b.isDirectory) {
          return a.isDirectory ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      });

      for (const entry of entries) {
        if (entry.name.startsWith('.')) continue;
        if (SKIP_DIRS.has(entry.name)) continue;

        const indent = '  '.repeat(depth);
        const prefix = entry.isDirectory ? '+ ' : '  ';

        lines.push(indent + prefix + entry.name);

        if (entry.isDirectory) {
          await walk(entry.path, depth + 1);
        }
      }
    } catch {
      // Skip directories we can't read
    }
  }

  await walk(projectDir, 0);
  return lines.join('\n');
}
