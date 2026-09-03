import {
  InventoryEventType,
  PredictedState,
  ShelfLifePolicyKind,
} from '../generated/prisma/enums';
import { DailyStockMaterializationService } from './daily-stock-materialization.service';

function firstCall<T>(mock: jest.Mock): T {
  return (mock.mock.calls as unknown as Array<[T]>)[0][0];
}

describe('DailyStockMaterializationService', () => {
  const projection = {
    id: 'projection-1',
    productId: 'product-1',
    estimatedQuantity: 3,
    recordedAt: new Date('2026-09-01T02:00:00.000Z'),
    recordedEventId: 'event-1',
    evaluatedAt: new Date('2026-09-02T02:00:00.000Z'),
  };
  const stockProjection = {
    findUnique: jest.fn(),
    updateMany: jest.fn(),
  };
  const productShelfLifePolicy = { findUnique: jest.fn() };
  const productStatistics = { findUnique: jest.fn() };
  const inventoryEvent = { findFirst: jest.fn() };
  const prediction = { create: jest.fn() };
  const transaction = jest.fn(
    (
      callback: (client: {
        prediction: typeof prediction;
        stockProjection: typeof stockProjection;
      }) => Promise<unknown>,
    ): Promise<unknown> => callback({ prediction, stockProjection }),
  );
  const prisma = {
    stockProjection,
    productShelfLifePolicy,
    productStatistics,
    inventoryEvent,
    prediction,
    $transaction: transaction,
  };
  const service = new DailyStockMaterializationService(prisma as never);

  beforeEach(() => {
    jest.clearAllMocks();
    stockProjection.findUnique.mockResolvedValue(projection);
    stockProjection.updateMany.mockResolvedValue({ count: 1 });
    productShelfLifePolicy.findUnique.mockResolvedValue({
      kind: ShelfLifePolicyKind.finite,
      shelfLifeDays: 10,
      confidence: 0.9,
    });
    productStatistics.findUnique.mockResolvedValue({
      estimatedConsumptionIntervalDays: 2,
    });
    inventoryEvent.findFirst.mockResolvedValue(null);
    prediction.create.mockResolvedValue({ id: 'prediction-1' });
  });

  afterEach(() => jest.useRealTimers());

  it('creates a prediction and narrowly updates the unchanged projection', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-09-03T02:00:00.000Z'));

    await expect(service.evaluateProduct('product-1')).resolves.toMatchObject({
      estimatedQuantity: 2.5,
      predictionId: 'prediction-1',
    });
    expect(prediction.create).toHaveBeenCalledTimes(1);
    const predictionCall = firstCall<{
      data: {
        productId: string;
        predictedState: PredictedState;
        deterministicSignals: Record<string, unknown>;
      };
    }>(prediction.create);
    expect(predictionCall.data.productId).toBe('product-1');
    expect(predictionCall.data.predictedState).toBe(
      PredictedState.likely_available,
    );
    expect(predictionCall.data.deterministicSignals).toMatchObject({
      source: 'daily_stock_workflow',
      elapsedDays: 1,
      expectedConsumption: 0.5,
    });
    expect(stockProjection.updateMany).toHaveBeenCalledWith({
      where: {
        id: projection.id,
        recordedEventId: projection.recordedEventId,
        evaluatedAt: projection.evaluatedAt,
      },
      data: {
        estimatedQuantity: 2.5,
        estimatedState: PredictedState.likely_available,
        confidence: 0.9,
        reason: 'daily_stock_available',
        predictionId: 'prediction-1',
        evaluatedAt: new Date('2026-09-03T02:00:00.000Z'),
      },
    });
    expect(prisma).not.toHaveProperty('inventoryEvent.create');
    const updateCall = firstCall<{
      data: Record<string, unknown>;
    }>(stockProjection.updateMany);
    expect(updateCall.data).not.toHaveProperty('recordedAt');
  });

  it('applies a later explicit low signal', async () => {
    inventoryEvent.findFirst.mockResolvedValue({
      eventType: InventoryEventType.STOCK_LOW,
    });

    await service.evaluateProduct(
      'product-1',
      new Date('2026-09-03T02:00:00.000Z'),
    );

    const updateCall = firstCall<{
      data: Record<string, unknown>;
    }>(stockProjection.updateMany);
    expect(updateCall.data).toMatchObject({
      estimatedState: PredictedState.probably_low,
      confidence: 1,
      reason: 'daily_explicit_low',
    });
  });

  it('does nothing for an untracked product', async () => {
    stockProjection.findUnique.mockResolvedValue(null);

    await expect(service.evaluateProduct('untracked')).resolves.toBeNull();
    expect(transaction).not.toHaveBeenCalled();
  });

  it('rolls back when an explicit write changes the projection concurrently', async () => {
    stockProjection.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      service.evaluateProduct(
        'product-1',
        new Date('2026-09-03T02:00:00.000Z'),
      ),
    ).rejects.toThrow('changed during daily evaluation');
  });
});
