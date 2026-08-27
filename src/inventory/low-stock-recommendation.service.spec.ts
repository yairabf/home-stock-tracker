import { Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { GroceryItemStatus, PredictedState } from '../generated/prisma/enums';
import {
  PREDICTION_ENGINE,
  type PredictionEngine,
} from '../estimation/prediction-engine';
import type { PredictionResult } from '../estimation/types/prediction-result';
import { HouseholdService } from '../household/household.service';
import { PrismaService } from '../prisma/prisma.service';
import { LowStockRecommendationService } from './low-stock-recommendation.service';

const prediction = (
  productId: string,
  predictedState: PredictedState = PredictedState.probably_low,
  confidenceScore = 0.8,
): PredictionResult => ({
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
});

describe('LowStockRecommendationService', () => {
  let service: LowStockRecommendationService;
  let prisma: {
    product: { findMany: jest.Mock };
    groceryListItem: { findMany: jest.Mock };
  };
  let householdService: { getOrCreate: jest.Mock };
  let predictionEngine: jest.Mocked<PredictionEngine>;

  beforeEach(async () => {
    prisma = {
      product: { findMany: jest.fn().mockResolvedValue([]) },
      groceryListItem: { findMany: jest.fn().mockResolvedValue([]) },
    };
    householdService = {
      getOrCreate: jest
        .fn()
        .mockResolvedValue({ suggestionConfidenceThreshold: 0.7 }),
    };
    predictionEngine = { predictProduct: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        LowStockRecommendationService,
        { provide: PrismaService, useValue: prisma },
        { provide: HouseholdService, useValue: householdService },
        { provide: PREDICTION_ENGINE, useValue: predictionEngine },
      ],
    }).compile();

    service = module.get(LowStockRecommendationService);
  });

  it('loads only enabled products and uses the household threshold', async () => {
    prisma.product.findMany.mockResolvedValue([
      { id: 'strong', canonicalName: 'Strong' },
      { id: 'weak', canonicalName: 'Weak' },
    ]);
    householdService.getOrCreate.mockResolvedValue({
      suggestionConfidenceThreshold: 0.85,
    });
    predictionEngine.predictProduct
      .mockResolvedValueOnce(prediction('strong', undefined, 0.85))
      .mockResolvedValueOnce(prediction('weak', undefined, 0.84));

    const result = await service.getRecommendations();

    expect(prisma.product.findMany).toHaveBeenCalledWith({
      where: { predictionEnabled: true },
      select: { id: true, canonicalName: true },
    });
    expect(result.map(({ productId }) => productId)).toEqual(['strong']);
  });

  it('does not predict products already pending on the grocery list', async () => {
    prisma.product.findMany.mockResolvedValue([
      { id: 'pending', canonicalName: 'Pending' },
      { id: 'eligible', canonicalName: 'Eligible' },
    ]);
    prisma.groceryListItem.findMany.mockResolvedValue([
      { productId: 'pending' },
    ]);
    predictionEngine.predictProduct.mockResolvedValue(prediction('eligible'));

    await service.getRecommendations();

    expect(prisma.groceryListItem.findMany).toHaveBeenCalledWith({
      where: { status: GroceryItemStatus.pending },
      select: { productId: true },
    });
    expect(predictionEngine.predictProduct).toHaveBeenCalledTimes(1);
    expect(predictionEngine.predictProduct).toHaveBeenCalledWith('eligible');
  });

  it('returns successful recommendations when a sibling prediction fails', async () => {
    prisma.product.findMany.mockResolvedValue([
      { id: 'failed', canonicalName: 'Failed' },
      { id: 'successful', canonicalName: 'Successful' },
    ]);
    predictionEngine.predictProduct.mockImplementation((productId) =>
      productId === 'failed'
        ? Promise.reject(new Error('provider unavailable'))
        : Promise.resolve(prediction(productId)),
    );
    jest.spyOn(Logger.prototype, 'error').mockImplementation();

    const result = await service.getRecommendations();

    expect(result.map(({ productId }) => productId)).toEqual(['successful']);
    expect(Logger.prototype.error).toHaveBeenCalledWith(
      'Failed to predict low stock for product failed',
      expect.any(String),
    );
  });

  it('returns an empty list without prediction calls when no products qualify', async () => {
    await expect(service.getRecommendations()).resolves.toEqual([]);
    expect(predictionEngine.predictProduct).not.toHaveBeenCalled();
  });
});
