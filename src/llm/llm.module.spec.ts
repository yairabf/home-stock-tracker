import { Test } from '@nestjs/testing';
import { z } from 'zod';
import { LLM_PROVIDER, type LlmProvider } from './llm-provider';
import { LlmModule } from './llm.module';

describe('LlmModule configuration', () => {
  const originalProvider = process.env.LLM_PROVIDER;
  const originalApiKey = process.env.OPENAI_API_KEY;
  const originalModel = process.env.LLM_MODEL;

  afterEach(() => {
    restoreEnvironmentVariable('LLM_PROVIDER', originalProvider);
    restoreEnvironmentVariable('OPENAI_API_KEY', originalApiKey);
    restoreEnvironmentVariable('LLM_MODEL', originalModel);
  });

  it('boots without an API key and exposes an unavailable OpenAI provider', async () => {
    delete process.env.LLM_PROVIDER;
    delete process.env.OPENAI_API_KEY;
    delete process.env.LLM_MODEL;
    const module = await Test.createTestingModule({
      imports: [LlmModule],
    }).compile();
    const provider = module.get<LlmProvider>(LLM_PROVIDER);

    await expect(
      provider.generateStructured({
        task: 'test',
        instructions: 'Return a value.',
        input: {},
        schemaName: 'test_result',
        schema: z.object({ value: z.string() }),
      }),
    ).resolves.toEqual({
      status: 'unavailable',
      provider: 'openai',
      model: 'gpt-5.6-sol',
    });
  });

  it('fails module startup for an unsupported configured provider', async () => {
    process.env.LLM_PROVIDER = 'openrouter';
    delete process.env.OPENAI_API_KEY;

    await expect(
      Test.createTestingModule({ imports: [LlmModule] }).compile(),
    ).rejects.toThrow('Unsupported LLM_PROVIDER "openrouter"');
  });
});

function restoreEnvironmentVariable(
  name: 'LLM_PROVIDER' | 'OPENAI_API_KEY' | 'LLM_MODEL',
  value: string | undefined,
): void {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}
