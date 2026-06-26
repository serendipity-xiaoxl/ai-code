# Node.js Compatibility & Binary Build Guide

## Quick Start

### Bun (primary)
```bash
bun install
bun run dev          # Development with watch mode
bun run start        # Start the assistant
```

### Node.js
```bash
npm install
npm run dev:node     # Development with watch mode
npm run start:node   # Start the assistant
```

### Run TypeScript directly with Node.js
```bash
npx tsx src/cli/index.ts
npx tsx src/cli/index.ts --help
```

## Build

```bash
# TypeScript compilation
npm run build           # Bun build (ESM)
npm run build:node      # Node.js build (CommonJS)

# Run compiled output
node dist/node/cli/index.js
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
- `aic-bun-{platform}` — Bun standalone binary
- `aic-node-{platform}` — Node.js standalone binary

### Binary build process
1. **esbuild** bundles all TypeScript into a single JS file
2. **Bun**: `bun build --compile` creates a self-contained binary
3. **Node.js**: `pkg` packages the bundle with a Node.js runtime
   - Falls back to Node.js SEA (Single Executable Application) if pkg unavailable

## Key Differences

| Feature | Bun | Node.js |
|---------|-----|---------|
| Runtime | `bun run src/cli/index.ts` | `node --import tsx src/cli/index.ts` |
| Package manager | `bun install` | `npm install` |
| TypeScript | Native execution | Requires tsx or compilation |
| Build | `bunx tsc` | `npx tsc --project tsconfig.node.json` |
| Testing | `bun test` | `vitest run` |
| Binary | `bun build --compile` | `pkg` or Node.js SEA |

## OS Compatibility Layer

All runtime-specific code is abstracted through `src/utils/os-compat.ts`:
- File operations use `node:fs/promises` (works in both Bun and Node.js)
- Shell execution checks `isBun` and uses the appropriate implementation
- `getRuntime()` detects the current runtime at startup
