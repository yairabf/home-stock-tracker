import OpenAI from 'openai';
import { ProductType } from '../../generated/prisma/enums';
import type { StructuredGenerationRequest } from '../types/structured-generation';
import {
  productClassificationResultSchema,
  type ProductClassificationResult,
} from '../../product/types/product-classification';
import { OpenAiLlmProvider } from './openai-llm.provider';
import { OperationalLogger } from '../../observability/operational-logger.service';

const request: StructuredGenerationRequest<ProductClassificationResult> = {
  task: 'product-classification',
  instructions: 'Classify one household product.',
  input: { rawName: 'milk' },
  schemaName: 'product_classification',
  schema: productClassificationResultSchema,
};

const parsedResult: ProductClassificationResult = {
  canonicalName: 'milk',
  aliases: [],
  category: 'dairy',
  typicalUnit: 'liter',
  productType: ProductType.fast_consumable,
  isPerishable: true,
  confidence: 0.95,
};

describe('OpenAiLlmProvider', () => {
  const model = 'test-model';
  let parse: jest.Mock;
  let provider: OpenAiLlmProvider;
  let operationalLogger: jest.Mocked<Pick<OperationalLogger, 'llmIntegration'>>;

  beforeEach(() => {
    parse = jest.fn();
    operationalLogger = { llmIntegration: jest.fn() };
    const client = { responses: { parse } } as unknown as OpenAI;
    provider = new OpenAiLlmProvider(
      client,
      model,
      operationalLogger as OperationalLogger,
    );
  });

  it('sends strict structured output through the Responses API', async () => {
    parse.mockResolvedValue({ output_parsed: parsedResult, output: [] });

    await expect(provider.generateStructured(request)).resolves.toEqual({
      status: 'success',
      provider: 'openai',
      model,
      value: parsedResult,
    });
    const parseCalls = parse.mock.calls as unknown[][];
    const providerRequest = parseCalls[0][0];
    expect(providerRequest).toMatchObject({
      model,
      instructions: request.instructions,
      input: JSON.stringify(request.input),
      text: {
        format: {
          type: 'json_schema',
          strict: true,
        },
      },
    });
  });

  it('caps the metadata operation, cancels hanging parsing and disables SDK retries', async () => {
    jest.useFakeTimers();
    try {
      parse.mockImplementation(() => new Promise(() => {}));
      const pending = provider.generateStructured({
        ...request,
        budgetMs: 100,
      });
      const calls = parse.mock.calls as unknown as Array<
        [unknown, { signal: AbortSignal; timeout: number; maxRetries: number }]
      >;
      expect(calls[0][1]).toMatchObject({ timeout: 100, maxRetries: 0 });
      await jest.advanceTimersByTimeAsync(100);
      expect(await pending).toEqual({
        status: 'unavailable',
        provider: 'openai',
        model,
      });
      expect(calls[0][1].signal.aborted).toBe(true);
      expect(parse).toHaveBeenCalledTimes(1);
      expect(jest.getTimerCount()).toBe(0);
    } finally {
      jest.useRealTimers();
    }
  });
  it.each([0, -1, Infinity, 10_001])(
    'rejects invalid bounded generation budget %p without requests',
    async (budgetMs) => {
      expect(
        (await provider.generateStructured({ ...request, budgetMs })).status,
      ).toBe('unavailable');
      expect(parse).not.toHaveBeenCalled();
    },
  );
  it('disposes the task deadline after success and preserves unbounded legacy request options', async () => {
    jest.useFakeTimers();
    try {
      parse.mockResolvedValue({ output_parsed: parsedResult, output: [] });
      expect(
        (await provider.generateStructured({ ...request, budgetMs: 10_000 }))
          .status,
      ).toBe('success');
      expect(jest.getTimerCount()).toBe(0);
      parse.mockClear();
      await provider.generateStructured(request);
      const calls = parse.mock.calls as unknown[][];
      expect(calls[0]).toHaveLength(1);
    } finally {
      jest.useRealTimers();
    }
  });

  it('returns unavailable when configuration has no API client', async () => {
    provider = new OpenAiLlmProvider(
      null,
      model,
      operationalLogger as OperationalLogger,
    );

    await expect(provider.generateStructured(request)).resolves.toEqual({
      status: 'unavailable',
      provider: 'openai',
      model,
    });
    expect(parse).not.toHaveBeenCalled();
    expect(operationalLogger.llmIntegration).toHaveBeenCalledWith({
      outcome: 'failure',
      provider: 'openai',
      errorType: 'provider_error',
    });
  });

  it('translates a refusal without retaining its provider text', async () => {
    parse.mockResolvedValue({
      output_parsed: null,
      output: [
        {
          type: 'message',
          content: [{ type: 'refusal', refusal: 'provider detail' }],
        },
      ],
    });

    await expect(provider.generateStructured(request)).resolves.toEqual({
      status: 'refusal',
      provider: 'openai',
      model,
    });
  });

  it('returns unavailable for an unparsed response', async () => {
    parse.mockResolvedValue({ output_parsed: null, output: [] });

    await expect(provider.generateStructured(request)).resolves.toEqual({
      status: 'unavailable',
      provider: 'openai',
      model,
    });
  });

  it.each([
    ['timeout', new OpenAI.APIConnectionTimeoutError()],
    [
      'rate limit',
      new OpenAI.RateLimitError(429, {}, 'provider detail', new Headers()),
    ],
  ])(
    'translates %s errors without exposing provider details',
    async (_name, error) => {
      parse.mockRejectedValue(error);

      await expect(provider.generateStructured(request)).resolves.toEqual({
        status: 'unavailable',
        provider: 'openai',
        model,
      });
      expect(operationalLogger.llmIntegration).toHaveBeenCalledWith({
        outcome: 'failure',
        provider: 'openai',
        errorType: 'provider_error',
      });
      expect(
        JSON.stringify(operationalLogger.llmIntegration.mock.calls),
      ).not.toContain('provider detail');
    },
  );
});
