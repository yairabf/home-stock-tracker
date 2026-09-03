import 'dotenv/config';
import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import {
  GroceryItemSource,
  InventoryEventType,
  PredictedState,
} from '../src/generated/prisma/enums';
import type { HouseholdModel } from '../src/generated/prisma/models';
import { PrismaService } from '../src/prisma/prisma.service';
import { ServiceAuthGuard } from '../src/auth/service-auth.guard';
import { AUTH_TEST_BYPASS } from './auth-test-bypass';
import { createProductFixture } from './product-fixture';

describe('Low-stock recommendations (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let originalHousehold: HouseholdModel | null;
  let householdId: string;
  const productIds: string[] = [];
  const products = new Map<string, string>();

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ServiceAuthGuard)
      .useValue(AUTH_TEST_BYPASS)
      .compile();

    app = module.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();
    prisma = app.get(PrismaService);

    originalHousehold = await prisma.household.findFirst();
    const household = originalHousehold
      ? await prisma.household.update({
          where: { id: originalHousehold.id },
          data: { suggestionConfidenceThreshold: 0.7 },
        })
      : await prisma.household.create({ data: {} });
    householdId = household.id;

    await createProduct('out', true);
    await createProduct('low', true);
    await createProduct('weak', true);
    await createProduct('pending', true);
    await createProduct('disabled', false);
    await createProduct('available', true);
    await prisma.groceryListItem.create({
      data: {
        productId: products.get('pending')!,
        requestedQuantity: 1,
        source: GroceryItemSource.api,
      },
    });
  });

  beforeEach(async () => {
    await prisma.household.update({
      where: { id: householdId },
      data: { suggestionConfidenceThreshold: 0.7 },
    });
    await Promise.all(
      [...products].map(([name, productId]) =>
        prisma.stockProjection.update({
          where: { productId },
          data: projectionEstimate(name),
        }),
      ),
    );
  });

  afterAll(async () => {
    await prisma.groceryListItem.deleteMany({
      where: { productId: { in: productIds } },
    });
    await prisma.stockProjection.deleteMany({
      where: { productId: { in: productIds } },
    });
    await prisma.prediction.deleteMany({
      where: { productId: { in: productIds } },
    });
    await prisma.inventoryEvent.deleteMany({
      where: { productId: { in: productIds } },
    });
    await prisma.productStatistics.deleteMany({
      where: { productId: { in: productIds } },
    });
    await prisma.product.deleteMany({ where: { id: { in: productIds } } });

    if (originalHousehold) {
      await prisma.household.update({
        where: { id: originalHousehold.id },
        data: {
          suggestionConfidenceThreshold:
            originalHousehold.suggestionConfidenceThreshold,
        },
      });
    } else {
      await prisma.household.delete({ where: { id: householdId } });
    }
    await app.close();
  });

  it('uses the default threshold, suppresses ineligible products, and has no side effects', async () => {
    await prisma.household.update({
      where: { id: householdId },
      data: { suggestionConfidenceThreshold: 0.7 },
    });
    const beforeCounts = await sideEffectCounts();

    const response = await request(app.getHttpServer())
      .get('/api/v1/inventory/predictions/low-stock')
      .expect(200);

    expect(response.body.recommendations).toEqual([
      expect.objectContaining({
        productId: products.get('out'),
        predictedState: PredictedState.probably_out,
        confidenceScore: 0.9,
      }),
      expect.objectContaining({
        productId: products.get('low'),
        predictedState: PredictedState.probably_low,
        confidenceScore: 0.7,
      }),
    ]);
    await expect(sideEffectCounts()).resolves.toEqual(beforeCounts);
  });

  it('honors a custom household threshold', async () => {
    await prisma.household.update({
      where: { id: householdId },
      data: { suggestionConfidenceThreshold: 0.85 },
    });

    const response = await request(app.getHttpServer())
      .get('/api/v1/inventory/predictions/low-stock')
      .expect(200);

    expect(response.body.recommendations).toEqual([
      expect.objectContaining({ productId: products.get('out') }),
    ]);
  });

  it('returns an empty recommendation list when nothing qualifies', async () => {
    await prisma.stockProjection.updateMany({
      where: { productId: { in: productIds } },
      data: { estimatedState: PredictedState.uncertain, confidence: 0.95 },
    });

    const response = await request(app.getHttpServer())
      .get('/api/v1/inventory/predictions/low-stock')
      .expect(200);

    expect(response.body).toEqual({ recommendations: [] });
  });

  async function createProduct(name: string, predictionEnabled: boolean) {
    const product = await createProductFixture(prisma, {
      canonicalName: `recommendation-${name}-${Date.now()}`,
      predictionEnabled,
    });
    products.set(name, product.id);
    productIds.push(product.id);
    const event = await prisma.inventoryEvent.create({
      data: {
        productId: product.id,
        eventType: InventoryEventType.STOCK_SET,
        quantity: 1,
        unit: 'item',
        source: 'test',
      },
    });
    await prisma.stockProjection.create({
      data: {
        productId: product.id,
        unit: 'item',
        recordedQuantity: 1,
        recordedAt: event.timestamp,
        recordedSource: 'test',
        recordedEventId: event.id,
        estimatedQuantity: 1,
        ...projectionEstimate(name),
        reason: `Reason for ${product.id}`,
        evaluatedAt: event.timestamp,
      },
    });
  }

  async function sideEffectCounts() {
    const [groceryItems, inventoryEvents, predictions, projections] =
      await Promise.all([
        prisma.groceryListItem.count({
          where: { productId: { in: productIds } },
        }),
        prisma.inventoryEvent.count({
          where: { productId: { in: productIds } },
        }),
        prisma.prediction.count({
          where: { productId: { in: productIds } },
        }),
        prisma.stockProjection.count({
          where: { productId: { in: productIds } },
        }),
      ]);
    return { groceryItems, inventoryEvents, predictions, projections };
  }
});

function projectionEstimate(name: string): {
  estimatedState: PredictedState;
  confidence: number;
} {
  if (name === 'out') {
    return { estimatedState: PredictedState.probably_out, confidence: 0.9 };
  }
  if (name === 'low') {
    return { estimatedState: PredictedState.probably_low, confidence: 0.7 };
  }
  if (name === 'weak') {
    return { estimatedState: PredictedState.probably_low, confidence: 0.69 };
  }
  return { estimatedState: PredictedState.likely_available, confidence: 0.95 };
}
