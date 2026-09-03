import {
  ProductNameKind,
  ShelfLifePolicyKind,
} from '../generated/prisma/enums';
import { ShelfLifeInferenceService } from './shelf-life-inference.service';
import type { ShelfLifeReasoner } from './shelf-life-reasoner.service';

function firstCall<T>(mock: jest.Mock): T {
  return (mock.mock.calls as unknown as Array<[T]>)[0][0];
}

describe('ShelfLifeInferenceService', () => {
  const findMany = jest.fn();
  const create = jest.fn();
  const infer = jest.fn();
  const stockWorkflow = jest.fn();
  const prisma = {
    product: { findMany },
    productShelfLifePolicy: { create },
  };
  const service = new ShelfLifeInferenceService(
    prisma as never,
    { infer } as unknown as ShelfLifeReasoner,
    { stockWorkflow } as never,
  );
  const product = (id: string, canonicalName = `Product ${id}`) => ({
    id,
    category: 'pantry',
    typicalUnit: 'item',
    productType: null,
    isPerishable: false,
    names: canonicalName ? [{ displayName: canonicalName }] : [],
  });

  beforeEach(() => {
    jest.clearAllMocks();
    create.mockResolvedValue({});
  });

  it('selects policy-free products and persists successful provenance', async () => {
    findMany.mockResolvedValue([product('one')]);
    infer.mockResolvedValue({
      status: 'success',
      provider: 'test-provider',
      model: 'test-model',
      value: {
        kind: ShelfLifePolicyKind.nonperishable,
        shelfLifeDays: null,
        confidence: 0.85,
        rationale: 'Stable pantry product',
      },
    });
    const evaluatedAt = new Date('2026-09-03T02:00:00.000Z');

    await expect(service.inferMissingPolicies(evaluatedAt)).resolves.toEqual({
      processed: 1,
      succeeded: 1,
      skipped: 0,
      failed: 0,
    });
    const findQuery = firstCall<{
      where: { shelfLifePolicy: null };
      select: { names: { where: { kind: ProductNameKind } } };
    }>(findMany);
    expect(findQuery.where).toEqual({ shelfLifePolicy: null });
    expect(findQuery.select.names.where).toEqual({
      kind: ProductNameKind.canonical,
    });
    const createInput = firstCall<{
      data: Record<string, unknown>;
    }>(create);
    expect(createInput.data).toMatchObject({
      productId: 'one',
      modelProvider: 'test-provider',
      modelVersion: 'test-model',
      promptVersion: 'shelf-life-inference-v1',
      evaluatedAt,
    });
  });

  it('isolates failures and leaves unavailable or malformed products retryable', async () => {
    findMany.mockResolvedValue([
      product('failed'),
      product('unavailable'),
      product('missing-name', ''),
      product('success'),
    ]);
    infer
      .mockRejectedValueOnce(new Error('provider failed'))
      .mockResolvedValueOnce({ status: 'unavailable' })
      .mockResolvedValueOnce({
        status: 'success',
        provider: 'test-provider',
        model: 'test-model',
        value: {
          kind: ShelfLifePolicyKind.finite,
          shelfLifeDays: 30,
          confidence: 0.8,
          rationale: 'Finite product',
        },
      });

    await expect(service.inferMissingPolicies()).resolves.toEqual({
      processed: 4,
      succeeded: 1,
      skipped: 2,
      failed: 1,
    });
    expect(create).toHaveBeenCalledTimes(1);
    const createInput = firstCall<{
      data: { productId: string };
    }>(create);
    expect(createInput.data.productId).toBe('success');
    expect(stockWorkflow).toHaveBeenCalledWith({
      stage: 'product_failure',
      outcome: 'failure',
      phase: 'shelf_life',
      productId: 'failed',
    });
  });
});
