// ============================================================
// ai-code - LLM Model Factory
//
// Creates LangChain chat model instances from configuration.
// Uses @langchain/openai (compatible with any OpenAI-format API).
// ============================================================

import { ChatOpenAI } from '@langchain/openai';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';

/**
 * Configuration for creating an LLM instance.
 */
export interface LlmConfig {
  /** API key */
  apiKey: string;
  /** OpenAI-compatible base URL */
  apiBaseUrl?: string;
  /** Model name */
  model: string;
  /** Temperature (0-2) */
  temperature?: number;
  /** Max tokens for response */
  maxTokens?: number;
}

/**
 * Create a LangChain ChatOpenAI instance.
 * Works with any OpenAI-compatible API provider.
 *
 * Note: @langchain/openai uses `configuration.baseURL` for custom endpoints.
 * In Bun, this works natively. In Node.js, it works via the same SDK.
 */
export function createChatModel(config: LlmConfig): BaseChatModel {
  const params: Record<string, unknown> = {
    model: config.model,
    temperature: config.temperature ?? 0,
    maxTokens: config.maxTokens ?? 4096,
    apiKey: config.apiKey,
  };

  if (config.apiBaseUrl) {
    // Support custom base URLs (OpenAI-compatible APIs)
    params['configuration'] = {
      baseURL: config.apiBaseUrl,
    };
  }

  return new ChatOpenAI(params);
}

/**
 * Create a streaming-capable chat model.
 */
export function createStreamingModel(config: LlmConfig): BaseChatModel {
  const params: Record<string, unknown> = {
    model: config.model,
    temperature: config.temperature ?? 0,
    maxTokens: config.maxTokens ?? 4096,
    apiKey: config.apiKey,
    streaming: true,
  };

  if (config.apiBaseUrl) {
    params['configuration'] = {
      baseURL: config.apiBaseUrl,
    };
  }

  return new ChatOpenAI(params);
}

/**
 * Get model info from the model name.
 */
export function getModelInfo(model: string): {
  provider: string;
  contextWindow: number;
  family: string;
} {
  const lower = model.toLowerCase();

  if (lower.includes('gpt-4') || lower.includes('gpt-3.5') || lower.includes('o1') || lower.includes('o3')) {
    return {
      provider: 'openai',
      contextWindow: lower.includes('128k') ? 128000 : 8192,
      family: lower.includes('gpt-4') ? 'gpt-4' : 'gpt-3.5',
    };
  }

  if (lower.includes('claude')) {
    return {
      provider: 'anthropic',
      contextWindow: 200000,
      family: 'claude',
    };
  }

  if (lower.includes('gemini')) {
    return {
      provider: 'google',
      contextWindow: 1000000,
      family: 'gemini',
    };
  }

  return {
    provider: 'unknown',
    contextWindow: 128000,
    family: 'other',
  };
}
