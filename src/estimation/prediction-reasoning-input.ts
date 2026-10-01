import { predictionReasoningInputSchema } from './types/prediction-reasoning';
import type { DeterministicPredictionCandidate } from './types/prediction-result';

export function serializePredictionEvidence(
  candidate: DeterministicPredictionCandidate,
) {
  return predictionReasoningInputSchema.parse({
    deterministicCandidate: {
      predictedState: candidate.predictedState,
      confidenceScore: candidate.confidenceScore,
      reason: candidate.reason,
      authoritative: candidate.authoritative,
    },
    signals: {
      ...candidate.signals,
      lastPurchaseAt: candidate.signals.lastPurchaseAt?.toISOString() ?? null,
      lastLowStockSignalAt:
        candidate.signals.lastLowStockSignalAt?.toISOString() ?? null,
      lastStockConfirmationAt:
        candidate.signals.lastStockConfirmationAt?.toISOString() ?? null,
    },
  });
}
