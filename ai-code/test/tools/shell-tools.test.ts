// ============================================================
// ai-code - Shell Tools Tests
// ============================================================

import { describe, it, expect } from 'bun:test';
import { createBashTool, createBashInteractiveTool } from '../../src/tools/shell/tools';

describe('Shell Tools', () => {
  describe('bash tool', () => {
    it('should execute a simple command', async () => {
      const tool = createBashTool();
      const result = await tool.invoke({
        command: 'echo "hello world"',
        timeout: 5000,
      }) as string;

      expect(result).toContain('hello world');
    });

    it('should capture exit codes for failing commands', async () => {
      const tool = createBashTool();
      const result = await tool.invoke({
        command: 'exit 42',
        timeout: 5000,
      }) as string;

      expect(result).toContain('Exit code: 42');
    });

    it('should have proper tool metadata', () => {
      const tool = createBashTool();
      expect(tool.name).toBe('bash');
      expect(tool.description).toBeTruthy();
      expect(tool.schema).toBeDefined();
    });
  });

  describe('bash_interactive tool', () => {
    it('should execute a command', async () => {
      const tool = createBashInteractiveTool();
      const result = await tool.invoke({
        command: 'echo "interactive test"',
        timeout: 5000,
      }) as string;

      expect(result).toContain('interactive test');
    });

    it('should have proper tool metadata', () => {
      const tool = createBashInteractiveTool();
      expect(tool.name).toBe('bash_interactive');
      expect(tool.description).toBeTruthy();
    });
  });
});
