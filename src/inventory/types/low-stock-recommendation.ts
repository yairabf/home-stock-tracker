import { PredictedState } from '../../generated/prisma/enums';
import type { PredictionResult } from '../../estimation/types/prediction-result';

export type LowStockState = Extract<
  PredictedState,
  'probably_low' | 'probably_out'
>;

export interface RecommendationCandidate {
  productName: string;
  prediction: PredictionResult;
}

export interface LowStockRecommendation {
  productId: string;
  productName: string;
  predictionId: string | null;
  predictedState: LowStockState;
  confidenceScore: number;
  reason: string;
  recommendedAction: string | null;
}

const STATE_PRIORITY: Record<LowStockState, number> = {
  [PredictedState.probably_out]: 0,
  [PredictedState.probably_low]: 1,
};

export function selectLowStockRecommendations(
  candidates: RecommendationCandidate[],
  confidenceThreshold: number,
  pendingProductIds: ReadonlySet<string>,
): LowStockRecommendation[] {
  return candidates
    .filter(({ prediction }) =>
      qualifies(prediction, confidenceThreshold, pendingProductIds),
    )
    .map(({ productName, prediction }) => ({
      productId: prediction.productId,
      productName,
      predictionId: prediction.predictionId,
      predictedState: prediction.predictedState as LowStockState,
      confidenceScore: prediction.confidenceScore,
      reason: prediction.reason,
      recommendedAction: prediction.recommendedAction,
    }))
    .sort(compareRecommendations);
}

function qualifies(
  prediction: PredictionResult,
  confidenceThreshold: number,
  pendingProductIds: ReadonlySet<string>,
): boolean {
  const isLowStock =
    prediction.predictedState === PredictedState.probably_low ||
    prediction.predictedState === PredictedState.probably_out;

  return (
    isLowStock &&
    prediction.confidenceScore >= confidenceThreshold &&
    !pendingProductIds.has(prediction.productId)
  );
}

function compareRecommendations(
  left: LowStockRecommendation,
  right: LowStockRecommendation,
): number {
  return (
    STATE_PRIORITY[left.predictedState] -
      STATE_PRIORITY[right.predictedState] ||
    right.confidenceScore - left.confidenceScore ||
    left.productName.localeCompare(right.productName)
  );
}
