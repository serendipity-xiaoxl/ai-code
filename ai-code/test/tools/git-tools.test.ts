import { describe, it, expect, vi, beforeEach } from 'vitest';
import { execSync } from 'node:child_process';

// Mock child_process.execSync
vi.mock('node:child_process', () => ({
  execSync: vi.fn(),
}));

// Dynamic import to avoid hoisting issues with vi.mock
const { createGitDiffTool, createGitStatusTool, createGitLogTool, createGitCommitTool, createGitTools } =
  await import('../../src/tools/git/tools');

function mockGit(callback: (cmd: string) => string | Error) {
  (execSync as unknown as ReturnType<typeof vi.fn>).mockImplementation((cmd: string) => {
    const result = callback(cmd);
    if (result instanceof Error) throw result;
    return result;
  });
}

describe('Git Tools', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createGitDiffTool', () => {
    it('should return working tree diff', async () => {
      mockGit(() => 'diff --git a/file.ts b/file.ts\n@@ -1,3 +1,4 @@\n unchanged\n-deleted\n+added\n unchanged');
      const tool = createGitDiffTool();
      const result = await tool.invoke({});
      expect(result).toContain('diff --git');
      expect(result).toContain('@@ -1,3 +1,4 @@');
    });

    it('should handle staged flag', async () => {
      mockGit(() => 'diff --cached output');
      const tool = createGitDiffTool();
      const result = await tool.invoke({ staged: true });
      expect(result).toContain('diff --cached');
    });

    it('should handle file restriction', async () => {
      const calls: string[] = [];
      mockGit((cmd) => { calls.push(cmd); return ''; });
      const tool = createGitDiffTool();
      await tool.invoke({ file: 'src/app.ts' });
      expect(calls.some((c) => c.includes('src/app.ts'))).toBe(true);
    });

    it('should handle no changes', async () => {
      mockGit(() => '');
      const tool = createGitDiffTool();
      const result = await tool.invoke({});
      expect(result).toContain('No changes found');
    });

    it('should handle not a git repo', async () => {
      const err = new Error() as Error & { code: string; stderr: string; status: number };
      err.code = '';
      err.stderr = 'fatal: not a git repository';
      err.status = 128;
      mockGit(() => { throw err; });
      const tool = createGitDiffTool();
      const result = await tool.invoke({});
      expect(result).toContain('Not a git repository');
    });

    it('should handle git not installed', async () => {
      const err = new Error() as Error & { code: string };
      err.code = 'ENOENT';
      mockGit(() => { throw err; });
      const tool = createGitDiffTool();
      const result = await tool.invoke({});
      expect(result).toContain('not installed');
    });
  });

  describe('createGitStatusTool', () => {
    it('should return long format by default', async () => {
      mockGit(() => 'On branch main\nnothing to commit, working tree clean');
      const tool = createGitStatusTool();
      const result = await tool.invoke({});
      expect(result).toContain('working tree clean');
    });

    it('should support porcelain format', async () => {
      mockGit(() => ' M src/file.ts\n?? new.ts');
      const tool = createGitStatusTool();
      const result = await tool.invoke({ porcelain: true });
      expect(result).toContain('[ M]');
      expect(result).toContain('[??]');
    });

    it('should handle clean working tree', async () => {
      mockGit(() => '');
      const tool = createGitStatusTool();
      const result = await tool.invoke({});
      expect(result).toContain('Nothing to commit');
    });
  });

  describe('createGitLogTool', () => {
    it('should return 10 commits by default', async () => {
      mockGit(() => 'abc1234 feat: something\ndef5678 fix: bug');
      const tool = createGitLogTool();
      const result = await tool.invoke({});
      expect(result).toContain('abc1234');
      expect(result).toContain('def5678');
    });

    it('should support oneline format', async () => {
      mockGit(() => 'abc1234 feat: test\ndef5678 fix: bug');
      const tool = createGitLogTool();
      const result = await tool.invoke({ oneline: true });
      expect(result).toContain('abc1234');
    });

    it('should handle no commits yet', async () => {
      const err = new Error() as Error & { code: string; stderr: string; status: number };
      err.code = '';
      err.stderr = 'fatal: your current branch does not have any commits';
      err.status = 128;
      mockGit(() => { throw err; });
      const tool = createGitLogTool();
      const result = await tool.invoke({});
      expect(result).toContain('No commits yet');
    });
  });

  describe('createGitCommitTool', () => {
    it('should commit with message', async () => {
      const calls: string[] = [];
      mockGit((cmd) => {
        calls.push(cmd);
        if (cmd.includes('commit')) return '[main abc1234] test commit\n1 file changed';
        return '';
      });
      const tool = createGitCommitTool();
      const result = await tool.invoke({ message: 'test commit' });
      expect(result).toContain('[main abc1234]');
      expect(calls.some((c) => c.includes('add -A'))).toBe(true);
      expect(calls.some((c) => c.includes('commit -m'))).toBe(true);
    });

    it('should stage specific files', async () => {
      const calls: string[] = [];
      mockGit((cmd) => {
        calls.push(cmd);
        if (cmd.includes('commit')) return 'done';
        return '';
      });
      const tool = createGitCommitTool();
      await tool.invoke({ message: 'update', files: ['src/a.ts', 'src/b.ts'] });
      expect(calls.some((c) => c.includes('src/a.ts') && c.includes('src/b.ts'))).toBe(true);
    });

    it('should handle nothing to commit', async () => {
      mockGit((cmd) => {
        if (cmd.includes('commit')) {
          const err = new Error() as Error & { stderr: string };
          err.stderr = 'nothing to commit, working tree clean';
          throw err;
        }
        return '';
      });
      const tool = createGitCommitTool();
      const result = await tool.invoke({ message: 'empty' });
      expect(result).toContain('Nothing to commit');
    });
  });

  describe('createGitTools', () => {
    it('should return 4 tools', () => {
      const tools = createGitTools();
      expect(tools).toHaveLength(4);
      expect(tools[0].name).toBe('git_diff');
      expect(tools[1].name).toBe('git_status');
      expect(tools[2].name).toBe('git_log');
      expect(tools[3].name).toBe('git_commit');
    });
  });
});
