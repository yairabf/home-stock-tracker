import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProductService } from '../product/product.service';
import { HouseholdService } from '../household/household.service';
import { EstimationResult } from './types/estimation-result';
import { ProductEventHistory } from './types/product-event-history';
import { PredictedState, ProductType, InventoryEventType } from '../generated/prisma/enums';
import { MS_PER_DAY } from '../common/constants';

const RELEVANT_EVENT_TYPES: InventoryEventType[] = [
  InventoryEventType.PURCHASED,
  InventoryEventType.RESTOCKED,
  InventoryEventType.STOCK_LOW,
  InventoryEventType.STOCK_OUT,
  InventoryEventType.STOCK_CONFIRMED,
  InventoryEventType.STOCK_CORRECTED,
];



const PRODUCT_TYPE_THRESHOLDS: Record<ProductType, number> = {
  [ProductType.fast_consumable]: 7,
  [ProductType.pantry_staple]: 30,
  [ProductType.household_consumable]: 21,
  [ProductType.discrete_consumable]: 21,
};

const FALLBACK_THRESHOLD_DAYS = 14;

@Injectable()
export class EstimationService {
  private readonly logger = new Logger(EstimationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly productService: ProductService,
    private readonly householdService: HouseholdService,
  ) {}

  /**
   * Fetch learned statistics for a product, if available.
   */
  private async fetchProductStatistics(
    productId: string,
  ): Promise<{
    avgPurchaseIntervalDays: number | null;
    avgNeedIntervalDays: number | null;
    observationCount: number;
  } | null> {
    const stats = await this.prisma.productStatistics.findUnique({
      where: { productId },
      select: {
        avgPurchaseIntervalDays: true,
        avgNeedIntervalDays: true,
        observationCount: true,
      },
    });

    return stats;
  }

  async estimateProductState(productId: string): Promise<EstimationResult> {
    const product = await this.productService.findOne(productId);

    let result: EstimationResult;

    if (!product.predictionEnabled) {
      result = this.buildDisabledResult(productId, product.productType);
    } else {
      const eventHistory = await this.fetchProductEventHistory(productId);
      const learnedStats = await this.fetchProductStatistics(productId);

      const directResult = this.applyDirectSignalPrecedence(eventHistory);
      if (directResult) {
        const coldStart = this.isColdStart(eventHistory);
        const confidence = this.calculateConfidence(
          eventHistory,
          product.productType,
          coldStart,
          learnedStats !== null,
          learnedStats,
        );
        result = this.buildResult(
          productId,
          directResult.state,
          confidence,
          directResult.reason,
          eventHistory,
          product.productType,
          coldStart,
          learnedStats,
        );
      } else {
        const coldStart = this.isColdStart(eventHistory);
        if (coldStart) {
          const confidence = this.calculateConfidence(eventHistory, product.productType, true, learnedStats !== null, learnedStats);
          result = this.buildResult(
            productId,
            PredictedState.uncertain,
            confidence,
            'Insufficient data: fewer than 2 events or less than 7 days since first event',
            eventHistory,
            product.productType,
            true,
            learnedStats,
          );
        } else {
          const timeDecayResult = this.applyTimeDecayHeuristics(
            eventHistory,
            product.productType,
            learnedStats,
          );

          const confidence = this.calculateConfidence(
            eventHistory,
            product.productType,
            false,
            learnedStats !== null,
            learnedStats,
          );

          result = this.buildResult(
            productId,
            timeDecayResult.state,
            confidence,
            timeDecayResult.reason,
            eventHistory,
            product.productType,
            false,
            learnedStats,
          );
        }
      }
    }

    // Persist the prediction
    await this.savePrediction(result);

    return result;
  }

  private async fetchProductEventHistory(
    productId: string,
  ): Promise<ProductEventHistory> {
    const now = Date.now();
    const events = await this.prisma.inventoryEvent.findMany({
      where: {
        productId,
        eventType: { in: RELEVANT_EVENT_TYPES },
      },
      orderBy: { timestamp: 'desc' },
      take: 20,
    });

    const validEvents = events.filter((e) => {
      const isValid = e.timestamp.getTime() <= now;
      if (!isValid) {
        this.logger.warn(
          `Ignoring future-dated event ${e.id} for product ${productId} with timestamp ${e.timestamp.toISOString()}`,
        );
      }
      return isValid;
    });

    let lastPurchaseAt: Date | null = null;
    let lastRestockAt: Date | null = null;
    let lastLowStockAt: Date | null = null;
    let lastStockOutAt: Date | null = null;
    let lastStockConfirmationAt: Date | null = null;

    for (const event of validEvents) {
      switch (event.eventType) {
        case InventoryEventType.PURCHASED:
          if (!lastPurchaseAt) lastPurchaseAt = event.timestamp;
          break;
        case InventoryEventType.RESTOCKED:
          if (!lastRestockAt) lastRestockAt = event.timestamp;
          break;
        case InventoryEventType.STOCK_LOW:
          if (!lastLowStockAt) lastLowStockAt = event.timestamp;
          break;
        case InventoryEventType.STOCK_OUT:
          if (!lastStockOutAt) lastStockOutAt = event.timestamp;
          break;
        case InventoryEventType.STOCK_CONFIRMED:
          if (!lastStockConfirmationAt) lastStockConfirmationAt = event.timestamp;
          break;
      }
    }

    const firstEventAt =
      validEvents.length > 0 ? validEvents[validEvents.length - 1].timestamp : null;

    return {
      productId,
      events: validEvents.map((e) => ({
        id: e.id,
        eventType: e.eventType,
        timestamp: e.timestamp,
        quantity: e.quantity ?? undefined,
        unit: e.unit ?? undefined,
      })),
      firstEventAt,
      lastPurchaseAt,
      lastRestockAt,
      lastLowStockAt,
      lastStockOutAt,
      lastStockConfirmationAt,
      eventCount: validEvents.length,
    };
  }

  private applyDirectSignalPrecedence(
    history: ProductEventHistory,
  ): { state: PredictedState; reason: string } | null {
    const { events } = history;
    if (events.length === 0) return null;

    const mostRecent = events[0];
    const now = Date.now();
    const daysSinceEvent = (now - mostRecent.timestamp.getTime()) / MS_PER_DAY;

    switch (mostRecent.eventType) {
      case InventoryEventType.STOCK_OUT:
        return {
          state: PredictedState.probably_out,
          reason: `Most recent signal is STOCK_OUT from ${daysSinceEvent.toFixed(1)} days ago`,
        };
      case InventoryEventType.STOCK_LOW:
        return {
          state: PredictedState.probably_low,
          reason: `Most recent signal is STOCK_LOW from ${daysSinceEvent.toFixed(1)} days ago`,
        };
      case InventoryEventType.STOCK_CONFIRMED:
        if (daysSinceEvent <= 3) {
          return {
            state: PredictedState.likely_available,
            reason: `Most recent signal is STOCK_CONFIRMED from ${daysSinceEvent.toFixed(1)} days ago (within 3-day threshold)`,
          };
        }
        return null;
      default:
        return null;
    }
  }

  private isColdStart(history: ProductEventHistory): boolean {
    if (history.eventCount < 2) return true;
    if (!history.firstEventAt) return true;
    const daysSinceFirstEvent =
      (Date.now() - history.firstEventAt.getTime()) / MS_PER_DAY;
    return daysSinceFirstEvent < 7;
  }

  private applyTimeDecayHeuristics(
    history: ProductEventHistory,
    productType: ProductType | null,
    learnedStats: { avgPurchaseIntervalDays: number | null; avgNeedIntervalDays: number | null } | null,
  ): { state: PredictedState; reason: string } {
    // Use learned interval if available, otherwise fall back to product-type thresholds
    const hasLearnedInterval = learnedStats !== null && learnedStats.avgPurchaseIntervalDays !== null;
    const thresholdDays = hasLearnedInterval
      ? learnedStats.avgPurchaseIntervalDays!
      : productType
        ? PRODUCT_TYPE_THRESHOLDS[productType] ?? FALLBACK_THRESHOLD_DAYS
        : FALLBACK_THRESHOLD_DAYS;

    const lastPurchase = history.lastPurchaseAt ?? history.lastRestockAt;
    const daysSincePurchase = lastPurchase
      ? (Date.now() - lastPurchase.getTime()) / MS_PER_DAY
      : null;

    if (daysSincePurchase === null) {
      return {
        state: PredictedState.uncertain,
        reason: 'No purchase or restock events recorded; cannot estimate availability',
      };
    }

    // Apply learned interval with buffer (80% of avg = likely_available, 120%+ = probably_low)
    if (hasLearnedInterval) {
      // Use ±20% buffer for learned intervals
      const lowerBound = thresholdDays * 0.8;
      const upperBound = thresholdDays * 1.2;

      if (daysSincePurchase <= lowerBound) {
        return {
          state: PredictedState.likely_available,
          reason: `Last purchase ${daysSincePurchase.toFixed(1)} days ago; within learned ${thresholdDays.toFixed(1)}-day interval (±20% buffer)`,
        };
      }

      if (daysSincePurchase >= upperBound) {
        return {
          state: PredictedState.probably_low,
          reason: `Last purchase ${daysSincePurchase.toFixed(1)} days ago; exceeds learned ${thresholdDays.toFixed(1)}-day interval (±20% buffer)`,
        };
      }

      // In between bounds - uncertain zone
      return {
        state: PredictedState.uncertain,
        reason: `Last purchase ${daysSincePurchase.toFixed(1)} days ago; near learned ${thresholdDays.toFixed(1)}-day interval (within 80-120% range)`,
      };
    } else {
      // Use exact threshold for product-type defaults (backward compatible)
      if (daysSincePurchase <= thresholdDays) {
        return {
          state: PredictedState.likely_available,
          reason: `Last purchase ${daysSincePurchase.toFixed(1)} days ago; within ${thresholdDays}-day threshold for ${productType ?? 'unknown'} product type`,
        };
      }

      return {
        state: PredictedState.probably_low,
        reason: `Last purchase ${daysSincePurchase.toFixed(1)} days ago; exceeds ${thresholdDays}-day threshold for ${productType ?? 'unknown'} product type`,
      };
    }
  }

  /**
   * Calculate confidence score based on signal quality and data availability.
   *
   * Confidence scoring formula:
   * - Base: 0.5
   * - +0.2 if productType is known
   * - +0.1 per extra event beyond 2 (capped at +0.2)
   * - +0.1 if last signal is within 7 days
   * - -0.2 if cold-start (insufficient history)
   * - +0.1 if learned statistics available
   * - +0.1 if learned statistics derived from 5+ events (observationCount)
   * - Final score clamped to [0.0, 1.0]
   */
  private calculateConfidence(
    history: ProductEventHistory,
    productType: ProductType | null,
    coldStart: boolean,
    hasLearnedStatistics: boolean,
    learnedStats?: { avgPurchaseIntervalDays: number | null; avgNeedIntervalDays: number | null; observationCount: number } | null,
  ): number {
    let confidence = 0.5;

    if (productType) confidence += 0.2;

    const extraEvents = Math.max(0, history.eventCount - 2);
    confidence += Math.min(extraEvents * 0.1, 0.2);

    const lastSignal =
      history.lastPurchaseAt ??
      history.lastRestockAt ??
      history.lastLowStockAt ??
      history.lastStockOutAt ??
      history.lastStockConfirmationAt;

    if (lastSignal) {
      const daysSinceSignal = (Date.now() - lastSignal.getTime()) / MS_PER_DAY;
      if (daysSinceSignal <= 7) confidence += 0.1;
    }

    if (coldStart) confidence -= 0.2;

    // Boost confidence when learned statistics are available
    if (hasLearnedStatistics) {
      confidence += 0.1;
      // Additional boost if derived from 5+ events (stored in ProductStatistics.observationCount)
      if (learnedStats && learnedStats.observationCount >= 5) {
        confidence += 0.1;
      }
    }

    return Math.max(0.0, Math.min(1.0, confidence));
  }

  private buildResult(
    productId: string,
    predictedState: PredictedState,
    confidenceScore: number,
    reason: string,
    history: ProductEventHistory,
    productType: ProductType | null,
    coldStart: boolean,
    learnedStats: { avgPurchaseIntervalDays: number | null; avgNeedIntervalDays: number | null } | null,
  ): EstimationResult {
    const now = Date.now();
    return {
      productId,
      predictedState,
      confidenceScore,
      reason,
      deterministicSignals: {
        lastPurchaseAt: history.lastPurchaseAt,
        lastLowStockSignalAt: history.lastLowStockAt,
        lastStockConfirmationAt: history.lastStockConfirmationAt,
        daysSinceLastPurchase: history.lastPurchaseAt
          ? (now - history.lastPurchaseAt.getTime()) / MS_PER_DAY
          : null,
        daysSinceLastLowSignal: history.lastLowStockAt
          ? (now - history.lastLowStockAt.getTime()) / MS_PER_DAY
          : null,
        productType,
        eventCount: history.eventCount,
        coldStart,
        hasLearnedStatistics: learnedStats !== null,
        avgPurchaseIntervalDays: learnedStats?.avgPurchaseIntervalDays ?? null,
        avgNeedIntervalDays: learnedStats?.avgNeedIntervalDays ?? null,
      },
    };
  }

  private async savePrediction(result: EstimationResult): Promise<void> {
    try {
      await this.prisma.prediction.create({
        data: {
          productId: result.productId,
          predictedState: result.predictedState,
          confidenceScore: result.confidenceScore,
          reason: result.reason,
          deterministicSignals: {
            lastPurchaseAt: result.deterministicSignals.lastPurchaseAt?.toISOString() ?? null,
            lastLowStockSignalAt: result.deterministicSignals.lastLowStockSignalAt?.toISOString() ?? null,
            lastStockConfirmationAt: result.deterministicSignals.lastStockConfirmationAt?.toISOString() ?? null,
            daysSinceLastPurchase: result.deterministicSignals.daysSinceLastPurchase,
            daysSinceLastLowSignal: result.deterministicSignals.daysSinceLastLowSignal,
            productType: result.deterministicSignals.productType,
            eventCount: result.deterministicSignals.eventCount,
            coldStart: result.deterministicSignals.coldStart,
            hasLearnedStatistics: result.deterministicSignals.hasLearnedStatistics,
            avgPurchaseIntervalDays: result.deterministicSignals.avgPurchaseIntervalDays,
            avgNeedIntervalDays: result.deterministicSignals.avgNeedIntervalDays,
          },
        },
      });
    } catch (error) {
      this.logger.error(
        `Failed to save prediction for product ${result.productId}: ${error}`,
      );
      // Don't throw - persistence failure shouldn't affect the response
    }
  }

  private buildDisabledResult(
    productId: string,
    productType: ProductType | null,
  ): EstimationResult {
    return {
      productId,
      predictedState: PredictedState.uncertain,
      confidenceScore: 0.0,
      reason: 'Prediction is disabled for this product',
      deterministicSignals: {
        lastPurchaseAt: null,
        lastLowStockSignalAt: null,
        lastStockConfirmationAt: null,
        daysSinceLastPurchase: null,
        daysSinceLastLowSignal: null,
        productType,
        eventCount: 0,
        coldStart: true,
        hasLearnedStatistics: false,
        avgPurchaseIntervalDays: null,
        avgNeedIntervalDays: null,
      },
    };
  }
}
