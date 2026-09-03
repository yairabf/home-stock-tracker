import { PredictedState } from '../../generated/prisma/enums';

export type LowStockState = Extract<
  PredictedState,
  'probably_low' | 'probably_out'
>;

export interface RecommendationCandidate {
  productId: string;
  productName: string;
  predictionId: string | null;
  predictedState: PredictedState;
  confidenceScore: number;
  reason: string;
  recommendedAction: string | null;
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
    .filter((candidate) =>
      qualifies(candidate, confidenceThreshold, pendingProductIds),
    )
    .map((candidate) => ({
      ...candidate,
      predictedState: candidate.predictedState as LowStockState,
    }))
    .sort(compareRecommendations);
}

function qualifies(
  candidate: RecommendationCandidate,
  confidenceThreshold: number,
  pendingProductIds: ReadonlySet<string>,
): boolean {
  const isLowStock =
    candidate.predictedState === PredictedState.probably_low ||
    candidate.predictedState === PredictedState.probably_out;

  return (
    isLowStock &&
    candidate.confidenceScore >= confidenceThreshold &&
    !pendingProductIds.has(candidate.productId)
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
