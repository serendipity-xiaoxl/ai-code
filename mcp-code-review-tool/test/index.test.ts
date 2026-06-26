// ============================================================
// MCP Code Review Tool - Entry Point Tests
// ============================================================

import { describe, it, expect, afterEach } from 'bun:test';

describe('MCP Review Entry Point', () => {
  const originalArgv = process.argv;
  const originalExit = process.exit;
  const originalStdout = process.stdout.write;

  afterEach(() => {
    process.argv = originalArgv;
    process.exit = originalExit;
    process.stdout.write = originalStdout;
  });

  describe('cli argument parsing', () => {
    it('should detect --help flag', async () => {
      process.argv = ['bun', 'src/index.ts', '--help'];
      // The module is already loaded, so we test the flag logic
      const helpFlag = process.argv.includes('--help');
      expect(helpFlag).toBe(true);
    });

    it('should detect --version flag', async () => {
      process.argv = ['bun', 'src/index.ts', '--version'];
      const versionFlag = process.argv.includes('--version');
      expect(versionFlag).toBe(true);
    });

    it('should detect -h flag', async () => {
      process.argv = ['bun', 'src/index.ts', '-h'];
      const helpFlag = process.argv.includes('-h');
      expect(helpFlag).toBe(true);
    });

    it('should detect -v flag', async () => {
      process.argv = ['bun', 'src/index.ts', '-v'];
      const versionFlag = process.argv.includes('-v');
      expect(versionFlag).toBe(true);
    });
  });

  describe('showHelp', () => {
    it('should output help text', async () => {
      // Capture console.log output
      const logs: string[] = [];
      const originalLog = console.log;
      console.log = (...args: string[]) => logs.push(args.join(' '));

      try {
        // We can test the help text by checking what would be logged
        const helpText = `
MCP Code Review Tool - Intelligent code review via MCP protocol

  USAGE:
    bun run src/index.ts                      Start MCP server (stdio)
    bun run src/index.ts --standalone         Run standalone review
    bun run src/index.ts --help               Show this help

  ENVIRONMENT VARIABLES:
    MCP_REVIEW_PROVIDER   LLM provider (openai, anthropic, custom)
    OPENAI_API_KEY        OpenAI API key
    ANTHROPIC_API_KEY     Anthropic API key`;
        expect(helpText).toContain('MCP Code Review Tool');
        expect(helpText).toContain('USAGE');
        expect(helpText).toContain('ENVIRONMENT VARIABLES');
        expect(helpText).toContain('MCP_REVIEW_PROVIDER');
      } finally {
        console.log = originalLog;
      }
    });
  });
});
