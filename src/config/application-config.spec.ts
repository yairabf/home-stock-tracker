import { DEFAULT_OPENAI_MODEL } from '../llm/openai/openai.tokens';
import { loadApplicationConfig } from './application-config';

const REQUIRED_ENVIRONMENT: NodeJS.ProcessEnv = {
  DATABASE_URL: 'postgresql://user:password@database:5432/inventory',
  API_AUTH_TOKEN: 'service-token',
  OPENAI_API_KEY: 'openai-key',
};

describe('loadApplicationConfig', () => {
  it('applies the documented defaults', () => {
    expect(loadApplicationConfig(REQUIRED_ENVIRONMENT)).toEqual({
      nodeEnv: undefined,
      port: 3000,
      databaseUrl: REQUIRED_ENVIRONMENT.DATABASE_URL,
      apiAuthToken: REQUIRED_ENVIRONMENT.API_AUTH_TOKEN,
      logLevel: 'log',
      mcpEnabled: false,
      llmProvider: 'openai',
      llmModel: DEFAULT_OPENAI_MODEL,
      openAiApiKey: REQUIRED_ENVIRONMENT.OPENAI_API_KEY,
    });
  });

  it('parses explicit supported values', () => {
    expect(
      loadApplicationConfig({
        ...REQUIRED_ENVIRONMENT,
        NODE_ENV: 'production',
        PORT: '8080',
        LOG_LEVEL: 'warn',
        MCP_ENABLED: 'true',
        LLM_PROVIDER: 'openai',
        LLM_MODEL: 'configured-model',
      }),
    ).toMatchObject({
      nodeEnv: 'production',
      port: 8080,
      logLevel: 'warn',
      mcpEnabled: true,
      llmProvider: 'openai',
      llmModel: 'configured-model',
    });
  });

  it.each([
    ['DATABASE_URL', { ...REQUIRED_ENVIRONMENT, DATABASE_URL: undefined }],
    ['DATABASE_URL', { ...REQUIRED_ENVIRONMENT, DATABASE_URL: '  ' }],
    ['API_AUTH_TOKEN', { ...REQUIRED_ENVIRONMENT, API_AUTH_TOKEN: ' padded ' }],
    ['PORT', { ...REQUIRED_ENVIRONMENT, PORT: '0' }],
    ['PORT', { ...REQUIRED_ENVIRONMENT, PORT: '12.5' }],
    ['LOG_LEVEL', { ...REQUIRED_ENVIRONMENT, LOG_LEVEL: 'info' }],
    ['MCP_ENABLED', { ...REQUIRED_ENVIRONMENT, MCP_ENABLED: 'yes' }],
    ['LLM_PROVIDER', { ...REQUIRED_ENVIRONMENT, LLM_PROVIDER: 'anthropic' }],
    ['LLM_MODEL', { ...REQUIRED_ENVIRONMENT, LLM_MODEL: ' ' }],
  ])('rejects malformed %s configuration', (_name, environment) => {
    expect(() => loadApplicationConfig(environment)).toThrow();
  });

  it('requires an OpenAI key for the default provider', () => {
    expect(() =>
      loadApplicationConfig({
        ...REQUIRED_ENVIRONMENT,
        OPENAI_API_KEY: undefined,
      }),
    ).toThrow('OPENAI_API_KEY is required when LLM_PROVIDER is openai');
  });

  it('does not include secret values in validation errors', () => {
    const secret = 'secret-value-that-must-not-leak';

    expect(() =>
      loadApplicationConfig({
        ...REQUIRED_ENVIRONMENT,
        API_AUTH_TOKEN: ` ${secret} `,
      }),
    ).toThrow('API_AUTH_TOKEN must be');

    try {
      loadApplicationConfig({
        ...REQUIRED_ENVIRONMENT,
        API_AUTH_TOKEN: ` ${secret} `,
      });
    } catch (error) {
      expect(String(error)).not.toContain(secret);
    }
  });
});
