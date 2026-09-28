import { InventoryEventType, PredictedState, ProductNameKind, ShelfLifePolicyKind } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { ExpirationRecommendationService } from './expiration-recommendation.service';

const now = new Date('2026-09-28T12:00:00.000Z');

function event(
  id: string,
  productId: string,
  expiresAt: Date | null,
  overrides: { quantity?: number | null; state?: PredictedState } = {},
) {
  return {
    id,
    productId,
    timestamp: new Date('2026-09-20T12:00:00.000Z'),
    expirationBatch: expiresAt ? { expiresAt } : null,
    product: {
      category: 'Dairy',
      names: [{ displayName: productId }],
      shelfLifePolicy: {
        kind: ShelfLifePolicyKind.finite,
        shelfLifeDays: 11,
        confidence: 0.65,
      },
      stockProjection: {
        estimatedQuantity: overrides.quantity === undefined ? 1 : overrides.quantity,
        estimatedState: overrides.state ?? PredictedState.likely_available,
        confidence: 0.8,
        evaluatedAt: new Date('2026-09-28T08:00:00.000Z'),
      },
    },
  };
}

describe('ExpirationRecommendationService', () => {
  const findMany = jest.fn();
  const prisma = {
    inventoryEvent: { findMany },
  } as unknown as PrismaService;
  const service = new ExpirationRecommendationService(prisma);

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(now);
    findMany.mockReset();
  });
  afterEach(() => jest.useRealTimers());

  it('returns empty groups from an empty read without a write or model call', async () => {
    findMany.mockResolvedValue([]);

    await expect(service.getRecommendations()).resolves.toEqual({
      evaluatedAt: now,
      expiringSoon: [],
      possiblyExpired: [],
    });
    expect(findMany).toHaveBeenCalledTimes(1);
    expect(findMany).toHaveBeenCalledWith({
      where: {
        eventType: {
          in: [InventoryEventType.PURCHASED, InventoryEventType.RESTOCKED],
        },
      },
      select: expect.objectContaining({
        expirationBatch: { select: { expiresAt: true } },
        product: {
          select: expect.objectContaining({
            names: {
              where: { kind: ProductNameKind.canonical },
              select: { displayName: true },
            },
            shelfLifePolicy: {
              select: { kind: true, shelfLifeDays: true, confidence: true },
            },
            stockProjection: {
              select: {
                estimatedQuantity: true,
                estimatedState: true,
                confidence: true,
                evaluatedAt: true,
              },
            },
          }),
        },
      }),
    });
  });

  it('combines existing event, policy, and stock evidence in one product-level read', async () => {
    findMany.mockResolvedValue([
      event('milk-new', 'Milk', new Date('2026-10-03T12:00:00.000Z')),
      event('milk-old', 'Milk', new Date('2026-09-27T12:00:00.000Z')),
      event('yogurt-policy', 'Yogurt', null),
      event('depleted', 'Empty Milk', new Date('2026-09-30T12:00:00.000Z'), {
        quantity: 0,
      }),
      event('uncertain', 'Cheese', new Date('2026-10-02T12:00:00.000Z'), {
        quantity: null,
        state: PredictedState.uncertain,
      }),
    ]);

    const result = await service.getRecommendations();

    expect(result.possiblyExpired).toEqual([
      expect.objectContaining({
        productId: 'Milk',
        purchaseEventId: 'milk-old',
        expirySource: 'explicit',
        batchPresenceUnconfirmed: true,
      }),
    ]);
    expect(result.expiringSoon.map((item) => item.productId)).toEqual([
      'Yogurt',
      'Cheese',
    ]);
    expect(result.expiringSoon[0]).toEqual(
      expect.objectContaining({
        expirySource: 'shelf_life_policy',
        expiryConfidence: 0.65,
        confidenceScore: 0.65,
      }),
    );
    expect(findMany).toHaveBeenCalledTimes(1);
  });
});
