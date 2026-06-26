// ============================================================
// ai-code - OS / Runtime Compatibility Layer
//
// Handles differences between Bun and Node.js runtimes.
// Provides a unified API regardless of runtime.
// ============================================================

import { readFile, writeFile, mkdir, readdir, access } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve, dirname, relative, basename, extname } from 'node:path';
import { createInterface } from 'node:readline';

export { join, resolve, dirname, relative, basename, extname };

/**
 * Detect the current runtime.
 */
export function getRuntime(): 'bun' | 'node' {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (typeof Bun !== 'undefined' && Bun.version) {
    return 'bun';
  }
  return 'node';
}

/**
 * Check if running in Bun.
 */
export const isBun: boolean = getRuntime() === 'bun';

/**
 * Get runtime version string.
 */
export function getRuntimeVersion(): string {
  if (isBun) {
    return Bun!.version;
  }
  return process.version;
}

/**
 * Read a file as text.
 * Works in both Bun and Node.js.
 */
export async function readTextFile(filePath: string): Promise<string> {
  return await readFile(filePath, 'utf-8');
}

/**
 * Write text to a file, creating directories if needed.
 */
export async function writeTextFile(
  filePath: string,
  content: string,
): Promise<void> {
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }
  await writeFile(filePath, content, 'utf-8');
}

/**
 * Check if a path exists.
 */
export function pathExists(filePath: string): boolean {
  return existsSync(filePath);
}

/**
 * Ensure a directory exists.
 */
export async function ensureDir(dirPath: string): Promise<void> {
  if (!existsSync(dirPath)) {
    await mkdir(dirPath, { recursive: true });
  }
}

/**
 * List entries in a directory.
 */
export async function listDir(
  dirPath: string,
): Promise<Array<{ name: string; path: string; isDirectory: boolean }>> {
  const entries = await readdir(dirPath, { withFileTypes: true });
  return entries.map((entry) => ({
    name: entry.name,
    path: join(dirPath, entry.name),
    isDirectory: entry.isDirectory(),
  }));
}

/**
 * Get environment variable value.
 * Works with both Bun and Node.js.
 */
export function getEnv(key: string): string | undefined {
  // Bun.access?(...) not needed; process.env works in both
  return process.env[key];
}

/**
 * Get the current working directory.
 */
export function getCwd(): string {
  return process.cwd();
}

/**
 * Get the home directory.
 */
export function getHomeDir(): string {
  return process.env['HOME'] ?? process.env['USERPROFILE'] ?? '/tmp';
}

/**
 * Check if a file path is readable.
 */
export async function isReadable(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Readline interface for terminal input.
 * Uses Node.js readline (available in both Bun and Node).
 */
export function createInput(
  onLine: (line: string) => void,
  onClose?: () => void,
): { write: (text: string) => void; close: () => void } {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
    prompt: '',
  });

  rl.on('line', onLine);
  if (onClose) {
    rl.on('close', onClose);
  }

  return {
    write: (text: string) => process.stdout.write(text),
    close: () => rl.close(),
  };
}

/**
 * Sleep for a given number of milliseconds.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Get terminal width (default to 80 if not detectable).
 */
export function getTerminalWidth(): number {
  return process.stdout.columns ?? 80;
}

/**
 * Get terminal height.
 */
export function getTerminalHeight(): number {
  return process.stdout.rows ?? 24;
}
