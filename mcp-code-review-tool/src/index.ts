// ============================================================
// MCP Code Review Tool - Entry Point
//
// A Model Context Protocol (MCP) server for intelligent
// code review powered by LangChain and LLMs.
//
// Runtime: Bun (primary) and Node.js (via tsx or build).
//
// Usage:
//   bun run src/index.ts                    # Start MCP server (Bun)
//   node --import tsx src/index.ts          # Start MCP server (Node.js)
//   bun run src/index.ts --help             # Show help
//   bun run src/index.ts --standalone       # Run standalone review
//
// Environment Variables (for MCP mode):
//   MCP_REVIEW_PROVIDER   - LLM provider: openai, anthropic, custom
//   OPENAI_API_KEY         - OpenAI API key
//   ANTHROPIC_API_KEY      - Anthropic API key
//   MCP_REVIEW_API_KEY     - Custom provider API key
//   MCP_REVIEW_API_BASE    - Custom API base URL
//   MCP_REVIEW_MODEL       - Model name (default: gpt-4o or claude-sonnet-4-20250514)
//   MCP_REVIEW_TEMPERATURE - LLM temperature (default: 0.1)
//   MCP_REVIEW_MAX_TOKENS  - Max tokens for response (default: 4096)
//   MCP_REVIEW_LOG_LEVEL   - Log level: silent, error, warn, info, debug
// ============================================================

import { McpReviewServer } from './mcp/server';
import { getLogger, setLogger, Logger } from './utils/logger';

// Parse command-line arguments
const args = process.argv.slice(2);
const helpFlag = args.includes('--help') || args.includes('-h');
const versionFlag = args.includes('--version') || args.includes('-v');
const logLevelArg = args.find((a) => a.startsWith('--log-level='));
const standaloneFlag = args.includes('--standalone');

// Configure logging
if (logLevelArg) {
  const level = logLevelArg.split('=')[1] as 'silent' | 'error' | 'warn' | 'info' | 'debug';
  setLogger(new Logger(level, 'MCP-Review'));
}

const logger = getLogger();

/**
 * Display help information.
 */
function showHelp(): void {
  const help = `
MCP Code Review Tool - Intelligent code review via MCP protocol

  USAGE:
    bun run src/index.ts                      Start MCP server (Bun)
    node --import tsx src/index.ts            Start MCP server (Node.js)
    bun run src/index.ts --standalone         Run standalone review
    bun run src/index.ts --help               Show this help
    bun run src/index.ts --version            Show version

  STANDALONE MODE:
    Review the current working directory using static analysis only.
    Useful for quick checks without LLM configuration.

  ENVIRONMENT VARIABLES:
    MCP_REVIEW_PROVIDER   LLM provider (openai, anthropic, custom)
    OPENAI_API_KEY        OpenAI API key
    ANTHROPIC_API_KEY     Anthropic API key
    MCP_REVIEW_API_KEY    Custom provider API key
    MCP_REVIEW_API_BASE   Custom API base URL
    MCP_REVIEW_MODEL      Model name
    MCP_REVIEW_LOG_LEVEL  Log level (silent, error, warn, info, debug)

  MCP TOOLS:
    review_code          - Review files or directories
    review_git_diff      - Review git changes
    get_fix_suggestion   - Get fix for a specific issue
    list_rules           - List static analysis rules

  MCP RESOURCES:
    review://{id}/summary  - Review summary
    review://{id}/issues   - Review issues
    review://rules         - Static analysis rules

  NODE.JS COMPATIBILITY:
    Run TS directly:  npx tsx src/index.ts
    Build JS:         npm run build:node-compat
    Run JS:           node dist/node/index.js
    Binary build:     npm run build:binary    (standalone executables)

  BINARY BUILD:
    bun run build:binary              Build for current runtime
    bun run build:binary:bun          Build with Bun only
    bun run build:binary:node         Build with Node.js/pkg only
    bun run build:binary:all          Build both
    Output: ./bin/

  REPORT FORMATS:
    Supported output formats: terminal, markdown, json, html
    Terminal output uses only ASCII characters (no Unicode).
`.trim();

  console.log(help);
}

/**
 * Main entry point.
 */
async function main(): Promise<void> {
  // Show help
  if (helpFlag) {
    showHelp();
    process.exit(0);
  }

  // Show version
  if (versionFlag) {
    console.log('mcp-code-review-tool v0.1.0');
    process.exit(0);
  }

  // Standalone mode: quick static analysis of current directory
  if (standaloneFlag) {
    logger.info('Running in standalone mode');

    const { ReviewChain } = await import('./agent/review-chain');
    const { TerminalReporter } = await import('./reporter/terminal-reporter');
    const { GitAnalyzer } = await import('./analyzer/git-analyzer');

    const gitAnalyzer = new GitAnalyzer();
    const isRepo = await gitAnalyzer.isRepo();

    if (isRepo) {
      logger.info('Git repository detected, analyzing working tree...');
      const reviewChain = new ReviewChain(
        {
          modelProvider: 'custom',
          modelName: 'none',
          apiKey: '',
        },
      );

      const result = await reviewChain.reviewGitDiff();
      const reporter = new TerminalReporter();
      console.log(reporter.generate(result));
    } else {
      logger.info('Not a git repository, analyzing current directory...');
      // Read files from current directory
      const { McpReviewServer: Server } = await import('./mcp/server');
      const server = new Server();
      const files = await server['readFiles'](process.cwd());
      const review = await server['runStaticAnalysisOnly'](files, 'terminal');
      const content = (review as { content: Array<{ text: string }> }).content;
      if (content && content.length > 0) {
        console.log(content[0].text);
      }
    }

    process.exit(0);
  }

  // Default: Start MCP server
  logger.info('Starting MCP Code Review Tool...');

  const server = new McpReviewServer();

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    logger.info('Shutting down...');
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    logger.info('Shutting down...');
    process.exit(0);
  });

  await server.start();
}

main().catch((error) => {
  logger.error('Fatal error:', error);
  process.exit(1);
});
