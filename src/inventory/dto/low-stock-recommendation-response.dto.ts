import type { LowStockState } from '../types/low-stock-recommendation';
import type { LowStockRecommendation } from '../types/low-stock-recommendation';

export class LowStockRecommendationDto {
  productId: string;
  productName: string;
  predictionId: string | null;
  predictedState: LowStockState;
  confidenceScore: number;
  reason: string;
  recommendedAction: string | null;

  static fromDomain(
    recommendation: LowStockRecommendation,
  ): LowStockRecommendationDto {
    const dto = new LowStockRecommendationDto();
    dto.productId = recommendation.productId;
    dto.productName = recommendation.productName;
    dto.predictionId = recommendation.predictionId;
    dto.predictedState = recommendation.predictedState;
    dto.confidenceScore = recommendation.confidenceScore;
    dto.reason = recommendation.reason;
    dto.recommendedAction = recommendation.recommendedAction;
    return dto;
  }
}

export class LowStockRecommendationListResponseDto {
  recommendations: LowStockRecommendationDto[];

  static fromDomain(
    recommendations: LowStockRecommendation[],
  ): LowStockRecommendationListResponseDto {
    const dto = new LowStockRecommendationListResponseDto();
    dto.recommendations = recommendations.map(
      LowStockRecommendationDto.fromDomain,
    );
    return dto;
  }
}
