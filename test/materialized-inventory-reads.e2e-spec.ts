import 'dotenv/config';
import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import {
  InventoryEventType,
  PredictedState,
} from '../src/generated/prisma/enums';
import { PrismaService } from '../src/prisma/prisma.service';
import { ServiceAuthGuard } from '../src/auth/service-auth.guard';
import { AUTH_TEST_BYPASS } from './auth-test-bypass';
import { createProductFixture } from './product-fixture';

describe('Materialized inventory reads (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let householdId: string;
  let originalThreshold: number;
  const productIds: string[] = [];

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ServiceAuthGuard)
      .useValue(AUTH_TEST_BYPASS)
      .compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();
    prisma = app.get(PrismaService);
    const existing = await prisma.household.findFirst();
    const household = existing ?? (await prisma.household.create({ data: {} }));
    householdId = household.id;
    originalThreshold = household.suggestionConfidenceThreshold;
    await prisma.household.update({
      where: { id: householdId },
      data: { suggestionConfidenceThreshold: 0.7 },
    });
  });

  afterEach(async () => {
    await prisma.stockProjection.deleteMany({
      where: { productId: { in: productIds } },
    });
    await prisma.prediction.deleteMany({
      where: { productId: { in: productIds } },
    });
    await prisma.groceryListItem.deleteMany({
      where: { productId: { in: productIds } },
    });
    await prisma.inventoryEvent.deleteMany({
      where: { productId: { in: productIds } },
    });
    await prisma.product.deleteMany({ where: { id: { in: productIds } } });
    productIds.length = 0;
  });

  afterAll(async () => {
    await prisma.household.update({
      where: { id: householdId },
      data: { suggestionConfidenceThreshold: originalThreshold },
    });
    await app.close();
  });

  it('serves one read-only snapshot across product, household, and recommendation routes', async () => {
    const available = await createProjection(
      'read-available',
      'liter',
      2.345,
      1.236,
      PredictedState.likely_available,
      0.9,
    );
    const low = await createProjection(
      'read-low',
      'item',
      4,
      2.6,
      PredictedState.probably_low,
      0.8,
    );
    const uncertain = await createProjection(
      'read-uncertain',
      'item',
      2,
      null,
      PredictedState.uncertain,
      0.5,
    );
    const out = await createProjection(
      'read-out',
      'item',
      0,
      0,
      PredictedState.probably_out,
      0.95,
    );
    const staleZero = await createProjection(
      'read-stale-zero',
      'item',
      1,
      0,
      PredictedState.likely_available,
      0.9,
    );
    const untracked = await createProduct('read-untracked');
    const before = await sideEffectCounts();

    const productResponse = await request(app.getHttpServer())
      .get(`/api/v1/inventory/estimate/${available}`)
      .expect(200);
    const listResponse = await request(app.getHttpServer())
      .get('/api/v1/inventory')
      .expect(200);
    const recommendationResponse = await request(app.getHttpServer())
      .get('/api/v1/inventory/predictions/low-stock')
      .expect(200);

    expect(productResponse.body).toMatchObject({
      productId: available,
      trackingStatus: 'tracked',
      recordedQuantity: 2.35,
      estimatedQuantity: 1.24,
      estimatedState: PredictedState.likely_available,
    });
    const relevantIds = new Set(productIds);
    const currentIds = listResponse.body.current
      .filter((item: { productId: string }) => relevantIds.has(item.productId))
      .map((item: { productId: string }) => item.productId);
    const uncertainIds = listResponse.body.uncertain
      .filter((item: { productId: string }) => relevantIds.has(item.productId))
      .map((item: { productId: string }) => item.productId);
    expect(currentIds).toEqual([available, low]);
    expect(uncertainIds).toEqual([uncertain]);
    expect([...currentIds, ...uncertainIds]).not.toEqual(
      expect.arrayContaining([out, staleZero, untracked]),
    );
    expect(
      recommendationResponse.body.recommendations
        .filter((item: { productId: string }) =>
          relevantIds.has(item.productId),
        )
        .map((item: { productId: string }) => item.productId),
    ).toEqual([out, low]);
    await expect(
      prisma.stockProjection.findUnique({ where: { productId: available } }),
    ).resolves.toMatchObject({
      recordedQuantity: 2.345,
      estimatedQuantity: 1.236,
    });
    await expect(sideEffectCounts()).resolves.toEqual(before);
  });

  async function createProduct(name: string): Promise<string> {
    const product = await createProductFixture(prisma, {
      canonicalName: `${name}-${Date.now()}-${productIds.length}`,
      predictionEnabled: true,
    });
    productIds.push(product.id);
    return product.id;
  }

  async function createProjection(
    name: string,
    unit: string,
    recordedQuantity: number,
    estimatedQuantity: number | null,
    estimatedState: PredictedState,
    confidence: number,
  ): Promise<string> {
    const productId = await createProduct(name);
    const event = await prisma.inventoryEvent.create({
      data: {
        productId,
        eventType: InventoryEventType.STOCK_SET,
        quantity: recordedQuantity,
        unit,
        source: 'test',
      },
    });
    await prisma.stockProjection.create({
      data: {
        productId,
        unit,
        recordedQuantity,
        recordedAt: event.timestamp,
        recordedSource: 'test',
        recordedEventId: event.id,
        estimatedQuantity,
        estimatedState,
        confidence,
        reason: `Materialized ${name}`,
        evaluatedAt: event.timestamp,
      },
    });
    return productId;
  }

  async function sideEffectCounts() {
    const [events, predictions, groceries, projections] = await Promise.all([
      prisma.inventoryEvent.count({
        where: { productId: { in: productIds } },
      }),
      prisma.prediction.count({ where: { productId: { in: productIds } } }),
      prisma.groceryListItem.count({
        where: { productId: { in: productIds } },
      }),
      prisma.stockProjection.count({
        where: { productId: { in: productIds } },
      }),
    ]);
    return { events, predictions, groceries, projections };
  }
});
