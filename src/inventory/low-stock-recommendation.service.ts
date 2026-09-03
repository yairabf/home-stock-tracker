import { Injectable } from '@nestjs/common';
import {
  GroceryItemStatus,
  PredictedState,
  ProductNameKind,
} from '../generated/prisma/enums';
import { HouseholdService } from '../household/household.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  selectLowStockRecommendations,
  type LowStockRecommendation,
  type RecommendationCandidate,
} from './types/low-stock-recommendation';
import { OperationalLogger } from '../observability/operational-logger.service';

@Injectable()
export class LowStockRecommendationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly householdService: HouseholdService,
    private readonly operationalLogger: OperationalLogger,
  ) {}

  async getRecommendations(): Promise<LowStockRecommendation[]> {
    const [household, products, pendingItems] = await Promise.all([
      this.householdService.getOrCreate(),
      this.prisma.product.findMany({
        where: {
          predictionEnabled: true,
          stockProjection: { isNot: null },
        },
        select: {
          id: true,
          names: {
            where: { kind: ProductNameKind.canonical },
            select: { displayName: true },
          },
          stockProjection: {
            select: {
              estimatedState: true,
              confidence: true,
              reason: true,
              predictionId: true,
              prediction: { select: { recommendedAction: true } },
            },
          },
        },
      }),
      this.prisma.groceryListItem.findMany({
        where: { status: GroceryItemStatus.pending },
        select: { productId: true },
      }),
    ]);
    const pendingProductIds = new Set(
      pendingItems.map(({ productId }) => productId),
    );
    const candidates = products.map((product) => this.toCandidate(product));

    return selectLowStockRecommendations(
      candidates.filter(
        (candidate): candidate is RecommendationCandidate => candidate !== null,
      ),
      household.suggestionConfidenceThreshold,
      pendingProductIds,
    );
  }

  private toCandidate(product: {
    id: string;
    names: { displayName: string }[];
    stockProjection: {
      estimatedState: PredictedState;
      confidence: number;
      reason: string;
      predictionId: string | null;
      prediction: { recommendedAction: string | null } | null;
    } | null;
  }): RecommendationCandidate | null {
    const canonicalName = product.names[0]?.displayName;
    const projection = product.stockProjection;
    if (!canonicalName || !projection) {
      this.operationalLogger.predictionRun({
        action: 'recommend',
        outcome: 'failure',
        productId: product.id,
      });
      return null;
    }
    return {
      productId: product.id,
      productName: canonicalName,
      predictionId: projection.predictionId,
      predictedState: projection.estimatedState,
      confidenceScore: projection.confidence,
      reason: projection.reason,
      recommendedAction: projection.prediction?.recommendedAction ?? null,
    };
  }
}
