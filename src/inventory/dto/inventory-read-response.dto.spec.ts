import { PredictedState } from '../../generated/prisma/enums';
import {
  InventoryEstimateResponseDto,
  InventoryItemResponseDto,
  InventoryTrackingStatus,
} from './inventory-read-response.dto';

const recordedAt = new Date('2026-09-01T08:00:00.000Z');
const evaluatedAt = new Date('2026-09-03T02:00:00.000Z');

describe('InventoryItemResponseDto', () => {
  it('represents an untracked product without inventing stock facts', () => {
    expect(
      InventoryItemResponseDto.fromEntity({
        id: 'product-1',
        names: [{ displayName: 'Milk' }],
        stockProjection: null,
      }),
    ).toEqual({
      productId: 'product-1',
      productName: 'Milk',
      trackingStatus: InventoryTrackingStatus.untracked,
      unit: null,
      recordedQuantity: null,
      recordedAt: null,
      recordedSource: null,
      recordedEventId: null,
      estimatedQuantity: null,
      estimatedState: null,
      confidence: null,
      reason: null,
      predictionId: null,
      evaluatedAt: null,
    });
  });

  it.each([
    ['item', 3.6, 4],
    ['UNITS', 3.4, 3],
    ['liter', 1.2345, 1.23],
  ])(
    'presents %s quantities without changing the entity',
    (unit, value, expected) => {
      const entity = {
        id: 'product-1',
        names: [{ displayName: 'Milk' }],
        stockProjection: {
          unit,
          recordedQuantity: value,
          recordedAt,
          recordedSource: 'api',
          recordedEventId: 'event-1',
          estimatedQuantity: value,
          estimatedState: PredictedState.likely_available,
          confidence: 0.91,
          reason: 'daily_estimate',
          predictionId: 'prediction-1',
          evaluatedAt,
          prediction: null,
        },
      };

      const result = InventoryItemResponseDto.fromEntity(entity);

      expect(result).toMatchObject({
        trackingStatus: InventoryTrackingStatus.tracked,
        recordedQuantity: expected,
        estimatedQuantity: expected,
        estimatedState: PredictedState.likely_available,
      });
      expect(entity.stockProjection.estimatedQuantity).toBe(value);
    },
  );

  it('keeps additive legacy fields without calculating an untracked estimate', () => {
    const result = InventoryEstimateResponseDto.fromEntity({
      id: 'product-1',
      names: [{ displayName: 'Milk' }],
      stockProjection: null,
    });

    expect(result).toMatchObject({
      productId: 'product-1',
      trackingStatus: InventoryTrackingStatus.untracked,
      predictedState: PredictedState.uncertain,
      confidenceScore: 0,
      reason: 'Stock is not tracked',
      recommendedAction: null,
      llmContributed: false,
      deterministicSignals: { coldStart: true, eventCount: 0 },
    });
  });
});
