// ============================================================
// ai-code - OS Compatibility Layer Tests
// ============================================================

import { describe, it, expect } from 'bun:test';
import {
  getRuntime,
  isBun,
  getRuntimeVersion,
  pathExists,
  getCwd,
  getHomeDir,
  getTerminalWidth,
  getTerminalHeight,
  sleep,
} from '../../src/utils/os-compat';

describe('OS Compatibility Layer', () => {
  describe('runtime detection', () => {
    it('should detect Bun runtime', () => {
      const runtime = getRuntime();
      expect(['bun', 'node']).toContain(runtime);
    });

    it('should have isBun boolean', () => {
      expect(typeof isBun).toBe('boolean');
    });

    it('should return a version string', () => {
      const version = getRuntimeVersion();
      expect(version.length).toBeGreaterThan(0);
    });
  });

  describe('path utilities', () => {
    it('should detect existing paths', () => {
      const cwd = getCwd();
      expect(pathExists(cwd)).toBe(true);
    });

    it('should detect non-existing paths', () => {
      expect(pathExists('/nonexistent-path-12345')).toBe(false);
    });
  });

  describe('environment info', () => {
    it('should return a cwd string', () => {
      expect(typeof getCwd()).toBe('string');
      expect(getCwd().length).toBeGreaterThan(0);
    });

    it('should return a home directory', () => {
      const home = getHomeDir();
      expect(typeof home).toBe('string');
      expect(home.length).toBeGreaterThan(0);
    });
  });

  describe('terminal info', () => {
    it('should return a positive terminal width', () => {
      expect(getTerminalWidth()).toBeGreaterThan(0);
    });

    it('should return a positive terminal height', () => {
      expect(getTerminalHeight()).toBeGreaterThan(0);
    });
  });

  describe('sleep', () => {
    it('should resolve after the given time', async () => {
      const start = Date.now();
      await sleep(50);
      const elapsed = Date.now() - start;
      expect(elapsed).toBeGreaterThanOrEqual(40);
    });
  });
});
