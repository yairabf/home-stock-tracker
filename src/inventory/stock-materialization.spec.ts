import { PredictedState, ShelfLifePolicyKind } from '../generated/prisma/enums';
import {
  StockMaterializationException,
  materializeDailyStock,
  materializeStockForward,
} from './stock-materialization';
import type { ForwardStockMaterializationInput } from './types/stock-materialization';

describe('materializeStockForward', () => {
  const purchasedAt = new Date('2026-09-01T08:00:00.000Z');
  const finitePolicy = {
    kind: ShelfLifePolicyKind.finite,
    shelfLifeDays: 10,
    confidence: 0.9,
  };
  const baseInput: ForwardStockMaterializationInput = {
    quantity: 5,
    purchasedAt,
    evaluatedAt: new Date('2026-09-03T08:00:00.000Z'),
    shelfLifePolicy: finitePolicy,
    estimatedConsumptionIntervalDays: 2,
  };

  afterEach(() => jest.useRealTimers());

  it('keeps a current-time purchase as a full-confidence explicit fact', () => {
    jest.useFakeTimers().setSystemTime(purchasedAt);

    expect(
      materializeStockForward({
        ...baseInput,
        evaluatedAt: new Date(),
      }),
    ).toEqual({
      estimatedQuantity: 5,
      estimatedState: PredictedState.likely_available,
      confidence: 1,
      reason: 'purchase_recorded',
      evaluatedAt: purchasedAt,
    });
  });

  it('subtracts expected consumption while preserving decimal precision', () => {
    expect(materializeStockForward(baseInput)).toMatchObject({
      estimatedQuantity: 4,
      estimatedState: PredictedState.likely_available,
      confidence: 0.9,
      reason: 'purchase_forward_estimated',
    });

    expect(
      materializeStockForward({
        ...baseInput,
        quantity: 2.75,
        evaluatedAt: new Date('2026-09-02T08:00:00.000Z'),
      }).estimatedQuantity,
    ).toBe(2.25);
  });

  it('clamps consumed stock at zero', () => {
    expect(
      materializeStockForward({ ...baseInput, quantity: 0.5 }),
    ).toMatchObject({
      estimatedQuantity: 0,
      estimatedState: PredictedState.probably_out,
    });
  });

  it('forces finite stock to zero at shelf-life expiry', () => {
    expect(
      materializeStockForward({
        ...baseInput,
        shelfLifePolicy: { ...finitePolicy, shelfLifeDays: 2 },
        estimatedConsumptionIntervalDays: null,
      }),
    ).toMatchObject({
      estimatedQuantity: 0,
      estimatedState: PredictedState.probably_out,
      confidence: 0.9,
      reason: 'stock_expired',
    });
  });

  it('does not expire a nonperishable product', () => {
    expect(
      materializeStockForward({
        ...baseInput,
        shelfLifePolicy: {
          kind: ShelfLifePolicyKind.nonperishable,
          shelfLifeDays: null,
          confidence: 0.95,
        },
        estimatedConsumptionIntervalDays: null,
      }),
    ).toMatchObject({
      estimatedQuantity: 5,
      confidence: 0.75,
      reason: 'purchase_forward_estimated_missing_consumption',
    });
  });

  it.each([
    [
      'shelf life',
      null,
      2,
      4,
      0.8,
      'purchase_forward_estimated_missing_shelf_life',
    ],
    [
      'consumption',
      finitePolicy,
      null,
      5,
      0.7,
      'purchase_forward_estimated_missing_consumption',
    ],
    [
      'both inputs',
      null,
      null,
      5,
      0.6,
      'purchase_forward_estimated_missing_shelf_life_and_consumption',
    ],
  ])(
    'uses a deterministic fallback when missing %s',
    (
      _label,
      shelfLifePolicy,
      estimatedConsumptionIntervalDays,
      estimatedQuantity,
      confidence,
      reason,
    ) => {
      expect(
        materializeStockForward({
          ...baseInput,
          shelfLifePolicy,
          estimatedConsumptionIntervalDays,
        }),
      ).toMatchObject({ estimatedQuantity, confidence, reason });
    },
  );

  it('rejects evaluation before the purchase timestamp', () => {
    expect(() =>
      materializeStockForward({
        ...baseInput,
        evaluatedAt: new Date('2026-08-31T08:00:00.000Z'),
      }),
    ).toThrow(StockMaterializationException);
  });

  it.each([
    { ...finitePolicy, shelfLifeDays: null },
    { ...finitePolicy, shelfLifeDays: 0 },
    { ...finitePolicy, confidence: 1.1 },
    {
      kind: ShelfLifePolicyKind.nonperishable,
      shelfLifeDays: 1,
      confidence: 0.9,
    },
  ])('rejects malformed internal shelf-life evidence %#', (shelfLifePolicy) => {
    expect(() =>
      materializeStockForward({ ...baseInput, shelfLifePolicy }),
    ).toThrow(StockMaterializationException);
  });
});

describe('materializeDailyStock', () => {
  const baseInput = {
    estimatedQuantity: 3,
    recordedAt: new Date('2026-09-01T02:00:00.000Z'),
    previousEvaluatedAt: new Date('2026-09-02T02:00:00.000Z'),
    evaluatedAt: new Date('2026-09-03T02:00:00.000Z'),
    shelfLifePolicy: {
      kind: ShelfLifePolicyKind.finite,
      shelfLifeDays: 10,
      confidence: 0.9,
    },
    estimatedConsumptionIntervalDays: 2,
    explicitState: null,
  };

  it('decays incrementally from the previous estimate without double counting', () => {
    const first = materializeDailyStock(baseInput);
    const second = materializeDailyStock({
      ...baseInput,
      estimatedQuantity: first.estimatedQuantity,
      previousEvaluatedAt: first.evaluatedAt,
      evaluatedAt: new Date('2026-09-04T02:00:00.000Z'),
    });

    expect(first.estimatedQuantity).toBe(2.5);
    expect(second.estimatedQuantity).toBe(2);
    expect(second.expectedConsumption).toBe(0.5);
  });

  it('preserves decimal precision and classifies one consumption unit as low', () => {
    expect(
      materializeDailyStock({ ...baseInput, estimatedQuantity: 0.75 }),
    ).toMatchObject({
      estimatedQuantity: 0.25,
      estimatedState: PredictedState.probably_low,
      reason: 'daily_stock_low',
    });
  });

  it('forces expired finite stock to zero but does not expire nonperishable stock', () => {
    expect(
      materializeDailyStock({
        ...baseInput,
        shelfLifePolicy: { ...baseInput.shelfLifePolicy, shelfLifeDays: 2 },
      }),
    ).toMatchObject({
      estimatedQuantity: 0,
      reason: 'daily_stock_expired',
    });
    expect(
      materializeDailyStock({
        ...baseInput,
        shelfLifePolicy: {
          kind: ShelfLifePolicyKind.nonperishable,
          shelfLifeDays: null,
          confidence: 0.9,
        },
      }),
    ).toMatchObject({
      estimatedQuantity: 2.5,
      reason: 'daily_stock_available',
    });
  });

  it('uses reduced-confidence fallback when shelf-life evidence is missing', () => {
    expect(
      materializeDailyStock({ ...baseInput, shelfLifePolicy: null }),
    ).toMatchObject({ estimatedQuantity: 2.5, confidence: 0.8 });
  });

  it.each([
    [PredictedState.probably_out, 0, 'daily_explicit_out'],
    [PredictedState.probably_low, 2.5, 'daily_explicit_low'],
  ] as const)(
    'keeps explicit %s precedence',
    (explicitState, estimatedQuantity, reason) => {
      expect(
        materializeDailyStock({ ...baseInput, explicitState }),
      ).toMatchObject({ estimatedQuantity, reason });
    },
  );

  it('keeps quantity-free projections uncertain without an explicit signal', () => {
    expect(
      materializeDailyStock({ ...baseInput, estimatedQuantity: null }),
    ).toMatchObject({
      estimatedQuantity: null,
      estimatedState: PredictedState.uncertain,
      reason: 'daily_stock_uncertain',
    });
  });
});
