# ai-code

Terminal AI Coding Assistant powered by LangChain. A modular, provider-agnostic coding agent for TypeScript developers.

## Features

- **Multi-turn conversation** with tool-calling AI agent
- **8 built-in tools**: read, write, edit, diff, bash, bash_interactive, grep, glob
- **@file references** — inject file contents into conversation (`@src/index.ts`, `@config:42`)
- **Context commands** — `/status`, `/context`, `/compact`, `/clear`
- **OpenAI-compatible** — works with any provider exposing an OpenAI-format API
- **Dual runtime** — Bun (primary) or Node.js via tsx
- **ASCII-only terminal UI** — no Unicode dependency
- **Standalone binaries** — Bun `--compile` or Node.js SEA

## Quick Start

### Prerequisites

- [Bun](https://bun.sh) >= 1.2.0 or [Node.js](https://nodejs.org) >= 22
- An API key for an OpenAI-compatible provider

### Install & Run

```bash
cd ai-code

# Install dependencies
bun install        # or: npm install

# Start (Bun)
bun run start

# Start (Node.js)
npm run start:node
```

Set your API key:

```bash
export AIC_API_KEY=sk-your-key-here
# or for OpenAI:
export OPENAI_API_KEY=sk-your-key-here
```

### Configuration

ai-code merges configuration from four sources (later overrides earlier):

1. **Defaults** — sensible built-in values
2. **User config** — `~/.ai-code/config.json`
3. **Project config** — `.ai-code/config.json`
4. **Environment** — `AIC_API_KEY`, `AIC_MODEL`, `AIC_API_BASE`, etc.
5. **CLI flags** — `--model`, `--api-key`, `--base-url`, `--temperature`

## Commands

| Command | Description |
|---------|-------------|
| `/help` | Show all commands |
| `/status` | Session status, token usage |
| `/context` | Current project context |
| `/compact [N]` | Compact conversation history |
| `/clear` | Clear session |
| `@file.ts` | Reference a file |
| `@file.ts:42` | Reference file at line |
| `Ctrl+L` | Clear screen |
| `Ctrl+C` | Interrupt |

## Build

```bash
bun run build           # ESM build
npm run build:node      # CJS build (Node.js)

# Standalone binaries
npm run build:binary:node   # Node.js SEA binary
npm run build:binary:bun    # Bun binary (requires Bun)
```

## License

MIT
