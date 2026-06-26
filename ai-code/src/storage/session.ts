// ============================================================
// ai-code - Session / Conversation Storage
//
// Persists conversation history to JSON files.
// Provides load/save operations for multi-turn conversations.
// For MVP, uses JSON file storage. SQLite is planned for Phase 2.
// ============================================================

import { join } from 'node:path';
import { readTextFile, writeTextFile, ensureDir, pathExists } from '../utils/os-compat';
import { getLogger } from '../utils/logger';

const logger = getLogger();

/**
 * A single message in the conversation.
 */
export interface Message {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  name?: string;
  timestamp?: string;
}

/**
 * A conversation session.
 */
export interface Session {
  id: string;
  projectDir: string;
  messages: Message[];
  createdAt: string;
  updatedAt: string;
  metadata: Record<string, unknown>;
}

/**
 * Create a new session.
 */
export function createSession(
  projectDir: string,
  id?: string,
): Session {
  const now = new Date().toISOString();
  return {
    id: id ?? 'session-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6),
    projectDir,
    messages: [],
    createdAt: now,
    updatedAt: now,
    metadata: {},
  };
}

/**
 * Session store for saving/loading conversations.
 */
export function createSessionStore(projectDir: string) {
  const sessionDir = join(projectDir, '.ai-code', 'sessions');
  const activeSessionFile = join(sessionDir, 'active.json');
  const historyDir = join(projectDir, '.ai-code', 'history');

  /**
   * Ensure storage directories exist.
   */
  async function ensureStorage(): Promise<void> {
    await ensureDir(sessionDir);
    await ensureDir(historyDir);
  }

  /**
   * Save the current session.
   * Returns a promise that resolves when the save is complete.
   */
  async function save(session: Session): Promise<void> {
    session.updatedAt = new Date().toISOString();
    try {
      await ensureStorage();
      await writeTextFile(activeSessionFile, JSON.stringify(session, null, 2));
      logger.debug('Session saved:', session.id);
    } catch (error) {
      logger.warn('Failed to save session', error);
    }
  }

  /**
   * Load the active session, or create a new one.
   */
  async function load(): Promise<Session> {
    try {
      if (pathExists(activeSessionFile)) {
        const content = await readTextFile(activeSessionFile);
        const parsed = JSON.parse(content) as Session;
        if (parsed && parsed.messages) {
          logger.debug('Session loaded:', parsed.id, parsed.messages.length, 'messages');
          return parsed;
        }
      }
    } catch (error) {
      logger.debug('No existing session found, creating new one');
    }

    return createSession(projectDir);
  }

  /**
   * Archive the current session to history.
   */
  async function archive(): Promise<void> {
    try {
      const content = await readTextFile(activeSessionFile);
      const session = JSON.parse(content) as Session;
      const historyFile = join(historyDir, session.id + '.json');
      await writeTextFile(historyFile, content);
      logger.debug('Session archived:', historyFile);
    } catch {
      logger.debug('No active session to archive');
    }
  }

  /**
   * List all archived sessions.
   */
  async function listSessions(): Promise<Array<{ id: string; date: string; count: number }>> {
    await ensureStorage();

    const { readdir } = await import('node:fs/promises');

    try {
      const files = await readdir(historyDir);
      const sessions: Array<{ id: string; date: string; count: number }> = [];

      for (const file of files) {
        if (!file.endsWith('.json')) continue;
        try {
          const content = await readTextFile(join(historyDir, file));
          const session = JSON.parse(content) as Session;
          sessions.push({
            id: session.id,
            date: session.createdAt,
            count: session.messages.length,
          });
        } catch {
          // Skip corrupted files
        }
      }

      return sessions.sort((a, b) => b.date.localeCompare(a.date));
    } catch {
      return [];
    }
  }

  return { save, load, archive, listSessions, createSession };
}

export type SessionStore = ReturnType<typeof createSessionStore>;
