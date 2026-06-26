// ============================================================
// ai-code - Vitest Configuration
// ============================================================

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Only include new vitest-based test files.
    // Existing tests use bun:test and run via `bun test`.
    include: [
      'test/renderer/input.test.ts',
      'test/cli/file-refs.test.ts',
      'test/cli/context-commands.test.ts',
    ],
    exclude: ['node_modules'],
  },
});
