import 'dotenv/config';
import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import {
  PREDICTION_ENGINE,
  type PredictionEngine,
} from '../src/estimation/prediction-engine';
import type { PredictionResult } from '../src/estimation/types/prediction-result';
import {
  GroceryItemSource,
  PredictedState,
} from '../src/generated/prisma/enums';
import type { HouseholdModel } from '../src/generated/prisma/models';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Low-stock recommendations (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let predictionEngine: jest.Mocked<PredictionEngine>;
  let originalHousehold: HouseholdModel | null;
  let householdId: string;
  const productIds: string[] = [];
  const products = new Map<string, string>();

  beforeAll(async () => {
    predictionEngine = { predictProduct: jest.fn() };
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PREDICTION_ENGINE)
      .useValue(predictionEngine)
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
        source: GroceryItemSource.api,
      },
    });
  });

  beforeEach(() => {
    predictionEngine.predictProduct.mockReset();
    predictionEngine.predictProduct.mockImplementation(async (productId) => {
      if (productId === products.get('out')) {
        return prediction(productId, PredictedState.probably_out, 0.9);
      }
      if (productId === products.get('low')) {
        return prediction(productId, PredictedState.probably_low, 0.7);
      }
      if (productId === products.get('weak')) {
        return prediction(productId, PredictedState.probably_low, 0.69);
      }
      return prediction(productId, PredictedState.likely_available, 0.95);
    });
  });

  afterAll(async () => {
    await prisma.groceryListItem.deleteMany({
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
    expect(predictionEngine.predictProduct).not.toHaveBeenCalledWith(
      products.get('pending'),
    );
    expect(predictionEngine.predictProduct).not.toHaveBeenCalledWith(
      products.get('disabled'),
    );
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
    predictionEngine.predictProduct.mockImplementation(async (productId) =>
      prediction(productId, PredictedState.uncertain, 0.95),
    );

    const response = await request(app.getHttpServer())
      .get('/api/v1/inventory/predictions/low-stock')
      .expect(200);

    expect(response.body).toEqual({ recommendations: [] });
  });

  async function createProduct(name: string, predictionEnabled: boolean) {
    const product = await prisma.product.create({
      data: {
        canonicalName: `recommendation-${name}-${Date.now()}`,
        predictionEnabled,
      },
    });
    products.set(name, product.id);
    productIds.push(product.id);
  }

  async function sideEffectCounts() {
    const [groceryItems, inventoryEvents] = await Promise.all([
      prisma.groceryListItem.count({
        where: { productId: { in: productIds } },
      }),
      prisma.inventoryEvent.count({
        where: { productId: { in: productIds } },
      }),
    ]);
    return { groceryItems, inventoryEvents };
  }
});

function prediction(
  productId: string,
  predictedState: PredictedState,
  confidenceScore: number,
): PredictionResult {
  return {
    predictionId: `prediction-${productId}`,
    productId,
    predictedState,
    confidenceScore,
    reason: `Reason for ${productId}`,
    deterministicSignals: {
      lastEventType: null,
      lastEventAt: null,
      daysSinceLastEvent: null,
      eventCount: 0,
      avgPurchaseIntervalDays: null,
      avgNeedIntervalDays: null,
      estimatedConsumptionIntervalDays: null,
      observationCount: 0,
      productType: null,
      isPerishable: false,
      predictionStrategy: null,
      householdAdultsCount: 2,
      householdChildrenCount: 3,
      householdPredictionPreferences: null,
    },
    recommendedAction: null,
    llmContributed: false,
    llmAttempt: null,
  };
}
