import {
  ProductNameKind,
  ShelfLifePolicyKind,
} from '../generated/prisma/enums';
import { ShelfLifeInferenceService } from './shelf-life-inference.service';
import type {
  ShelfLifePolicyInput,
  ShelfLifePolicyResult,
} from './shelf-life-policy';

function firstCall<T>(mock: jest.Mock): T {
  return (mock.mock.calls as unknown as Array<[T]>)[0][0];
}

describe('ShelfLifeInferenceService', () => {
  const findMany = jest.fn();
  const create = jest.fn();
  const infer = jest.fn();
  const stockWorkflow = jest.fn();
  const write = jest.fn();
  const record = jest.fn();
  const prisma = {
    product: { findMany },
    productShelfLifePolicy: { create },
  };
  const service = new ShelfLifeInferenceService(
    prisma as never,
    { infer },
    { stockWorkflow } as never,
    { write } as never,
    { record } as never,
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
    record.mockReset();
    write.mockImplementation(
      (_input: ShelfLifePolicyInput, result: ShelfLifePolicyResult) =>
        Promise.resolve(
          result.status === 'resolved' ? 'applied' : 'unresolved',
        ),
    );
  });

  it('selects policy-free products and persists successful provenance', async () => {
    findMany.mockResolvedValue([product('one')]);
    infer.mockResolvedValue({
      status: 'resolved',
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
    expect(write).toHaveBeenCalledWith(
      expect.objectContaining({ productId: 'one', context: null }),
      expect.objectContaining({
        status: 'resolved',
        provider: 'test-provider',
        model: 'test-model',
      }),
      evaluatedAt,
    );
  });

  it('passes unknown perishability as null instead of false', async () => {
    findMany.mockResolvedValue([{ ...product('unknown'), isPerishable: null }]);
    infer.mockResolvedValue({ status: 'unresolved' });
    await service.inferMissingPolicies();
    expect(infer).toHaveBeenCalledWith(
      expect.objectContaining({ isPerishable: null }),
    );
    expect(create).not.toHaveBeenCalled();
  });
  it('does not invoke providers for an empty missing-policy query', async () => {
    findMany.mockResolvedValue([]);
    expect(await service.inferMissingPolicies()).toEqual({
      processed: 0,
      succeeded: 0,
      skipped: 0,
      failed: 0,
    });
    expect(infer).not.toHaveBeenCalled();
  });
  it('isolates logger failures after applying a valid policy', async () => {
    findMany.mockResolvedValue([product('one')]);
    infer.mockResolvedValue({ status: 'resolved' });
    record.mockRejectedValue(new Error('log unavailable'));
    expect(await service.inferMissingPolicies()).toEqual({
      processed: 1,
      succeeded: 1,
      skipped: 0,
      failed: 0,
    });
  });
  it.each(['reused', 'stale'])(
    'counts %s policies as skipped',
    async (outcome) => {
      findMany.mockResolvedValue([product('one')]);
      infer.mockResolvedValue({ status: 'resolved' });
      write.mockResolvedValue(outcome);
      expect(await service.inferMissingPolicies()).toEqual({
        processed: 1,
        succeeded: 0,
        skipped: 1,
        failed: 0,
      });
    },
  );

  it('isolates failures and leaves unavailable or malformed products retryable', async () => {
    findMany.mockResolvedValue([
      product('failed'),
      product('unavailable'),
      product('missing-name', ''),
      product('success'),
    ]);
    infer
      .mockRejectedValueOnce(new Error('provider failed'))
      .mockResolvedValueOnce({ status: 'unresolved' })
      .mockResolvedValueOnce({
        status: 'resolved',
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
    expect(write).toHaveBeenCalledTimes(2);
    expect(
      (write.mock.calls as unknown as Array<[ShelfLifePolicyInput]>)[1][0]
        .productId,
    ).toBe('success');
    expect(stockWorkflow).toHaveBeenCalledWith({
      stage: 'product_failure',
      outcome: 'failure',
      phase: 'shelf_life',
      productId: 'failed',
    });
  });
});
