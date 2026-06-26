// ============================================================
// ai-code - Permission Guard
//
// Controls execution of sensitive tools.
// Requires user approval before running dangerous operations.
// ============================================================

import { createInterface } from 'node:readline';
import { getLogger } from '../utils/logger';

const logger = getLogger();

/**
 * Result of a permission check.
 */
export interface PermissionResult {
  /** Whether the operation is approved */
  approved: boolean;
  /** Reason if denied */
  reason?: string;
}

/**
 * Permission guard that asks the user to confirm sensitive operations.
 */
export class PermissionGuard {
  private requireApproval: boolean;
  private autoYes: boolean;

  constructor(options?: { requireApproval?: boolean; autoYes?: boolean }) {
    this.requireApproval = options?.requireApproval ?? true;
    this.autoYes = options?.autoYes ?? false;
  }

  /**
   * Set whether to require approval.
   */
  setRequireApproval(value: boolean): void {
    this.requireApproval = value;
  }

  /**
   * Set auto-yes mode.
   */
  setAutoYes(value: boolean): void {
    this.autoYes = value;
  }

  /**
   * Request permission to execute a tool.
   * Returns true if approved, false if denied.
   */
  async requestPermission(
    toolName: string,
    args: Record<string, unknown>,
  ): Promise<PermissionResult> {
    // Auto-yes mode
    if (this.autoYes) {
      return { approved: true };
    }

    // If approval not required, auto-approve
    if (!this.requireApproval) {
      return { approved: true };
    }

    // Format the args for display
    const argsStr = Object.entries(args)
      .map(([key, value]) => {
        const str = String(value);
        // Truncate long values
        const display = str.length > 80 ? str.slice(0, 77) + '...' : str;
        return '    ' + key + ': ' + display;
      })
      .join('\n');

    // Build the prompt
    const prompt = [
      '',
      '  [PERMISSION] Execute: ' + toolName,
      argsStr,
      '',
      '  Allow? (y/N): ',
    ].join('\n');

    // Ask the user
    const answer = await this.ask(prompt);
    const approved = answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes';

    logger.debug('Permission for', toolName, ':', approved ? 'approved' : 'denied');

    if (!approved) {
      return { approved: false, reason: 'User denied permission' };
    }

    return { approved: true };
  }

  /**
   * Ask the user a yes/no question via stdin.
   */
  private ask(question: string): Promise<string> {
    return new Promise((resolve) => {
      const rl = createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      rl.question(question, (answer: string) => {
        rl.close();
        resolve(answer.trim());
      });
    });
  }
}
