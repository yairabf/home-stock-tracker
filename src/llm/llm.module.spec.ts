import { Test, type TestingModule } from '@nestjs/testing';
import OpenAI from 'openai';
import { z } from 'zod';
import type { ModelConfig } from '../config/application-config';
import { ModelConfigModule } from '../config/model-config.module';
import { LLM_PROVIDER, type LlmProvider } from './llm-provider';
import { LlmModule } from './llm.module';
import { DEFAULT_OPENAI_MODEL } from './openai/openai.tokens';
import { JevDecisionClient } from './typesafe/jev-decision.client';

jest.mock('openai', () => ({ __esModule: true, default: jest.fn() }));

const MODEL_FIXTURE: ModelConfig = {
  llmProvider: 'openai',
  llmModel: DEFAULT_OPENAI_MODEL,
  productResolutionProvider: 'openai',
  stockPredictionProvider: 'openai',
};

const GENERATION_REQUEST = {
  task: 'test',
  instructions: 'Return a value.',
  input: {},
  schemaName: 'test_result',
  schema: z.object({ value: z.string() }),
};

describe('LlmModule configuration', () => {
  const environmentNames = [
    'LLM_PROVIDER',
    'OPENAI_API_KEY',
    'LLM_MODEL',
    'PRODUCT_RESOLUTION_PROVIDER',
    'STOCK_PREDICTION_PROVIDER',
    'TYPESAFE_API_KEY',
    'JEV_MODEL',
  ];
  const originalEnvironment = new Map(
    environmentNames.map((name) => [name, process.env[name]]),
  );
  const parse = jest.fn();
  let module: TestingModule | undefined;
  let fetchSpy: jest.SpiedFunction<typeof fetch>;

  beforeEach(() => {
    jest.mocked(OpenAI).mockReset();
    parse.mockReset().mockResolvedValue({
      output_parsed: { value: 'fixture-result' },
      output: [],
    });
    jest
      .mocked(OpenAI)
      .mockReturnValue({ responses: { parse } } as unknown as OpenAI);
    fetchSpy = jest
      .spyOn(globalThis, 'fetch')
      .mockRejectedValue(new Error('Unexpected network call in module test'));
    Object.assign(process.env, {
      LLM_PROVIDER: 'unsupported-environment-provider',
      OPENAI_API_KEY: 'environment-key',
      LLM_MODEL: 'environment-model',
      PRODUCT_RESOLUTION_PROVIDER: 'typesafe',
      STOCK_PREDICTION_PROVIDER: 'typesafe',
      TYPESAFE_API_KEY: 'environment-typesafe-key',
      JEV_MODEL: 'jev-9.9.9',
    });
  });

  afterEach(async () => {
    await module?.close();
    module = undefined;
    fetchSpy.mockRestore();
    for (const [name, value] of originalEnvironment) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  });

  async function compile(config: ModelConfig): Promise<TestingModule> {
    module = await Test.createTestingModule({
      imports: [ModelConfigModule.register(config), LlmModule],
    }).compile();
    await module.init();
    return module;
  }

  it('uses an explicit no-key fixture to expose an unavailable OpenAI provider', async () => {
    const module = await compile(MODEL_FIXTURE);
    const provider = module.get<LlmProvider>(LLM_PROVIDER);

    await expect(
      provider.generateStructured(GENERATION_REQUEST),
    ).resolves.toEqual({
      status: 'unavailable',
      provider: 'openai',
      model: DEFAULT_OPENAI_MODEL,
    });
    expect(OpenAI).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('injects OpenAI key, model and generation routing despite conflicting env', async () => {
    const module = await compile({
      ...MODEL_FIXTURE,
      openAiApiKey: 'fixture-openai-key',
      llmModel: 'fixture-model',
      typesafeApiKey: 'fixture-typesafe-key',
      jevModel: 'jev-1.13.0',
    });
    const provider = module.get<LlmProvider>(LLM_PROVIDER);
    const decisionClient = module.get(JevDecisionClient);

    expect(OpenAI).toHaveBeenCalledTimes(1);
    expect(OpenAI).toHaveBeenCalledWith({ apiKey: 'fixture-openai-key' });
    expect(provider.name).toBe('openai');
    expect(decisionClient.configured).toBe(true);
    expect(decisionClient.model).toBe('jev-1.13.0');
    expect(parse).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();

    await expect(
      provider.generateStructured(GENERATION_REQUEST),
    ).resolves.toEqual({
      status: 'success',
      provider: 'openai',
      model: 'fixture-model',
      value: { value: 'fixture-result' },
    });
    expect(parse).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'fixture-model' }),
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it.each([
    {},
    { typesafeApiKey: 'fixture-typesafe-key' },
    { jevModel: 'jev-1.13.0' },
  ])(
    'registers a disabled decision client for incomplete fixtures',
    async (settings) => {
      const module = await compile({ ...MODEL_FIXTURE, ...settings });
      const client = module.get(JevDecisionClient);

      expect(client.configured).toBe(false);
      expect(client.model).toBe(settings.jevModel);
      expect(fetchSpy).not.toHaveBeenCalled();
    },
  );
});
