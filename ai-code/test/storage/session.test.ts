// ============================================================
// ai-code - Session Store Tests
// ============================================================

import { describe, it, expect } from 'bun:test';
import { createSession, createSessionStore } from '../../src/storage/session';
import { join } from 'node:path';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';

describe('Session', () => {
  describe('createSession', () => {
    it('should create a new session with defaults', () => {
      const session = createSession('/test/project');
      expect(session.projectDir).toBe('/test/project');
      expect(session.messages).toBeArray();
      expect(session.messages.length).toBe(0);
      expect(session.id).toMatch(/^session-/);
      expect(session.createdAt).toBeTruthy();
    });

    it('should accept custom session ID', () => {
      const session = createSession('/test', 'custom-id');
      expect(session.id).toBe('custom-id');
    });

    it('should have valid timestamps', () => {
      const session = createSession('/test');
      const created = new Date(session.createdAt).getTime();
      expect(created).not.toBeNaN();
      const updated = new Date(session.updatedAt).getTime();
      expect(updated).not.toBeNaN();
    });
  });

  describe('createSessionStore', () => {
    it('should create store with session methods', () => {
      const dir = mkdtempSync(join(tmpdir(), 'aic-test-'));
      const store = createSessionStore(dir);

      expect(store.save).toBeFunction();
      expect(store.load).toBeFunction();
      expect(store.archive).toBeFunction();
      expect(store.listSessions).toBeFunction();
      expect(store.createSession).toBeFunction();
    });

    it('should save and load a session', async () => {
      const dir = mkdtempSync(join(tmpdir(), 'aic-test-'));
      const store = createSessionStore(dir);

      const session = store.createSession(dir);
      session.messages.push({ role: 'user', content: 'hello' });
      session.messages.push({ role: 'assistant', content: 'hi' });

      await store.save(session);

      const loaded = await store.load();
      expect(loaded.messages.length).toBe(2);
      expect(loaded.messages[0]?.content).toBe('hello');
      expect(loaded.messages[1]?.content).toBe('hi');
    });

    it('should load a new session when no saved session exists', async () => {
      const dir = mkdtempSync(join(tmpdir(), 'aic-test-'));
      const store = createSessionStore(dir);

      const session = await store.load();
      expect(session.messages).toBeArray();
      expect(session.messages.length).toBe(0);
    });
  });
});
