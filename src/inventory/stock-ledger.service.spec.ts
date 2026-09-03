import { PredictedState } from '../generated/prisma/enums';
import {
  StockLedgerException,
  StockStateConflictException,
} from './stock-ledger.exception';
import { StockLedgerService } from './stock-ledger.service';
import { StockLedgerTransaction } from './types/stock-ledger';

describe('StockLedgerService', () => {
  interface ProjectionRecord {
    productId: string;
    unit: string;
    recordedQuantity?: number;
    recordedEventId?: string;
    estimatedQuantity?: number | null;
    estimatedState?: PredictedState;
    confidence?: number;
    evaluatedAt?: Date;
  }

  interface UpsertArguments {
    where: { productId: string };
    create: Record<string, unknown>;
    update: Record<string, unknown>;
  }

  interface UpdateArguments {
    where: { productId: string };
    data: Record<string, unknown>;
  }

  const service = new StockLedgerService();
  const stockProjection = {
    findUnique: jest.fn<(args: unknown) => Promise<ProjectionRecord | null>>(),
    upsert: jest.fn<(args: UpsertArguments) => Promise<unknown>>(),
    update: jest.fn<(args: UpdateArguments) => Promise<unknown>>(),
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
    stockProjection.update.mockResolvedValue({});
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
      recordedAt: new Date('2026-09-02T10:00:01.000Z'),
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

  it('stores a backdated purchase fact with its forward-materialized estimate', async () => {
    const evaluatedAt = new Date('2026-09-03T10:00:00.000Z');

    await service.resetWithinTransaction(tx, {
      ...baseFact,
      explicitUnit: 'liter',
      materialization: {
        estimatedQuantity: 0.5,
        estimatedState: PredictedState.likely_available,
        confidence: 0.8,
        reason: 'purchase_forward_estimated',
        evaluatedAt,
      },
    });

    expect(lastUpsert().create).toMatchObject({
      recordedQuantity: 2,
      recordedAt: baseFact.occurredAt,
      estimatedQuantity: 0.5,
      confidence: 0.8,
      reason: 'purchase_forward_estimated',
      evaluatedAt,
    });
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

  it('sets a first absolute balance', async () => {
    await service.setWithinTransaction(tx, {
      ...baseFact,
      explicitUnit: 'liter',
      reason: 'stock_set',
    });

    expect(lastUpsert().create).toMatchObject({
      productId: 'product-1',
      unit: 'liter',
      recordedQuantity: 2,
      estimatedQuantity: 2,
      estimatedState: PredictedState.likely_available,
      recordedEventId: 'event-1',
    });
  });

  it('treats an explicit set unit as confirmed replacement', async () => {
    stockProjection.findUnique.mockResolvedValue({
      productId: 'product-1',
      unit: 'liter',
      recordedQuantity: 9,
      estimatedQuantity: 9,
    });

    await service.setWithinTransaction(tx, {
      ...baseFact,
      explicitUnit: 'carton',
      reason: 'stock_set',
    });

    expect(lastUpsert().update).toMatchObject({
      unit: 'carton',
      recordedQuantity: 2,
      estimatedQuantity: 2,
    });
  });

  it('retains the established unit when a set omits it', async () => {
    stockProjection.findUnique.mockResolvedValue({
      productId: 'product-1',
      unit: 'liter',
      estimatedQuantity: 2,
    });

    await service.setWithinTransaction(tx, {
      ...baseFact,
      reason: 'stock_set',
    });

    expect(lastUpsert().update).toMatchObject({ unit: 'liter' });
  });

  it.each([
    null,
    { productId: 'product-1', unit: 'item', estimatedQuantity: null },
  ])('rejects decrement without a numeric estimate', async (projection) => {
    stockProjection.findUnique.mockResolvedValue(projection);

    await expect(
      service.decrementWithinTransaction(tx, {
        ...baseFact,
        quantity: 1,
        reason: 'stock_decremented',
      }),
    ).rejects.toThrow(StockStateConflictException);
    expect(stockProjection.update).not.toHaveBeenCalled();
  });

  it('rejects a decrement unit that conflicts with the ledger', async () => {
    stockProjection.findUnique.mockResolvedValue({
      productId: 'product-1',
      unit: 'liter',
      estimatedQuantity: 2,
      estimatedState: PredictedState.likely_available,
    });

    await expect(
      service.decrementWithinTransaction(tx, {
        ...baseFact,
        quantity: 1,
        explicitUnit: 'carton',
        reason: 'stock_decremented',
      }),
    ).rejects.toThrow(StockLedgerException);
  });

  it('decrements the estimate while preserving absolute fact and uncertainty', async () => {
    stockProjection.findUnique.mockResolvedValue({
      productId: 'product-1',
      unit: 'item',
      recordedQuantity: 5,
      recordedEventId: 'recorded-event',
      estimatedQuantity: 3,
      estimatedState: PredictedState.probably_low,
      confidence: 0.6,
    });

    await service.decrementWithinTransaction(tx, {
      ...baseFact,
      quantity: 1,
      explicitUnit: 'item',
      reason: 'stock_decremented',
    });

    expect(lastUpdate().data).toMatchObject({
      estimatedQuantity: 2,
      estimatedState: PredictedState.probably_low,
      reason: 'stock_decremented',
      predictionId: null,
    });
    expect(lastUpdate().data).not.toHaveProperty('recordedQuantity');
    expect(lastUpdate().data).not.toHaveProperty('recordedEventId');
    expect(lastUpdate().data).not.toHaveProperty('confidence');
  });

  it('clamps an over-decrement at zero and marks the estimate out', async () => {
    stockProjection.findUnique.mockResolvedValue({
      productId: 'product-1',
      unit: 'item',
      estimatedQuantity: 1,
      estimatedState: PredictedState.likely_available,
    });

    await service.decrementWithinTransaction(tx, {
      ...baseFact,
      quantity: 4,
      reason: 'stock_decremented',
    });

    expect(lastUpdate().data).toMatchObject({
      estimatedQuantity: 0,
      estimatedState: PredictedState.probably_out,
    });
  });

  it('marks untracked and already-out stock at an explicit zero balance', async () => {
    await service.markOutWithinTransaction(tx, {
      productId: 'product-1',
      eventId: 'event-1',
      occurredAt: baseFact.occurredAt,
      source: 'mcp',
      reason: 'stock_marked_out',
      typicalUnit: 'item',
    });
    expect(lastUpsert().create).toMatchObject({
      recordedQuantity: 0,
      estimatedQuantity: 0,
      estimatedState: PredictedState.probably_out,
    });

    stockProjection.findUnique.mockResolvedValue({
      productId: 'product-1',
      unit: 'item',
      recordedQuantity: 0,
      estimatedQuantity: 0,
      estimatedState: PredictedState.probably_out,
    });
    await service.markOutWithinTransaction(tx, {
      productId: 'product-1',
      eventId: 'event-2',
      occurredAt: baseFact.occurredAt,
      source: 'mcp',
      reason: 'stock_marked_out',
    });
    expect(lastUpsert().update).toMatchObject({
      recordedQuantity: 0,
      recordedEventId: 'event-2',
      estimatedQuantity: 0,
    });
  });

  it.each(['set', 'decrement', 'mark_out'] as const)(
    'does not let a stale %s replace a newer projection',
    async (operation) => {
      const newerProjection = {
        productId: 'product-1',
        unit: 'item',
        recordedQuantity: 7,
        recordedEventId: 'newer-event',
        estimatedQuantity: 7,
        estimatedState: PredictedState.likely_available,
        evaluatedAt: new Date('2026-09-02T10:00:01.000Z'),
      };
      stockProjection.findUnique.mockResolvedValue(newerProjection);

      const common = { ...baseFact, reason: `stock_${operation}` };
      if (operation === 'set') {
        await service.setWithinTransaction(tx, common);
      } else if (operation === 'decrement') {
        await service.decrementWithinTransaction(tx, common);
      } else {
        await service.markOutWithinTransaction(tx, common);
      }

      expect(stockProjection.upsert).not.toHaveBeenCalled();
      expect(stockProjection.update).not.toHaveBeenCalled();
    },
  );

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

  function lastUpdate(): UpdateArguments {
    const calls = stockProjection.update.mock.calls as unknown as Array<
      [UpdateArguments]
    >;
    const call = calls.at(-1);
    if (!call) {
      throw new Error('Expected stock projection update');
    }
    return call[0];
  }
});
