import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProductService } from '../product/product.service';
import { HouseholdService } from '../household/household.service';
import { ProductStatisticsResult } from './types/product-statistics-result';
import { InventoryEventType } from '../generated/prisma/enums';
import { MS_PER_DAY } from '../common/constants';

const MAX_EVENTS_FOR_CALCULATION = 20;

const PURCHASE_EVENT_TYPES: InventoryEventType[] = [
  InventoryEventType.PURCHASED,
  InventoryEventType.RESTOCKED,
];

const NEED_EVENT_TYPES: InventoryEventType[] = [
  InventoryEventType.STOCK_LOW,
  InventoryEventType.STOCK_OUT,
  InventoryEventType.GROCERY_ADDED,
];

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

    // Extract timestamps for last signals
    let lastPurchaseAt: Date | null = null;
    let lastLowStockSignalAt: Date | null = null;
    let lastStockConfirmationAt: Date | null = null;

    for (const event of events) {
      if (PURCHASE_EVENT_TYPES.includes(event.eventType) && !lastPurchaseAt) {
        lastPurchaseAt = event.timestamp;
      }
      if (NEED_EVENT_TYPES.includes(event.eventType) && !lastLowStockSignalAt) {
        lastLowStockSignalAt = event.timestamp;
      }
      if (
        event.eventType === InventoryEventType.STOCK_CONFIRMED &&
        !lastStockConfirmationAt
      ) {
        lastStockConfirmationAt = event.timestamp;
      }
    }

    // Calculate intervals and quantities
    const avgPurchaseIntervalDays = this.calculatePurchaseInterval(events);
    const avgNeedIntervalDays = this.calculateNeedInterval(events);
    const typicalPurchaseQuantity =
      this.calculateTypicalPurchaseQuantity(events);

    // Get household size for consumption estimation
    const householdSize = await this.getHouseholdSize();
    const estimatedConsumptionIntervalDays = this.estimateConsumptionInterval(
      avgPurchaseIntervalDays,
      typicalPurchaseQuantity,
      householdSize,
    );

    // Count total relevant events (used in any calculation)
    const relevantEventTypes = new Set([
      ...PURCHASE_EVENT_TYPES,
      ...NEED_EVENT_TYPES,
      InventoryEventType.STOCK_CONFIRMED,
    ]);
    const observationCount = events.filter((e) =>
      relevantEventTypes.has(e.eventType),
    ).length;

    // Persist and return results
    return this.persistStatistics(productId, {
      avgPurchaseIntervalDays,
      avgNeedIntervalDays,
      typicalPurchaseQuantity,
      estimatedConsumptionIntervalDays,
      lastPurchaseAt,
      lastLowStockSignalAt,
      lastStockConfirmationAt,
      observationCount,
    });
  }

  /**
   * Calculate average purchase interval in days from consecutive PURCHASED/RESTOCKED events.
   * Returns null if fewer than 2 purchase events exist.
   * Uses only the most recent MAX_EVENTS_FOR_CALCULATION events for stability.
   */
  private calculatePurchaseInterval(
    events: Array<{ eventType: InventoryEventType; timestamp: Date }>,
  ): number | null {
    const purchaseEvents = events
      .filter((e) => PURCHASE_EVENT_TYPES.includes(e.eventType))
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, MAX_EVENTS_FOR_CALCULATION);

    if (purchaseEvents.length < 2) {
      return null;
    }

    // Calculate intervals between consecutive purchases (most recent first)
    const intervals: number[] = [];
    for (let i = 0; i < purchaseEvents.length - 1; i++) {
      const daysBetween =
        (purchaseEvents[i].timestamp.getTime() -
          purchaseEvents[i + 1].timestamp.getTime()) /
        MS_PER_DAY;
      intervals.push(daysBetween);
    }

    // Return mean interval
    const sum = intervals.reduce((acc, val) => acc + val, 0);
    return sum / intervals.length;
  }

  /**
   * Calculate average need interval in days from consecutive STOCK_LOW/STOCK_OUT/GROCERY_ADDED events.
   * Returns null if fewer than 2 need events exist.
   * Uses only the most recent MAX_EVENTS_FOR_CALCULATION events for stability.
   */
  private calculateNeedInterval(
    events: Array<{ eventType: InventoryEventType; timestamp: Date }>,
  ): number | null {
    const needEvents = events
      .filter((e) => NEED_EVENT_TYPES.includes(e.eventType))
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, MAX_EVENTS_FOR_CALCULATION);

    if (needEvents.length < 2) {
      return null;
    }

    // Calculate intervals between consecutive need signals (most recent first)
    const intervals: number[] = [];
    for (let i = 0; i < needEvents.length - 1; i++) {
      const daysBetween =
        (needEvents[i].timestamp.getTime() -
          needEvents[i + 1].timestamp.getTime()) /
        MS_PER_DAY;
      intervals.push(daysBetween);
    }

    // Return mean interval
    const sum = intervals.reduce((acc, val) => acc + val, 0);
    return sum / intervals.length;
  }

  /**
   * Calculate typical purchase quantity (mode/median) from PURCHASED events.
   * Returns null if no valid quantity data exists.
   * Ignores null, 0, and undefined quantities.
   */
  private calculateTypicalPurchaseQuantity(
    events: Array<{ eventType: InventoryEventType; quantity?: number | null }>,
  ): number | null {
    const purchaseEvents = events.filter(
      (e) =>
        PURCHASE_EVENT_TYPES.includes(e.eventType) &&
        e.quantity != null &&
        e.quantity > 0,
    );

    if (purchaseEvents.length === 0) {
      return null;
    }

    const quantities = purchaseEvents
      .map((e) => e.quantity as number)
      .sort((a, b) => a - b);

    // Use median for typical quantity (more robust than mode for continuous values)
    const mid = Math.floor(quantities.length / 2);
    return quantities.length % 2 !== 0
      ? quantities[mid]
      : (quantities[mid - 1] + quantities[mid]) / 2;
  }

  /**
   * Estimate consumption interval in days based on purchase frequency, quantity, and household size.
   * Formula: avgPurchaseIntervalDays * typicalPurchaseQuantity / householdSize
   * Returns null if required data is missing.
   */
  private estimateConsumptionInterval(
    avgPurchaseIntervalDays: number | null,
    typicalPurchaseQuantity: number | null,
    householdSize: number,
  ): number | null {
    if (
      avgPurchaseIntervalDays === null ||
      typicalPurchaseQuantity === null ||
      householdSize <= 0
    ) {
      return null;
    }

    return (avgPurchaseIntervalDays * typicalPurchaseQuantity) / householdSize;
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
