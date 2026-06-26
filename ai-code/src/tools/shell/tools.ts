// ============================================================
// ai-code - Shell Tools
//
// LangChain DynamicStructuredTool implementations for shell execution:
// - bash: Execute shell commands with timeout
// - bash_interactive: Execute interactive / long-running commands
//
// Uses Bun's $ or Node.js child_process for execution.
// ============================================================

import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { getLogger } from '../../utils/logger';
import { isBun } from '../../utils/os-compat';

const logger = getLogger();

// ============================================================
// Implementation: executeBash
//
// Bun: uses Bun.spawn (native)
// Node.js: uses child_process.exec
// ============================================================

interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/**
 * Execute a shell command with timeout.
 */
async function executeBash(
  command: string,
  timeoutMs: number = 30000,
): Promise<ExecResult> {
  if (isBun) {
    // Bun implementation using Bun.spawn
    const proc = Bun.spawn(['/bin/bash', '-c', command], {
      stdout: 'pipe',
      stderr: 'pipe',
    });

    const timeout = setTimeout(() => {
      try {
        proc.kill(9);
      } catch {
        // Process may already be dead
      }
    }, timeoutMs);

    try {
      const [stdout, stderr] = await Promise.all([
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text(),
      ]);

      const exitCode = await proc.exited;
      clearTimeout(timeout);

      return { stdout: stdout.trim(), stderr: stderr.trim(), exitCode };
    } catch {
      clearTimeout(timeout);
      return { stdout: '', stderr: 'Command execution failed', exitCode: 1 };
    }
  }

  // Node.js implementation using child_process
  const { exec } = await import('node:child_process');
  const { promisify } = await import('node:util');
  const execAsync = promisify(exec);

  try {
    const ac = new AbortController();
    const timeout = setTimeout(() => ac.abort(), timeoutMs);

    const { stdout, stderr } = await execAsync(command, {
      signal: ac.signal,
      maxBuffer: 10 * 1024 * 1024, // 10MB
    });

    clearTimeout(timeout);
    return { stdout: stdout.trim(), stderr: stderr.trim(), exitCode: 0 };
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'AbortError') {
      return { stdout: '', stderr: 'Command timed out after ' + timeoutMs + 'ms', exitCode: 124 };
    }

    // exec throws with stdout/stderr on non-zero exit
    const err = error as { stdout?: string; stderr?: string; code?: number };
    return {
      stdout: (err.stdout ?? '').toString().trim(),
      stderr: (err.stderr ?? '').toString().trim() || String(error),
      exitCode: err.code ?? 1,
    };
  }
}

// ============================================================
// TOOL: bash
// ============================================================

const BashSchema = z.object({
  command: z
    .string()
    .min(1)
    .describe('The shell command to execute'),
  description: z
    .string()
    .optional()
    .describe('Brief description of what this command does (for user display)'),
  timeout: z
    .number()
    .int()
    .positive()
    .optional()
    .default(30000)
    .describe('Timeout in milliseconds (default: 30000)'),
});

/**
 * Create the bash tool.
 * Executes shell commands with timeout and output capture.
 */
export function createBashTool(): DynamicStructuredTool<typeof BashSchema> {
  return new DynamicStructuredTool({
    name: 'bash',
    description: 'Execute a shell command and capture its output. ' +
      'Use this to run build commands, tests, linters, ' +
      'or any terminal operation needed for the project. ' +
      'Has a configurable timeout (default 30s). ' +
      'The command runs in the project root directory via /bin/bash.',
    schema: BashSchema,
    func: async ({ command, description: _desc, timeout }: z.infer<typeof BashSchema>) => {
      logger.info('bash:', command.slice(0, 100));

      try {
        const result = await executeBash(command, timeout);

        let output = '';
        if (result.stdout) {
          output += result.stdout;
        }
        if (result.stderr) {
          output += (output ? '\n' : '') + '[STDERR]\n' + result.stderr;
        }

        if (result.exitCode === 0) {
          return output || 'Command completed successfully (no output).';
        }

        return (
          'Exit code: ' +
          result.exitCode +
          '\n' +
          (output || 'No output captured.')
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return 'Error executing command: ' + message;
      }
    },
  });
}

// ============================================================
// TOOL: bash_interactive
// ============================================================

const BashInteractiveSchema = z.object({
  command: z
    .string()
    .min(1)
    .describe('The interactive shell command to execute'),
  description: z
    .string()
    .optional()
    .describe('Brief description of what this command does'),
  timeout: z
    .number()
    .int()
    .positive()
    .optional()
    .default(120000)
    .describe('Timeout in milliseconds (default: 120000)'),
});

/**
 * Create the bash_interactive tool.
 * For long-running or interactive commands with longer timeout.
 */
export function createBashInteractiveTool(): DynamicStructuredTool<typeof BashInteractiveSchema> {
  return new DynamicStructuredTool({
    name: 'bash_interactive',
    description: 'Execute a shell command that may run longer than normal. ' +
      'Use for install commands, dev servers, or other long-running operations. ' +
      'Has a longer default timeout (120s). ' +
      'Output is captured and returned when the command completes or is killed.',
    schema: BashInteractiveSchema,
    func: async ({ command, description: _desc, timeout }: z.infer<typeof BashInteractiveSchema>) => {
      logger.info('bash_interactive:', command.slice(0, 100));

      try {
        const result = await executeBash(command, timeout);

        let output = '';
        if (result.stdout) {
          output += 'Output:\n' + result.stdout;
        }
        if (result.stderr) {
          output += (output ? '\n' : '') + 'Errors:\n' + result.stderr;
        }

        if (result.exitCode === 0) {
          return output || 'Command completed (no output).';
        }

        return (
          'Exit code: ' +
          result.exitCode +
          '\n' +
          (output || 'No output.')
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return 'Error: ' + message;
      }
    },
  });
}
