// ============================================================
// ai-code - Context-Aware Slash Commands
//
// Handles /help, /status, /context, /compact, /clear, /exit
// and provides conversation compaction functionality.
//
// CRITICAL: All output uses ONLY ASCII characters.
// No Unicode, no emoji, no special box-drawing characters.
// ============================================================

import type { Session, Message } from '../storage/session';
import type { Renderer } from '../renderer/markdown';
import type { InputRenderer } from '../renderer/input';

/**
 * A side-effect action returned after handling a command.
 * The caller is expected to apply the side effect to the session
 * or application state.
 */
export type CommandAction =
  | { type: 'clear' }
  | { type: 'exit' }
  | { type: 'compact'; summary: string; messages: Message[] }
  | { type: 'none' };

/**
 * Result of handling a slash command.
 */
export interface CommandResult {
  /** True if a command was matched and handled. */
  handled: boolean;
  /** Display output to show the user (optional). */
  output?: string;
  /** Side effect the caller should perform. */
  action?: CommandAction;
}

/**
 * Simple token estimation: 1 token roughly equals 4 characters.
 *
 * @param text - The input text to estimate tokens for.
 * @returns Estimated token count (rounded up).
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Detect the JavaScript runtime.
 */
function detectRuntime(): string {
  // Bun sets a global `Bun` object with a `version` property.
  if (typeof globalThis !== 'undefined' && 'Bun' in globalThis) {
    return 'Bun';
  }
  return 'Node.js';
}

/**
 * Format a duration string from an ISO-8601 timestamp to the present moment.
 *
 * Produces human-readable output like "1d 3h 12m 5s".
 */
function formatDuration(createdAt: string): string {
  const start = new Date(createdAt).getTime();
  const now = Date.now();
  const delta = now - start;

  if (delta < 0) return '0s';

  const totalSeconds = Math.floor(delta / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const parts: string[] = [];
  if (days > 0) parts.push(days + 'd');
  if (hours > 0) parts.push(hours + 'h');
  if (minutes > 0) parts.push(minutes + 'm');
  if (seconds > 0 || parts.length === 0) parts.push(seconds + 's');

  return parts.join(' ');
}

/**
 * Sum estimated tokens across all message contents.
 */
function estimateSessionTokens(messages: Message[]): number {
  let total = 0;
  for (const msg of messages) {
    total += estimateTokens(msg.content);
  }
  return total;
}

/**
 * Count messages by role.
 */
function countByRole(
  messages: Message[],
): { user: number; assistant: number; system: number; tool: number } {
  const counts = { user: 0, assistant: 0, system: 0, tool: 0 };

  for (const msg of messages) {
    switch (msg.role) {
      case 'user':
        counts.user++;
        break;
      case 'assistant':
        counts.assistant++;
        break;
      case 'system':
        counts.system++;
        break;
      case 'tool':
        counts.tool++;
        break;
    }
  }

  return counts;
}

/**
 * Extract @file references from message content.
 *
 * Looks for tokens starting with `@` followed by a file-like path
 * (word characters, dots, slashes, and hyphens, ending with a file
 * extension). Short or purely-numeric matches are discarded as false
 * positives. Results are deduplicated and returned in order of first
 * appearance.
 */
function extractFileRefs(messages: Message[]): string[] {
  const seen = new Set<string>();
  const refs: string[] = [];

  // Matches @ followed by a file path with an extension.
  const pattern = /@([\w.\/\\-]+(?:\.[a-zA-Z0-9]+))/g;

  for (const msg of messages) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(msg.content)) !== null) {
      const ref = match[1];
      if (ref && ref.length >= 3 && !/^\d+$/.test(ref) && !seen.has(ref)) {
        seen.add(ref);
        refs.push(ref);
      }
    }
  }

  return refs;
}

// ---------------------------------------------------------------------------
// Command handlers
// ---------------------------------------------------------------------------

/**
 * Build the extended help text by combining the base renderer.help() table
 * with additional slash commands documented in this module.
 */
function buildHelpText(renderer: Renderer): string {
  const baseHelp = renderer.help();

  const extras: Array<[string, string]> = [
    ['/status', 'Show session status'],
    ['/context', 'Show conversation context'],
    ['/compact', 'Compact conversation history'],
    ['@<file>', 'Reference a file in the project'],
  ];

  const extraTable = renderer.table(
    ['Command', 'Description'],
    extras.map(([k, v]) => [k, v]),
  );

  return baseHelp + '\n' + extraTable;
}

/**
 * Handle a /status command -- display current session status as key-value
 * metadata.
 */
function handleStatus(session: Session, renderer: Renderer): string {
  const counts = countByRole(session.messages);
  const totalMessages = counts.user + counts.assistant;
  const modelName =
    typeof session.metadata['model'] === 'string'
      ? (session.metadata['model'] as string)
      : 'unknown';
  const runtime = detectRuntime();
  const tokenEstimate = estimateSessionTokens(session.messages);

  const rows: Array<[string, string]> = [
    ['Model', modelName],
    [
      'Messages',
      String(totalMessages) +
        ' (' +
        String(counts.user) +
        ' user, ' +
        String(counts.assistant) +
        ' assistant)',
    ],
    ['Session ID', session.id],
    ['Duration', formatDuration(session.createdAt)],
    ['Est. Tokens', String(tokenEstimate)],
    ['Runtime', runtime],
  ];

  return renderer.metadata(rows);
}

/**
 * Handle a /context command -- display conversation context information
 * using the InputRenderer's boxed display style.
 */
function handleContext(
  session: Session,
  inputRenderer: InputRenderer,
  projectDir?: string,
): string {
  const totalChars = session.messages.reduce(
    (sum, msg) => sum + msg.content.length,
    0,
  );

  const systemMsgs = session.messages.filter((m) => m.role === 'system');
  const systemChars = systemMsgs.reduce((sum, m) => sum + m.content.length, 0);
  const systemTokens = estimateTokens(
    systemMsgs.map((m) => m.content).join(''),
  );

  const fileRefs = extractFileRefs(session.messages);

  const lines: string[] = [];

  const dir = projectDir ?? session.projectDir;
  lines.push(inputRenderer.inputBox('Project: ' + dir));
  lines.push(inputRenderer.inputBox('Messages: ' + String(session.messages.length)));
  lines.push(inputRenderer.inputBox('Total characters: ' + String(totalChars)));
  lines.push(
    inputRenderer.inputBox(
      'System prompt: ' +
        String(systemChars) +
        ' chars (' +
        String(systemTokens) +
        ' tokens)',
    ),
  );

  if (fileRefs.length > 0) {
    lines.push(inputRenderer.inputBox('Referenced files: ' + String(fileRefs.length)));
    const displayLimit = 20;
    for (const ref of fileRefs.slice(0, displayLimit)) {
      lines.push(inputRenderer.inputBox('  ' + inputRenderer.refFile(ref)));
    }
    if (fileRefs.length > displayLimit) {
      lines.push(
        inputRenderer.inputBox(
          '  ... and ' + String(fileRefs.length - displayLimit) + ' more',
        ),
      );
    }
  } else {
    lines.push(inputRenderer.inputBox('Referenced files: none'));
  }

  return lines.join('\n');
}

/**
 * Handle a /compact command -- produce a compacted conversation and
 * return a `compact` action the caller can apply to the session.
 *
 * Keeps all system messages plus the last `keepCount` non-system messages.
 * The removed middle messages are replaced by a summary note.
 *
 * @param session    - The current session (not mutated).
 * @param renderer   - Renderer for display text.
 * @param keepCount  - Number of most-recent non-system messages to retain
 *                     (default 5).
 */
function handleCompact(
  session: Session,
  renderer: Renderer,
  keepCount: number = 5,
): CommandResult {
  if (keepCount < 1) keepCount = 1;

  const beforeCount = session.messages.length;

  // Separate system messages from the rest.
  const systemMessages = session.messages.filter((m) => m.role === 'system');
  const nonSystem = session.messages.filter((m) => m.role !== 'system');

  if (nonSystem.length <= keepCount) {
    return {
      handled: true,
      output: renderer.muted(
        'Conversation has only ' +
          String(nonSystem.length) +
          ' non-system messages -- nothing to compact.',
      ),
      action: { type: 'none' },
    };
  }

  // Keep the last N non-system messages.
  const kept = nonSystem.slice(-keepCount);
  const removedCount = nonSystem.length - kept.length;

  // Timestamp for the summary system message
  const now = new Date().toISOString();

  const summary =
    '[Conversation compacted: ' +
    String(removedCount) +
    ' messages summarized. Previous context preserved.]';

  const compactedMessages: Message[] = [
    ...systemMessages,
    { role: 'system', content: summary, timestamp: now },
    ...kept,
  ];

  const afterCount = compactedMessages.length;

  return {
    handled: true,
    output: renderer.info(
      'Messages: ' +
        String(beforeCount) +
        ' -> ' +
        String(afterCount) +
        ' (removed ' +
        String(removedCount) +
        ')',
    ),
    action: {
      type: 'compact',
      summary,
      messages: compactedMessages,
    },
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parse user input for slash commands and return a {@link CommandResult}.
 *
 * Recognised commands:
 *
 *   `/help`     - Show the help table (base + extended commands).
 *   `/status`   - Display current session status.
 *   `/context`  - Display conversation context.
 *   `/compact`  - Compact conversation history (optional arg: keep count).
 *   `/clear`    - Clear the session.
 *   `/reset`    - Alias for /clear.
 *   `/exit`     - Exit the application.
 *   `exit`      - Alias for /exit.
 *   `quit`      - Alias for /exit.
 *
 * `/compact` optionally accepts a number to control how many of the most
 * recent non-system messages are retained, e.g. `/compact 3`.
 *
 * @param input          - The raw user input line.
 * @param session        - The current conversation session.
 * @param renderer       - Renderer for producing display output.
 * @param inputRenderer  - InputRenderer for context display styling.
 * @param projectDir     - Optional project directory override.
 * @returns A CommandResult describing whether a command was handled and
 *          what side effect (if any) the caller should apply.
 */
export function handleCommand(
  input: string,
  session: Session,
  renderer: Renderer,
  inputRenderer: InputRenderer,
  projectDir?: string,
): CommandResult {
  const trimmed = input.trim().toLowerCase();

  // /help
  if (trimmed === '/help') {
    return {
      handled: true,
      output: buildHelpText(renderer),
      action: { type: 'none' },
    };
  }

  // /status
  if (trimmed === '/status') {
    return {
      handled: true,
      output: handleStatus(session, renderer),
      action: { type: 'none' },
    };
  }

  // /context
  if (trimmed === '/context') {
    return {
      handled: true,
      output: handleContext(session, inputRenderer, projectDir),
      action: { type: 'none' },
    };
  }

  // /compact [keepCount]
  if (trimmed === '/compact' || trimmed.startsWith('/compact ')) {
    let keepCount = 5;
    const parts = trimmed.split(/\s+/);
    if (parts.length >= 2) {
      const parsed = parseInt(parts[1], 10);
      if (!Number.isNaN(parsed) && parsed > 0) {
        keepCount = parsed;
      }
    }
    return handleCompact(session, renderer, keepCount);
  }

  // /clear, /reset
  if (trimmed === '/clear' || trimmed === '/reset') {
    return {
      handled: true,
      output: renderer.muted('Session cleared.'),
      action: { type: 'clear' },
    };
  }

  // /exit, exit, quit
  if (trimmed === '/exit' || trimmed === 'exit' || trimmed === 'quit') {
    return {
      handled: true,
      output: renderer.muted('Goodbye!'),
      action: { type: 'exit' },
    };
  }

  // No command matched.
  return {
    handled: false,
    action: { type: 'none' },
  };
}
