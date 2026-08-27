import { Inject, Injectable } from '@nestjs/common';
import { GroceryItemStatus } from '../generated/prisma/enums';
import {
  PREDICTION_ENGINE,
  type PredictionEngine,
} from '../estimation/prediction-engine';
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
    @Inject(PREDICTION_ENGINE)
    private readonly predictionEngine: PredictionEngine,
    private readonly operationalLogger: OperationalLogger,
  ) {}

  async getRecommendations(): Promise<LowStockRecommendation[]> {
    const [household, products, pendingItems] = await Promise.all([
      this.householdService.getOrCreate(),
      this.prisma.product.findMany({
        where: { predictionEnabled: true },
        select: { id: true, canonicalName: true },
      }),
      this.prisma.groceryListItem.findMany({
        where: { status: GroceryItemStatus.pending },
        select: { productId: true },
      }),
    ]);
    const pendingProductIds = new Set(
      pendingItems.map(({ productId }) => productId),
    );
    const eligibleProducts = products.filter(
      ({ id }) => !pendingProductIds.has(id),
    );
    const candidates = await Promise.all(
      eligibleProducts.map((product) => this.predictSafely(product)),
    );

    return selectLowStockRecommendations(
      candidates.filter(
        (candidate): candidate is RecommendationCandidate => candidate !== null,
      ),
      household.suggestionConfidenceThreshold,
      pendingProductIds,
    );
  }

  private async predictSafely(product: {
    id: string;
    canonicalName: string;
  }): Promise<RecommendationCandidate | null> {
    try {
      return {
        productName: product.canonicalName,
        prediction: await this.predictionEngine.predictProduct(product.id),
      };
    } catch {
      this.operationalLogger.predictionRun({
        action: 'recommend',
        outcome: 'failure',
        productId: product.id,
      });
      return null;
    }
  }
}
