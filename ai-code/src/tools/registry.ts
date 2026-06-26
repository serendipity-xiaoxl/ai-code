// ============================================================
// ai-code - Tool Registry
//
// Central registry for all available tools.
// Tools follow LangChain DynamicStructuredTool spec.
// ============================================================

import type { DynamicStructuredTool } from '@langchain/core/tools';
import { getLogger } from '../utils/logger';

const logger = getLogger();

/**
 * A registered tool with metadata.
 */
export interface RegisteredTool {
  /** The LangChain tool instance */
  tool: DynamicStructuredTool;
  /** Whether this tool requires user approval before execution */
  requiresApproval: boolean;
}

/**
 * Tool registry - manages the lifecycle and retrieval of tools.
 */
export class ToolRegistry {
  private tools: Map<string, RegisteredTool> = new Map();

  /**
   * Register a tool.
   */
  register(
    tool: DynamicStructuredTool,
    options?: { requiresApproval?: boolean },
  ): void {
    this.tools.set(tool.name, {
      tool,
      requiresApproval: options?.requiresApproval ?? false,
    });
    logger.debug('Tool registered:', tool.name);
  }

  /**
   * Get a registered tool by name.
   */
  get(name: string): DynamicStructuredTool | undefined {
    return this.tools.get(name)?.tool;
  }

  /**
   * Get all registered tools as LangChain tool array.
   */
  getAllTools(): DynamicStructuredTool[] {
    const result: DynamicStructuredTool[] = [];
    for (const [, registered] of this.tools) {
      result.push(registered.tool);
    }
    return result;
  }

  /**
   * Get all registered tools with their metadata.
   */
  getAllRegistered(): RegisteredTool[] {
    return Array.from(this.tools.values());
  }

  /**
   * Check if a tool requires approval.
   */
  requiresApproval(name: string): boolean {
    return this.tools.get(name)?.requiresApproval ?? false;
  }

  /**
   * Remove a tool.
   */
  unregister(name: string): void {
    this.tools.delete(name);
    logger.debug('Tool unregistered:', name);
  }

  /**
   * Get the count of registered tools.
   */
  get count(): number {
    return this.tools.size;
  }

  /**
   * Get all tool names.
   */
  get names(): string[] {
    return Array.from(this.tools.keys());
  }
}

/**
 * Create the default tool registry with all built-in tools.
 */
export async function createDefaultRegistry(
  config: { requireApproval: boolean },
): Promise<ToolRegistry> {
  const registry = new ToolRegistry();

  // File tools
  const { createReadTool, createWriteTool, createEditTool } = await import('./file/tools');
  registry.register(createReadTool());
  registry.register(createWriteTool(), { requiresApproval: config.requireApproval });
  registry.register(createEditTool(), { requiresApproval: config.requireApproval });

  // Shell tools
  const { createBashTool, createBashInteractiveTool } = await import('./shell/tools');
  registry.register(createBashTool(), { requiresApproval: config.requireApproval });
  registry.register(createBashInteractiveTool(), { requiresApproval: config.requireApproval });

  // Search tools
  const { createGrepTool, createGlobTool } = await import('./search/tools');
  registry.register(createGrepTool());
  registry.register(createGlobTool());

  // Diff tool
  const { createDiffTool } = await import('./file/diff');
  registry.register(createDiffTool(), { requiresApproval: true });

  // Git tools
  const {
    createGitDiffTool,
    createGitStatusTool,
    createGitLogTool,
    createGitCommitTool,
  } = await import('./git/tools');
  registry.register(createGitDiffTool(), { requiresApproval: false });
  registry.register(createGitStatusTool(), { requiresApproval: false });
  registry.register(createGitLogTool(), { requiresApproval: false });
  registry.register(createGitCommitTool(), { requiresApproval: true });

  // Batch edit tool
  const { createBatchEditTool } = await import('./file/batch-edit');
  registry.register(createBatchEditTool(), { requiresApproval: true });

  logger.info('Tool registry created with', registry.count, 'tools');

  return registry;
}
