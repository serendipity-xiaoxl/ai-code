// ============================================================
// MCP Code Review Tool - MCP Tool Definitions
//
// Defines the tools exposed by the MCP server:
// - review_code: Review a file or directory
// - review_git_diff: Review git changes
// - get_fix_suggestion: Get fix for a specific issue
// - list_rules: List available analysis rules
// ============================================================

import type { ReviewConfig } from '../types';
import { getLogger } from '../utils/logger';

/**
 * Schema definition for an MCP tool parameter.
 */
export interface ToolParameter {
  name: string;
  type: 'string' | 'number' | 'boolean';
  description: string;
  required: boolean;
  default?: string | number | boolean;
}

/**
 * Schema definition for an MCP tool.
 */
export interface ToolDefinition {
  name: string;
  description: string;
  parameters: ToolParameter[];
}

/**
 * Parse tool arguments from raw input into typed values.
 */
export function parseToolArgs(
  params: ToolParameter[],
  args: Record<string, unknown>,
): Record<string, unknown> {
  const parsed: Record<string, unknown> = {};
  const logger = getLogger();

  for (const param of params) {
    const value = args[param.name];

    if (value === undefined || value === null) {
      if (param.required) {
        throw new Error('Missing required parameter: ' + param.name);
      }
      if (param.default !== undefined) {
        parsed[param.name] = param.default;
      }
      continue;
    }

    // Type coercion
    switch (param.type) {
      case 'string':
        parsed[param.name] = String(value);
        break;
      case 'number': {
        const num = Number(value);
        if (isNaN(num)) {
          throw new Error(
            'Parameter ' + param.name + ' must be a number, got: ' + String(value),
          );
        }
        parsed[param.name] = num;
        break;
      }
      case 'boolean':
        if (typeof value === 'string') {
          parsed[param.name] = value === 'true' || value === '1' || value.toLowerCase() === 'yes';
        } else {
          parsed[param.name] = Boolean(value);
        }
        break;
      default:
        parsed[param.name] = value;
    }
  }

  return parsed;
}

/**
 * Get the review config from environment variables.
 * This is the fallback when no config is provided via tool args.
 */
export function getConfigFromEnv(): ReviewConfig | null {
  const provider = process.env['MCP_REVIEW_PROVIDER']?.toLowerCase() ?? '';

  if (provider === 'anthropic' && process.env['ANTHROPIC_API_KEY']) {
    return {
      modelProvider: 'anthropic',
      modelName: process.env['MCP_REVIEW_MODEL'] ?? 'claude-sonnet-4-20250514',
      apiKey: process.env['ANTHROPIC_API_KEY'],
      apiBaseUrl: process.env['MCP_REVIEW_API_BASE'],
      temperature: process.env['MCP_REVIEW_TEMPERATURE']
        ? Number(process.env['MCP_REVIEW_TEMPERATURE'])
        : undefined,
      maxTokens: process.env['MCP_REVIEW_MAX_TOKENS']
        ? Number(process.env['MCP_REVIEW_MAX_TOKENS'])
        : undefined,
      customInstructions: process.env['MCP_REVIEW_INSTRUCTIONS'],
    };
  }

  if (
    (provider === 'openai' || provider === 'custom' || !provider) &&
    (process.env['OPENAI_API_KEY'] || process.env['MCP_REVIEW_API_KEY'])
  ) {
    return {
      modelProvider: process.env['MCP_REVIEW_PROVIDER'] as ReviewConfig['modelProvider'] ?? 'openai',
      modelName: process.env['MCP_REVIEW_MODEL'] ?? 'gpt-4o',
      apiKey: process.env['MCP_REVIEW_API_KEY'] ?? process.env['OPENAI_API_KEY'] ?? '',
      apiBaseUrl: process.env['MCP_REVIEW_API_BASE'],
      temperature: process.env['MCP_REVIEW_TEMPERATURE']
        ? Number(process.env['MCP_REVIEW_TEMPERATURE'])
        : undefined,
      maxTokens: process.env['MCP_REVIEW_MAX_TOKENS']
        ? Number(process.env['MCP_REVIEW_MAX_TOKENS'])
        : undefined,
      customInstructions: process.env['MCP_REVIEW_INSTRUCTIONS'],
    };
  }

  return null;
}

// ============================================================
// Tool Definitions
// ============================================================

/**
 * Tool to review a file or directory.
 */
export const REVIEW_CODE_TOOL: ToolDefinition = {
  name: 'review_code',
  description: 'Review a file or directory for code quality issues, bugs, and security vulnerabilities',
  parameters: [
    {
      name: 'targetPath',
      type: 'string',
      description: 'Path to the file or directory to review',
      required: true,
    },
    {
      name: 'instructions',
      type: 'string',
      description: 'Additional instructions for the review',
      required: false,
    },
    {
      name: 'format',
      type: 'string',
      description: 'Output format: markdown, terminal, json, or html',
      required: false,
      default: 'terminal',
    },
  ],
};

/**
 * Tool to review a git diff.
 */
export const REVIEW_GIT_DIFF_TOOL: ToolDefinition = {
  name: 'review_git_diff',
  description: 'Review changes in the working tree or between git references',
  parameters: [
    {
      name: 'target',
      type: 'string',
      description: 'Target git reference (commit, branch, or HEAD) to diff against',
      required: false,
    },
    {
      name: 'base',
      type: 'string',
      description: 'Base git reference (defaults to HEAD)',
      required: false,
    },
    {
      name: 'instructions',
      type: 'string',
      description: 'Additional instructions for the review',
      required: false,
    },
    {
      name: 'format',
      type: 'string',
      description: 'Output format: markdown, terminal, json, or html',
      required: false,
      default: 'terminal',
    },
  ],
};

/**
 * Tool to get a fix suggestion for a specific issue.
 */
export const GET_FIX_TOOL: ToolDefinition = {
  name: 'get_fix_suggestion',
  description: 'Get a specific fix suggestion for a review issue',
  parameters: [
    {
      name: 'reviewId',
      type: 'string',
      description: 'Review ID to get fixes for',
      required: true,
    },
    {
      name: 'filePath',
      type: 'string',
      description: 'Optional file path to scope the fix to',
      required: false,
    },
    {
      name: 'issueIndex',
      type: 'number',
      description: 'Optional issue index (0-based) to get a specific fix',
      required: false,
    },
  ],
};

/**
 * Tool to list available static analysis rules.
 */
export const LIST_RULES_TOOL: ToolDefinition = {
  name: 'list_rules',
  description: 'List all available static analysis rules used in code review',
  parameters: [],
};

/**
 * All available tools.
 */
export const ALL_TOOLS: ToolDefinition[] = [
  REVIEW_CODE_TOOL,
  REVIEW_GIT_DIFF_TOOL,
  GET_FIX_TOOL,
  LIST_RULES_TOOL,
];
