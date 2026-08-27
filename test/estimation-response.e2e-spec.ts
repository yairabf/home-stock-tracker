import { Test } from '@nestjs/testing';
import { type INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import {
  PREDICTION_ENGINE,
  type PredictionEngine,
} from '../src/estimation/prediction-engine';
import { PredictedState, ProductType } from '../src/generated/prisma/enums';
import { PrismaService } from '../src/prisma/prisma.service';
import type { PredictionResult } from '../src/estimation/types/prediction-result';

const baseResult: PredictionResult = {
  predictionId: 'prediction-1',
  productId: 'product-1',
  predictedState: PredictedState.uncertain,
  confidenceScore: 0.5,
  reason: 'Insufficient deterministic evidence',
  recommendedAction: null,
  llmContributed: false,
  llmAttempt: null,
  deterministicSignals: {
    lastPurchaseAt: null,
    lastLowStockSignalAt: null,
    lastStockConfirmationAt: null,
    daysSinceLastPurchase: null,
    daysSinceLastLowSignal: null,
    productType: ProductType.fast_consumable,
    eventCount: 0,
    coldStart: true,
    hasLearnedStatistics: false,
    avgPurchaseIntervalDays: null,
    avgNeedIntervalDays: null,
    estimatedConsumptionIntervalDays: null,
    observationCount: 0,
    isPerishable: true,
    predictionStrategy: null,
    householdContext: {
      adultsCount: 2,
      childrenCount: 3,
      childAgeGroups: [],
      predictionPreferences: null,
    },
    authoritativeDirectSignal: false,
  },
};

describe('Estimation response (e2e)', () => {
  let app: INestApplication<App>;
  let predictionEngine: jest.Mocked<PredictionEngine>;

  beforeEach(async () => {
    predictionEngine = { predictProduct: jest.fn() };
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PREDICTION_ENGINE)
      .useValue(predictionEngine)
      .overrideProvider(PrismaService)
      .useValue({
        $connect: () => Promise.resolve(),
        $disconnect: () => Promise.resolve(),
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('returns the stable deterministic response shape', async () => {
    predictionEngine.predictProduct.mockResolvedValue(baseResult);

    const response = await request(app.getHttpServer())
      .get('/api/v1/inventory/estimate/product-1')
      .expect(200);

    expect(response.body).toMatchObject({
      predictionId: 'prediction-1',
      productId: 'product-1',
      predictedState: PredictedState.uncertain,
      recommendedAction: null,
      llmContributed: false,
      deterministicSignals: {
        estimatedConsumptionIntervalDays: null,
        observationCount: 0,
        isPerishable: true,
        householdContext: { adultsCount: 2, childrenCount: 3 },
        authoritativeDirectSignal: false,
      },
    });
  });

  it('returns hybrid fields without exposing internal LLM metadata', async () => {
    predictionEngine.predictProduct.mockResolvedValue({
      ...baseResult,
      predictedState: PredictedState.probably_low,
      confidenceScore: 0.7,
      reason: 'Combined evidence suggests low stock',
      recommendedAction: 'Check the pantry',
      llmContributed: true,
      llmAttempt: {
        provider: 'private-provider',
        model: 'private-model',
        accepted: true,
        value: {
          predictedState: PredictedState.probably_low,
          confidence: 0.9,
          reason: 'Combined evidence suggests low stock',
          recommendedAction: 'Check the pantry',
        },
      },
    });

    const response = await request(app.getHttpServer())
      .get('/api/v1/inventory/estimate/product-1')
      .expect(200);

    expect(response.body).toMatchObject({
      predictedState: PredictedState.probably_low,
      recommendedAction: 'Check the pantry',
      llmContributed: true,
    });
    expect(response.body.llmAttempt).toBeUndefined();
    expect(JSON.stringify(response.body)).not.toContain('private-provider');
    expect(JSON.stringify(response.body)).not.toContain('private-model');
  });

  it('returns the deterministic shape after LLM fallback', async () => {
    predictionEngine.predictProduct.mockResolvedValue({
      ...baseResult,
      reason: 'Provider-independent deterministic fallback',
    });

    const response = await request(app.getHttpServer())
      .get('/api/v1/inventory/estimate/product-1')
      .expect(200);

    expect(response.body).toMatchObject({
      predictedState: PredictedState.uncertain,
      recommendedAction: null,
      llmContributed: false,
    });
    expect(JSON.stringify(response.body)).not.toContain('provider');
  });
});
