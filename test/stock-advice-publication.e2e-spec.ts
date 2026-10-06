import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../src/prisma/prisma.service';
import { HouseholdService } from '../src/household/household.service';
import { StockEvidenceService } from '../src/estimation/stock-evidence.service';
import { StockAdviceSnapshot } from '../src/inventory/stock-advice-snapshot.service';
import { StockAdviceAttempts } from '../src/inventory/stock-advice-attempts.service';
import { StockAdviceExecutor } from '../src/inventory/stock-advice-executor.service';
import { StockAdviceWriter } from '../src/inventory/stock-advice-writer.service';
import { DailyStockMaterializationService } from '../src/inventory/daily-stock-materialization.service';
import { StockLedgerService } from '../src/inventory/stock-ledger.service';
import { OperationalLogger } from '../src/observability/operational-logger.service';
import type { StockPredictionAdvisor } from '../src/estimation/stock-prediction-advisor';
import { createProductFixture } from './product-fixture';
import type {
  ModelConfig,
  StockWorkflowConfig,
} from '../src/config/application-config';

describe('Stock advice atomic publication (PostgreSQL)', () => {
  const prisma = new PrismaService();
  const household = new HouseholdService(prisma);
  const snapshots = new StockAdviceSnapshot(
    prisma,
    new StockEvidenceService(prisma, household),
    household,
  );
  const attempts = new StockAdviceAttempts(prisma);
  const reason = jest.fn();
  const advisor: StockPredictionAdvisor = { provider: 'typesafe', reason };
  const model = {
    stockPredictionProvider: 'typesafe',
    jevModel: 'jev-1.13.0',
  } as ModelConfig;
  const workflow = { adviceEnabled: true } as StockWorkflowConfig;
  const executor = new StockAdviceExecutor(
    prisma,
    attempts,
    snapshots,
    advisor,
    model,
    workflow,
  );
  const writer = new StockAdviceWriter(
    prisma,
    snapshots,
    model,
    new OperationalLogger(),
  );
  const materialization = new DailyStockMaterializationService(prisma);
  const ledger = new StockLedgerService();
  let productId: string;
  let cutoff: Date;
  beforeAll(async () => {
    await prisma.$connect();
    await household.getOrCreate();
  });
  beforeEach(async () => {
    cutoff = new Date();
    productId = (
      await createProductFixture(prisma, {
        canonicalName: `advice-publication-${randomUUID()}`,
        productType: null,
      })
    ).id;
    const events = await Promise.all(
      [20, 10].map((days) =>
        prisma.inventoryEvent.create({
          data: {
            productId,
            eventType: 'PURCHASED',
            timestamp: new Date(cutoff.getTime() - days * 86400000),
            source: 'e2e',
          },
        }),
      ),
    );
    await prisma.productStatistics.create({
      data: { productId, avgPurchaseIntervalDays: 10, observationCount: 2 },
    });
    await prisma.productShelfLifePolicy.create({
      data: {
        productId,
        kind: 'nonperishable',
        confidence: 1,
        rationale: 'Fixture',
        evaluatedAt: cutoff,
      },
    });
    await prisma.stockProjection.create({
      data: {
        productId,
        unit: 'unit',
        recordedQuantity: null,
        recordedAt: events[1].timestamp,
        recordedSource: 'e2e',
        recordedEventId: events[1].id,
        estimatedQuantity: null,
        estimatedState: 'uncertain',
        confidence: 0.6,
        reason: 'fixture',
        evaluatedAt: cutoff,
      },
    });
    reason.mockReset().mockResolvedValue({
      status: 'success',
      provider: 'typesafe',
      model: 'jev-1.14.0',
      taskVersion: 'jev-stock-prediction-v1',
      value: {
        predictedState: 'probably_low',
        confidence: 0.95,
        reason: 'Fixture evidence',
        recommendedAction: null,
      },
    });
  });
  afterEach(async () => {
    await prisma.llmInferenceLog.deleteMany({
      where: { prediction: { productId } },
    });
    await prisma.stockProjection.deleteMany({ where: { productId } });
    await prisma.productShelfLifePolicy.deleteMany({ where: { productId } });
    await prisma.stockAdviceAttempt.deleteMany({ where: { productId } });
    await prisma.prediction.deleteMany({ where: { productId } });
    await prisma.productStatistics.deleteMany({ where: { productId } });
    await prisma.inventoryEvent.deleteMany({ where: { productId } });
    await prisma.product.delete({ where: { id: productId } });
  });
  afterAll(async () => prisma.$disconnect());
  async function execute() {
    const baseline = await materialization.evaluateProduct(productId, cutoff);
    if (!baseline) throw new Error('Missing baseline');
    const result = await executor.execute(baseline);
    if (!result) throw new Error('Missing advice');
    return result;
  }
  it('publishes agreement and reuses the persisted result after deterministic reevaluation', async () => {
    const e = await execute();
    expect(e.accepted).toBe(true);
    expect(await writer.publish(e)).toBe('applied');
    const projection = await prisma.stockProjection.findUniqueOrThrow({
      where: { productId },
    });
    const prediction = await prisma.prediction.findUniqueOrThrow({
      where: { id: projection.predictionId! },
    });
    expect(projection).toMatchObject({
      estimatedQuantity: null,
      recordedQuantity: null,
      estimatedState: 'probably_low',
      confidence: 0.6,
    });
    expect(prediction).toMatchObject({
      predictedState: projection.estimatedState,
      confidenceScore: projection.confidence,
      modelProviderVersion: 'typesafe/jev-1.14.0',
    });
    const cached = await execute();
    expect(await writer.publish(cached)).toBe('applied');
    expect(reason).toHaveBeenCalledTimes(1);
    expect(
      await prisma.stockAdviceAttempt.count({ where: { productId } }),
    ).toBe(1);
  });
  it.each([
    'purchase',
    'set',
    'consume',
    'low',
    'out',
    'disable',
    'metadata',
    'statistics',
    'evaluation',
  ] as const)(
    'rejects a concurrent %s without an orphan prediction',
    async (operation) => {
      const e = await execute();
      const count = await prisma.prediction.count({ where: { productId } });
      if (operation === 'disable')
        await prisma.product.update({
          where: { id: productId },
          data: { predictionEnabled: false },
        });
      else if (operation === 'metadata')
        await prisma.product.update({
          where: { id: productId },
          data: { category: 'changed' },
        });
      else if (operation === 'statistics')
        await prisma.productStatistics.update({
          where: { productId },
          data: { observationCount: 8 },
        });
      else if (operation === 'evaluation')
        await materialization.evaluateProduct(productId, cutoff);
      else
        await prisma.$transaction(async (tx) => {
          const event = await tx.inventoryEvent.create({
            data: {
              productId,
              timestamp: cutoff,
              source: 'e2e',
              eventType:
                operation === 'low'
                  ? 'STOCK_LOW'
                  : operation === 'out'
                    ? 'STOCK_OUT'
                    : 'STOCK_SET',
            },
          });
          const input = {
            productId,
            eventId: event.id,
            quantity: 3,
            occurredAt: cutoff,
            source: 'e2e',
            reason: 'correction',
          };
          if (operation === 'purchase')
            await ledger.resetWithinTransaction(tx, input);
          if (operation === 'set') await ledger.setWithinTransaction(tx, input);
          if (operation === 'consume') {
            await ledger.setWithinTransaction(tx, input);
            await ledger.decrementWithinTransaction(tx, {
              ...input,
              quantity: 1,
            });
          }
          if (operation === 'low' || operation === 'out')
            await ledger.applyObservationWithinTransaction(tx, {
              ...input,
              state: operation === 'low' ? 'probably_low' : 'probably_out',
            });
        });
      const before = await prisma.stockProjection.findUniqueOrThrow({
        where: { productId },
      });
      expect(await writer.publish(e)).toBe('stale');
      expect(
        await prisma.stockProjection.findUnique({ where: { productId } }),
      ).toEqual(before);
      expect(await prisma.prediction.count({ where: { productId } })).toBe(
        count + (operation === 'evaluation' ? 1 : 0),
      );
      expect(
        await prisma.stockAdviceAttempt.findUnique({
          where: { id: e.attemptId },
        }),
      ).toMatchObject({ applicationStatus: 'stale' });
    },
  );
  it('rolls back Prediction creation when the guarded update loses its revision', async () => {
    const e = await execute();
    const before = await prisma.stockProjection.findUniqueOrThrow({
      where: { productId },
    });
    const count = await prisma.prediction.count({ where: { productId } });
    const originalRead = snapshots.read.bind(
      snapshots,
    ) as StockAdviceSnapshot['read'];
    const spy = jest
      .spyOn(snapshots, 'read')
      .mockImplementation(async (baseline, model, tx) => {
        const result = await originalRead(baseline, model, tx);
        if (tx)
          await tx.stockProjection.update({
            where: { productId },
            data: { revision: { increment: 1 } },
          });
        return result;
      });
    try {
      expect(await writer.publish(e)).toBe('stale');
    } finally {
      spy.mockRestore();
    }
    expect(await prisma.prediction.count({ where: { productId } })).toBe(count);
    expect(
      await prisma.stockProjection.findUnique({ where: { productId } }),
    ).toEqual(before);
  });

  it('keeps valid rejected advice and suppresses duplicate calls', async () => {
    reason.mockResolvedValue({
      status: 'success',
      provider: 'typesafe',
      model: 'jev-1.14.0',
      taskVersion: 'jev-stock-prediction-v1',
      value: {
        predictedState: 'uncertain',
        confidence: 0.95,
        reason: 'Insufficient evidence',
        recommendedAction: null,
      },
    });
    const e = await execute();
    expect(e.accepted).toBe(false);
    expect(await writer.publish(e)).toBe('not_applied');
    await execute();
    expect(reason).toHaveBeenCalledTimes(1);
    expect(
      await prisma.llmInferenceLog.findFirst({
        where: { predictionId: e.baseline.predictionId },
      }),
    ).toMatchObject({
      structuredResponse: {
        version: 'daily-stock-advice-v1',
        accepted: false,
        applicationStatus: 'not_applied',
      },
    });
  });
});
