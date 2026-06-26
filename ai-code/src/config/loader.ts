// ============================================================
// ai-code - Configuration Loader
//
// Loads config from multiple sources (lowest to highest priority):
// 1. Default config
// 2. User-level config (~/.ai-code/config.json)
// 3. Project-level config (.ai-code/config.json)
// 4. Environment variables
// 5. CLI flags
// ============================================================

import type { AicConfig } from './schema';
import { AicConfigSchema, DEFAULT_CONFIG } from './schema';
import { getHomeDir, readTextFile, pathExists } from '../utils/os-compat';
import { getLogger } from '../utils/logger';
import { join } from 'node:path';

const logger = getLogger();

/**
 * Merge two configs deeply, with source overriding defaults.
 */
function mergeConfig(base: AicConfig, override: Partial<AicConfig>): AicConfig {
  return {
    ...base,
    llm: { ...base.llm, ...(override.llm ?? {}) },
    agent: { ...base.agent, ...(override.agent ?? {}) },
    behavior: { ...base.behavior, ...(override.behavior ?? {}) },
    display: { ...base.display, ...(override.display ?? {}) },
    storage: { ...base.storage, ...(override.storage ?? {}) },
  };
}

/**
 * Load config from a JSON file.
 */
async function loadConfigFile(filePath: string): Promise<Partial<AicConfig> | null> {
  try {
    if (!pathExists(filePath)) return null;
    const content = await readTextFile(filePath);
    const parsed = JSON.parse(content) as Partial<AicConfig>;
    return parsed;
  } catch (error) {
    logger.debug('Failed to load config from', filePath, error);
    return null;
  }
}

/**
 * Load config from environment variables.
 */
function loadConfigFromEnv(): Partial<AicConfig> {
  const config: Partial<AicConfig> = {};
  const llm: Partial<AicConfig['llm']> = {};

  // LLM config from env
  const apiBaseUrl = process.env['AIC_API_BASE'] ?? process.env['OPENAI_BASE_URL'];
  if (apiBaseUrl) llm.apiBaseUrl = apiBaseUrl;

  const apiKey = process.env['AIC_API_KEY'] ?? process.env['OPENAI_API_KEY'];
  if (apiKey) llm.apiKey = apiKey;

  const model = process.env['AIC_MODEL'];
  if (model) llm.model = model;

  const temp = process.env['AIC_TEMPERATURE'];
  if (temp) llm.temperature = Number(temp);

  if (Object.keys(llm).length > 0) config.llm = llm as AicConfig['llm'];

  // Agent config from env
  if (process.env['AIC_VERBOSE'] === 'true' || process.env['AIC_VERBOSE'] === '1') {
    config.agent = { maxIterations: 20, verbose: true, requireApproval: true };
  }

  // Display config from env
  const width = process.env['AIC_WIDTH'];
  if (width) {
    config.display = { color: true, width: Number(width), showTokens: false };
  }

  return config;
}

/**
 * Load the full configuration from all sources.
 */
export async function loadConfig(
  projectDir?: string,
  overrides?: Partial<AicConfig>,
): Promise<AicConfig> {
  let config: AicConfig = { ...DEFAULT_CONFIG };

  // 1. User-level config (~/.ai-code/config.json)
  const userConfigPath = join(getHomeDir(), '.ai-code', 'config.json');
  const userConfig = await loadConfigFile(userConfigPath);
  if (userConfig) {
    config = mergeConfig(config, userConfig);
    logger.debug('Loaded user config from', userConfigPath);
  }

  // 2. Project-level config
  if (projectDir) {
    const projConfigPath = join(projectDir, '.ai-code', 'config.json');
    const projConfig = await loadConfigFile(projConfigPath);
    if (projConfig) {
      config = mergeConfig(config, projConfig);
      logger.debug('Loaded project config from', projConfigPath);
    }
  }

  // 3. Environment variables
  const envConfig = loadConfigFromEnv();
  config = mergeConfig(config, envConfig);

  // 4. Programmatic overrides (CLI flags)
  if (overrides) {
    config = mergeConfig(config, overrides);
  }

  // Final validation
  const result = AicConfigSchema.safeParse(config);
  if (!result.success) {
    logger.warn('Config validation errors:', result.error.message);
    return config;
  }

  return result.data;
}

/**
 * Get the default project directory (current working directory).
 */
export function getDefaultProjectDir(): string {
  return process.cwd();
}

/**
 * Resolve the data directory for a project.
 */
export function getDataDir(config: AicConfig, projectDir: string): string {
  if (config.storage.dataDir.startsWith('.')) {
    return join(projectDir, config.storage.dataDir);
  }
  return config.storage.dataDir;
}

/**
 * Resolve the history directory for a project.
 */
export function getHistoryDir(config: AicConfig, projectDir: string): string {
  if (config.storage.historyDir.startsWith('.')) {
    return join(projectDir, config.storage.historyDir);
  }
  return config.storage.historyDir;
}
