// ============================================================
// ai-code - Tool Registry Tests
// ============================================================

import { describe, it, expect } from 'bun:test';
import { ToolRegistry } from '../../src/tools/registry';
import { createReadTool } from '../../src/tools/file/tools';

describe('ToolRegistry', () => {
  it('should register and retrieve tools', () => {
    const registry = new ToolRegistry();
    const tool = createReadTool();

    registry.register(tool);

    expect(registry.get('read')).toBeDefined();
    expect(registry.count).toBe(1);
    expect(registry.names).toContain('read');
  });

  it('should return undefined for unregistered tools', () => {
    const registry = new ToolRegistry();
    expect(registry.get('nonexistent')).toBeUndefined();
  });

  it('should track requiresApproval flag', () => {
    const registry = new ToolRegistry();
    const tool = createReadTool();

    registry.register(tool, { requiresApproval: true });
    expect(registry.requiresApproval('read')).toBe(true);
  });

  it('should unregister tools', () => {
    const registry = new ToolRegistry();
    registry.register(createReadTool());

    expect(registry.count).toBe(1);
    registry.unregister('read');
    expect(registry.count).toBe(0);
  });

  it('should return all tools as array', () => {
    const registry = new ToolRegistry();
    registry.register(createReadTool());

    const all = registry.getAllTools();
    expect(all.length).toBe(1);
  });

  it('should return all registered tools with metadata', () => {
    const registry = new ToolRegistry();
    registry.register(createReadTool(), { requiresApproval: true });

    const all = registry.getAllRegistered();
    expect(all.length).toBe(1);
    expect(all[0]?.requiresApproval).toBe(true);
  });
});
