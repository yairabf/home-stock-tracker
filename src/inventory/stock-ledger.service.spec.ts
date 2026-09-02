import { PredictedState } from '../generated/prisma/enums';
import { StockLedgerException } from './stock-ledger.exception';
import { StockLedgerService } from './stock-ledger.service';
import { StockLedgerTransaction } from './types/stock-ledger';

describe('StockLedgerService', () => {
  interface ProjectionRecord {
    productId: string;
    unit: string;
    recordedQuantity?: number;
    recordedEventId?: string;
    estimatedQuantity?: number;
    evaluatedAt?: Date;
  }

  interface UpsertArguments {
    where: { productId: string };
    create: Record<string, unknown>;
    update: Record<string, unknown>;
  }

  const service = new StockLedgerService();
  const stockProjection = {
    findUnique: jest.fn<(args: unknown) => Promise<ProjectionRecord | null>>(),
    upsert: jest.fn<(args: UpsertArguments) => Promise<unknown>>(),
  };
  const tx = { stockProjection } as unknown as StockLedgerTransaction;
  const baseFact = {
    productId: 'product-1',
    eventId: 'event-1',
    quantity: 2,
    occurredAt: new Date('2026-09-02T10:00:00.000Z'),
    source: 'mcp',
    reason: 'purchase_recorded',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    stockProjection.findUnique.mockResolvedValue(null);
    stockProjection.upsert.mockResolvedValue({});
  });

  it.each([
    [
      { explicitUnit: ' liter ', groceryUnit: 'carton', typicalUnit: 'unit' },
      'liter',
    ],
    [{ groceryUnit: ' carton ', typicalUnit: 'unit' }, 'carton'],
    [{ typicalUnit: ' unit ' }, 'unit'],
    [{}, 'item'],
  ])('resolves the canonical unit by precedence', (input, expected) => {
    expect(service.resolveCanonicalUnit(input)).toBe(expected);
  });

  it('preserves an established unit when no new unit is supplied', () => {
    expect(
      service.resolveCanonicalUnit({
        existingUnit: 'liter',
        typicalUnit: 'carton',
      }),
    ).toBe('liter');
  });

  it('rejects a supplied unit that conflicts with the established unit', () => {
    expect(() =>
      service.resolveCanonicalUnit({
        existingUnit: 'liter',
        explicitUnit: 'carton',
      }),
    ).toThrow(StockLedgerException);
  });

  it.each(['', '   '])('rejects a blank explicit unit', (explicitUnit) => {
    expect(() => service.resolveCanonicalUnit({ explicitUnit })).toThrow(
      StockLedgerException,
    );
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects invalid reset quantity %s',
    async (quantity) => {
      await expect(
        service.resetWithinTransaction(tx, { ...baseFact, quantity }),
      ).rejects.toThrow(StockLedgerException);
      expect(stockProjection.upsert).not.toHaveBeenCalled();
    },
  );

  it('creates a fully materialized reset for the first stock fact', async () => {
    await service.resetWithinTransaction(tx, {
      ...baseFact,
      explicitUnit: 'liter',
    });

    expect(lastUpsert().where).toEqual({ productId: 'product-1' });
    expect(lastUpsert().create).toMatchObject({
      productId: 'product-1',
      unit: 'liter',
      recordedQuantity: 2,
      recordedEventId: 'event-1',
      estimatedQuantity: 2,
      estimatedState: PredictedState.likely_available,
    });
  });

  it('resets an existing estimate without adding to it', async () => {
    stockProjection.findUnique.mockResolvedValue({
      productId: 'product-1',
      unit: 'liter',
      estimatedQuantity: 9,
    });

    await service.resetWithinTransaction(tx, {
      ...baseFact,
      explicitUnit: 'liter',
    });

    expect(lastUpsert().update).toMatchObject({
      recordedQuantity: 2,
      estimatedQuantity: 2,
    });
  });

  it('does not let an older reset replace a newer projection', async () => {
    const newerProjection = {
      productId: 'product-1',
      unit: 'liter',
      recordedQuantity: 7,
      recordedEventId: 'newer-event',
      estimatedQuantity: 7,
      evaluatedAt: new Date('2026-09-02T10:00:01.000Z'),
    };
    stockProjection.findUnique.mockResolvedValue(newerProjection);

    await expect(
      service.resetWithinTransaction(tx, {
        ...baseFact,
        explicitUnit: 'liter',
      }),
    ).resolves.toBe(newerProjection);
    expect(stockProjection.upsert).not.toHaveBeenCalled();
  });

  it('materializes an out observation at zero', async () => {
    await service.applyObservationWithinTransaction(tx, {
      ...baseFact,
      state: PredictedState.probably_out,
      typicalUnit: 'unit',
    });

    expect(lastUpsert().create).toMatchObject({
      recordedQuantity: 0,
      estimatedQuantity: 0,
      estimatedState: PredictedState.probably_out,
    });
  });

  it('creates a low-only projection without inventing quantity', async () => {
    await service.applyObservationWithinTransaction(tx, {
      ...baseFact,
      state: PredictedState.probably_low,
      typicalUnit: 'unit',
    });

    expect(lastUpsert().create).toMatchObject({
      recordedQuantity: null,
      estimatedQuantity: null,
      estimatedState: PredictedState.probably_low,
    });
  });

  it('preserves the recorded fact when low overrides an existing estimate', async () => {
    stockProjection.findUnique.mockResolvedValue({
      productId: 'product-1',
      unit: 'liter',
      recordedQuantity: 4,
      recordedEventId: 'prior-event',
      estimatedQuantity: 3,
    });

    await service.applyObservationWithinTransaction(tx, {
      ...baseFact,
      state: PredictedState.probably_low,
    });

    const update = lastUpsert().update;
    expect(update).toMatchObject({
      estimatedState: PredictedState.probably_low,
      unit: 'liter',
    });
    expect(update).not.toHaveProperty('recordedQuantity');
    expect(update).not.toHaveProperty('recordedEventId');
    expect(update).not.toHaveProperty('estimatedQuantity');
  });

  it('does not let an older observation replace a newer projection', async () => {
    const newerProjection = {
      productId: 'product-1',
      unit: 'liter',
      recordedQuantity: 0,
      recordedEventId: 'newer-event',
      estimatedQuantity: 0,
      evaluatedAt: new Date('2026-09-02T10:00:01.000Z'),
    };
    stockProjection.findUnique.mockResolvedValue(newerProjection);

    await expect(
      service.applyObservationWithinTransaction(tx, {
        ...baseFact,
        state: PredictedState.probably_low,
      }),
    ).resolves.toBe(newerProjection);
    expect(stockProjection.upsert).not.toHaveBeenCalled();
  });

  function lastUpsert(): UpsertArguments {
    const calls = stockProjection.upsert.mock.calls as unknown as Array<
      [UpsertArguments]
    >;
    const call = calls.at(-1);
    if (!call) {
      throw new Error('Expected stock projection upsert');
    }
    return call[0];
  }
});
