import { OpenAiProductUnderstanding } from './openai-product-understanding.service';
import type { LlmProvider } from '../llm/llm-provider';
import type { ModelConfig } from '../config/application-config';
import {
  acceptedMetadata,
  type ProductUnderstandingInput,
} from './product-understanding';

const input: ProductUnderstandingInput = {
  rawName: 'Milk',
  metadata: {
    category: 'dairy',
    typicalUnit: null,
    productType: null,
    isPerishable: false,
  },
  categories: ['dairy'],
  units: ['liter'],
};
describe('OpenAI product understanding', () => {
  const generateStructured = jest.fn();
  const adapter = new OpenAiProductUnderstanding(
    { generateStructured } as unknown as LlmProvider,
    { llmModel: 'test-model' } as ModelConfig,
  );
  beforeEach(() => generateStructured.mockReset());
  it('generates only missing metadata in one call and preserves names and supplied false', async () => {
    generateStructured.mockResolvedValue({
      status: 'success',
      provider: 'openai',
      model: 'resolved-model',
      value: {
        typicalUnit: { value: 'liter', confidence: 0.9 },
        productType: { value: 'fast_consumable', confidence: 0.95 },
      },
    });
    const result = await adapter.understand(input);
    expect(acceptedMetadata(input.metadata, result)).toEqual({
      typicalUnit: 'liter',
      productType: 'fast_consumable',
    });
    expect(generateStructured).toHaveBeenCalledTimes(1);
    const request = (
      generateStructured.mock.calls as unknown as Array<
        [{ input: { requestedFields: string[] }; schema: { shape: object } }]
      >
    )[0][0];
    expect(request.input.requestedFields).toEqual([
      'productType',
      'typicalUnit',
    ]);
    expect(Object.keys(request.schema.shape)).toEqual([
      'productType',
      'typicalUnit',
    ]);
    expect(result.fields.isPerishable).toMatchObject({
      source: 'supplied',
      value: false,
    });
    expect(
      result.attempts.every((attempt) => attempt.status === 'accepted'),
    ).toBe(true);
    expect(result.attempts[0]).toMatchObject({
      configuredModel: 'test-model',
      resolvedModel: 'resolved-model',
    });
    expect(result.attempts[0]).not.toHaveProperty('usage');
  });
  it('accepts partial confidence and treats null as unknown', async () => {
    generateStructured.mockResolvedValue({
      status: 'success',
      provider: 'openai',
      model: 'model',
      value: {
        typicalUnit: { value: 'liter', confidence: 0.79 },
        productType: { value: null, confidence: 0.95 },
      },
    });
    const result = await adapter.understand(input);
    expect(result.attempts[1]).toMatchObject({
      confidence: 0.79,
      status: 'rejected',
    });
    expect(result.fields.typicalUnit).toEqual({
      status: 'uncertain',
      reason: 'low_confidence',
    });
    expect(result.fields.productType).toEqual({
      status: 'uncertain',
      reason: 'unknown',
    });
    expect(acceptedMetadata(input.metadata, result)).toEqual({});
  });
  it('accepts a generated false distinct from unknown', async () => {
    generateStructured.mockResolvedValue({
      status: 'success',
      provider: 'openai',
      model: 'model',
      value: { isPerishable: { value: false, confidence: 0.8 } },
    });
    const snapshot = {
      ...input.metadata,
      typicalUnit: 'liter',
      productType: 'fast_consumable' as const,
      isPerishable: null,
    };
    const result = await adapter.understand({ ...input, metadata: snapshot });
    expect(acceptedMetadata(snapshot, result)).toEqual({ isPerishable: false });
  });
  it('bypasses complete metadata', async () => {
    const result = await adapter.understand({
      ...input,
      metadata: {
        ...input.metadata,
        typicalUnit: 'liter',
        productType: 'fast_consumable',
      },
    });
    expect(generateStructured).not.toHaveBeenCalled();
    expect(result.attempts).toEqual([]);
  });
  it.each([
    {
      canonicalName: 'renamed',
      aliases: ['alias'],
      typicalUnit: { value: 'liter', confidence: 0.9 },
      productType: { value: 'fast_consumable', confidence: 0.9 },
    },
    {
      typicalUnit: { value: 'liter', confidence: 2 },
      productType: { value: 'fast_consumable', confidence: 0.9 },
    },
    {
      typicalUnit: { value: ' ', confidence: 0.9 },
      productType: { value: 'made_up', confidence: 0.9 },
    },
  ])(
    'rejects malformed or identity-bearing output without mutation',
    async (value) => {
      generateStructured.mockResolvedValue({
        status: 'success',
        provider: 'openai',
        model: 'model',
        value,
      });
      const result = await adapter.understand(input);
      expect(acceptedMetadata(input.metadata, result)).toEqual({});
      expect(
        result.attempts.every((attempt) => attempt.status === 'rejected'),
      ).toBe(true);
    },
  );
  it.each(['refusal', 'unavailable', 'throw'])(
    'safely records %s with no retries',
    async (status) => {
      if (status === 'throw')
        generateStructured.mockRejectedValue(new Error('private raw error'));
      else
        generateStructured.mockResolvedValue({
          status,
          provider: 'openai',
          model: 'model',
        });
      const result = await adapter.understand(input);
      expect(generateStructured).toHaveBeenCalledTimes(1);
      expect(acceptedMetadata(input.metadata, result)).toEqual({});
      expect(result.attempts.length).toBeGreaterThan(0);
      expect(JSON.stringify(result.attempts)).not.toContain(
        'private raw error',
      );
    },
  );
});
