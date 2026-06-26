// ============================================================
// ai-code - CLI Commands / Argument Parsing
//
// Uses commander for CLI argument parsing.
// ============================================================

import { Command } from 'commander';
import type { RuntimeFlags } from '../config/schema';
import { getLogger } from '../utils/logger';

const logger = getLogger();
const pkg = { version: '0.1.0', name: 'ai-code' };

/**
 * Parse CLI arguments and return runtime flags.
 */
export function parseArgs(): RuntimeFlags {
  const program = new Command();

  program
    .name('aic')
    .description('Terminal AI Coding Assistant - powered by LangChain')
    .version(pkg.version)
    .option('-y, --yes', 'Skip approval prompts and auto-confirm')
    .option('-v, --verbose', 'Enable verbose output')
    .option('-m, --model <model>', 'LLM model to use')
    .option('-b, --base-url <url>', 'OpenAI-compatible API base URL')
    .option('--api-key <key>', 'API key for the LLM provider')
    .option('-t, --temperature <number>', 'LLM temperature (0-2)')
    .option('-d, --directory <path>', 'Project directory')
    .helpOption('-h, --help', 'Show help')
    .allowExcessArguments(true);

  // Parse and handle errors gracefully
  try {
    program.parse(process.argv);
  } catch (error) {
    logger.error('Failed to parse arguments', error);
    program.help({ error: true });
  }

  const opts = program.opts();

  return {
    yes: opts['yes'] ?? false,
    verbose: opts['verbose'] ?? false,
    help: opts['help'] ?? false,
    version: opts['version'] ?? false,
  };
}

/**
 * Get command-line argument values merged into config overrides.
 */
export function getCliConfigOverrides(): Record<string, unknown> {
  const program = new Command();

  program
    .option('-m, --model <model>', '')
    .option('-b, --base-url <url>', '')
    .option('--api-key <key>', '')
    .option('-t, --temperature <number>', '')
    .option('-d, --directory <path>', '')
    .allowExcessArguments(true);

  try {
    program.parse(process.argv);
  } catch {
    return {};
  }

  const opts = program.opts<Record<string, string | undefined>>();
  const overrides: Record<string, unknown> = {};

  if (opts['model']) {
    overrides['llm'] = { ...(overrides['llm'] as object ?? {}), model: opts['model'] };
  }
  if (opts['baseUrl']) {
    overrides['llm'] = { ...(overrides['llm'] as object ?? {}), apiBaseUrl: opts['baseUrl'] };
  }
  if (opts['apiKey']) {
    overrides['llm'] = { ...(overrides['llm'] as object ?? {}), apiKey: opts['apiKey'] };
  }
  if (opts['temperature']) {
    overrides['llm'] = { ...(overrides['llm'] as object ?? {}), temperature: Number(opts['temperature']) };
  }

  return overrides;
}

/**
 * Display help text.
 */
export function showHelp(): void {
  const help = `
  aic - Terminal AI Coding Assistant

  USAGE:
    aic                       Start interactive session
    aic -m gpt-4o             Start with specific model
    aic --help                Show this help
    aic --version             Show version

  OPTIONS:
    -y, --yes                 Skip approval prompts
    -v, --verbose             Verbose output
    -m, --model <model>       LLM model name
    -b, --base-url <url>      OpenAI-compatible API base URL
    --api-key <key>           API key
    -t, --temperature <n>     Temperature (0-2)
    -d, --directory <path>    Project directory
    -h, --help                Show help
    --version                 Show version

  ENVIRONMENT VARIABLES:
    AIC_API_KEY               API key
    AIC_API_BASE              API base URL
    AIC_MODEL                 Model name
    AIC_TEMPERATURE           Temperature
    AIC_LOG_LEVEL             Log level

  NODE.JS COMPATIBILITY:
    Run TS directly:  npx tsx src/cli/index.ts
    Build JS:         npm run build:node
    Run JS:           node dist/node/cli/index.js
    Binary build:     npm run build:binary    (standalone executables)

  KEYBINDINGS:
    Ctrl+C    Interrupt / stop
    Ctrl+D    Exit (on empty line)
    Ctrl+L    Clear screen

  Learn more: https://github.com/ai-code

  License: MIT
`.trim();

  console.log(help);
}
