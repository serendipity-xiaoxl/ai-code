// ============================================================
// MCP Code Review Tool - Logger Tests
// ============================================================

import { describe, it, expect } from 'bun:test';
import { Logger, getLogger, setLogger } from '../../src/utils/logger';

describe('MCP Logger', () => {
  it('should create logger with default level', () => {
    const logger = new Logger();
    expect(logger).toBeDefined();
  });

  it('should create logger with custom context', () => {
    const logger = new Logger('debug', 'test-context');
    expect(logger).toBeDefined();
  });

  it('should not throw on log calls at various levels', () => {
    const logger = new Logger('debug');
    expect(() => {
      logger.error('error msg');
      logger.warn('warn msg');
      logger.info('info msg');
      logger.debug('debug msg');
    }).not.toThrow();
  });

  it('should respect log level filtering', () => {
    const logger = new Logger('error');
    expect(() => {
      logger.debug('should not appear');
      logger.info('should not appear');
      logger.warn('should not appear');
      logger.error('should appear');
    }).not.toThrow();
  });

  it('should support setLevel', () => {
    const logger = new Logger('silent');
    expect(() => logger.error('silent')).not.toThrow();
    logger.setLevel('debug');
    expect(() => logger.debug('now visible')).not.toThrow();
  });

  it('should have global getLogger singleton', () => {
    const logger1 = getLogger();
    const logger2 = getLogger();
    expect(logger1).toBe(logger2);
  });

  it('should support setLogger', () => {
    const logger = new Logger('debug', 'test');
    setLogger(logger);
    expect(getLogger()).toBe(logger);
  });

  it('should accept args in log methods', () => {
    const logger = new Logger('debug');
    expect(() => {
      logger.error('error with', { extra: 'data' });
      logger.info('info with', 42, ['a', 'b']);
    }).not.toThrow();
  });
});
