import { DEFAULT_OPENAI_MODEL } from '../llm/openai/openai.tokens';
import { parseLogLevels } from '../observability/log-levels';
import { CronTime } from 'cron';

const DEFAULT_PORT = 3000;
const DEFAULT_LOG_LEVEL = 'log';
const DEFAULT_LLM_PROVIDER = 'openai';

export interface ApplicationConfig {
  nodeEnv?: string;
  port: number;
  databaseUrl: string;
  apiAuthToken: string;
  logLevel: string;
  mcpEnabled: boolean;
  llmProvider: string;
  llmModel: string;
  openAiApiKey?: string;
  stockWorkflow: StockWorkflowConfig;
}

export interface StockWorkflowConfig {
  enabled: boolean;
  cron: string;
  timezone: string;
}

export const STOCK_WORKFLOW_CONFIG = Symbol('STOCK_WORKFLOW_CONFIG');

export const DEFAULT_STOCK_WORKFLOW_CRON = '0 2 * * *';
export const DEFAULT_STOCK_WORKFLOW_TIMEZONE = 'Asia/Jerusalem';

export function loadApplicationConfig(
  environment: NodeJS.ProcessEnv = process.env,
): ApplicationConfig {
  const nodeEnv = optionalTrimmed(environment.NODE_ENV, 'NODE_ENV');
  const databaseUrl = requiredTrimmed(environment.DATABASE_URL, 'DATABASE_URL');
  const apiAuthToken = requiredUnpadded(
    environment.API_AUTH_TOKEN,
    'API_AUTH_TOKEN',
  );
  const port = parsePort(environment.PORT);
  const logLevel = environment.LOG_LEVEL ?? DEFAULT_LOG_LEVEL;
  parseLogLevels(logLevel);

  const mcpEnabled = parseBoolean(
    environment.MCP_ENABLED,
    'MCP_ENABLED',
    false,
  );
  const llmProvider =
    optionalTrimmed(environment.LLM_PROVIDER, 'LLM_PROVIDER') ??
    DEFAULT_LLM_PROVIDER;

  if (llmProvider !== 'openai') {
    throw new Error('LLM_PROVIDER must be openai');
  }

  const llmModel =
    optionalTrimmed(environment.LLM_MODEL, 'LLM_MODEL') ?? DEFAULT_OPENAI_MODEL;
  const openAiApiKey = optionalTrimmed(
    environment.OPENAI_API_KEY,
    'OPENAI_API_KEY',
  );
  const stockWorkflow = loadStockWorkflowConfig(environment);

  if (llmProvider === 'openai' && !openAiApiKey) {
    throw new Error('OPENAI_API_KEY is required when LLM_PROVIDER is openai');
  }

  return {
    nodeEnv,
    port,
    databaseUrl,
    apiAuthToken,
    logLevel,
    mcpEnabled,
    llmProvider,
    llmModel,
    openAiApiKey,
    stockWorkflow,
  };
}

export function loadStockWorkflowConfig(
  environment: NodeJS.ProcessEnv = process.env,
): StockWorkflowConfig {
  const config = {
    enabled: parseBoolean(
      environment.STOCK_WORKFLOW_ENABLED,
      'STOCK_WORKFLOW_ENABLED',
      true,
    ),
    cron:
      optionalTrimmed(environment.STOCK_WORKFLOW_CRON, 'STOCK_WORKFLOW_CRON') ??
      DEFAULT_STOCK_WORKFLOW_CRON,
    timezone:
      optionalTrimmed(
        environment.STOCK_WORKFLOW_TIMEZONE,
        'STOCK_WORKFLOW_TIMEZONE',
      ) ?? DEFAULT_STOCK_WORKFLOW_TIMEZONE,
  };
  new CronTime(config.cron, config.timezone);
  return config;
}

function requiredTrimmed(value: string | undefined, name: string): string {
  const trimmed = optionalTrimmed(value, name);

  if (!trimmed) {
    throw new Error(`${name} is required`);
  }

  return trimmed;
}

function requiredUnpadded(value: string | undefined, name: string): string {
  if (!value || value.trim() !== value) {
    throw new Error(
      `${name} must be a non-blank value without surrounding whitespace`,
    );
  }

  return value;
}

function optionalTrimmed(
  value: string | undefined,
  name: string,
): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`${name} must not be blank when provided`);
  }

  return trimmed;
}

function parsePort(value: string | undefined): number {
  if (value === undefined) {
    return DEFAULT_PORT;
  }

  if (!/^\d+$/.test(value)) {
    throw new Error('PORT must be an integer between 1 and 65535');
  }

  const port = Number(value);
  if (port < 1 || port > 65_535) {
    throw new Error('PORT must be an integer between 1 and 65535');
  }

  return port;
}

function parseBoolean(
  value: string | undefined,
  name: string,
  fallback: boolean,
): boolean {
  if (value === undefined) {
    return fallback;
  }

  if (value === 'true') {
    return true;
  }

  if (value === 'false') {
    return false;
  }

  throw new Error(`${name} must be true or false`);
}
