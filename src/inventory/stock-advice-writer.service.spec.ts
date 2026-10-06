import { StockAdviceWriter } from './stock-advice-writer.service';
import { stockCandidate } from '../estimation/stock-prediction.fixture';
import type { ExecutedStockAdvice } from './stock-advice-executor.service';

function execution(): ExecutedStockAdvice {
  return {
    baseline: {
      productId: 'p',
      projectionId: 'proj',
      revision: 3,
      predictionId: 'deterministic',
      evaluatedAt: new Date(),
      estimatedQuantity: null,
      estimatedState: 'uncertain',
      confidence: 0.6,
      reason: 'daily_stock_uncertain',
    },
    snapshot: { candidate: stockCandidate(), fingerprint: 'f' },
    attemptId: 'a',
    accepted: true,
    result: null,
    advice: {
      status: 'success',
      provider: 'typesafe',
      model: 'jev-1.14.0',
      taskVersion: 'jev-stock-prediction-v1',
      value: {
        predictedState: 'probably_low',
        confidence: 0.95,
        reason: 'Evidence',
        recommendedAction: null,
      },
    },
  };
}
describe('StockAdviceWriter', () => {
  const read = jest.fn();
  const create = jest.fn();
  const updateMany = jest.fn();
  const update = jest.fn();
  const logCreate = jest.fn();
  const logger = { predictionRun: jest.fn(), predictionPersistence: jest.fn() };
  const tx = {
    $queryRaw: jest.fn(),
    prediction: {
      findUniqueOrThrow: jest.fn().mockResolvedValue({
        deterministicSignals: { source: 'daily_stock_workflow' },
      }),
      create,
    },
    stockProjection: { updateMany },
    stockAdviceAttempt: { update },
  };
  const prisma = {
    $transaction: jest.fn((fn: (db: typeof tx) => Promise<unknown>) => fn(tx)),
    stockAdviceAttempt: { update },
    llmInferenceLog: { create: logCreate },
  };
  const writer = new StockAdviceWriter(
    prisma as never,
    { read } as never,
    { jevModel: 'jev-1.13.0' } as never,
    logger as never,
  );
  beforeEach(() => {
    jest.clearAllMocks();
    read.mockResolvedValue(execution().snapshot);
    create.mockResolvedValue({ id: 'accepted' });
    updateMany.mockResolvedValue({ count: 1 });
    update.mockResolvedValue({});
    logCreate.mockResolvedValue({});
  });
  it('atomically links a conservative prediction and never writes quantities', async () => {
    await expect(writer.publish(execution())).resolves.toBe('applied');
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: 'proj', revision: 3, predictionId: 'deterministic' },
      data: containing({
        estimatedState: 'probably_low',
        confidence: 0.6,
        predictionId: 'accepted',
        revision: { increment: 1 },
      }),
    });
    const data = (updateMany.mock.calls[0] as [{ data: object }])[0].data;
    expect(data).not.toHaveProperty('estimatedQuantity');
    expect(data).not.toHaveProperty('recordedQuantity');
    expect(create).toHaveBeenCalledWith(
      containing({
        data: containing({
          modelProviderVersion: 'typesafe/jev-1.14.0',
        }),
      }),
    );
  });
  it.each([null, { ...execution().snapshot, fingerprint: 'changed' }])(
    'does not publish changed evidence %p',
    async (snapshot) => {
      read.mockResolvedValue(snapshot);
      await expect(writer.publish(execution())).resolves.toBe('stale');
      expect(create).not.toHaveBeenCalled();
      expect(logCreate).toHaveBeenCalledWith(
        containing({
          data: containing({
            structuredResponse: containing({
              accepted: true,
              applicationStatus: 'stale',
            }),
          }),
        }),
      );
    },
  );
  it('throws within the transaction on a lost projection compare-and-swap', async () => {
    updateMany.mockResolvedValue({ count: 0 });
    await expect(writer.publish(execution())).resolves.toBe('stale');
    expect(update).toHaveBeenCalledWith(
      containing({ data: { applicationStatus: 'stale' } }),
    );
  });
  it('retains deterministic stock on publication persistence failure', async () => {
    create.mockRejectedValueOnce(new Error('db'));
    await expect(writer.publish(execution())).resolves.toBe(
      'persistence_failed',
    );
    expect(updateMany).not.toHaveBeenCalled();
  });
  it('keeps an applied prediction when only logging fails', async () => {
    logCreate.mockRejectedValueOnce(new Error('log'));
    await expect(writer.publish(execution())).resolves.toBe('applied');
    expect(logger.predictionPersistence).toHaveBeenCalled();
  });
  it('logs rejection without creating a second prediction', async () => {
    const e = execution();
    e.accepted = false;
    await expect(writer.publish(e)).resolves.toBe('not_applied');
    expect(create).not.toHaveBeenCalled();
    expect(logCreate).toHaveBeenCalledWith(
      containing({
        data: containing({ predictionId: 'deterministic' }),
      }),
    );
  });
});

function containing(value: Record<string, unknown>): unknown {
  return expect.objectContaining(value) as unknown;
}
