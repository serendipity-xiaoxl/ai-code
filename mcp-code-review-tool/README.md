# MCP Code Review Tool

An intelligent code review tool implementing the **Model Context Protocol (MCP)**,
powered by **LangChain** and large language models.

Analyze source code for bugs, security vulnerabilities, performance issues, and
best practice violations. Supports multiple output formats including beautiful
terminal output using only ASCII characters.

## Features

- **Static Analysis**: Built-in pattern-based analysis (9+ rules) without LLM dependency
- **AI-Powered Review**: LangChain integration with OpenAI/Anthropic LLMs for deep analysis
- **Git Diff Review**: Analyze staged/unstaged changes or compare git references
- **Multiple Outputs**: Terminal (ASCII-only), Markdown, JSON, HTML
- **MCP Protocol**: Standard MCP server with tools and resources
- **Configurable**: Custom models, providers, and review instructions

## Installation

```bash
# Clone and enter the project
cd mcp-code-review-tool

# Install dependencies (requires Bun >= 1.2.0)
bun install

# Optional: Build TypeScript
bun run build
```

## Usage

### MCP Server Mode (Default)

Start the MCP server using stdio transport:

```bash
# Set up your LLM provider
export MCP_REVIEW_PROVIDER=openai
export OPENAI_API_KEY=sk-...

# Or use Anthropic
export MCP_REVIEW_PROVIDER=anthropic
export ANTHROPIC_API_KEY=sk-ant-...

# Start the server
bun run start
```

### MCP Tools

| Tool | Description |
|------|-------------|
| `review_code` | Review a file or directory for code quality issues |
| `review_git_diff` | Review changes in the working tree or between git refs |
| `get_fix_suggestion` | Get a fix suggestion for a specific review issue |
| `list_rules` | List all available static analysis rules |

### MCP Resources

| Resource | Description |
|----------|-------------|
| `review://{id}/summary` | Summary of a completed review |
| `review://{id}/issues` | All issues from a completed review |
| `review://rules` | Static analysis rules reference |

### Standalone Mode

For a quick review without MCP:

```bash
# Review current git working tree
bun run review

# Or use --standalone flag
bun run src/index.ts --standalone
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `MCP_REVIEW_PROVIDER` | LLM provider (`openai`, `anthropic`, `custom`) | `openai` |
| `OPENAI_API_KEY` | OpenAI API key | - |
| `ANTHROPIC_API_KEY` | Anthropic API key | - |
| `MCP_REVIEW_API_KEY` | Custom provider API key | - |
| `MCP_REVIEW_API_BASE` | Custom API base URL | - |
| `MCP_REVIEW_MODEL` | Model name | `gpt-4o` or `claude-sonnet-4-20250514` |
| `MCP_REVIEW_TEMPERATURE` | LLM temperature | `0.1` |
| `MCP_REVIEW_MAX_TOKENS` | Max response tokens | `4096` |
| `MCP_REVIEW_INSTRUCTIONS` | Additional review instructions | - |
| `MCP_REVIEW_LOG_LEVEL` | Log level (`silent`, `error`, `warn`, `info`, `debug`) | `info` |

## Output Formats

### Terminal (ASCII-only)

The terminal reporter uses only ASCII characters (no Unicode, no emoji) for
maximum terminal compatibility. ANSI escape codes provide color highlighting.

```
================================================================================
                          CODE REVIEW REPORT
               Review ID: rev-abc123-def456
               Date: 2026-06-26T10:00:00.000Z
================================================================================

  SUMMARY
  ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
    Files Reviewed:     1
    Total Lines:       50
    Total Issues:       3
    Duration:        1.2s
    CRITICAL: 1  WARNINGS: 1  INFO: 1
```

### Markdown, JSON, HTML

Use the `format` parameter with MCP tools to select output:
- `terminal` - ASCII terminal output (default)
- `markdown` - Formatted Markdown report
- `json` - Machine-readable JSON
- `html` - Standalone HTML report with embedded CSS

## Project Architecture

```
src/
  types/          Type definitions (ReviewIssue, CodeReview, etc.)
  analyzer/       Code analysis: git diff parsing, AST rules, AI review
  agent/          LangChain chains: review, fix, summary
  reporter/       Output generators: terminal, markdown, json, html
  mcp/            MCP protocol server and tool definitions
  utils/          Logging and text formatting utilities
  index.ts        Entry point
```

## Development

```bash
# Watch mode
bun run dev

# Run tests
bun test

# Run tests with coverage
bun run test:coverage

# Watch tests
bun run test:watch
```

## Node.js Compatibility

This project targets Bun as the primary runtime. See [NODEJS-COMPAT.md](NODEJS-COMPAT.md)
for details on running with Node.js.

## License

MIT
