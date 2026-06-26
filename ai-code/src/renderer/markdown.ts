// ============================================================
// ai-code - Terminal Markdown Renderer
//
// CRITICAL: All output uses ONLY ASCII characters.
// No Unicode, no emoji, no special box-drawing characters.
// ANSI escape codes for coloring only.
// ============================================================

/**
 * ANSI color codes.
 */
const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  italic: '\x1b[3m',
  underline: '\x1b[4m',

  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',

  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
  bgGray: '\x1b[100m',
} as const;

/**
 * Configuration for the renderer.
 */
export interface RendererConfig {
  color: boolean;
  width: number;
}

/**
 * Mute colors if disabled.
 */
function c(config: RendererConfig, code: string): string {
  return config.color ? code : '';
}

/**
 * Create a renderer instance.
 */
export function createRenderer(config?: Partial<RendererConfig>) {
  const cfg: RendererConfig = {
    color: config?.color ?? true,
    width: config?.width ?? 80,
  };

  const rt = c.bind(null, cfg);

  /**
   * Create a horizontal line separator.
   */
  function line(ch: string = '='): string {
    return rt(C.bold) + ch.repeat(cfg.width) + rt(C.reset);
  }

  /**
   * Center text within terminal width.
   */
  function center(text: string): string {
    if (text.length >= cfg.width) return text;
    const pad = Math.floor((cfg.width - text.length) / 2);
    return ' '.repeat(Math.max(0, pad)) + text;
  }

  /**
   * Render a header box.
   */
  function header(title: string): string {
    const parts: string[] = [];
    parts.push(line());
    parts.push(center(rt(C.bold) + title + rt(C.reset)));
    parts.push(line());
    return parts.join('\n');
  }

  /**
   * Render AI response with basic markdown-like formatting.
   */
  function aiResponse(text: string): string {
    const lines = text.split('\n');
    const result: string[] = [];

    for (const rawLine of lines) {
      let line = rawLine;

      // Code block start/end
      if (line.startsWith('```')) {
        result.push(rt(C.dim) + line + rt(C.reset));
        continue;
      }

      // Headers (## or ###)
      if (line.startsWith('### ')) {
        result.push(rt(C.bold) + rt(C.cyan) + line.replace('### ', '') + rt(C.reset));
        continue;
      }
      if (line.startsWith('## ')) {
        result.push(rt(C.bold) + rt(C.cyan) + line.replace('## ', '') + rt(C.reset));
        continue;
      }
      if (line.startsWith('# ')) {
        result.push(rt(C.bold) + rt(C.cyan) + line.replace('# ', '') + rt(C.reset));
        result.push(rt(C.dim) + '---' + rt(C.reset));
        continue;
      }

      // Blockquote
      if (line.startsWith('> ')) {
        result.push(rt(C.gray) + '> ' + rt(C.reset) + line.slice(2));
        continue;
      }

      // Unordered list
      if (line.startsWith('- ') || line.startsWith('* ')) {
        result.push('  ' + rt(C.green) + '-' + rt(C.reset) + ' ' + line.slice(2));
        continue;
      }

      // Ordered list
      if (/^\d+\.\s/.test(line)) {
        result.push('  ' + line);
        continue;
      }

      // Code inline (between backticks) - just render as-is
      // Horizontal rule
      if (line.trim() === '---' || line.trim() === '***') {
        result.push(rt(C.dim) + '-'.repeat(cfg.width) + rt(C.reset));
        continue;
      }

      // Default: regular text
      result.push(line);
    }

    return result.join('\n');
  }

  /**
   * Render metadata as key-value pairs.
   */
  function metadata(items: Array<[string, string]>): string {
    const parts: string[] = [];
    const maxKeyLen = Math.max(...items.map(([k]) => k.length));

    for (const [key, value] of items) {
      const paddedKey = key.padEnd(maxKeyLen);
      parts.push(
        '  ' +
          rt(C.bold) + paddedKey + rt(C.reset) +
          '  ' +
          rt(C.cyan) + value + rt(C.reset),
      );
    }

    return parts.join('\n');
  }

  /**
   * Render an error message.
   */
  function error(msg: string): string {
    return (
      '  ' +
      rt(C.red) + rt(C.bold) + '[ERROR]' + rt(C.reset) +
      ' ' +
      msg
    );
  }

  /**
   * Render a warning message.
   */
  function warning(msg: string): string {
    return (
      '  ' +
      rt(C.yellow) + rt(C.bold) + '[WARN]' + rt(C.reset) +
      ' ' +
      msg
    );
  }

  /**
   * Render an info message.
   */
  function info(msg: string): string {
    return (
      '  ' +
      rt(C.blue) + rt(C.bold) + '[INFO]' + rt(C.reset) +
      ' ' +
      msg
    );
  }

  /**
   * Render a success message.
   */
  function success(msg: string): string {
    return (
      '  ' +
      rt(C.green) + rt(C.bold) + '[OK]' + rt(C.reset) +
      ' ' +
      msg
    );
  }

  /**
   * Render muted / dim text.
   */
  function muted(msg: string): string {
    return rt(C.gray) + msg + rt(C.reset);
  }

  /**
   * Render a tool call in progress.
   */
  function toolCall(name: string, params?: string): string {
    return (
      '  ' +
      rt(C.magenta) + rt(C.bold) + 'TOOL:' + rt(C.reset) +
      ' ' +
      rt(C.cyan) + name + rt(C.reset) +
      (params ? ' ' + rt(C.dim) + params + rt(C.reset) : '')
    );
  }

  /**
   * Render a file reference.
   */
  function fileRef(path: string, line?: number): string {
    return rt(C.magenta) + path + (line ? ':' + line : '') + rt(C.reset);
  }

  /**
   * Render a code block.
   */
  function codeBlock(language: string, code: string): string {
    const parts: string[] = [];
    parts.push(rt(C.dim) + '  ' + language + rt(C.reset));
    const lines = code.split('\n');
    for (const l of lines) {
      parts.push('    ' + l);
    }
    return parts.join('\n');
  }

  /**
   * Render a table from rows.
   */
  function table(headers: string[], rows: string[][]): string {
    if (headers.length === 0) return '';

    const colWidths = headers.map((h, i) =>
      Math.max(h.length, ...rows.map((r) => (r[i] ?? '').length), 3),
    );

    const sep =
      '+' +
      colWidths.map((w) => '-'.repeat(w + 2)).join('+') +
      '+';

    const headerLine =
      '|' +
      headers.map((h, i) => ' ' + h.padEnd(colWidths[i] ?? 0) + ' ').join('|') +
      '|';

    const dataLines = rows.map(
      (row) =>
        '|' +
        row.map((cell, i) => ' ' + cell.padEnd(colWidths[i] ?? 0) + ' ').join('|') +
        '|',
    );

    return [sep, headerLine, sep, ...dataLines, sep].join('\n');
  }

  /**
   * Render help text.
   */
  function help(): string {
    const items: Array<[string, string]> = [
      ['/help', 'Show this help'],
      ['/clear', 'Clear conversation history'],
      ['/exit', 'Exit ai-code'],
      ['exit', 'Exit ai-code'],
      ['quit', 'Exit ai-code'],
      ['Ctrl+C', 'Interrupt current response'],
    ];

    return table(
      ['Command', 'Description'],
      items.map(([k, v]) => [k, v]),
    );
  }

  /**
   * Bold text.
   */
  function bold(text: string): string {
    return rt(C.bold) + text + rt(C.reset);
  }

  /**
   * Render a diff line.
   */
  function diffLine(type: 'add' | 'del' | 'context', content: string): string {
    switch (type) {
      case 'add':
        return rt(C.green) + '+' + content + rt(C.reset);
      case 'del':
        return rt(C.red) + '-' + content + rt(C.reset);
      case 'context':
        return ' ' + content;
    }
  }

  return {
    header,
    aiResponse,
    metadata,
    error,
    warning,
    info,
    success,
    muted,
    toolCall,
    fileRef,
    codeBlock,
    table,
    help,
    bold,
    diffLine,
    line: (ch?: string) => line(ch),
  };
}

export type Renderer = ReturnType<typeof createRenderer>;
