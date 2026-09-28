import { PredictedState, ShelfLifePolicyKind } from '../generated/prisma/enums';
import { evaluateExpirationStatus, type ExpirySource } from './expiration-status';

export interface ExpirationRecommendationCandidate {
  purchaseEventId: string;
  productId: string;
  productName: string;
  category: string | null;
  purchasedAt: Date;
  explicitExpiresAt: Date | null;
  shelfLifePolicy: {
    kind: ShelfLifePolicyKind;
    shelfLifeDays: number | null;
    confidence: number;
  } | null;
  stockProjection: {
    estimatedQuantity: number | null;
    estimatedState: PredictedState;
    confidence: number;
    evaluatedAt: Date;
  } | null;
}

export interface ExpirationRecommendation {
  productId: string;
  productName: string;
  category: string | null;
  purchaseEventId: string;
  purchasedAt: Date;
  expiresAt: Date;
  expirySource: Exclude<ExpirySource, 'none'>;
  stockConfidence: number;
  stockEvaluatedAt: Date;
  expiryConfidence: number;
  confidenceScore: number;
  batchPresenceUnconfirmed: true;
}

export interface ExpirationRecommendations {
  evaluatedAt: Date;
  expiringSoon: ExpirationRecommendation[];
  possiblyExpired: ExpirationRecommendation[];
}

export function selectExpirationRecommendations(
  candidates: readonly ExpirationRecommendationCandidate[],
  evaluatedAt: Date,
): ExpirationRecommendations {
  const earliestByProduct = new Map<string, ExpirationRecommendation>();

  for (const candidate of candidates) {
    const projection = candidate.stockProjection;
    if (
      !projection ||
      projection.estimatedState === PredictedState.probably_out ||
      (projection.estimatedQuantity !== null &&
        projection.estimatedQuantity <= 0) ||
      !validConfidence(projection.confidence) ||
      !validDate(projection.evaluatedAt) ||
      !validDate(candidate.purchasedAt) ||
      !candidate.productName
    ) {
      continue;
    }

    const expiry = evaluateExpirationStatus({
      purchasedAt: candidate.purchasedAt,
      explicitExpiresAt: candidate.explicitExpiresAt,
      shelfLifePolicy: candidate.shelfLifePolicy,
      asOf: evaluatedAt,
    });
    if (
      (expiry.status !== 'expired' && expiry.status !== 'expiring_soon') ||
      !expiry.expiresAt ||
      expiry.expirySource === 'none'
    ) {
      continue;
    }

    const expiryConfidence =
      expiry.expirySource === 'explicit'
        ? 1
        : candidate.shelfLifePolicy?.confidence;
    if (!validConfidence(expiryConfidence)) continue;

    const recommendation: ExpirationRecommendation = {
      productId: candidate.productId,
      productName: candidate.productName,
      category: candidate.category,
      purchaseEventId: candidate.purchaseEventId,
      purchasedAt: candidate.purchasedAt,
      expiresAt: expiry.expiresAt,
      expirySource: expiry.expirySource,
      stockConfidence: projection.confidence,
      stockEvaluatedAt: projection.evaluatedAt,
      expiryConfidence,
      confidenceScore: Math.min(projection.confidence, expiryConfidence),
      batchPresenceUnconfirmed: true,
    };
    const earlier = earliestByProduct.get(candidate.productId);
    if (!earlier || compareRecommendations(recommendation, earlier) < 0) {
      earliestByProduct.set(candidate.productId, recommendation);
    }
  }

  const selected = [...earliestByProduct.values()].sort(compareRecommendations);
  return {
    evaluatedAt,
    expiringSoon: selected.filter((item) => item.expiresAt > evaluatedAt),
    possiblyExpired: selected.filter((item) => item.expiresAt <= evaluatedAt),
  };
}

function compareRecommendations(
  left: ExpirationRecommendation,
  right: ExpirationRecommendation,
): number {
  return (
    left.expiresAt.getTime() - right.expiresAt.getTime() ||
    left.productName.localeCompare(right.productName) ||
    left.productId.localeCompare(right.productId) ||
    left.purchaseEventId.localeCompare(right.purchaseEventId)
  );
}

function validConfidence(value: number | undefined): value is number {
  return value !== undefined && Number.isFinite(value) && value >= 0 && value <= 1;
}

function validDate(value: Date): boolean {
  return !Number.isNaN(value.getTime());
}
