import 'dotenv/config';
import { PrismaService } from '../src/prisma/prisma.service';
import { StockAdviceExecutor } from '../src/inventory/stock-advice-executor.service';
import { stockCandidate } from '../src/estimation/stock-prediction.fixture';
import { StockAdviceAttempts } from '../src/inventory/stock-advice-attempts.service';
import { createProductFixture } from './product-fixture';

describe('Stock advice durable storage (e2e)', () => {
  const prisma = new PrismaService();
  const attempts = new StockAdviceAttempts(prisma);
  let productId: string;
  beforeAll(async () => {
    await prisma.$connect();
    productId = (
      await createProductFixture(prisma, {
        canonicalName: 'Advice storage fixture',
      })
    ).id;
  });
  afterAll(async () => {
    await prisma.product.delete({ where: { id: productId } });
    await prisma.$disconnect();
  });
  it('has one owner across simultaneous reservations and survives a new repository', async () => {
    const input = {
      productId,
      fingerprint: 'concurrent-fingerprint',
      taskVersion: 'jev-stock-prediction-v1',
      configuredModel: 'jev-1.13.0',
    };
    const results = await Promise.all(
      Array.from({ length: 4 }, () => attempts.reserve(input)),
    );
    expect(results.filter((r) => r.owned)).toHaveLength(1);
    expect(new Set(results.map((r) => r.attempt.id)).size).toBe(1);
    await expect(
      new StockAdviceAttempts(prisma).reserve(input),
    ).resolves.toMatchObject({ owned: false, attempt: { status: 'reserved' } });
    expect(
      await prisma.stockAdviceAttempt.count({ where: { productId } }),
    ).toBe(1);
  });
  it('abandons an interrupted reservation without issuing a new provider call', async () => {
    await prisma.stockAdviceAttempt.create({
      data: {
        productId,
        fingerprint: 'interrupted',
        taskVersion: 'jev-stock-prediction-v1',
        configuredModel: 'jev-1.13.0',
        createdAt: new Date(Date.now() - 60000),
      },
    });
    const reason = jest.fn();
    const executor = new StockAdviceExecutor(
      prisma,
      attempts,
      {
        read: jest.fn().mockResolvedValue({
          candidate: stockCandidate(),
          fingerprint: 'interrupted',
        }),
      } as never,
      { provider: 'typesafe', reason },
      { stockPredictionProvider: 'typesafe', jevModel: 'jev-1.13.0' } as never,
      { adviceEnabled: true } as never,
    );
    const baseline = {
      productId,
      projectionId: 'p',
      revision: 1,
      predictionId: 'prediction',
      evaluatedAt: new Date(),
      estimatedQuantity: null,
      estimatedState: 'uncertain' as const,
      confidence: 0.6,
      reason: 'daily_stock_uncertain',
    };
    expect(await executor.execute(baseline)).toBeNull();
    expect(await executor.execute(baseline)).toBeNull();
    expect(reason).not.toHaveBeenCalled();
    expect(
      await prisma.stockAdviceAttempt.findUnique({
        where: {
          productId_fingerprint: { productId, fingerprint: 'interrupted' },
        },
      }),
    ).toMatchObject({ status: 'abandoned' });
  });
});
