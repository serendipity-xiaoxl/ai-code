// ============================================================
// ai-code - CLI Commands Tests
// ============================================================

import { describe, it, expect, afterEach } from 'bun:test';

describe('CLI Commands', () => {
  // Store original argv and env
  const originalArgv = process.argv;

  afterEach(() => {
    process.argv = originalArgv;
  });

  describe('getCliConfigOverrides', () => {
    it('should return empty overrides when no args set', async () => {
      process.argv = ['bun', 'src/index.ts'];
      const { getCliConfigOverrides } = await import('../../src/cli/commands');
      const overrides = getCliConfigOverrides();
      expect(overrides).toEqual({});
    });

    it('should extract model override', async () => {
      process.argv = ['bun', 'src/index.ts', '-m', 'gpt-4o-mini'];
      const { getCliConfigOverrides } = await import('../../src/cli/commands');
      const overrides = getCliConfigOverrides();
      expect(overrides.llm).toBeDefined();
      if (overrides.llm) {
        expect((overrides.llm as Record<string, unknown>).model).toBe('gpt-4o-mini');
      }
    });

    it('should extract temperature override', async () => {
      process.argv = ['bun', 'src/index.ts', '-t', '0.7'];
      const { getCliConfigOverrides } = await import('../../src/cli/commands');
      const overrides = getCliConfigOverrides();
      if (overrides.llm) {
        expect((overrides.llm as Record<string, unknown>).temperature).toBe(0.7);
      }
    });

    it('should extract api key override', async () => {
      process.argv = ['bun', 'src/index.ts', '--api-key', 'sk-test-key'];
      const { getCliConfigOverrides } = await import('../../src/cli/commands');
      const overrides = getCliConfigOverrides();
      if (overrides.llm) {
        expect((overrides.llm as Record<string, unknown>).apiKey).toBe('sk-test-key');
      }
    });
  });

  describe('showHelp', () => {
    it('should not throw when displaying help', async () => {
      const { showHelp } = await import('../../src/cli/commands');
      expect(() => showHelp()).not.toThrow();
    });
  });
});
