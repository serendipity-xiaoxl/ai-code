// ============================================================
// ai-code - System Prompt Tests
// ============================================================

import { describe, it, expect } from 'bun:test';
import { buildSystemPrompt } from '../../src/agent/system';
import type { ProjectContext } from '../../src/agent/context';

describe('System Prompt', () => {
  it('should include role definition', () => {
    const context: ProjectContext = {
      projectDir: '/test',
      rootFiles: [],
      directories: [],
      files: [],
      totalLines: 0,
      keyFiles: {},
    };
    const prompt = buildSystemPrompt('/test/project', context);
    expect(prompt).toContain('ai-code');
    expect(prompt).toContain('terminal-based AI coding assistant');
  });

  it('should include project directory', () => {
    const context: ProjectContext = {
      projectDir: '/my-project',
      rootFiles: [],
      directories: [],
      files: [],
      totalLines: 0,
      keyFiles: {},
    };
    const prompt = buildSystemPrompt('/my-project', context);
    expect(prompt).toContain('/my-project');
  });

  it('should list root files when present', () => {
    const context: ProjectContext = {
      projectDir: '/test',
      rootFiles: ['package.json', 'README.md'],
      directories: [],
      files: [],
      totalLines: 0,
      keyFiles: {},
    };
    const prompt = buildSystemPrompt('/test', context);
    expect(prompt).toContain('package.json');
    expect(prompt).toContain('README.md');
  });

  it('should include project stats', () => {
    const context: ProjectContext = {
      projectDir: '/test',
      rootFiles: [],
      directories: ['src', 'test'],
      files: ['index.ts'],
      totalLines: 150,
      keyFiles: {},
    };
    const prompt = buildSystemPrompt('/test', context);
    expect(prompt).toContain('150');
    expect(prompt).toContain('2');
  });

  it('should not include root files section when none exist', () => {
    const context: ProjectContext = {
      projectDir: '/test',
      rootFiles: [],
      directories: [],
      files: [],
      totalLines: 0,
      keyFiles: {},
    };
    const prompt = buildSystemPrompt('/test', context);
    expect(prompt).not.toContain('Root files:');
  });

  it('should include available tools section', () => {
    const context: ProjectContext = {
      projectDir: '/test',
      rootFiles: [],
      directories: [],
      files: [],
      totalLines: 0,
      keyFiles: {},
    };
    const prompt = buildSystemPrompt('/test', context);
    expect(prompt).toContain('read');
    expect(prompt).toContain('write');
    expect(prompt).toContain('bash');
    expect(prompt).toContain('grep');
    expect(prompt).toContain('glob');
  });

  it('should include response guidelines', () => {
    const context: ProjectContext = {
      projectDir: '/test',
      rootFiles: [],
      directories: [],
      files: [],
      totalLines: 0,
      keyFiles: {},
    };
    const prompt = buildSystemPrompt('/test', context);
    expect(prompt).toContain('Response Guidelines');
    expect(prompt).toContain('code blocks');
  });
});
