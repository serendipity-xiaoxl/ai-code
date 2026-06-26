// ============================================================
// ai-code - Spinner Tests
//
// Tests spinner API without relying on timing or stdout.
// ============================================================

import { describe, it, expect } from 'bun:test';
import { createSpinner } from '../../src/renderer/spinner';

describe('Spinner', () => {
  it('should create spinner with all methods', () => {
    const spinner = createSpinner();
    expect(spinner.start).toBeFunction();
    expect(spinner.stop).toBeFunction();
    expect(spinner.setMessage).toBeFunction();
    expect(spinner.succeed).toBeFunction();
    expect(spinner.fail).toBeFunction();
  });

  it('should not throw when starting and stopping', () => {
    const spinner = createSpinner();
    expect(() => {
      spinner.start('Testing...');
      spinner.setMessage('Still testing...');
      spinner.stop();
    }).not.toThrow();
  });

  it('should not throw when succeeding', () => {
    const spinner = createSpinner();
    expect(() => {
      spinner.start('Processing...');
      spinner.succeed('All done.');
    }).not.toThrow();
  });

  it('should not throw when failing', () => {
    const spinner = createSpinner();
    expect(() => {
      spinner.start('Processing...');
      spinner.fail('Something broke.');
    }).not.toThrow();
  });

  it('should use default message when none provided', () => {
    const spinner = createSpinner();
    expect(() => {
      spinner.start();
      spinner.stop();
    }).not.toThrow();
  });

  it('should use default success message when none provided', () => {
    const spinner = createSpinner();
    expect(() => {
      spinner.start();
      spinner.succeed();
    }).not.toThrow();
  });

  it('should use default failure message when none provided', () => {
    const spinner = createSpinner();
    expect(() => {
      spinner.start();
      spinner.fail();
    }).not.toThrow();
  });

  it('should handle multiple start/stop cycles', () => {
    const spinner = createSpinner();
    expect(() => {
      for (let i = 0; i < 3; i++) {
        spinner.start('Cycle ' + (i + 1));
        spinner.stop();
      }
    }).not.toThrow();
  });
});
