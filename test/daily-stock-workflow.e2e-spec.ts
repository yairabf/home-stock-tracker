import 'dotenv/config';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { ServiceAuthGuard } from '../src/auth/service-auth.guard';
import { LLM_PROVIDER, type LlmProvider } from '../src/llm/llm-provider';
import { PrismaService } from '../src/prisma/prisma.service';
import { DailyStockWorkflowService } from '../src/inventory/daily-stock-workflow.service';
import { AUTH_TEST_BYPASS } from './auth-test-bypass';
import { createProductFixture } from './product-fixture';

describe('Daily stock workflow (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let workflow: DailyStockWorkflowService;
  let productId: string | null = null;
  const llmProvider: LlmProvider = {
    name: 'test-provider',
    generateStructured: jest.fn().mockResolvedValue({
      status: 'success',
      provider: 'test-provider',
      model: 'test-model',
      value: {
        kind: 'finite',
        shelfLifeDays: 10,
        confidence: 0.9,
        rationale: 'Test fixture with finite shelf life',
      },
    }),
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ServiceAuthGuard)
      .useValue(AUTH_TEST_BYPASS)
      .overrideProvider(LLM_PROVIDER)
      .useValue(llmProvider)
      .compile();
    app = module.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    workflow = app.get(DailyStockWorkflowService);
  });

  afterEach(async () => {
    if (!productId) return;
    await prisma.stockProjection.deleteMany({ where: { productId } });
    await prisma.productShelfLifePolicy.deleteMany({ where: { productId } });
    await prisma.inventoryEvent.deleteMany({ where: { productId } });
    await prisma.prediction.deleteMany({ where: { productId } });
    await prisma.productStatistics.deleteMany({ where: { productId } });
    await prisma.product.deleteMany({ where: { id: productId } });
    productId = null;
  });

  afterAll(async () => app.close());

  it('persists inferred policy, prediction, and incremental projection estimate', async () => {
    const product = await createProductFixture(prisma, {
      canonicalName: 'Workflow milk fixture',
      category: 'dairy',
      typicalUnit: 'carton',
      isPerishable: true,
    });
    productId = product.id;
    const recordedAt = new Date('2026-09-01T02:00:00.000Z');
    const previousEvaluatedAt = new Date('2026-09-02T02:00:00.000Z');
    const evaluatedAt = new Date('2026-09-03T02:00:00.000Z');
    const event = await prisma.inventoryEvent.create({
      data: {
        productId,
        eventType: 'PURCHASED',
        quantity: 3,
        unit: 'carton',
        timestamp: recordedAt,
        source: 'e2e',
      },
    });
    await prisma.productStatistics.create({
      data: { productId, estimatedConsumptionIntervalDays: 2 },
    });
    await prisma.stockProjection.create({
      data: {
        productId,
        unit: 'carton',
        recordedQuantity: 3,
        recordedAt,
        recordedSource: 'e2e',
        recordedEventId: event.id,
        estimatedQuantity: 3,
        estimatedState: 'likely_available',
        confidence: 1,
        reason: 'purchase_recorded',
        evaluatedAt: previousEvaluatedAt,
      },
    });

    const summary = await workflow.run(evaluatedAt, [productId]);

    expect(summary.shelfLife).toEqual({
      processed: 1,
      succeeded: 1,
      skipped: 0,
      failed: 0,
    });
    expect(summary.evaluation).toEqual({
      processed: 1,
      succeeded: 1,
      skipped: 0,
      failed: 0,
    });
    await expect(
      prisma.productShelfLifePolicy.findUnique({ where: { productId } }),
    ).resolves.toMatchObject({
      kind: 'finite',
      shelfLifeDays: 10,
      modelProvider: 'test-provider',
      modelVersion: 'test-model',
      promptVersion: 'shelf-life-inference-v1',
    });
    const projection = await prisma.stockProjection.findUniqueOrThrow({
      where: { productId },
    });
    expect(projection).toMatchObject({
      recordedQuantity: 3,
      recordedAt,
      recordedEventId: event.id,
      estimatedQuantity: 2.5,
      estimatedState: 'likely_available',
      evaluatedAt,
    });
    expect(projection.predictionId).not.toBeNull();
    await expect(
      prisma.prediction.findUnique({ where: { id: projection.predictionId! } }),
    ).resolves.toMatchObject({
      productId,
      predictedState: 'likely_available',
      predictedAt: evaluatedAt,
      reason: 'daily_stock_available',
    });
  });
});
