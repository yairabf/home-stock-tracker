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
      productResolutionProvider: 'openai',
      stockPredictionProvider: 'openai',
      typesafeApiKey: undefined,
      jevModel: undefined,
      stockWorkflow: {
        enabled: true,
        cron: '0 2 * * *',
        timezone: 'Asia/Jerusalem',
      },
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
        STOCK_WORKFLOW_ENABLED: 'false',
        STOCK_WORKFLOW_CRON: '15 4 * * *',
        STOCK_WORKFLOW_TIMEZONE: 'UTC',
      }),
    ).toMatchObject({
      nodeEnv: 'production',
      port: 8080,
      logLevel: 'warn',
      mcpEnabled: true,
      llmProvider: 'openai',
      llmModel: 'configured-model',
      stockWorkflow: {
        enabled: false,
        cron: '15 4 * * *',
        timezone: 'UTC',
      },
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
    [
      'STOCK_WORKFLOW_ENABLED',
      { ...REQUIRED_ENVIRONMENT, STOCK_WORKFLOW_ENABLED: 'yes' },
    ],
    [
      'STOCK_WORKFLOW_CRON',
      { ...REQUIRED_ENVIRONMENT, STOCK_WORKFLOW_CRON: ' ' },
    ],
    [
      'STOCK_WORKFLOW_TIMEZONE',
      { ...REQUIRED_ENVIRONMENT, STOCK_WORKFLOW_TIMEZONE: ' ' },
    ],
    [
      'STOCK_WORKFLOW_CRON',
      { ...REQUIRED_ENVIRONMENT, STOCK_WORKFLOW_CRON: 'not a cron' },
    ],
    [
      'STOCK_WORKFLOW_TIMEZONE',
      { ...REQUIRED_ENVIRONMENT, STOCK_WORKFLOW_TIMEZONE: 'Not/A_Timezone' },
    ],
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

  it('trims model settings and allows optional Jev settings with OpenAI tasks', () => {
    expect(
      loadApplicationConfig({
        ...REQUIRED_ENVIRONMENT,
        LLM_PROVIDER: ' openai ',
        LLM_MODEL: ' configured-model ',
        OPENAI_API_KEY: ' openai-key ',
        PRODUCT_RESOLUTION_PROVIDER: ' openai ',
        STOCK_PREDICTION_PROVIDER: ' openai ',
        TYPESAFE_API_KEY: ' typesafe-test-key ',
        JEV_MODEL: ' jev-1.13.0 ',
      }),
    ).toMatchObject({
      llmProvider: 'openai',
      llmModel: 'configured-model',
      openAiApiKey: 'openai-key',
      productResolutionProvider: 'openai',
      stockPredictionProvider: 'openai',
      typesafeApiKey: 'typesafe-test-key',
      jevModel: 'jev-1.13.0',
    });
  });

  it.each([
    { TYPESAFE_API_KEY: 'typesafe-test-key' },
    { JEV_MODEL: 'jev-2.10.3' },
  ])(
    'allows partial optional Jev configuration for OpenAI tasks',
    (settings) => {
      expect(
        loadApplicationConfig({ ...REQUIRED_ENVIRONMENT, ...settings }),
      ).toMatchObject({
        productResolutionProvider: 'openai',
        stockPredictionProvider: 'openai',
      });
    },
  );

  it.each([
    ['PRODUCT_RESOLUTION_PROVIDER', 'unsupported'],
    ['STOCK_PREDICTION_PROVIDER', 'unsupported'],
    ['PRODUCT_RESOLUTION_PROVIDER', 'TypeSafe'],
    ['STOCK_PREDICTION_PROVIDER', 'OPENAI'],
    ['PRODUCT_RESOLUTION_PROVIDER', ' '],
    ['STOCK_PREDICTION_PROVIDER', ''],
    ['TYPESAFE_API_KEY', ' '],
    ['JEV_MODEL', ' '],
    ['JEV_MODEL', 'jev-latest'],
    ['JEV_MODEL', 'jev-preview'],
    ['JEV_MODEL', 'jev-1.13'],
    ['JEV_MODEL', 'jev-1.13.0-extra'],
    ['JEV_MODEL', 'jev-1x13x0'],
    ['JEV_MODEL', 'other-1.13.0'],
  ])('rejects malformed %s even with OpenAI tasks', (name, value) => {
    expect(() =>
      loadApplicationConfig({ ...REQUIRED_ENVIRONMENT, [name]: value }),
    ).toThrow(name);
  });

  describe.each(['PRODUCT_RESOLUTION_PROVIDER', 'STOCK_PREDICTION_PROVIDER'])(
    '%s TypeSafe selection',
    (selector) => {
      const typesafeEnvironment = {
        ...REQUIRED_ENVIRONMENT,
        [selector]: ' typesafe ',
      };

      it.each([undefined, ' '])(
        'requires a nonblank TypeSafe key',
        (apiKey) => {
          expect(() =>
            loadApplicationConfig({
              ...typesafeEnvironment,
              TYPESAFE_API_KEY: apiKey,
              JEV_MODEL: 'jev-1.13.0',
            }),
          ).toThrow('TYPESAFE_API_KEY');
        },
      );

      it.each([undefined, ' ', 'jev-latest'])(
        'requires a pinned model',
        (model) => {
          expect(() =>
            loadApplicationConfig({
              ...typesafeEnvironment,
              TYPESAFE_API_KEY: 'typesafe-test-key',
              JEV_MODEL: model,
            }),
          ).toThrow('JEV_MODEL');
        },
      );

      it('rejects the unavailable adapter after credentials pass validation', () => {
        expect(() =>
          loadApplicationConfig({
            ...typesafeEnvironment,
            TYPESAFE_API_KEY: 'typesafe-test-key',
            JEV_MODEL: 'jev-1.13.0',
          }),
        ).toThrow(`${selector} typesafe adapter is not available`);
      });
    },
  );

  it('requires OpenAI generation credentials even with Jev settings', () => {
    expect(() =>
      loadApplicationConfig({
        ...REQUIRED_ENVIRONMENT,
        OPENAI_API_KEY: undefined,
        TYPESAFE_API_KEY: 'typesafe-test-key',
        JEV_MODEL: 'jev-1.13.0',
      }),
    ).toThrow('OPENAI_API_KEY is required when LLM_PROVIDER is openai');
  });

  it.each([
    'LLM_PROVIDER',
    'PRODUCT_RESOLUTION_PROVIDER',
    'STOCK_PREDICTION_PROVIDER',
    'JEV_MODEL',
  ])('does not echo invalid %s or private keys in errors', (name) => {
    const privateKey = 'private-test-value';
    const invalidValue = 'invalid-config-value';
    const load = () =>
      loadApplicationConfig({
        ...REQUIRED_ENVIRONMENT,
        OPENAI_API_KEY: privateKey,
        TYPESAFE_API_KEY: privateKey,
        [name]: invalidValue,
      });

    expect(load).toThrow(name);
    expect(load).not.toThrow(privateKey);
    expect(load).not.toThrow(invalidValue);
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
