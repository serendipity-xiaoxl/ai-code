// ============================================================
// ai-code - Configuration Loader Tests
// ============================================================

import { describe, it, expect, afterEach } from 'bun:test';
import { join } from 'node:path';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';

describe('Config Loader', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('mergeConfig', () => {
    it('should deep-merge config overrides', async () => {
      const { loadConfig } = await import('../../src/config/loader');
      const dir = mkdtempSync(join(tmpdir(), 'aic-cfg-'));
      const config = await loadConfig(dir, {
        llm: { temperature: 0.5 },
      });
      expect(config.llm.temperature).toBe(0.5);
    });
  });

  describe('getDataDir', () => {
    it('should resolve relative data directory', async () => {
      const { getDataDir } = await import('../../src/config/loader');
      const config = { storage: { dataDir: '.ai-code/data', historyDir: '.ai-code/history' } } as never;
      const dir = getDataDir(config, '/project');
      expect(dir).toBe('/project/.ai-code/data');
    });

    it('should return absolute data directory as-is', async () => {
      const { getDataDir } = await import('../../src/config/loader');
      const config = { storage: { dataDir: '/abs/path', historyDir: '.ai-code/history' } } as never;
      const dir = getDataDir(config, '/project');
      expect(dir).toBe('/abs/path');
    });
  });

  describe('getHistoryDir', () => {
    it('should resolve relative history directory', async () => {
      const { getHistoryDir } = await import('../../src/config/loader');
      const config = { storage: { dataDir: '.ai-code/data', historyDir: '.ai-code/history' } } as never;
      const dir = getHistoryDir(config, '/project');
      expect(dir).toBe('/project/.ai-code/history');
    });
  });

  describe('ENV config loading', () => {
    it('should load model from environment variable', async () => {
      process.env['AIC_MODEL'] = 'gpt-4o-mini';
      const { loadConfig } = await import('../../src/config/loader');
      const dir = mkdtempSync(join(tmpdir(), 'aic-env-'));
      const config = await loadConfig(dir);
      expect(config.llm.model).toBe('gpt-4o-mini');
    });

    it('should load verbose from environment', async () => {
      process.env['AIC_VERBOSE'] = 'true';
      const { loadConfig } = await import('../../src/config/loader');
      const dir = mkdtempSync(join(tmpdir(), 'aic-env-'));
      const config = await loadConfig(dir);
      expect(config.agent.verbose).toBe(true);
    });

    it('should load display width from environment', async () => {
      process.env['AIC_WIDTH'] = '100';
      const { loadConfig } = await import('../../src/config/loader');
      const dir = mkdtempSync(join(tmpdir(), 'aic-env-'));
      const config = await loadConfig(dir);
      expect(config.display.width).toBe(100);
    });
  });

  describe('getDefaultProjectDir', () => {
    it('should return current working directory', async () => {
      const { getDefaultProjectDir } = await import('../../src/config/loader');
      const dir = getDefaultProjectDir();
      expect(dir).toBe(process.cwd());
    });
  });
});
