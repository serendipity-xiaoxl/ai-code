import { describe, it, expect, vi } from 'vitest';

// Mock os-compat
vi.mock('../../src/utils/os-compat', () => {
  const mockFs: Record<string, string> = {
    'src/a.ts': 'function calculate() { return 42; }\nconst x = calculate();\n',
    'src/b.ts': 'import { calculate } from "./a";\ncalculate();\n',
    'src/c.ts': 'export const x = 1;\n',
    'empty.ts': '',
  };

  const getKey = (p: string) => {
    const parts = p.replaceAll('\\', '/').split('/');
    return parts.slice(-2).join('/');
  };

  return {
    readTextFile: vi.fn(async (path: string) => mockFs[getKey(path)] ?? ''),
    writeTextFile: vi.fn(async () => {}),
    pathExists: vi.fn(async (path: string) => getKey(path) in mockFs),
    listDir: vi.fn(async (dirPath: string) => {
      const dirName = dirPath.replace(/\\/g, '/').split('/').pop() || '';
      if (dirName === 'src') {
        return [
          { name: 'a.ts', path: 'src/a.ts', isDirectory: false },
          { name: 'b.ts', path: 'src/b.ts', isDirectory: false },
          { name: 'c.ts', path: 'src/c.ts', isDirectory: false },
        ];
      }
      // Root dir: return 'src' directory
      return [
        { name: 'src', path: 'src', isDirectory: true },
      ];
    }),
    resolve: vi.fn((...args: string[]) => args.join('/')),
    join: vi.fn((...args: string[]) => args.join('/')),
    relative: vi.fn((_from: string, to: string) => to),
  };
});

const { createBatchEditTool } = await import('../../src/tools/file/batch-edit');

describe('Batch Edit Tool', () => {
  describe('createBatchEditTool', () => {
    it('should create tool with correct name', () => {
      const tool = createBatchEditTool();
      expect(tool.name).toBe('batch_edit');
    });

    it('should preview matches across files', async () => {
      const tool = createBatchEditTool();
      const result = await tool.invoke({
        pattern: 'calculate',
        replacement: 'compute',
        glob: 'src/*.ts',
        preview: true,
      });
      expect(result).toContain('[BATCH EDIT]');
      expect(result).toContain('calculate');
      expect(result).toContain('compute');
      expect(result).toContain('src/*.ts');
      expect(result).toContain('preview');
    });

    it('should apply replacements', async () => {
      const tool = createBatchEditTool();
      const result = await tool.invoke({
        pattern: 'calculate',
        replacement: 'compute',
        glob: 'src/*.ts',
        preview: false,
      });
      expect(result).toContain('file(s) changed');
    });

    it('should handle no matches', async () => {
      const tool = createBatchEditTool();
      const result = await tool.invoke({
        pattern: 'nonexistentPattern12345',
        replacement: 'nothing',
        glob: 'src/*.ts',
        preview: true,
      });
      expect(result).toContain('0 total replacement(s)');
    });

    it('should handle invalid regex', async () => {
      const tool = createBatchEditTool();
      const result = await tool.invoke({
        pattern: '[invalid(regex',
        replacement: 'x',
        glob: 'src/*.ts',
      });
      expect(result).toContain('Invalid regex');
    });

    it('should reject empty pattern', async () => {
      const tool = createBatchEditTool();
      await expect(tool.invoke({
        pattern: '',
        replacement: 'x',
        glob: 'src/*.ts',
      })).rejects.toThrow();
    });

    it('should reject empty glob', async () => {
      const tool = createBatchEditTool();
      await expect(tool.invoke({
        pattern: 'x',
        replacement: 'y',
        glob: '',
      })).rejects.toThrow();
    });
  });
});
