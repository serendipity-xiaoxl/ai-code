# Node.js Compatibility & Binary Build Guide

## Quick Start

### Bun (primary)
```bash
bun install
bun run dev          # Start MCP server with watch mode
bun run start        # Run compiled output
```

### Node.js
```bash
npm install
npm run dev:node     # Development with watch mode
npm run start:node   # Start MCP server
```

### Run TypeScript directly with Node.js
```bash
npx tsx src/index.ts
npx tsx src/index.ts --help
npx tsx src/index.ts --standalone
```

## Build

```bash
# TypeScript compilation
npm run build              # Bun build (ESM)
npm run build:node-compat  # Node.js build (CommonJS)

# Run compiled output
node dist/node/index.js
```

## Binary Build (Standalone Executables)

Build standalone native binaries that don't require Bun or Node.js installed.

### Prerequisites
```bash
npm install             # Install dependencies (esbuild, etc.)
npm install pkg         # Optional: for Node.js binary builds
```

### Build commands
```bash
npm run build:binary           # Build both Bun and Node.js binaries
npm run build:binary:bun       # Build with Bun only
npm run build:binary:node      # Build with Node.js/pkg only
npm run build:binary:all       # Build both (same as default)
```

### Output
Binaries are placed in `./bin/` directory:
- `mcp-review-bun-{platform}` — Bun standalone binary
- `mcp-review-node-{platform}` — Node.js standalone binary

### Binary build process
1. **esbuild** bundles all TypeScript into a single JS file
2. **Bun**: `bun build --compile` creates a self-contained binary
3. **Node.js**: `pkg` packages the bundle with a Node.js runtime
   - Falls back to Node.js SEA (Single Executable Application) if pkg unavailable

## Key Differences

| Feature | Bun | Node.js |
|---------|-----|---------|
| Runtime | `bun run src/index.ts` | `node --import tsx src/index.ts` |
| Package manager | `bun install` | `npm install` |
| TypeScript | Native execution | Requires tsx or compilation |
| Build | `bunx tsc` | `npx tsc --project tsconfig.node.json` |
| Testing | `bun test` | `vitest run` |
| Binary | `bun build --compile` | `pkg` or Node.js SEA |

## Code Patterns for Compatibility

### File I/O
```typescript
// Compatible with both Bun and Node.js
import { readFile, writeFile } from 'node:fs/promises';

const content = await readFile('file.txt', 'utf-8');
await writeFile('output.txt', content);
```

### Environment Variables
```typescript
// Works in both Bun and Node.js
const apiKey = process.env['API_KEY'];
```
