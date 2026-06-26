// ============================================================
// ai-code - Agent Orchestration
//
// Manages tool-using AI agent via LangChain ChatOpenAI.
// Uses a simple invoke loop without depending on langchain/agents.
// Tools are converted to OpenAI-compatible format using
// Zod's public API only (no _def/isOptional internal access).
// ============================================================

import { ChatOpenAI } from '@langchain/openai';
import {
  HumanMessage,
  AIMessage,
  ToolMessage,
  SystemMessage,
} from '@langchain/core/messages';
import type { BaseMessage } from '@langchain/core/messages';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { ZodString, ZodNumber, ZodBoolean, ZodArray, ZodObject } from 'zod';
import type { Message } from '../storage/session';
import { createReadTool, createWriteTool, createEditTool } from '../tools/file/tools';
import { createBashTool, createBashInteractiveTool } from '../tools/shell/tools';
import { createGrepTool, createGlobTool } from '../tools/search/tools';
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
 * Create the standard set of tools for the agent.
 */
function createDefaultTools(): DynamicStructuredTool[] {
  return [
    createReadTool(),
    createWriteTool(),
    createEditTool(),
    createBashTool(),
    createBashInteractiveTool(),
    createGrepTool(),
    createGlobTool(),
  ];
}

/**
 * The AI Coding Agent.
 * Uses ChatOpenAI with OpenAI-compatible tool definitions.
 * Agent is reusable across multiple invoke() calls.
 */
export class CodingAgent {
  private model: ReturnType<ChatOpenAI['bindTools']>;
  private tools: DynamicStructuredTool[];
  private config: AgentConfig;
  private systemPrompt: string;

  constructor(config: AgentConfig, tools: DynamicStructuredTool[], systemPrompt?: string) {
    this.config = config;
    this.tools = tools;
    this.systemPrompt = systemPrompt ?? '';

    const llmParams: Record<string, unknown> = {
      model: config.model,
      temperature: config.temperature,
      maxTokens: config.maxTokens,
      apiKey: config.apiKey,
    };

    if (config.apiBaseUrl) {
      llmParams['configuration'] = { baseURL: config.apiBaseUrl };
    }

    // Convert tools to OpenAI format and bind them once in constructor
    const openaiTools = tools.map((t) => toolToOpenAIFormat(t));
    this.model = new ChatOpenAI(llmParams).bindTools(openaiTools);
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

      // Execute tool calls
      for (const toolCall of toolCalls) {
        const tool = this.tools.find((t) => t.name === toolCall.name);
        if (!tool) {
          logger.warn('Unknown tool called:', toolCall.name);
          lcMessages.push(new ToolMessage({
            content: 'Error: Unknown tool: ' + toolCall.name,
            tool_call_id: toolCall.id ?? '',
          }));
          continue;
        }

        try {
          const result = await tool.invoke(toolCall.args as Record<string, unknown>);
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
 */
export function buildAgent(
  config: AgentConfig,
  systemPrompt: string,
): CodingAgent {
  logger.info('Building agent with model:', config.model);
  const tools = createDefaultTools();
  return new CodingAgent(config, tools, systemPrompt);
}
