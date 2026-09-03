import { Test } from '@nestjs/testing';
import {
  GroceryItemStatus,
  PredictedState,
  ProductNameKind,
} from '../generated/prisma/enums';
import { HouseholdService } from '../household/household.service';
import { PrismaService } from '../prisma/prisma.service';
import { LowStockRecommendationService } from './low-stock-recommendation.service';
import { OperationalLogger } from '../observability/operational-logger.service';

const product = (
  productId: string,
  predictedState: PredictedState = PredictedState.probably_low,
  confidenceScore = 0.8,
  name = productId,
) => ({
  id: productId,
  names: name === '' ? [] : [{ displayName: name }],
  stockProjection: {
    predictionId: `prediction-${productId}`,
    estimatedState: predictedState,
    confidence: confidenceScore,
    reason: `Reason for ${productId}`,
    prediction: null,
  },
});

describe('LowStockRecommendationService', () => {
  let service: LowStockRecommendationService;
  let prisma: {
    product: { findMany: jest.Mock };
    groceryListItem: { findMany: jest.Mock };
  };
  let householdService: { getOrCreate: jest.Mock };
  let operationalLogger: { predictionRun: jest.Mock };

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
    operationalLogger = { predictionRun: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        LowStockRecommendationService,
        { provide: PrismaService, useValue: prisma },
        { provide: HouseholdService, useValue: householdService },
        { provide: OperationalLogger, useValue: operationalLogger },
      ],
    }).compile();

    service = module.get(LowStockRecommendationService);
  });

  it('loads only enabled products and uses the household threshold', async () => {
    prisma.product.findMany.mockResolvedValue([
      product('strong', PredictedState.probably_low, 0.85, 'Strong'),
      product('weak', PredictedState.probably_low, 0.84, 'Weak'),
    ]);
    householdService.getOrCreate.mockResolvedValue({
      suggestionConfidenceThreshold: 0.85,
    });
    const result = await service.getRecommendations();

    expect(prisma.product.findMany).toHaveBeenCalledWith({
      where: {
        predictionEnabled: true,
        stockProjection: { isNot: null },
      },
      select: {
        id: true,
        names: {
          where: { kind: ProductNameKind.canonical },
          select: { displayName: true },
        },
        stockProjection: expect.any(Object),
      },
    });
    expect(result.map(({ productId }) => productId)).toEqual(['strong']);
  });

  it('suppresses products already pending on the grocery list', async () => {
    prisma.product.findMany.mockResolvedValue([
      product('pending', undefined, undefined, 'Pending'),
      product('eligible', undefined, undefined, 'Eligible'),
    ]);
    prisma.groceryListItem.findMany.mockResolvedValue([
      { productId: 'pending' },
    ]);
    const result = await service.getRecommendations();

    expect(prisma.groceryListItem.findMany).toHaveBeenCalledWith({
      where: { status: GroceryItemStatus.pending },
      select: { productId: true },
    });
    expect(result.map(({ productId }) => productId)).toEqual(['eligible']);
  });

  it('isolates a product whose canonical name is missing', async () => {
    prisma.product.findMany.mockResolvedValue([
      product('failed', undefined, undefined, ''),
      product('successful', undefined, undefined, 'Successful'),
    ]);
    const result = await service.getRecommendations();

    expect(result.map(({ productId }) => productId)).toEqual(['successful']);
    expect(operationalLogger.predictionRun).toHaveBeenCalledWith({
      action: 'recommend',
      outcome: 'failure',
      productId: 'failed',
    });
  });

  it('returns an empty list when no products qualify', async () => {
    await expect(service.getRecommendations()).resolves.toEqual([]);
  });
});
