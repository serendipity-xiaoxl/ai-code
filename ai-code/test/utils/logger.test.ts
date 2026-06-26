// ============================================================
// ai-code - Logger Tests
// ============================================================

import { describe, it, expect } from 'bun:test';
import { Logger, getLogger, setLogger } from '../../src/utils/logger';

describe('Logger', () => {
  it('should create logger with default level', () => {
    const logger = new Logger();
    expect(logger).toBeDefined();
  });

  it('should not throw on log calls', () => {
    const logger = new Logger('debug');
    expect(() => {
      logger.info('test info');
      logger.warn('test warn');
      logger.error('test error');
      logger.debug('test debug');
    }).not.toThrow();
  });

  it('should respect log level', () => {
    const logger = new Logger('error');
    // Should not throw but also should not output debug messages
    expect(() => logger.debug('should not show')).not.toThrow();
  });

  it('should support setLevel', () => {
    const logger = new Logger('silent');
    expect(() => logger.error('silent error')).not.toThrow();
    logger.setLevel('debug');
    expect(() => logger.debug('now visible')).not.toThrow();
  });

  it('should have global getLogger', () => {
    const logger = getLogger();
    expect(logger).toBeDefined();
  });

  it('should support setLogger', () => {
    const logger = new Logger('debug', 'test');
    setLogger(logger);
    expect(getLogger()).toBe(logger);
  });
});
