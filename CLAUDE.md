# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is the **ai-code** project — a terminal AI coding assistant powered by LangChain.

## Team

This project uses a structured team workflow defined in `docs/agent-team-init.md`:

- **team-lead** (you): Coordinate, assign tasks, analyze bugs, track progress
- **product-manager**: Product planning and goal setting
- **develop-engineer**: Development (TS + Bun + LangChain + terminal UI)
- **test-engineer**: Testing (Bun test + Vitest)
- **code-reviewer**: Code quality review

Workflow: `product-manager plan → developer build → test-engineer test → code-reviewer review`

## Essential Commands

### ai-code

```bash
cd ai-code

# Development
bun run dev              # Watch mode (Bun)
bun run start            # Start interactive session
npm run start:node       # Start with Node.js (tsx)

# Build
bun run build            # TypeScript compilation (ESM, Bun)
npm run build:node       # TypeScript compilation (CJS, Node.js)
bun run build:binary     # Build standalone binaries (Bun + Node.js SEA)
npm run build:binary:node # Build Node.js-only binary

# Test
bun test                 # Run all tests (Bun)
bun test --watch         # Watch mode
npm run test:node        # Run with Vitest (Node.js)

# Lint
bun run lint             # ESLint
bun run format           # Prettier
```

## Architecture

### Agent Loop (`src/agent/index.ts`)

The core is a **custom tool-calling loop**, not LangChain's AgentExecutor. It uses `ChatOpenAI.bindTools()` for OpenAI-compatible function calling. Key behaviors:

- Tools are converted from `DynamicStructuredTool` to OpenAI format via `toolToOpenAIFormat()` — uses only Zod's public API (no `_def` internal access)
- The agent loops up to `maxIterations`, invoking the model and executing tool calls manually
- Each tool call result is fed back as a `ToolMessage` with the matching `tool_call_id`
- Agent instances are **reusable** — `buildAgent()` is called once; `invoke()` handles each conversation turn

### Tool System (`src/tools/`)

Seven tools registered in the CodingAgent constructor (not through ToolRegistry in the active path):

| Tool | Module | Requires Approval |
|------|--------|-------------------|
| `read` | `file/tools.ts` | No |
| `write` | `file/tools.ts` | Yes |
| `edit` | `file/tools.ts` | Yes |
| `bash` | `shell/tools.ts` | Yes |
| `bash_interactive` | `shell/tools.ts` | Yes |
| `grep` | `search/tools.ts` | No |
| `glob` | `search/tools.ts` | No |

**Two code paths exist**: The `CodingAgent` class in `agent/index.ts` creates tools directly via `createDefaultTools()`. The `ToolRegistry` class in `tools/registry.ts` provides an alternative registration-based approach. The active path is the direct creation in CodingAgent.

### Dual Runtime (`src/utils/os-compat.ts`)

`getRuntime()` detects `'bun'` or `'node'` at runtime. Shell execution in `tools/shell/tools.ts` branches on `isBun`:
- **Bun**: `Bun.spawn()` with `Response` for text streaming
- **Node.js**: `child_process.exec()` with `AbortController` timeout

All file I/O uses `node:fs/promises` (works in both runtimes).

### Configuration (`src/config/loader.ts`)

Four-layer merge (later overrides earlier):
1. Default config (`DEFAULT_CONFIG` in schema.ts)
2. User-level: `~/.ai-code/config.json`
3. Project-level: `.ai-code/config.json`
4. Environment variables: `AIC_API_KEY`, `AIC_MODEL`, etc.
5. CLI flags: `--model`, `--api-key`, etc.

Schema defined in `src/config/schema.ts` with Zod. Supports custom API base URL via `AIC_API_BASE` env or `--base-url` flag.

### Rendering (`src/renderer/`)

**CRITICAL**: All terminal output uses **ASCII-only characters**. No Unicode, no emoji, no box-drawing characters. ANSI escape codes are the only formatting mechanism.

Three renderers:
- `markdown.ts` — Markdown formatting, metadata display, help text, diff lines
- `input.ts` — Styled input prompt (`aic >`), syntax highlighting for /commands and @files
- `spinner.ts` — ASCII spinner animation ( `- \ | /` )

### Context Commands (`src/cli/context-commands.ts`)

Slash commands dispatched by `handleCommand()`:
- `/help` — Command table
- `/status` — Session info (model, messages, tokens, runtime)
- `/context` — Project context (directory, files, system prompt size)
- `/compact [N]` — Truncate history keeping last N messages
- `/clear` — Reset session
- `/exit` — Quit

### File References (`src/cli/file-refs.ts`)

`@file.ts` and `@file.ts:42` syntax in user input:
- `parseFileRefs()` — Resolves paths, reads content (≤10KB)
- `injectFileRefs()` — Replaces references with code-block-wrapped content
- `highlightFileRefs()` — ANSI coloring for display

### Session Storage (`src/storage/session.ts`)

JSON file-based persistence in `.ai-code/sessions/active.json`. Sessions auto-save on each message and restore on startup. History archived to `.ai-code/history/`.

## Code Conventions

- **TypeScript strict mode** (`noUnusedLocals`, `noUnusedParameters`, `strictNullChecks` all on)
- **ESM modules** (`"type": "module"` in package.json)
- **No default exports** — all exports are named
- **JSDoc on all public functions** with `@param` and `@returns` tags
- **ANSI color pattern**: `const C = { reset, bold, dim, ... }` then `rt(C.color)` wrapper
- **Factory pattern**: `createXxx()` functions return object bags of methods (e.g., `createRenderer()`, `createSpinner()`, `createInputRenderer()`, `createSessionStore()`)
- **File headers**: `// ===...=== // Module Name — Description // ===...===`

## Build Outputs

- `dist/` — ESM build output (Bun tsc)
- `dist/node/` — CJS build output (tsconfig.node.json) + auto-generated `package.json` with `{"type":"commonjs"}`
- `dist/bundle/` — esbuild single-file bundles for binary packaging
- `bin/` — Standalone executables (gitignored)
