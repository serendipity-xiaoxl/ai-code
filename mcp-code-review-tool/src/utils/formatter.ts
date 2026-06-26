// ============================================================
// MCP Code Review Tool - Terminal Text Formatting Utility
//
// IMPORTANT: All output uses only ASCII characters.
// No Unicode, no emoji, no special symbols.
// Box drawing uses + - | characters for maximum compatibility.
// ============================================================

/**
 * ANSI color codes for terminal formatting.
 * Uses only ASCII escape sequences.
 */
export const ANSI = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  italic: '\x1b[3m',
  underline: '\x1b[4m',
  strikethrough: '\x1b[9m',

  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',

  bgBlack: '\x1b[40m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
  bgMagenta: '\x1b[45m',
  bgCyan: '\x1b[46m',
  bgWhite: '\x1b[47m',
} as const;

/**
 * Create a horizontal line separator.
 */
export function horizontalLine(width: number = 72): string {
  return '+'.repeat(width);
}

/**
 * Create a double-line separator (using = for ASCII-only).
 */
export function doubleLine(width: number = 72): string {
  return '='.repeat(width);
}

/**
 * Center text within a given width, padded with spaces.
 */
export function centerText(text: string, width: number = 72): string {
  if (text.length >= width) return text;
  const leftPad = Math.floor((width - text.length) / 2);
  const rightPad = width - text.length - leftPad;
  return ' '.repeat(leftPad) + text + ' '.repeat(rightPad);
}

/**
 * Pad text to the right to fill a given width.
 */
export function padRight(text: string, width: number): string {
  if (text.length >= width) return text.slice(0, width);
  return text + ' '.repeat(width - text.length);
}

/**
 * Pad text to the left to fill a given width.
 */
export function padLeft(text: string, width: number): string {
  if (text.length >= width) return text.slice(0, width);
  return ' '.repeat(width - text.length) + text;
}

/**
 * Truncate text with ellipsis if it exceeds maxLength.
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  if (maxLength <= 3) return text.slice(0, maxLength);
  return text.slice(0, maxLength - 3) + '...';
}

/**
 * Wrap text to a specified width, respecting word boundaries.
 */
export function wrapText(text: string, width: number = 72): string[] {
  const lines: string[] = [];
  const words = text.split(' ');
  let currentLine = '';

  for (const word of words) {
    const nextLine = (currentLine ? currentLine + ' ' : '') + word;
    if (nextLine.length > width && currentLine) {
      lines.push(currentLine.trim());
      currentLine = word;
    } else {
      currentLine = nextLine;
    }
  }

  if (currentLine.trim()) {
    lines.push(currentLine.trim());
  }

  // Filter out empty lines
  return lines.filter((l) => l.length > 0);
}

/**
 * Create a box around text using ASCII characters only.
 *
 * Example:
 *   +------------------+
 *   | Hello World      |
 *   +------------------+
 */
export function textBox(
  lines: string[],
  width: number = 72,
  title?: string,
): string {
  // Calculate border width
  const borderWidth = Math.max(width, ...lines.map((l) => l.length)) + 4;

  const topBorder = title
    ? '+-- ' + title + ' ' + '-'.repeat(borderWidth - 6 - title.length) + '+'
    : '+' + '-'.repeat(borderWidth - 2) + '+';

  const bottomBorder = '+' + '-'.repeat(borderWidth - 2) + '+';

  const result: string[] = [topBorder];
  for (const line of lines) {
    const padded = padRight(line, borderWidth - 4);
    result.push('| ' + padded + ' |');
  }
  result.push(bottomBorder);

  return result.join('\n');
}

/**
 * Format a severity label for terminal display (ASCII only).
 *
 * Returns [SEVERITY] styled label.
 */
export function formatSeverityBadge(severity: string): string {
  switch (severity) {
    case 'critical':
      return ANSI.red + ANSI.bold + '[CRITICAL]' + ANSI.reset;
    case 'warning':
      return ANSI.yellow + ANSI.bold + '[WARNING]' + ANSI.reset;
    case 'info':
      return ANSI.blue + ANSI.bold + '[INFO]' + ANSI.reset;
    default:
      return ANSI.gray + '[' + severity.toUpperCase() + ']' + ANSI.reset;
  }
}

/**
 * Format a category label for terminal display.
 */
export function formatCategoryLabel(category: string): string {
  return ANSI.cyan + category.replace(/_/g, ' ') + ANSI.reset;
}

/**
 * Format a score with color based on value.
 */
export function formatScore(score: number): string {
  if (score >= 90) return ANSI.green + ANSI.bold + score + '/100' + ANSI.reset;
  if (score >= 70) return ANSI.yellow + ANSI.bold + score + '/100' + ANSI.reset;
  return ANSI.red + ANSI.bold + score + '/100' + ANSI.reset;
}

/**
 * Format a file path, optionally with line number.
 */
export function formatFileRef(file: string, line?: number): string {
  const ref = line !== undefined ? file + ':' + line : file;
  return ANSI.magenta + ANSI.underline + ref + ANSI.reset;
}

/**
 * Format duration in a human-readable way.
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return ms + 'ms';
  if (ms < 60000) return (ms / 1000).toFixed(1) + 's';
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return minutes + 'm ' + seconds + 's';
}

/**
 * Create a simple ASCII table.
 *
 * Example:
 *   +-------+-------+
 *   | Col A | Col B |
 *   +-------+-------+
 *   | val1  | val2  |
 *   +-------+-------+
 */
export function createTable(headers: string[], rows: string[][]): string {
  if (headers.length === 0) return '';

  const colWidths = headers.map((h, i) =>
    Math.max(h.length, ...rows.map((r) => (r[i] ?? '').length)),
  );

  const separator =
    '+' +
    colWidths.map((w) => '-'.repeat(w + 2)).join('+') +
    '+';

  const headerRow =
    '| ' +
    headers
      .map((h, i) => padRight(h, colWidths[i] ?? 0))
      .join(' | ') +
    ' |';

  const dataRows = rows.map(
    (row) =>
      '| ' +
      row
        .map((cell, i) => padRight(cell, colWidths[i] ?? 0))
        .join(' | ') +
      ' |',
  );

  return [separator, headerRow, separator, ...dataRows, separator].join('\n');
}

/**
 * Create a simple ASCII progress bar.
 * @param current Current value
 * @param total Total value
 * @param width Width of the bar in characters
 */
export function progressBar(
  current: number,
  total: number,
  width: number = 20,
): string {
  const fraction = total > 0 ? current / total : 0;
  const filled = Math.round(fraction * width);
  const empty = width - filled;

  const bar = '[' + '#'.repeat(filled) + '-'.repeat(empty) + ']';
  const pct = (fraction * 100).toFixed(0) + '%';
  return bar + ' ' + pct;
}

/**
 * Indent every line of a text block.
 */
export function indent(text: string, spaces: number = 2): string {
  const prefix = ' '.repeat(spaces);
  return text
    .split('\n')
    .map((line) => (line.trim() ? prefix + line : ''))
    .join('\n');
}

/**
 * Safely strip ANSI escape codes (for plain text output).
 */
export function stripAnsi(text: string): string {
  return text.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '');
}
