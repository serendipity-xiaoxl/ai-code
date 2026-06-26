// ============================================================
// ai-code - Terminal Input Renderer
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
 * Create an input renderer instance.
 */
export function createInputRenderer() {
  /**
   * Return the input prompt line with visual distinction.
   *
   * @param text - Optional hint text to append after the prompt prefix.
   * @returns A colorized prompt string.
   *
   * @example
   * prompt()                    // "\x1b[1m\x1b[36maic\x1b[0m \x1b[90m>\x1b[0m "
   * prompt("type a command")    // "\x1b[1m\x1b[36maic\x1b[0m \x1b[90m>\x1b[0m type a command"
   */
  function prompt(text?: string): string {
    const prefix = C.bold + C.cyan + 'aic' + C.reset + ' ' + C.gray + '>' + C.reset;
    return text ? prefix + ' ' + text : prefix + ' ';
  }

  /**
   * Parse user input and apply syntax highlighting before echo.
   *
   * Rules:
   * - Lines starting with / (slash commands) -> bold magenta
   * - @file references (words starting with @ followed by a path pattern) -> cyan + underline
   * - Everything else -> default color
   *
   * @param input - The raw user input string.
   * @returns The colorized input string.
   */
  function highlightInput(input: string): string {
    // Process each line independently
    const lines = input.split('\n');
    const result: string[] = [];

    for (const line of lines) {
      // Slash commands: entire line in bold magenta
      if (line.startsWith('/')) {
        result.push(C.bold + C.magenta + line + C.reset);
        continue;
      }

      // Highlight @file references inline, preserve everything else
      const parts = line.split(/(@[^\s"']+)/g);
      const colored = parts.map((part) => {
        if (part.startsWith('@') && part.length > 1) {
          return C.cyan + C.underline + part + C.reset;
        }
        return part;
      });
      result.push(colored.join(''));
    }

    return result.join('\n');
  }

  /**
   * Render the current input in a styled box/area with a colored left border.
   *
   * Uses a dim gray vertical bar on the left side as a border indicator.
   *
   * @param text - The text content to display inside the box.
   * @returns The boxed string.
   */
  function inputBox(text: string): string {
    const border = '  ' + C.gray + '|' + C.reset;
    return border + ' ' + text;
  }

  /**
   * Format a file reference for display.
   *
   * Produces a cyan underlined path with an optional line number,
   * mimicking a clickable file link appearance.
   *
   * @param path  - The file path.
   * @param line  - Optional line number to append.
   * @returns The colorized file reference string.
   */
  function refFile(path: string, line?: number): string {
    const ref = path + (line !== undefined ? ':' + line : '');
    return C.cyan + C.underline + ref + C.reset;
  }

  /**
   * Small badge-like format for command names.
   *
   * Wraps the name in square brackets and renders it in bold magenta.
   *
   * @param name - The command name.
   * @returns The badge string (e.g. "[help]" in bold magenta).
   */
  function commandBadge(name: string): string {
    return C.bold + C.magenta + '[' + name + ']' + C.reset;
  }

  /**
   * A section header for separating input/output areas.
   *
   * Renders a dim gray horizontal line with the title centered within it.
   *
   * @param title - The section title text.
   * @returns The formatted header string.
   */
  function sectionHeader(title: string): string {
    const width = 80;
    const line = C.dim + C.gray + '--' + C.reset;
    const padded = ' ' + title + ' ';
    const remaining = Math.max(0, width - padded.length - 4);
    const dashes = C.dim + C.gray + '-'.repeat(remaining) + C.reset;
    return line + C.bold + padded + C.reset + dashes;
  }

  return {
    prompt,
    highlightInput,
    inputBox,
    refFile,
    commandBadge,
    sectionHeader,
  };
}

export type InputRenderer = ReturnType<typeof createInputRenderer>;
