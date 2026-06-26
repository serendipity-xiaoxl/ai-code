# Node.js Compatibility Guide

This project is built with **Bun** as the primary runtime and package manager.
This document describes differences when running with **Node.js**.

## Quick Start with Node.js

```bash
# Install dependencies (Bun is still recommended for install)
npm install

# Build for Node.js (uses CommonJS module format)
npx tsc --project tsconfig.node.json

# Run with Node.js
node dist/node/index.js
```

## Build Configuration

- `tsconfig.node.json` compiles to CommonJS with `moduleResolution: "node"`
- Output goes to `dist/node/` to avoid conflicting with the Bun build
- Run `bun run build:node-compat` or `npx tsc --project tsconfig.node.json` to build

## Key Differences (Bun vs Node.js)

| Feature | Bun | Node.js |
|---------|-----|---------|
| Runtime | `bun run src/index.ts` | `node dist/node/index.js` or `npx tsx src/index.ts` |
| Package manager | `bun add/install` | `npm install` or `npx` |
| TypeScript execution | Native (no compile step needed) | Requires `tsx` or pre-compilation |
| File I/O | `Bun.file()`, `Bun.write()` | `fs.readFile/readFileSync`, `fs.writeFile/writeFileSync` |
| Environment | `Bun.env` or `process.env` | `process.env` only |
| Test runner | `bun test` | `npx vitest` or `npx jest` |
| Watch mode | `--watch` flag | Requires `tsx watch` or `ts-node-dev` |
| Node_modules | Bun's binary lockfile `bun.lock` | `package-lock.json` |

## Code Patterns for Compatibility

### File I/O

This project uses `node:fs/promises` (readFile, writeFile) which works in both Bun and Node.js:

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

### Package.json Fields

The `package.json` includes both `type: "module"` for Bun (ESM) and a separate
`tsconfig.node.json` for Node.js CommonJS output.

## When to Use Which

- **Development**: Always use Bun for the best experience (`bun run dev`)
- **CI/CD**: Use Bun for speed, or Node.js with `tsx` for compatibility
- **Production deployment**: Both work; choose based on your infrastructure
- **Library usage**: Export TypeScript source; consumers can use with either runtime

## Known Limitations with Node.js

1. **TypeScript execution**: Node.js cannot natively run `.ts` files. Use `tsx` (`npx tsx`) as a runtime or compile first.
2. **Performance**: Bun generally starts faster and has better module resolution for this project.
3. **Test runner**: `bun test` is the primary test runner. For Node.js, use `vitest` (already included in devDependencies).
