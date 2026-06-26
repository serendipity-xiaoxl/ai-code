// ============================================================
// ai-code - Agent Orchestration
//
// Manages tool-using AI agent via LangChain ChatOpenAI.
// Uses a simple invoke loop without depending on langchain/agents.
// Tools are converted to OpenAI-compatible format using
// Zod's public API only (no _def/isOptional internal access).
// ============================================================

import type { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, AIMessage, ToolMessage, SystemMessage } from '@langchain/core/messages';
import type { BaseMessage } from '@langchain/core/messages';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { ZodString, ZodNumber, ZodBoolean, ZodArray, ZodObject } from 'zod';
import type { Message } from '../storage/session';
import { createChatModel } from '../llm/factory';
import { ToolRegistry } from '../tools/registry';
import { PermissionGuard } from '../tools/guard';
import { getLogger } from '../utils/logger';

const logger = getLogger();

/**
 * Configuration for building the agent.
 */
export interface AgentConfig {
  apiKey: string;
  apiBaseUrl?: string;
  model: string;
  temperature: number;
  maxTokens: number;
  maxIterations: number;
  verbose: boolean;
}

/**
 * Map a Zod type to a JSON Schema type string using public API only.
 * Uses instanceof checks and the public isOptional() method.
 */
function zodTypeToJsonSchema(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  zodValue: any,
): { jsonType: string; description: string; required: boolean } {
  let jsonType = 'string';

  if (zodValue instanceof ZodString) {
    jsonType = 'string';
  } else if (zodValue instanceof ZodNumber) {
    jsonType = 'number';
  } else if (zodValue instanceof ZodBoolean) {
    jsonType = 'boolean';
  } else if (zodValue instanceof ZodArray) {
    jsonType = 'array';
  } else if (zodValue instanceof ZodObject) {
    jsonType = 'object';
  }

  // Use .description property (set via .describe() on ZodType)
  // In Zod v3, this is a public readonly property
  const description = typeof zodValue.description === 'string'
    ? zodValue.description
    : '';

  // Use the public isOptional() method from ZodType
  const isOptional = typeof zodValue.isOptional === 'function'
    ? zodValue.isOptional()
    : false;

  return { jsonType, description, required: !isOptional };
}

/**
 * Convert a DynamicStructuredTool to OpenAI tool format.
 * Uses only Zod's public API to extract schema metadata.
 */
function toolToOpenAIFormat(tool: DynamicStructuredTool): Record<string, unknown> {
  const schema = tool.schema;
  const properties: Record<string, unknown> = {};
  const required: string[] = [];

  // schema.shape is a public property on ZodObject
  if (schema && typeof schema === 'object' && 'shape' in schema) {
    const shape = schema.shape as Record<string, unknown>;

    for (const [key, value] of Object.entries(shape)) {
      const { jsonType, description, required: isRequired } = zodTypeToJsonSchema(value);

      properties[key] = {
        type: jsonType,
        description,
      };

      if (isRequired) {
        required.push(key);
      }
    }
  }

  return {
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: {
        type: 'object',
        properties,
        required,
      },
    },
  };
}

/**
 * The AI Coding Agent.
 * Uses createChatModel (LLM Factory) for model creation,
 * ToolRegistry for tool management, and PermissionGuard for safety.
 * Agent is reusable across multiple invoke() calls.
 */
export class CodingAgent {
  private model: ReturnType<ChatOpenAI['bindTools']>;
  private registry: ToolRegistry;
  private guard: PermissionGuard;
  private config: AgentConfig;
  private systemPrompt: string;

  constructor(
    config: AgentConfig,
    registry: ToolRegistry,
    guard: PermissionGuard,
    systemPrompt?: string,
  ) {
    this.config = config;
    this.registry = registry;
    this.guard = guard;
    this.systemPrompt = systemPrompt ?? '';

    // Use LLM Factory instead of direct ChatOpenAI instantiation
    const llm = createChatModel({
      apiKey: config.apiKey,
      apiBaseUrl: config.apiBaseUrl,
      model: config.model,
      temperature: config.temperature,
      maxTokens: config.maxTokens,
    });

    // Convert tools to OpenAI format and bind them once in constructor
    const openaiTools = registry.getAllTools().map((t) => toolToOpenAIFormat(t));
    this.model = (llm as ChatOpenAI).bindTools(openaiTools);
  }

  /**
   * Invoke the agent with a list of messages.
   * Handles tool-calling loop internally.
   * This agent instance is reusable across multiple invocations.
   */
  async invoke(
    messages: Message[],
  ): Promise<{ output: string; [key: string]: unknown }> {
    logger.debug('Agent invoke:', messages.length, 'messages');

    // Build LangChain messages - start with system prompt
    const lcMessages: BaseMessage[] = [];
    if (this.systemPrompt) {
      lcMessages.push(new SystemMessage(this.systemPrompt));
    }
    for (const msg of messages) {
      switch (msg.role) {
        case 'user':
          lcMessages.push(new HumanMessage(msg.content));
          break;
        case 'assistant':
          lcMessages.push(new AIMessage(msg.content));
          break;
        case 'system':
          lcMessages.push(new SystemMessage(msg.content));
          break;
        default:
          lcMessages.push(new HumanMessage(msg.content));
      }
    }

    // Tool-calling loop
    for (let iteration = 0; iteration < this.config.maxIterations; iteration++) {
      logger.debug('Agent iteration:', iteration + 1);

      const response = await this.model.invoke(lcMessages);
      lcMessages.push(response);

      const responseContent = response.content;
      const toolCalls = response.tool_calls;

      if (!toolCalls || toolCalls.length === 0) {
        const output = typeof responseContent === 'string'
          ? responseContent
          : JSON.stringify(responseContent);
        return { output };
      }

      // Execute tool calls with permission gating
      for (const toolCall of toolCalls) {
        const toolName = toolCall.name;
        const args = toolCall.args as Record<string, unknown>;

        // Permission check: use ToolRegistry's requiresApproval metadata
        if (this.registry.requiresApproval(toolName)) {
          const permission = await this.guard.requestPermission(toolName, args);
          if (!permission.approved) {
            const reason = permission.reason ?? 'User denied permission';
            logger.info('Tool call denied:', toolName, '-', reason);
            lcMessages.push(new ToolMessage({
              content: 'Permission denied: ' + reason,
              tool_call_id: toolCall.id ?? '',
            }));
            continue;
          }
        }

        // Look up tool from registry
        const tool = this.registry.get(toolName);
        if (!tool) {
          logger.warn('Unknown tool called:', toolName);
          lcMessages.push(new ToolMessage({
            content: 'Error: Unknown tool: ' + toolName,
            tool_call_id: toolCall.id ?? '',
          }));
          continue;
        }

        try {
          const result = await tool.invoke(args);
          lcMessages.push(new ToolMessage({
            content: typeof result === 'string' ? result : JSON.stringify(result),
            tool_call_id: toolCall.id ?? '',
          }));
        } catch (error) {
          const errMsg = error instanceof Error ? error.message : String(error);
          lcMessages.push(new ToolMessage({
            content: 'Error: ' + errMsg,
            tool_call_id: toolCall.id ?? '',
          }));
        }
      }
    }

    // Max iterations reached
    const lastMsg = lcMessages[lcMessages.length - 1];
    if (lastMsg && lastMsg._getType() === 'ai') {
      const content = lastMsg.content;
      return { output: typeof content === 'string' ? content : JSON.stringify(content) };
    }

    return { output: 'Max iterations reached. Please try a simpler request.' };
  }
}

/**
 * Build a new CodingAgent instance.
 *
 * Uses ToolRegistry internally (via createDefaultRegistry) for tool
 * lifecycle management. The PermissionGuard is configured based on
 * whether the `--yes` flag or config skips approval prompts.
 */
export async function buildAgent(
  config: AgentConfig,
  systemPrompt: string,
  options?: {
    /** Skip approval prompts (auto-yes mode). */
    autoYes?: boolean;
    /** External ToolRegistry instance to use instead of default. */
    registry?: ToolRegistry;
  },
): Promise<CodingAgent> {
  logger.info('Building agent with model:', config.model);

  const requireApproval = !(options?.autoYes ?? false);

  // Use the provided registry or create a default one
  const registry = options?.registry ?? await (async () => {
    const { createDefaultRegistry } = await import('../tools/registry');
    return createDefaultRegistry({ requireApproval });
  })();

  // PermissionGuard: sensitive tools require approval unless auto-yes
  const guard = new PermissionGuard({
    requireApproval,
    autoYes: options?.autoYes ?? false,
  });

  logger.info('Agent initialized with', registry.count, 'tools');
  return new CodingAgent(config, registry, guard, systemPrompt);
}
