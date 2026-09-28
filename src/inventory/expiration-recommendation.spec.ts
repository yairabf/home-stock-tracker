import { PredictedState, ShelfLifePolicyKind } from '../generated/prisma/enums';
import {
  selectExpirationRecommendations,
  type ExpirationRecommendationCandidate,
} from './expiration-recommendation';

const now = new Date('2026-09-28T12:00:00.000Z');

function candidate(
  overrides: Partial<ExpirationRecommendationCandidate> = {},
): ExpirationRecommendationCandidate {
  return {
    purchaseEventId: 'event-1',
    productId: 'milk',
    productName: 'Milk',
    category: 'Dairy',
    purchasedAt: new Date('2026-09-25T12:00:00.000Z'),
    explicitExpiresAt: new Date('2026-09-30T12:00:00.000Z'),
    shelfLifePolicy: {
      kind: ShelfLifePolicyKind.finite,
      shelfLifeDays: 14,
      confidence: 0.65,
    },
    stockProjection: {
      estimatedQuantity: 1,
      estimatedState: PredictedState.likely_available,
      confidence: 0.8,
      evaluatedAt: new Date('2026-09-28T08:00:00.000Z'),
    },
    ...overrides,
  };
}

describe('selectExpirationRecommendations', () => {
  it('uses explicit dates over policy and keeps the earliest event per product', () => {
    const result = selectExpirationRecommendations(
      [
        candidate({
          purchaseEventId: 'newer-milk',
          explicitExpiresAt: new Date('2026-10-02T12:00:00.000Z'),
        }),
        candidate({
          purchaseEventId: 'older-milk',
          explicitExpiresAt: new Date('2026-09-27T12:00:00.000Z'),
        }),
      ],
      now,
    );

    expect(result.expiringSoon).toEqual([]);
    expect(result.possiblyExpired).toEqual([
      expect.objectContaining({
        productId: 'milk',
        purchaseEventId: 'older-milk',
        expirySource: 'explicit',
        expiryConfidence: 1,
        stockConfidence: 0.8,
        confidenceScore: 0.8,
        batchPresenceUnconfirmed: true,
      }),
    ]);
  });

  it('includes the seven-day boundary and conservatively scores a policy date', () => {
    const result = selectExpirationRecommendations(
      [
        candidate({
          productId: 'boundary',
          purchaseEventId: 'boundary-event',
          explicitExpiresAt: new Date('2026-10-05T12:00:00.000Z'),
        }),
        candidate({
          productId: 'policy',
          purchaseEventId: 'policy-event',
          productName: 'Yogurt',
          explicitExpiresAt: null,
          purchasedAt: new Date('2026-09-20T12:00:00.000Z'),
          shelfLifePolicy: {
            kind: ShelfLifePolicyKind.finite,
            shelfLifeDays: 11,
            confidence: 0.65,
          },
        }),
        candidate({
          productId: 'outside',
          explicitExpiresAt: new Date('2026-10-05T12:00:00.001Z'),
        }),
      ],
      now,
    );

    expect(result.expiringSoon.map((item) => item.productId)).toEqual([
      'policy',
      'boundary',
    ]);
    expect(result.expiringSoon[0]).toEqual(
      expect.objectContaining({
        expirySource: 'shelf_life_policy',
        expiryConfidence: 0.65,
        confidenceScore: 0.65,
      }),
    );
  });

  it('excludes products with no stock projection or an out or zero estimate', () => {
    const result = selectExpirationRecommendations(
      [
        candidate({ productId: 'untracked', stockProjection: null }),
        candidate({
          productId: 'out',
          stockProjection: {
            estimatedQuantity: 2,
            estimatedState: PredictedState.probably_out,
            confidence: 0.9,
            evaluatedAt: now,
          },
        }),
        candidate({
          productId: 'zero',
          stockProjection: {
            estimatedQuantity: 0,
            estimatedState: PredictedState.likely_available,
            confidence: 0.9,
            evaluatedAt: now,
          },
        }),
        candidate({
          productId: 'uncertain',
          stockProjection: {
            estimatedQuantity: null,
            estimatedState: PredictedState.uncertain,
            confidence: 0.3,
            evaluatedAt: now,
          },
        }),
      ],
      now,
    );

    expect(result.expiringSoon.map((item) => item.productId)).toEqual([
      'uncertain',
    ]);
    expect(result.expiringSoon[0].confidenceScore).toBe(0.3);
  });

  it('omits fresh, unknown, nonperishable, and invalid-confidence evidence', () => {
    const result = selectExpirationRecommendations(
      [
        candidate({
          productId: 'fresh',
          explicitExpiresAt: new Date('2026-10-06T12:00:00.000Z'),
        }),
        candidate({
          productId: 'unknown',
          explicitExpiresAt: null,
          shelfLifePolicy: null,
        }),
        candidate({
          productId: 'nonperishable',
          explicitExpiresAt: null,
          shelfLifePolicy: {
            kind: ShelfLifePolicyKind.nonperishable,
            shelfLifeDays: null,
            confidence: 0.9,
          },
        }),
        candidate({
          productId: 'bad-policy-confidence',
          explicitExpiresAt: null,
          shelfLifePolicy: {
            kind: ShelfLifePolicyKind.finite,
            shelfLifeDays: 4,
            confidence: Number.NaN,
          },
        }),
        candidate({
          productId: 'bad-stock-confidence',
          stockProjection: {
            estimatedQuantity: 1,
            estimatedState: PredictedState.likely_available,
            confidence: 1.2,
            evaluatedAt: now,
          },
        }),
      ],
      now,
    );

    expect(result).toEqual({ evaluatedAt: now, expiringSoon: [], possiblyExpired: [] });
  });

  it('uses deterministic ordering when dates tie', () => {
    const expiry = new Date('2026-09-29T12:00:00.000Z');
    const result = selectExpirationRecommendations(
      [
        candidate({ productId: 'z', productName: 'Bread', purchaseEventId: 'b', explicitExpiresAt: expiry }),
        candidate({ productId: 'a', productName: 'Bread', purchaseEventId: 'a', explicitExpiresAt: expiry }),
        candidate({ productId: 'm', productName: 'Apple', purchaseEventId: 'c', explicitExpiresAt: expiry }),
      ],
      now,
    );

    expect(result.expiringSoon.map((item) => item.productId)).toEqual([
      'm',
      'a',
      'z',
    ]);
  });
});
