import type {
  ExpirationRecommendation,
  ExpirationRecommendations,
} from '../expiration-recommendation';

export class ExpirationRecommendationItemResponseDto {
  productId: string;
  productName: string;
  category: string | null;
  purchaseEventId: string;
  purchasedAt: Date;
  expiresAt: Date;
  expirySource: ExpirationRecommendation['expirySource'];
  stockConfidence: number;
  stockEvaluatedAt: Date;
  expiryConfidence: number;
  confidenceScore: number;
  batchPresenceUnconfirmed: true;

  static fromDomain(
    recommendation: ExpirationRecommendation,
  ): ExpirationRecommendationItemResponseDto {
    return Object.assign(
      new ExpirationRecommendationItemResponseDto(),
      recommendation,
    );
  }
}

export class ExpirationRecommendationListResponseDto {
  evaluatedAt: Date;
  expiringSoon: ExpirationRecommendationItemResponseDto[];
  possiblyExpired: ExpirationRecommendationItemResponseDto[];

  static fromDomain(
    recommendations: ExpirationRecommendations,
  ): ExpirationRecommendationListResponseDto {
    return Object.assign(new ExpirationRecommendationListResponseDto(), {
      evaluatedAt: recommendations.evaluatedAt,
      expiringSoon: recommendations.expiringSoon.map(
        ExpirationRecommendationItemResponseDto.fromDomain,
      ),
      possiblyExpired: recommendations.possiblyExpired.map(
        ExpirationRecommendationItemResponseDto.fromDomain,
      ),
    });
  }
}
