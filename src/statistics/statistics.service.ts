import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProductService } from '../product/product.service';
import { HouseholdService } from '../household/household.service';
import { ProductStatisticsResult } from './types/product-statistics-result';
import { calculateStatistics } from './statistics-calculation';

@Injectable()
export class StatisticsService {
  private readonly logger = new Logger(StatisticsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly productService: ProductService,
    private readonly householdService: HouseholdService,
  ) {}

  async calculateProductStatistics(
    productId: string,
  ): Promise<ProductStatisticsResult> {
    // Verify product exists
    await this.productService.findOne(productId);

    // Fetch all relevant inventory events for this product
    const events = await this.prisma.inventoryEvent.findMany({
      where: { productId },
      orderBy: { timestamp: 'desc' },
    });

    const householdSize = await this.getHouseholdSize();
    return this.persistStatistics(
      productId,
      calculateStatistics(events, householdSize),
    );
  }

  /**
   * Get household size (adults + children) with fallback defaults.
   * Logs warning on failure but continues with defaults.
   */
  private async getHouseholdSize(): Promise<number> {
    const DEFAULT_ADULTS = 2;
    const DEFAULT_CHILDREN = 3;

    try {
      const household = await this.householdService.getOrCreate();
      return household.adultsCount + household.childrenCount;
    } catch (error) {
      this.logger.warn(`Failed to fetch household, using defaults: ${error}`);
      return DEFAULT_ADULTS + DEFAULT_CHILDREN;
    }
  }

  /**
   * Persist computed statistics to ProductStatistics table (upsert).
   * Idempotent: multiple calls with same data produce same result.
   * Returns the persisted statistics.
   */
  private async persistStatistics(
    productId: string,
    data: {
      avgPurchaseIntervalDays: number | null;
      avgNeedIntervalDays: number | null;
      typicalPurchaseQuantity: number | null;
      estimatedConsumptionIntervalDays: number | null;
      lastPurchaseAt: Date | null;
      lastLowStockSignalAt: Date | null;
      lastStockConfirmationAt: Date | null;
      observationCount: number;
    },
  ): Promise<ProductStatisticsResult> {
    const stats = await this.prisma.productStatistics.upsert({
      where: { productId },
      create: {
        productId,
        avgPurchaseIntervalDays: data.avgPurchaseIntervalDays,
        avgNeedIntervalDays: data.avgNeedIntervalDays,
        typicalPurchaseQuantity: data.typicalPurchaseQuantity,
        estimatedConsumptionIntervalDays: data.estimatedConsumptionIntervalDays,
        lastPurchaseAt: data.lastPurchaseAt,
        lastLowStockSignalAt: data.lastLowStockSignalAt,
        lastStockConfirmationAt: data.lastStockConfirmationAt,
        observationCount: data.observationCount,
      },
      update: {
        avgPurchaseIntervalDays: data.avgPurchaseIntervalDays,
        avgNeedIntervalDays: data.avgNeedIntervalDays,
        typicalPurchaseQuantity: data.typicalPurchaseQuantity,
        estimatedConsumptionIntervalDays: data.estimatedConsumptionIntervalDays,
        lastPurchaseAt: data.lastPurchaseAt,
        lastLowStockSignalAt: data.lastLowStockSignalAt,
        lastStockConfirmationAt: data.lastStockConfirmationAt,
        observationCount: data.observationCount,
      },
    });

    return {
      productId: stats.productId,
      avgPurchaseIntervalDays: stats.avgPurchaseIntervalDays,
      avgNeedIntervalDays: stats.avgNeedIntervalDays,
      typicalPurchaseQuantity: stats.typicalPurchaseQuantity,
      estimatedConsumptionIntervalDays: stats.estimatedConsumptionIntervalDays,
      observationCount: stats.observationCount,
      lastPurchaseAt: stats.lastPurchaseAt,
      lastLowStockSignalAt: stats.lastLowStockSignalAt,
      lastStockConfirmationAt: stats.lastStockConfirmationAt,
      updatedAt: stats.updatedAt,
    };
  }
}
