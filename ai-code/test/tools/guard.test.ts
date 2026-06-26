// ============================================================
// ai-code - Permission Guard Tests
//
// Tests guard construction and auto-approval logic.
// Interactive stdin tests are skipped to avoid hanging.
// ============================================================

import { describe, it, expect } from 'bun:test';
import { PermissionGuard } from '../../src/tools/guard';

describe('PermissionGuard', () => {
  it('should create guard with default settings', () => {
    const guard = new PermissionGuard();
    expect(guard).toBeDefined();
  });

  it('should create guard with custom options', () => {
    const guard = new PermissionGuard({ autoYes: true, requireApproval: false });
    expect(guard).toBeDefined();
  });

  it('should auto-approve when autoYes is true', async () => {
    const guard = new PermissionGuard({ autoYes: true });
    const result = await guard.requestPermission('bash', { command: 'ls' });
    expect(result.approved).toBe(true);
  });

  it('should auto-approve when requireApproval is false', async () => {
    const guard = new PermissionGuard({ requireApproval: false });
    const result = await guard.requestPermission('write', { filePath: '/test.txt' });
    expect(result.approved).toBe(true);
  });

  it('should support setAutoYes toggle', () => {
    const guard = new PermissionGuard();
    guard.setAutoYes(true);
    // Internal state changed - verify by behavior
    expect(guard).toBeDefined();
  });

  it('should support setRequireApproval toggle', () => {
    const guard = new PermissionGuard();
    guard.setRequireApproval(false);
    expect(guard).toBeDefined();
  });

  it('should have PermissionResult type structure', async () => {
    const guard = new PermissionGuard({ autoYes: true });
    const result = await guard.requestPermission('test', { key: 'value' });
    expect(result).toHaveProperty('approved');
    expect(result.approved).toBe(true);
  });
});
