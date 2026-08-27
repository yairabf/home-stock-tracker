import { PredictedState } from '../../generated/prisma/enums';
import type { PredictionResult } from '../../estimation/types/prediction-result';
import {
  selectLowStockRecommendations,
  type RecommendationCandidate,
} from './low-stock-recommendation';

const prediction = (
  productId: string,
  predictedState: PredictedState,
  confidenceScore: number,
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

const candidate = (
  productName: string,
  predictedState: PredictedState,
  confidenceScore: number,
): RecommendationCandidate => ({
  productName,
  prediction: prediction(productName, predictedState, confidenceScore),
});

describe('selectLowStockRecommendations', () => {
  it('keeps probably low and probably out predictions at the inclusive threshold', () => {
    const candidates = [
      candidate('low', PredictedState.probably_low, 0.7),
      candidate('out', PredictedState.probably_out, 0.8),
    ];

    const result = selectLowStockRecommendations(candidates, 0.7, new Set());

    expect(result.map(({ productId }) => productId)).toEqual(['out', 'low']);
  });

  it('excludes available, uncertain, below-threshold, and pending products', () => {
    const candidates = [
      candidate('available', PredictedState.likely_available, 0.95),
      candidate('uncertain', PredictedState.uncertain, 0.95),
      candidate('weak', PredictedState.probably_low, 0.69),
      candidate('pending', PredictedState.probably_out, 0.95),
    ];

    const result = selectLowStockRecommendations(
      candidates,
      0.7,
      new Set(['pending']),
    );

    expect(result).toEqual([]);
  });

  it('orders by urgency, confidence, and canonical product name', () => {
    const candidates = [
      candidate('zucchini', PredictedState.probably_low, 0.99),
      candidate('soap', PredictedState.probably_out, 0.8),
      candidate('rice', PredictedState.probably_out, 0.9),
      candidate('apples', PredictedState.probably_out, 0.8),
    ];

    const result = selectLowStockRecommendations(candidates, 0.7, new Set());

    expect(result.map(({ productName }) => productName)).toEqual([
      'rice',
      'apples',
      'soap',
      'zucchini',
    ]);
  });

  it('returns an empty list for no candidates', () => {
    expect(selectLowStockRecommendations([], 0.7, new Set())).toEqual([]);
  });
});
