// ============================================================
// ai-code - LLM Factory Tests
// ============================================================

import { describe, it, expect } from 'bun:test';
import { getModelInfo, createChatModel, createStreamingModel } from '../../src/llm/factory';

describe('LLM Factory', () => {
  describe('getModelInfo', () => {
    it('should detect OpenAI GPT-4 models', () => {
      const info = getModelInfo('gpt-4o');
      expect(info.provider).toBe('openai');
      expect(info.family).toBe('gpt-4');
      expect(info.contextWindow).toBe(8192);
    });

    it('should detect OpenAI GPT-3.5 models', () => {
      const info = getModelInfo('gpt-3.5-turbo');
      expect(info.provider).toBe('openai');
      expect(info.family).toBe('gpt-3.5');
    });

    it('should detect 128k context models', () => {
      const info = getModelInfo('gpt-4-128k');
      expect(info.contextWindow).toBe(128000);
    });

    it('should detect O1 models', () => {
      const info = getModelInfo('o1-mini');
      expect(info.provider).toBe('openai');
    });

    it('should detect O3 models', () => {
      const info = getModelInfo('o3-mini');
      expect(info.provider).toBe('openai');
    });

    it('should detect Anthropic Claude models', () => {
      const info = getModelInfo('claude-sonnet-4-20250514');
      expect(info.provider).toBe('anthropic');
      expect(info.family).toBe('claude');
      expect(info.contextWindow).toBe(200000);
    });

    it('should detect Google Gemini models', () => {
      const info = getModelInfo('gemini-2.0-flash');
      expect(info.provider).toBe('google');
      expect(info.family).toBe('gemini');
      expect(info.contextWindow).toBe(1000000);
    });

    it('should return unknown for unrecognized models', () => {
      const info = getModelInfo('custom-model-v1');
      expect(info.provider).toBe('unknown');
      expect(info.family).toBe('other');
      expect(info.contextWindow).toBe(128000);
    });

    it('should be case-insensitive', () => {
      const info = getModelInfo('GPT-4O-MINI');
      expect(info.provider).toBe('openai');
    });
  });

  describe('createChatModel', () => {
    it('should create a chat model with given config', () => {
      const model = createChatModel({
        apiKey: 'test-key',
        model: 'gpt-4o',
        temperature: 0.5,
        maxTokens: 2048,
      });
      expect(model).toBeDefined();
    });

    it('should use defaults for optional fields', () => {
      const model = createChatModel({
        apiKey: 'test-key',
        model: 'gpt-4o',
      });
      expect(model).toBeDefined();
    });

    it('should handle apiBaseUrl config', () => {
      const model = createChatModel({
        apiKey: 'test-key',
        model: 'gpt-4o',
        apiBaseUrl: 'https://custom-api.example.com',
      });
      expect(model).toBeDefined();
    });
  });

  describe('createStreamingModel', () => {
    it('should create a streaming chat model', () => {
      const model = createStreamingModel({
        apiKey: 'test-key',
        model: 'gpt-4o',
      });
      expect(model).toBeDefined();
    });
  });
});
