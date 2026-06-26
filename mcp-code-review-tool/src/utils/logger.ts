// ============================================================
// MCP Code Review Tool - Logging Utility
// ============================================================

/**
 * Log levels with numeric precedence.
 * Higher number = more verbose.
 */
export type LogLevel = 'silent' | 'error' | 'warn' | 'info' | 'debug';

const LOG_PRECEDENCE: Record<LogLevel, number> = {
  silent: 0,
  error: 1,
  warn: 2,
  info: 3,
  debug: 4,
};

/**
 * ANSI color codes for terminal output.
 * Uses only ASCII escape sequences - no Unicode characters.
 */
const ANSI = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
} as const;

/**
 * PREFIX labels for each log level (ASCII only).
 */
const LEVEL_PREFIX: Record<Exclude<LogLevel, 'silent'>, string> = {
  error: '[ERROR]',
  warn: '[WARN]',
  info: '[INFO]',
  debug: '[DEBUG]',
};

/**
 * Color mapping for each log level.
 */
const LEVEL_COLOR: Record<Exclude<LogLevel, 'silent'>, string> = {
  error: ANSI.red,
  warn: ANSI.yellow,
  info: ANSI.cyan,
  debug: ANSI.gray,
};

/**
 * Simple structured logger with level-based filtering and ANSI coloring.
 */
export class Logger {
  private level: number;
  private context: string;

  constructor(level: LogLevel = 'info', context: string = 'MCP-Review') {
    this.level = LOG_PRECEDENCE[level];
    this.context = context;
  }

  /**
   * Set the current log level.
   */
  setLevel(level: LogLevel): void {
    this.level = LOG_PRECEDENCE[level];
  }

  /**
   * Format a log message with timestamp, level, and context.
   */
  private formatMessage(level: Exclude<LogLevel, 'silent'>, message: string): string {
    const timestamp = new Date().toISOString();
    const color = LEVEL_COLOR[level];
    const prefix = LEVEL_PREFIX[level];
    const dimmed = ANSI.dim;

    return [
      `${ANSI.gray}${timestamp}${ANSI.reset}`,
      `${color}${ANSI.bold}${prefix}${ANSI.reset}`,
      `${dimmed}[${this.context}]${ANSI.reset}`,
      `${color}${message}${ANSI.reset}`,
    ].join(' ');
  }

  error(message: string, ...args: unknown[]): void {
    if (this.level >= LOG_PRECEDENCE.error) {
      console.error(this.formatMessage('error', message), ...args);
    }
  }

  warn(message: string, ...args: unknown[]): void {
    if (this.level >= LOG_PRECEDENCE.warn) {
      console.warn(this.formatMessage('warn', message), ...args);
    }
  }

  info(message: string, ...args: unknown[]): void {
    if (this.level >= LOG_PRECEDENCE.info) {
      console.log(this.formatMessage('info', message), ...args);
    }
  }

  debug(message: string, ...args: unknown[]): void {
    if (this.level >= LOG_PRECEDENCE.debug) {
      console.log(this.formatMessage('debug', message), ...args);
    }
  }
}

/**
 * Global logger instance.
 */
let _globalLogger: Logger | null = null;

/**
 * Get or create the global logger instance.
 */
export function getLogger(): Logger {
  if (!_globalLogger) {
    const level =
      (process.env['MCP_REVIEW_LOG_LEVEL'] as LogLevel | undefined) ?? 'info';
    _globalLogger = new Logger(level);
  }
  return _globalLogger;
}

/**
 * Set the global logger instance.
 */
export function setLogger(logger: Logger): void {
  _globalLogger = logger;
}
