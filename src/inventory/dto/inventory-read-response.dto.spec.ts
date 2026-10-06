import { serializePredictionEvidence } from '../../estimation/prediction-reasoning-input';
import { stockCandidate } from '../../estimation/stock-prediction.fixture';
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
        category: null,
        names: [{ displayName: 'Milk' }],
        stockProjection: null,
      }),
    ).toEqual({
      productId: 'product-1',
      productName: 'Milk',
      category: null,
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
        category: 'dairy',
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
        category: 'dairy',
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
      category: null,
      names: [{ displayName: 'Milk' }],
      stockProjection: null,
    });

    expect(result).toMatchObject({
      productId: 'product-1',
      trackingStatus: InventoryTrackingStatus.untracked,
      category: null,
      predictedState: PredictedState.uncertain,
      confidenceScore: 0,
      reason: 'Stock is not tracked',
      recommendedAction: null,
      llmContributed: false,
      deterministicSignals: { coldStart: true, eventCount: 0 },
    });
  });
  it.each([false, true])(
    'maps daily provenance to the published signal contract (advice %s)',
    (advice) => {
      const candidate = stockCandidate();
      candidate.signals.householdContext = null;
      const result = InventoryEstimateResponseDto.fromEntity({
        id: 'p',
        category: null,
        names: [{ displayName: 'Fixture' }],
        stockProjection: {
          unit: 'unit',
          recordedQuantity: null,
          recordedAt,
          recordedSource: 'api',
          recordedEventId: 'event',
          estimatedQuantity: null,
          estimatedState: 'probably_low',
          confidence: 0.6,
          reason: 'fixture',
          predictionId: 'prediction',
          evaluatedAt,
          prediction: {
            recommendedAction: null,
            llmResult: advice ? {} : null,
            deterministicSignals: {
              source: 'daily_stock_workflow',
              estimatedConsumptionIntervalDays: 3,
              ...(advice
                ? {
                    stockAdvice: {
                      candidate: serializePredictionEvidence(candidate),
                      attemptId: 'private-internal-id',
                    },
                  }
                : {}),
            },
          },
        },
      });
      expect(result.deterministicSignals.eventCount).toBe(advice ? 2 : 0);
      expect(result.deterministicSignals).not.toHaveProperty('stockAdvice');
      expect(result.deterministicSignals).not.toHaveProperty('source');
      expect(result.deterministicSignals.estimatedConsumptionIntervalDays).toBe(
        advice ? null : 3,
      );
    },
  );
});
