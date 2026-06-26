# Node.js Compatibility Guide

This project is built with **Bun** as the primary runtime. This document describes the differences and how to run with **Node.js**.

## Quick Start

```bash
# Install dependencies
npm install

# Build for Node.js (CommonJS output)
npx tsc --project tsconfig.node.json

# Run with Node.js
node dist/node/cli/index.js

# Or use tsx for direct TypeScript execution
npx tsx src/cli/index.ts
```

## Build Configuration

- `tsconfig.node.json` uses CommonJS module format for Node.js compatibility
- Output goes to `dist/node/` directory
- Run `bun run build:node` or `npx tsc --project tsconfig.node.json`

## Key Differences

| Feature | Bun | Node.js |
|---------|-----|---------|
| Runtime | `bun run src/cli/index.ts` | `node dist/node/cli/index.js` or `npx tsx src/cli/index.ts` |
| Package manager | `bun install` | `npm install` |
| TypeScript | Native execution | Requires tsx or compilation |
| Shell execution | `Bun.spawn()` | `child_process.exec()` |
| File I/O | `Bun.file()` | `fs/promises` |
| SQLite | `bun:sqlite` (native) | `better-sqlite3` |
| Testing | `bun test` | `vitest` or `jest` |

## OS Compatibility Layer

All runtime-specific code is abstracted through `src/utils/os-compat.ts`:

- File operations use `node:fs/promises` (works in both Bun and Node.js)
- Shell execution checks `isBun` and uses the appropriate implementation
- Environment variables use `process.env` (works in both)

## Shell Execution

The `shell/tools.ts` module has dual implementations:

```typescript
if (isBun) {
  // Bun: use Bun.spawn
  const proc = Bun.spawn(['/bin/bash', '-c', command], { ... });
} else {
  // Node.js: use child_process.exec
  const { exec } = await import('node:child_process');
  // ...
}
```

## Testing

```bash
# Bun (primary)
bun test

# Node.js
npx vitest run
# or
npx jest
```

## Limitations with Node.js

1. **No native TypeScript execution**: Use `tsx` or compile first
2. **Performance**: Bun starts faster and has better module resolution
3. **SQLite**: In Node.js, install `better-sqlite3` for SQLite support
4. **Test runner**: Primary test suite uses `bun test`; for Node.js, vitest is available
