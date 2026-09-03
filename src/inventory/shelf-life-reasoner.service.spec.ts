import { ShelfLifePolicyKind } from '../generated/prisma/enums';
import type { LlmProvider } from '../llm/llm-provider';
import { ShelfLifeReasoner } from './shelf-life-reasoner.service';

describe('ShelfLifeReasoner', () => {
  const generateStructured = jest.fn();
  const provider = {
    name: 'test',
    generateStructured,
  } as LlmProvider;
  const reasoner = new ShelfLifeReasoner(provider);
  const input = {
    productId: 'product-1',
    canonicalName: 'Milk',
    category: 'dairy',
    typicalUnit: 'carton',
    productType: null,
    isPerishable: true,
  };

  beforeEach(() => jest.clearAllMocks());

  it('requests and returns a validated structured policy', async () => {
    generateStructured.mockResolvedValue({
      status: 'success',
      provider: 'test',
      model: 'test-model',
      value: {
        kind: ShelfLifePolicyKind.finite,
        shelfLifeDays: 7,
        confidence: 0.9,
        rationale: 'Fresh dairy product',
      },
    });

    await expect(reasoner.infer(input)).resolves.toMatchObject({
      status: 'success',
      value: { shelfLifeDays: 7 },
    });
    expect(generateStructured).toHaveBeenCalledWith(
      expect.objectContaining({
        task: 'product-shelf-life-inference',
        input,
        schemaName: 'product_shelf_life_policy',
        promptVersion: 'shelf-life-inference-v1',
      }),
    );
  });

  it('turns an invalid successful provider value into unavailable', async () => {
    generateStructured.mockResolvedValue({
      status: 'success',
      provider: 'test',
      model: 'test-model',
      value: {
        kind: ShelfLifePolicyKind.nonperishable,
        shelfLifeDays: 7,
        confidence: 0.9,
        rationale: 'Contradictory result',
      },
    });

    await expect(reasoner.infer(input)).resolves.toEqual({
      status: 'unavailable',
      provider: 'test',
      model: 'test-model',
    });
  });
});
