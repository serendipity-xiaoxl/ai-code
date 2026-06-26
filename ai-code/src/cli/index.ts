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
import { createInputRenderer } from '../renderer/input';
import { handleCommand } from './context-commands';
import { parseFileRefs, injectFileRefs } from './file-refs';

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
  const inputRenderer = createInputRenderer();

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

  let agent = await buildAgent(agentConfig, systemPrompt, {
    autoYes: flags.yes || config.behavior.skipConfirmation,
  });

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

  console.log(inputRenderer.sectionHeader('SESSION'));

  // Restore previous session
  const session = await sessionStore.load();
  if (session.messages.length > 0) {
    console.log(renderer.info('Restored ' + session.messages.length + ' messages from previous session.'));
    console.log('');
  }

  // Main interaction loop
  let running = true;

  // Separator lines to frame input area
  const inputFrame = inputRenderer.inputFrame();

  // Print initial top separator and start with prompt
  console.log('');
  console.log(inputFrame.top);

  // Set up readline with backspace-safe prompt
  const rl = createInput(
    async (line: string) => {
      // Reset exit timer on any input
      if (exitTimer) { clearTimeout(exitTimer); exitTimer = null; }

      const trimmed = line.trim();

      // Print bottom separator to close the input frame
      console.log(inputFrame.bottom);

      // Handle slash commands via handleCommand() BEFORE any other processing
      const cmdResult = handleCommand(trimmed, session, renderer, inputRenderer, projectDir);

      if (cmdResult.handled) {
        if (cmdResult.output) {
          console.log(cmdResult.output);
          console.log('');
        }

        // Apply side effects from CommandAction
        if (cmdResult.action) {
          if (cmdResult.action.type === 'clear') {
            session.messages = [];
            sessionStore.save(session);
          } else if (cmdResult.action.type === 'exit') {
            running = false;
            sessionStore.save(session);
            console.log(renderer.muted('Goodbye!'));
            process.exit(0);
          } else if (cmdResult.action.type === 'compact') {
            session.messages = cmdResult.action.messages;
            sessionStore.save(session);
          }
        }

        // Reprint top separator for next input
        console.log('');
        console.log(inputFrame.top);
        rl.setPrompt(inputRenderer.prompt());
        return;
      }

      // Echo highlighted input (non-empty only) inside the frame
      if (trimmed.length > 0) {
        console.log(inputRenderer.inputBox(inputRenderer.highlightInput(trimmed)));
      }

      // Parse @file references
      const fileRefs = parseFileRefs(trimmed, projectDir);
      let processedInput = trimmed;
      let loadedFileMsg = '';

      if (fileRefs.length > 0) {
        const existingRefs = fileRefs.filter((f) => f.exists);
        if (existingRefs.length > 0) {
          loadedFileMsg = 'Loaded ' + existingRefs.length + ' file(s): ' +
            existingRefs.map((f) => inputRenderer.refFile(f.filePath)).join(', ');
          processedInput = injectFileRefs(trimmed, fileRefs);
        }
      }

      // Add user message to session
      session.messages.push({ role: 'user', content: processedInput });

      // Show file loading message
      if (loadedFileMsg) {
        console.log('');
        console.log(renderer.muted(loadedFileMsg));
        console.log('');
      }

      // Show spinner while AI responds
      appState = 'processing';
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

        // Agent is reusable - no need to rebuild
      } catch (error) {
        spinner.stop();
        const errMsg = error instanceof Error ? error.message : String(error);
        console.log(renderer.error(errMsg));
        logger.error('Agent invoke failed', error);
      }

      // Reprint top separator to start new input frame
      appState = 'idle';
      console.log('');
      console.log(inputFrame.top);
      rl.setPrompt(inputRenderer.prompt());
    },
    () => {
      running = false;
      sessionStore.save(session);
      process.exit(0);
    },
    inputRenderer.prompt(), // backspace-safe prompt via readline
  );

  // Track app state for Ctrl+C behavior
  let appState: 'idle' | 'processing' = 'idle';
  let exitTimer: ReturnType<typeof setTimeout> | null = null;
  const EXIT_WINDOW_MS = 3000; // 3s window for double Ctrl+C to exit

  // Handle Ctrl+C with three behaviors:
  // 1. Idle + first Ctrl+C  → readline clears input, warn about exit
  // 2. Idle + second Ctrl+C within 3s → exit process
  // 3. Processing + Esc/Ctrl+C → interrupt current task
  process.on('SIGINT', () => {
    if (appState === 'processing') {
      // Interrupt current AI task
      spinner.stop();
      console.log('');
      console.log(renderer.muted('Interrupted.'));
      console.log('');
      console.log(inputFrame.top);
      rl.setPrompt(inputRenderer.prompt());
      appState = 'idle';
      return;
    }

    // Idle state: first press warns, second within window exits
    if (exitTimer) {
      // Second Ctrl+C within window → exit
      clearTimeout(exitTimer);
      console.log('');
      console.log(renderer.muted('Goodbye!'));
      sessionStore.save(session);
      process.exit(0);
    }

    // First Ctrl+C → clear input, warn
    console.log('');
    console.log(renderer.muted('Press Ctrl+C again to exit.'));
    console.log('');
    console.log(inputFrame.top);
    rl.setPrompt(inputRenderer.prompt());

    // Set exit window timer
    exitTimer = setTimeout(() => {
      exitTimer = null;
    }, EXIT_WINDOW_MS);
  });

  // Reset exit timer when user starts typing (handled by readline 'line' event already)

  // Keep alive
  while (running) {
    await sleep(100);
  }
}

main().catch((error) => {
  logger.error('Fatal error', error);
  process.exit(1);
});
