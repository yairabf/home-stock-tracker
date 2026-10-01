import { PredictedState, ProductType } from '../generated/prisma/enums';
import type { DeterministicPredictionCandidate } from './types/prediction-result';

export function stockCandidate(): DeterministicPredictionCandidate {
  return {
    predictedState: PredictedState.uncertain,
    confidenceScore: 0.6,
    reason: 'Near the learned purchase interval',
    authoritative: false,
    signals: {
      lastPurchaseAt: new Date('2026-09-20T10:00:00.000Z'),
      lastLowStockSignalAt: null,
      lastStockConfirmationAt: null,
      daysSinceLastPurchase: 10,
      daysSinceLastLowSignal: null,
      productType: ProductType.fast_consumable,
      eventCount: 2,
      coldStart: false,
      hasLearnedStatistics: true,
      avgPurchaseIntervalDays: 10,
      avgNeedIntervalDays: null,
      estimatedConsumptionIntervalDays: null,
      observationCount: 2,
      isPerishable: true,
      predictionStrategy: null,
      householdContext: {
        adultsCount: 2,
        childrenCount: 3,
        childAgeGroups: ['private-age-group'],
        predictionPreferences: { private: 'private-preference' },
      },
      authoritativeDirectSignal: false,
    },
  };
}
