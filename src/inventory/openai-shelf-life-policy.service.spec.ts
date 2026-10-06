import type { StructuredGenerationRequest } from '../llm/types/structured-generation';
import type {
  ShelfLifeInferenceInput,
  ShelfLifeInferenceResult,
} from './types/shelf-life-inference';
import {
  OpenAiShelfLifePolicy,
  RequiredShelfLifeGeneration,
} from './openai-shelf-life-policy.service';
import type { ShelfLifePolicyInput } from './shelf-life-policy';

const input: ShelfLifePolicyInput = {
  productId: 'product',
  canonicalName: 'salmon',
  category: null,
  typicalUnit: null,
  productType: null,
  isPerishable: true,
  context: {
    version: 1,
    storage: 'refrigerated',
    maxTemperatureC: 4,
    preparation: 'raw',
    form: 'whole_or_pieces',
  },
};
const response = {
  status: 'success',
  provider: 'openai',
  model: 'test-model',
  value: {
    kind: 'finite',
    shelfLifeDays: 1.5,
    confidence: 0.95,
    rationale: 'Raw refrigerated fish inventory estimate',
  },
};
describe('shelf-life generation adapters', () => {
  const generateStructured = jest.fn();
  const generation = new RequiredShelfLifeGeneration({
    name: 'openai',
    generateStructured,
  } as never);
  beforeEach(() => {
    generateStructured.mockReset();
    generateStructured.mockResolvedValue(response);
  });
  it('generates a required unsupported policy once without quantizing days', async () => {
    const result = await generation.infer(input, performance.now() + 5000);
    expect(result).toMatchObject({
      status: 'resolved',
      value: { shelfLifeDays: 1.5 },
      attempts: [
        expect.objectContaining({
          routingReason: 'unsupported_required_generation',
          status: 'accepted',
        }),
      ],
    });
    expect(generateStructured).toHaveBeenCalledTimes(1);
    expect(
      firstCall<StructuredGenerationRequest<ShelfLifeInferenceResult>>(
        generateStructured,
      ),
    ).toMatchObject({
      input: { requiredField: 'shelfLifePolicy', context: input.context },
      promptVersion: 'shelf-life-policy-generation-v2',
    });
    expect(
      firstCall<StructuredGenerationRequest<ShelfLifeInferenceResult>>(
        generateStructured,
      ).budgetMs,
    ).toBeLessThanOrEqual(5000);
    expect(
      firstCall<StructuredGenerationRequest<ShelfLifeInferenceResult>>(
        generateStructured,
      ).input,
    ).not.toHaveProperty('category');
  });
  it.each([
    null,
    { ...input.context!, storage: 'unknown' },
    { ...input.context!, preparation: 'cooked' },
  ])('does not spend on missing facts', async (context) => {
    expect(
      await generation.infer(
        { ...input, context } as ShelfLifePolicyInput,
        performance.now() + 5000,
      ),
    ).toMatchObject({ status: 'unresolved' });
    expect(generateStructured).not.toHaveBeenCalled();
  });
  it('does not call when the shared operation deadline is exhausted', async () => {
    await generation.infer(input, performance.now() - 1);
    expect(generateStructured).not.toHaveBeenCalled();
  });
  it('rejects a response arriving beyond the shared deadline', async () => {
    jest.useFakeTimers();
    try {
      generateStructured.mockImplementation(() => {
        jest.advanceTimersByTime(5001);
        return response;
      });
      expect(
        await generation.infer(input, performance.now() + 5000),
      ).toMatchObject({
        status: 'unresolved',
        outcome: { status: 'unavailable' },
      });
    } finally {
      jest.useRealTimers();
    }
  });
  it.each([
    {
      ...response,
      value: { ...response.value, kind: 'nonperishable', shelfLifeDays: null },
    },
    { ...response, value: { ...response.value, confidence: 0.89 } },
    { ...response, value: { ...response.value, shelfLifeDays: 0 } },
    { status: 'refusal', provider: 'openai', model: 'test-model' },
    { status: 'unavailable' },
  ])('leaves rejected/refused/unavailable policies missing', async (result) => {
    generateStructured.mockResolvedValue(result);
    expect(
      await generation.infer(input, performance.now() + 5000),
    ).toMatchObject({ status: 'unresolved' });
  });
  it('keeps the selected OpenAI mode compatible without requiring context', async () => {
    const infer = jest.fn().mockResolvedValue({
      ...response,
      value: {
        ...response.value,
        kind: 'nonperishable',
        shelfLifeDays: null,
        confidence: 0.85,
      },
    });
    const legacy = new OpenAiShelfLifePolicy({ infer } as never);
    expect(await legacy.infer({ ...input, context: null })).toMatchObject({
      status: 'resolved',
      taskVersion: 'shelf-life-inference-v1',
      value: { kind: 'nonperishable' },
    });
    expect(firstCall<ShelfLifeInferenceInput>(infer)).not.toHaveProperty(
      'context',
    );
  });
});

function firstCall<T>(mock: jest.Mock): T {
  return (mock.mock.calls as unknown as Array<[T]>)[0][0];
}
