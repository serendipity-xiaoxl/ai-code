// ============================================================
// ai-code - Config Schema Tests
// ============================================================

import { describe, it, expect } from 'bun:test';
import { AicConfigSchema, DEFAULT_CONFIG } from '../../src/config/schema';

describe('Config Schema', () => {
  it('should validate default config', () => {
    const result = AicConfigSchema.safeParse(DEFAULT_CONFIG);
    expect(result.success).toBe(true);
  });

  it('should accept valid config overrides', () => {
    const result = AicConfigSchema.safeParse({
      llm: {
        model: 'gpt-4o-mini',
        temperature: 0.5,
      },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.llm.model).toBe('gpt-4o-mini');
      expect(result.data.llm.temperature).toBe(0.5);
    }
  });

  it('should fill defaults for partial config', () => {
    const result = AicConfigSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.llm.model).toBe('gpt-4o');
      expect(result.data.llm.temperature).toBe(0);
      expect(result.data.display.width).toBe(80);
    }
  });

  it('should reject invalid temperature', () => {
    const result = AicConfigSchema.safeParse({
      llm: { temperature: 5 },
    });
    expect(result.success).toBe(false);
  });

  it('should reject invalid model name', () => {
    const result = AicConfigSchema.safeParse({
      llm: { model: '' },
    });
    expect(result.success).toBe(false);
  });
});
