// ============================================================
// ai-code - Main CLI Entry Point
//
// Entry point for the terminal AI coding assistant.
// Starts interactive session loop.
//
// Runtime: Bun (primary) and Node.js (via tsx or build).
// ============================================================

import { parseArgs, showHelp, getCliConfigOverrides } from './commands';
import { loadConfig, getDefaultProjectDir } from '../config/loader';
import { createRenderer } from '../renderer/markdown';
import { createSpinner } from '../renderer/spinner';
import { buildAgent } from '../agent/index';
import { buildSystemPrompt } from '../agent/system';
import { buildProjectContext } from '../agent/context';
import { createSessionStore } from '../storage/session';
import { getLogger, setLogger, Logger } from '../utils/logger';
import { createInput, sleep, getRuntime } from '../utils/os-compat';

const logger = getLogger();

/**
 * Main entry point.
 */
async function main(): Promise<void> {
  const flags = parseArgs();

  // Handle --help
  if (flags.help) {
    showHelp();
    process.exit(0);
  }

  // Set log level
  if (flags.verbose) {
    setLogger(new Logger('debug', 'aic'));
  }

  // Load configuration
  const projectDir = getDefaultProjectDir();
  const cliOverrides = getCliConfigOverrides() as Record<string, unknown>;
  const config = await loadConfig(projectDir, cliOverrides as never);

  // Check for API key
  const apiKey = config.llm.apiKey ?? process.env['AIC_API_KEY'] ?? process.env['OPENAI_API_KEY'];

  if (!apiKey) {
    logger.error('No API key found.');
    console.log('');
    console.log('  Set one of:');
    console.log('    AIC_API_KEY  environment variable');
    console.log('    OPENAI_API_KEY  environment variable');
    console.log('    --api-key <key>  command line flag');
    console.log('    ~/.ai-code/config.json  config file');
    console.log('');
    console.log('  Example:');
    console.log('    export AIC_API_KEY=sk-your-key-here');
    console.log('    aic');
    console.log('');
    process.exit(1);
  }

  // Initialize components
  const renderer = createRenderer({ color: config.display.color, width: config.display.width });
  const spinner = createSpinner();
  const sessionStore = createSessionStore(projectDir);

  // Build project context
  spinner.start('Reading project context...');
  const projectContext = await buildProjectContext(projectDir);
  spinner.stop();

  // Build system prompt
  const systemPrompt = buildSystemPrompt(projectDir, projectContext);

  // Build LangChain agent
  const agentConfig = {
    apiKey,
    apiBaseUrl: config.llm.apiBaseUrl,
    model: config.llm.model,
    temperature: config.llm.temperature,
    maxTokens: config.llm.maxTokens,
    maxIterations: config.agent.maxIterations,
    verbose: config.agent.verbose,
  };

  let agent = buildAgent(agentConfig, systemPrompt);

  // Render startup banner
  const runtime = getRuntime();
  console.log('');
  console.log(renderer.header('ai-code v0.1.0'));
  console.log(renderer.metadata([
    ['Runtime', runtime === 'bun' ? 'Bun' : 'Node.js'],
    ['Model', config.llm.model],
    ['Project', projectDir],
    ['Context', projectContext.files.length + ' files, ' + projectContext.totalLines + ' lines'],
    ['Help', 'Type your questions or "exit" to quit'],
  ]));
  console.log('');

  // Restore previous session
  const session = await sessionStore.load();
  if (session.messages.length > 0) {
    console.log(renderer.info('Restored ' + session.messages.length + ' messages from previous session.'));
    console.log('');
  }

  // Main interaction loop
  let running = true;

  // Set up readline
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  createInput(
    async (line: string) => {
      const trimmed = line.trim();

      // Exit conditions
      if (trimmed === 'exit' || trimmed === 'quit' || trimmed === '/exit') {
        running = false;
        console.log(renderer.muted('Goodbye!'));
        sessionStore.save(session);
        process.exit(0);
      }

      if (trimmed === '/clear' || trimmed === '/reset') {
        session.messages = [];
        sessionStore.save(session);
        console.log(renderer.muted('Session cleared.'));
        return;
      }

      if (trimmed === '' || trimmed === '/help') {
        console.log(renderer.help());
        return;
      }

      // Add user message to session
      session.messages.push({ role: 'user', content: trimmed });

      // Show spinner while AI responds
      spinner.start('Thinking...');

      try {
        const response = await agent.invoke(session.messages);

        // Extract the final AI message
        const aiMessage = response.output ?? response.text ?? JSON.stringify(response);

        // Add to session
        session.messages.push({ role: 'assistant', content: aiMessage });
        sessionStore.save(session);

        spinner.stop();

        // Render the response
        console.log('');
        console.log(renderer.aiResponse(aiMessage));
        console.log('');

        // Agent is reusable - no need to rebuild
      } catch (error) {
        spinner.stop();
        const errMsg = error instanceof Error ? error.message : String(error);
        console.log(renderer.error(errMsg));
        logger.error('Agent invoke failed', error);
      }
    },
    () => {
      running = false;
      sessionStore.save(session);
      process.exit(0);
    },
  );

  // Handle Ctrl+C gracefully
  process.on('SIGINT', () => {
    spinner.stop();
    console.log('');
    console.log(renderer.muted('Interrupted. Type "exit" to quit.'));
  });

  // Keep alive
  while (running) {
    await sleep(100);
  }
}

main().catch((error) => {
  logger.error('Fatal error', error);
  process.exit(1);
});
