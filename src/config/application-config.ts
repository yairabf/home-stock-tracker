import { DEFAULT_OPENAI_MODEL } from '../llm/openai/openai.tokens';
import { parseLogLevels } from '../observability/log-levels';
import { CronTime } from 'cron';

const DEFAULT_PORT = 3000;
const DEFAULT_LOG_LEVEL = 'log';
const DEFAULT_LLM_PROVIDER = 'openai';

export type DecisionProvider = 'openai' | 'typesafe';

export interface ModelConfig {
  llmProvider: 'openai';
  llmModel: string;
  openAiApiKey?: string;
  productResolutionProvider: DecisionProvider;
  stockPredictionProvider: DecisionProvider;
  productUnderstandingProvider?: DecisionProvider;
  productUnderstandingCaptureEnabled?: boolean;
  shelfLifePolicyProvider?: DecisionProvider;
  typesafeApiKey?: string;
  jevModel?: string;
}

export interface ApplicationConfig extends ModelConfig {
  nodeEnv?: string;
  port: number;
  databaseUrl: string;
  apiAuthToken: string;
  logLevel: string;
  mcpEnabled: boolean;
  stockWorkflow: StockWorkflowConfig;
}

export interface StockWorkflowConfig {
  adviceEnabled: boolean;
  adviceMaxProducts: number;
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
  const modelConfig = loadModelConfig(environment);
  const stockWorkflow = loadStockWorkflowConfig(environment);

  return {
    nodeEnv,
    port,
    databaseUrl,
    apiAuthToken,
    logLevel,
    mcpEnabled,
    ...modelConfig,
    stockWorkflow,
  };
}

function loadModelConfig(environment: NodeJS.ProcessEnv): ModelConfig {
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
  if (!openAiApiKey) {
    throw new Error('OPENAI_API_KEY is required when LLM_PROVIDER is openai');
  }

  const productResolutionProvider = parseDecisionProvider(
    environment.PRODUCT_RESOLUTION_PROVIDER,
    'PRODUCT_RESOLUTION_PROVIDER',
  );
  const stockPredictionProvider = parseDecisionProvider(
    environment.STOCK_PREDICTION_PROVIDER,
    'STOCK_PREDICTION_PROVIDER',
  );
  const productUnderstandingProvider = parseDecisionProvider(
    environment.PRODUCT_UNDERSTANDING_PROVIDER,
    'PRODUCT_UNDERSTANDING_PROVIDER',
  );
  const typesafeApiKey = optionalTrimmed(
    environment.TYPESAFE_API_KEY,
    'TYPESAFE_API_KEY',
  );
  const shelfLifePolicyProvider = parseDecisionProvider(
    environment.SHELF_LIFE_POLICY_PROVIDER,
    'SHELF_LIFE_POLICY_PROVIDER',
  );
  const jevModel = optionalTrimmed(environment.JEV_MODEL, 'JEV_MODEL');
  if (jevModel !== undefined && !/^jev-\d+\.\d+\.\d+$/.test(jevModel)) {
    throw new Error(
      'JEV_MODEL must be a versioned ID: jev-<major>.<minor>.<patch>',
    );
  }
  validateDecisionCapabilities(
    productResolutionProvider,
    stockPredictionProvider,
    productUnderstandingProvider,
    shelfLifePolicyProvider,
    typesafeApiKey,
    jevModel,
  );

  return {
    llmProvider,
    llmModel,
    openAiApiKey,
    productResolutionProvider,
    stockPredictionProvider,
    productUnderstandingProvider,
    productUnderstandingCaptureEnabled: parseBoolean(
      environment.PRODUCT_UNDERSTANDING_CAPTURE_ENABLED,
      'PRODUCT_UNDERSTANDING_CAPTURE_ENABLED',
      false,
    ),
    shelfLifePolicyProvider,
    typesafeApiKey,
    jevModel,
  };
}

function parseDecisionProvider(
  value: string | undefined,
  name: string,
): DecisionProvider {
  const provider = optionalTrimmed(value, name) ?? 'openai';
  if (provider !== 'openai' && provider !== 'typesafe') {
    throw new Error(`${name} must be openai or typesafe`);
  }
  return provider;
}

function validateDecisionCapabilities(
  productResolutionProvider: DecisionProvider,
  stockPredictionProvider: DecisionProvider,
  productUnderstandingProvider: DecisionProvider,
  shelfLifePolicyProvider: DecisionProvider,
  typesafeApiKey: string | undefined,
  jevModel: string | undefined,
): void {
  if (
    productResolutionProvider !== 'typesafe' &&
    stockPredictionProvider !== 'typesafe' &&
    productUnderstandingProvider !== 'typesafe' &&
    shelfLifePolicyProvider !== 'typesafe'
  ) {
    return;
  }
  if (!typesafeApiKey) {
    throw new Error(
      'TYPESAFE_API_KEY is required when a task provider is typesafe',
    );
  }
  if (!jevModel) {
    throw new Error('JEV_MODEL is required when a task provider is typesafe');
  }
}

export function loadStockWorkflowConfig(
  environment: NodeJS.ProcessEnv = process.env,
): StockWorkflowConfig {
  const adviceLimit = environment.STOCK_WORKFLOW_ADVICE_MAX_PRODUCTS;
  if (
    adviceLimit !== undefined &&
    (!/^\d+$/.test(adviceLimit) ||
      Number(adviceLimit) < 1 ||
      Number(adviceLimit) > 100)
  )
    throw new Error(
      'STOCK_WORKFLOW_ADVICE_MAX_PRODUCTS must be an integer from 1 to 100',
    );
  const config = {
    adviceEnabled: parseBoolean(
      environment.STOCK_WORKFLOW_ADVICE_ENABLED,
      'STOCK_WORKFLOW_ADVICE_ENABLED',
      false,
    ),
    adviceMaxProducts: adviceLimit === undefined ? 20 : Number(adviceLimit),
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
