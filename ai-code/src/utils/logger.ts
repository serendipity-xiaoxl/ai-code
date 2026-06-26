// ============================================================
// ai-code - Logging Utility
//
// Structured logger with ANSI color support
// (ASCII-only, no Unicode characters).
// ============================================================

const LOG_LEVELS = ['silent', 'error', 'warn', 'info', 'debug'] as const;

export type LogLevel = (typeof LOG_LEVELS)[number];

const LOG_PRECEDENCE: Record<LogLevel, number> = {
  silent: 0,
  error: 1,
  warn: 2,
  info: 3,
  debug: 4,
};

/**
 * ANSI color codes - only uses ASCII escape sequences.
 */
const COLORS = {
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
 * Label for each log level.
 */
const LABELS: Record<Exclude<LogLevel, 'silent'>, string> = {
  error: '[ERROR]',
  warn: '[WARN]',
  info: '[INFO]',
  debug: '[DEBUG]',
};

/**
 * Output stream for each log level.
 */
function getStream(level: Exclude<LogLevel, 'silent'>): typeof console.log {
  return level === 'error' ? console.error : console.log;
}

/**
 * Simple structured logger.
 */
export class Logger {
  private level: number;
  private context: string;

  constructor(level: LogLevel = 'info', context: string = 'aic') {
    this.level = LOG_PRECEDENCE[level];
    this.context = context;
  }

  setLevel(level: LogLevel): void {
    this.level = LOG_PRECEDENCE[level];
  }

  private format(
    level: Exclude<LogLevel, 'silent'>,
    message: string,
  ): string {
    const ts = new Date().toISOString().slice(11, 23);
    const colorMap: Record<string, string> = {
      error: COLORS.red,
      warn: COLORS.yellow,
      info: COLORS.cyan,
      debug: COLORS.gray,
    };
    const c = colorMap[level] ?? COLORS.gray;
    return (
      COLORS.gray +
      ts +
      COLORS.reset +
      ' ' +
      c +
      COLORS.bold +
      LABELS[level] +
      COLORS.reset +
      ' ' +
      COLORS.dim +
      '[' +
      this.context +
      ']' +
      COLORS.reset +
      ' ' +
      message
    );
  }

  error(message: string, ...args: unknown[]): void {
    if (this.level >= LOG_PRECEDENCE.error) {
      getStream('error')(this.format('error', message), ...args);
    }
  }

  warn(message: string, ...args: unknown[]): void {
    if (this.level >= LOG_PRECEDENCE.warn) {
      getStream('warn')(this.format('warn', message), ...args);
    }
  }

  info(message: string, ...args: unknown[]): void {
    if (this.level >= LOG_PRECEDENCE.info) {
      getStream('info')(this.format('info', message), ...args);
    }
  }

  debug(message: string, ...args: unknown[]): void {
    if (this.level >= LOG_PRECEDENCE.debug) {
      getStream('debug')(this.format('debug', message), ...args);
    }
  }
}

let _logger: Logger | null = null;

export function getLogger(): Logger {
  if (!_logger) {
    const level = (process.env['AIC_LOG_LEVEL'] as LogLevel | undefined) ?? 'info';
    _logger = new Logger(level);
  }
  return _logger;
}

export function setLogger(logger: Logger): void {
  _logger = logger;
}
