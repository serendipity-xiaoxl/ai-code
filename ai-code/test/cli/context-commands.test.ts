// ============================================================
// ai-code - Context-Aware Slash Commands Tests
//
// Tests handleCommand for /help, /status, /context, /compact,
// /clear, /exit and estimateTokens.
// ============================================================

import { describe, it, expect } from 'vitest';
import { createRenderer } from '../../src/renderer/markdown';
import { createInputRenderer } from '../../src/renderer/input';
import { handleCommand, estimateTokens } from '../../src/cli/context-commands';
import type { Message, Session } from '../../src/storage/session';

// -----------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------

const renderer = createRenderer({ color: false, width: 80 });
const inputRenderer = createInputRenderer();

/** Create a minimal Session for testing. */
function createMockSession(overrides?: Partial<Session>): Session {
  return {
    id: 'test-session-001',
    projectDir: '/test/project',
    messages: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    metadata: { model: 'gpt-4o' },
    ...overrides,
  };
}

/** Create N messages with the given role. */
function createMessages(count: number, role: Message['role'] = 'user'): Message[] {
  return Array.from({ length: count }, (_, i) => ({
    role,
    content: 'message ' + (i + 1) + ' content',
    timestamp: new Date().toISOString(),
  }));
}

// -----------------------------------------------------------------------
// estimateTokens
// -----------------------------------------------------------------------
describe('estimateTokens', () => {
  it('should return 0 for empty string', () => {
    expect(estimateTokens('')).toBe(0);
  });

  it('should estimate 1 token per 4 characters', () => {
    expect(estimateTokens('abcd')).toBe(1);
    expect(estimateTokens('abcdefgh')).toBe(2);
  });

  it('should round up fractional tokens', () => {
    expect(estimateTokens('a')).toBe(1);       // ceil(1/4) = 1
    expect(estimateTokens('abcde')).toBe(2);    // ceil(5/4) = 2
    expect(estimateTokens('abcdefghi')).toBe(3); // ceil(9/4) = 3
  });

  it('should handle long text', () => {
    const longText = 'hello '.repeat(100); // 600 chars
    expect(estimateTokens(longText)).toBe(150); // ceil(600/4) = 150
  });
});

// -----------------------------------------------------------------------
// handleCommand — command dispatch
// -----------------------------------------------------------------------
describe('handleCommand', () => {
  describe('/help', () => {
    it('should return handled with help output', () => {
      const session = createMockSession();
      const result = handleCommand('/help', session, renderer, inputRenderer);

      expect(result.handled).toBe(true);
      expect(result.output).toBeTruthy();
      expect(result.action?.type).toBe('none');
    });

    it('should include extended slash commands', () => {
      const session = createMockSession();
      const result = handleCommand('/help', session, renderer, inputRenderer);

      expect(result.output).toContain('/status');
      expect(result.output).toContain('/context');
      expect(result.output).toContain('/compact');
    });
  });

  // -----------------------------------------------------------------------
  // /status
  // -----------------------------------------------------------------------
  describe('/status', () => {
    it('should return handled with session metadata', () => {
      const session = createMockSession();
      const result = handleCommand('/status', session, renderer, inputRenderer);

      expect(result.handled).toBe(true);
      expect(result.action?.type).toBe('none');
    });

    it('should display model name from session metadata', () => {
      const session = createMockSession({ metadata: { model: 'gpt-4o-mini' } });
      const result = handleCommand('/status', session, renderer, inputRenderer);

      expect(result.output).toContain('gpt-4o-mini');
    });

    it('should display session ID', () => {
      const session = createMockSession();
      const result = handleCommand('/status', session, renderer, inputRenderer);

      expect(result.output).toContain('test-session-001');
    });

    it('should display message count', () => {
      const session = createMockSession({ messages: createMessages(3) });
      const result = handleCommand('/status', session, renderer, inputRenderer);

      expect(result.output).toContain('3 (3 user, 0 assistant)');
    });

    it('should handle sessions with zero messages', () => {
      const session = createMockSession();
      const result = handleCommand('/status', session, renderer, inputRenderer);

      expect(result.output).toContain('0 (0 user, 0 assistant)');
    });

    it('should display Runtime', () => {
      const session = createMockSession();
      const result = handleCommand('/status', session, renderer, inputRenderer);

      expect(result.output).toContain('Runtime');
    });
  });

  // -----------------------------------------------------------------------
  // /context
  // -----------------------------------------------------------------------
  describe('/context', () => {
    it('should return handled with context output', () => {
      const session = createMockSession();
      const result = handleCommand('/context', session, renderer, inputRenderer);

      expect(result.handled).toBe(true);
      expect(result.action?.type).toBe('none');
    });

    it('should display project directory', () => {
      const session = createMockSession();
      const result = handleCommand('/context', session, renderer, inputRenderer, '/custom/dir');

      expect(result.output).toContain('/custom/dir');
    });

    it('should fall back to session.projectDir', () => {
      const session = createMockSession({ projectDir: '/fallback/dir' });
      const result = handleCommand('/context', session, renderer, inputRenderer);

      expect(result.output).toContain('/fallback/dir');
    });

    it('should display total messages count', () => {
      const session = createMockSession({ messages: createMessages(5) });
      const result = handleCommand('/context', session, renderer, inputRenderer);

      expect(result.output).toContain('Messages');
      expect(result.output).toContain('5');
    });

    it('should display total characters', () => {
      const msgs = [{
        role: 'user' as const,
        content: 'hello world',
        timestamp: new Date().toISOString(),
      }];
      const session = createMockSession({ messages: msgs });
      const result = handleCommand('/context', session, renderer, inputRenderer);

      expect(result.output).toContain('Total characters');
    });

    it('should display file references from conversation', () => {
      const messages = [
        {
          role: 'user' as const,
          content: 'check @src/test.ts',
          timestamp: new Date().toISOString(),
        },
        {
          role: 'assistant' as const,
          content: 'looking at @src/test.ts',
          timestamp: new Date().toISOString(),
        },
      ];
      const session = createMockSession({ messages });
      const result = handleCommand('/context', session, renderer, inputRenderer);

      expect(result.output).toContain('Referenced files');
      expect(result.output).toContain('src/test.ts');
    });

    it('should show "none" when no file references exist', () => {
      const session = createMockSession({ messages: createMessages(2) });
      const result = handleCommand('/context', session, renderer, inputRenderer);

      expect(result.output).toContain('none');
    });
  });

  // -----------------------------------------------------------------------
  // /compact
  // -----------------------------------------------------------------------
  describe('/compact', () => {
    it('should return compact action when messages exceed keepCount', () => {
      const session = createMockSession({ messages: createMessages(10) });
      const result = handleCommand('/compact', session, renderer, inputRenderer);

      expect(result.handled).toBe(true);
      expect(result.action?.type).toBe('compact');

      if (result.action?.type === 'compact') {
        // 1 summary + 5 kept = 6 messages
        expect(result.action.messages).toHaveLength(6);
        expect(result.action.summary).toContain('compacted');
      }
    });

    it('should display before and after message counts', () => {
      const session = createMockSession({ messages: createMessages(10) });
      const result = handleCommand('/compact', session, renderer, inputRenderer);

      // 10 -> 6 (removed 5)
      expect(result.output).toContain('10');
      expect(result.output).toContain('6');
      expect(result.output).toContain('5');
    });

    it('should accept custom keep count via /compact N', () => {
      const session = createMockSession({ messages: createMessages(10) });
      const result = handleCommand('/compact 3', session, renderer, inputRenderer);

      expect(result.handled).toBe(true);
      expect(result.action?.type).toBe('compact');

      if (result.action?.type === 'compact') {
        // 1 summary + 3 kept = 4 messages
        expect(result.action.messages).toHaveLength(4);
      }
    });

    it('should clamp keepCount to minimum of 1', () => {
      const session = createMockSession({ messages: createMessages(3) });
      const result = handleCommand('/compact 0', session, renderer, inputRenderer);

      // nonSystem (3) <= 1 → nothing to compact
      expect(result.action?.type).toBe('none');
    });

    it('should return none action when nothing to compact', () => {
      const session = createMockSession({ messages: createMessages(3) });
      const result = handleCommand('/compact', session, renderer, inputRenderer);

      expect(result.handled).toBe(true);
      expect(result.action?.type).toBe('none');
      expect(result.output).toContain('nothing to compact');
    });

    it('should preserve system messages during compaction', () => {
      const systemMsgs: Message[] = [
        { role: 'system', content: 'system prompt text', timestamp: new Date().toISOString() },
      ];
      const userMsgs = createMessages(10);
      const session = createMockSession({ messages: [...systemMsgs, ...userMsgs] });
      const result = handleCommand('/compact', session, renderer, inputRenderer);

      expect(result.action?.type).toBe('compact');

      if (result.action?.type === 'compact') {
        // system message should be preserved at the beginning
        expect(result.action.messages[0].content).toBe('system prompt text');
        // 1 system + 1 summary + 5 kept = 7 total
        expect(result.action.messages).toHaveLength(7);
      }
    });
  });

  // -----------------------------------------------------------------------
  // /clear and /reset
  // -----------------------------------------------------------------------
  describe('/clear', () => {
    it('should return clear action', () => {
      const session = createMockSession();
      const result = handleCommand('/clear', session, renderer, inputRenderer);

      expect(result.handled).toBe(true);
      expect(result.action?.type).toBe('clear');
      expect(result.output).toContain('cleared');
    });
  });

  describe('/reset', () => {
    it('should be an alias for clear', () => {
      const session = createMockSession();
      const result = handleCommand('/reset', session, renderer, inputRenderer);

      expect(result.handled).toBe(true);
      expect(result.action?.type).toBe('clear');
      expect(result.output).toContain('cleared');
    });
  });

  // -----------------------------------------------------------------------
  // /exit, exit, quit
  // -----------------------------------------------------------------------
  describe('/exit', () => {
    it('should return exit action for /exit', () => {
      const session = createMockSession();
      const result = handleCommand('/exit', session, renderer, inputRenderer);

      expect(result.handled).toBe(true);
      expect(result.action?.type).toBe('exit');
      expect(result.output).toContain('Goodbye');
    });

    it('should return exit action for exit (no slash)', () => {
      const session = createMockSession();
      const result = handleCommand('exit', session, renderer, inputRenderer);

      expect(result.handled).toBe(true);
      expect(result.action?.type).toBe('exit');
    });

    it('should return exit action for quit', () => {
      const session = createMockSession();
      const result = handleCommand('quit', session, renderer, inputRenderer);

      expect(result.handled).toBe(true);
      expect(result.action?.type).toBe('exit');
    });
  });

  // -----------------------------------------------------------------------
  // Unmatched input
  // -----------------------------------------------------------------------
  describe('unmatched input', () => {
    it('should return handled false for unrecognized commands', () => {
      const session = createMockSession();
      const result = handleCommand('/unknown', session, renderer, inputRenderer);

      expect(result.handled).toBe(false);
    });

    it('should return handled false for regular text', () => {
      const session = createMockSession();
      const result = handleCommand('hello world', session, renderer, inputRenderer);

      expect(result.handled).toBe(false);
    });

    it('should return handled false for empty string', () => {
      const session = createMockSession();
      const result = handleCommand('', session, renderer, inputRenderer);

      expect(result.handled).toBe(false);
    });

    it('should have none action when not handled', () => {
      const session = createMockSession();
      const result = handleCommand('random text', session, renderer, inputRenderer);

      expect(result.action?.type).toBe('none');
      expect(result.output).toBeUndefined();
    });
  });
});
