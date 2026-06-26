// ============================================================
// ai-code - Project Context Tests
// ============================================================

import { describe, it, expect } from 'bun:test';
import { readProjectInstructions, getDirectoryOverview } from '../../src/agent/context';
import { join } from 'node:path';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';

describe('Project Context', () => {
  describe('readProjectInstructions', () => {
    it('should return null when instructions file does not exist', async () => {
      const dir = mkdtempSync(join(tmpdir(), 'aic-ctx-'));
      const result = await readProjectInstructions(dir);
      expect(result).toBeNull();
    });

    it('should read instructions file when it exists', async () => {
      const dir = mkdtempSync(join(tmpdir(), 'aic-ctx-'));
      const aiCodeDir = join(dir, '.ai-code');
      mkdirSync(aiCodeDir, { recursive: true });
      writeFileSync(join(aiCodeDir, 'instructions.md'), '# Project Rules\n\nUse TypeScript.', 'utf-8');

      const result = await readProjectInstructions(dir);
      expect(result).toContain('Project Rules');
      expect(result).toContain('Use TypeScript');
    });
  });

  describe('getDirectoryOverview', () => {
    it('should return structured directory overview', async () => {
      const dir = mkdtempSync(join(tmpdir(), 'aic-overview-'));
      writeFileSync(join(dir, 'README.md'), '', 'utf-8');
      writeFileSync(join(dir, 'package.json'), '', 'utf-8');
      mkdirSync(join(dir, 'src'), { recursive: true });

      const result = await getDirectoryOverview(dir);
      expect(result).toContain('Project structure:');
      expect(result).toContain('README.md');
      expect(result).toContain('package.json');
      expect(result).toContain('src');
    });

    it('should skip hidden directories', async () => {
      const dir = mkdtempSync(join(tmpdir(), 'aic-skip-'));
      mkdirSync(join(dir, '.hidden-dir'), { recursive: true });
      writeFileSync(join(dir, 'visible.txt'), '', 'utf-8');

      const result = await getDirectoryOverview(dir);
      expect(result).toContain('visible.txt');
      expect(result).not.toContain('.hidden-dir');
    });
  });
});
