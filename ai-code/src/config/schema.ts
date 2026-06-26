// ============================================================
// ai-code - Configuration Schema & Types
//
// Uses Zod for validation.
// Supports user-level, project-level, and CLI-level config.
// ============================================================

import { z } from "zod";

/**
 * Configuration schema for ai-code.
 * All fields are validated with Zod.
 */
export const AicConfigSchema = z.object({
  /** LLM provider configuration */
  llm: z
    .object({
      /** OpenAI-compatible API base URL */
      apiBaseUrl: z.string().default("https://api.deepseek.com"),
      /** API key (can also be set via env var) */
      apiKey: z.string().min(1).optional(),
      /** Model name */
      model: z.string().min(1).default("deepseek-v4-flash"),
      /** Temperature (0-2) */
      temperature: z.number().min(0).max(2).default(0),
      /** Max tokens for response */
      maxTokens: z.number().positive().default(4096),
      /** Max tokens for context window */
      contextWindow: z.number().positive().default(128000),
    })
    .default({}),

  /** Agent behavior configuration */
  agent: z
    .object({
      /** Max iterations per task */
      maxIterations: z.number().positive().default(20),
      /** Whether to show intermediate steps/tool calls */
      verbose: z.boolean().default(true),
      /** Whether to ask before executing sensitive commands */
      requireApproval: z.boolean().default(true),
    })
    .default({}),

  /** Behavior configuration */
  behavior: z
    .object({
      /** Default yes to all prompts (non-interactive mode) */
      yes: z.boolean().default(false),
      /** Disable confirmation for file writes */
      skipConfirmation: z.boolean().default(false),
    })
    .default({}),

  /** Display configuration */
  display: z
    .object({
      /** Whether to use ANSI colors */
      color: z.boolean().default(true),
      /** Terminal output width */
      width: z.number().positive().default(80),
      /** Show token usage */
      showTokens: z.boolean().default(false),
    })
    .default({}),

  /** Storage paths */
  storage: z
    .object({
      /** Directory for session data */
      dataDir: z.string().min(1).default(".ai-code"),
      /** Directory for conversation history */
      historyDir: z.string().min(1).default(".ai-code/history"),
    })
    .default({}),
});

/** Inferred config type from the schema. */
export type AicConfig = z.infer<typeof AicConfigSchema>;

/**
 * Default configuration values.
 */
export const DEFAULT_CONFIG: AicConfig = {
  llm: {
    apiBaseUrl: "https://api.deepseek.com/",
    model: "deepseek-v4-flash",
    temperature: 0,
    maxTokens: 4096,
    contextWindow: 128000,
  },
  agent: {
    maxIterations: 20,
    verbose: true,
    requireApproval: true,
  },
  behavior: {
    yes: false,
    skipConfirmation: false,
  },
  display: {
    color: true,
    width: 80,
    showTokens: false,
  },
  storage: {
    dataDir: ".ai-code",
    historyDir: ".ai-code/history",
  },
};

/**
 * Runtime flags that override config but are not persisted.
 */
export interface RuntimeFlags {
  /** Skip approval prompts */
  yes: boolean;
  /** Verbose output */
  verbose: boolean;
  /** Show help */
  help: boolean;
  /** Show version */
  version: boolean;
}

export const DEFAULT_FLAGS: RuntimeFlags = {
  yes: false,
  verbose: false,
  help: false,
  version: false,
};
