import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProductService } from '../product/product.service';
import { HouseholdService } from '../household/household.service';
import { EstimationResult } from './types/estimation-result';
import { ProductEventHistory } from './types/product-event-history';
import { PredictedState, ProductType, InventoryEventType } from '../generated/prisma/enums';

const RELEVANT_EVENT_TYPES: InventoryEventType[] = [
  InventoryEventType.PURCHASED,
  InventoryEventType.RESTOCKED,
  InventoryEventType.STOCK_LOW,
  InventoryEventType.STOCK_OUT,
  InventoryEventType.STOCK_CONFIRMED,
  InventoryEventType.STOCK_CORRECTED,
];

const MS_PER_DAY = 24 * 60 * 60 * 1000;

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

  async estimateProductState(productId: string): Promise<EstimationResult> {
    const product = await this.productService.findOne(productId);

    let result: EstimationResult;

    if (!product.predictionEnabled) {
      result = this.buildDisabledResult(productId, product.productType);
    } else {
      const eventHistory = await this.fetchProductEventHistory(productId);

      const directResult = this.applyDirectSignalPrecedence(eventHistory);
      if (directResult) {
        const coldStart = this.isColdStart(eventHistory);
        const confidence = this.calculateConfidence(
          eventHistory,
          product.productType,
          coldStart,
        );
        result = this.buildResult(
          productId,
          directResult.state,
          confidence,
          directResult.reason,
          eventHistory,
          product.productType,
          coldStart,
        );
      } else {
        const coldStart = this.isColdStart(eventHistory);
        if (coldStart) {
          const confidence = this.calculateConfidence(eventHistory, product.productType, true);
          result = this.buildResult(
            productId,
            PredictedState.uncertain,
            confidence,
            'Insufficient data: fewer than 2 events or less than 7 days since first event',
            eventHistory,
            product.productType,
            true,
          );
        } else {
          const timeDecayResult = this.applyTimeDecayHeuristics(
            eventHistory,
            product.productType,
          );

          const confidence = this.calculateConfidence(
            eventHistory,
            product.productType,
            false,
          );

          result = this.buildResult(
            productId,
            timeDecayResult.state,
            confidence,
            timeDecayResult.reason,
            eventHistory,
            product.productType,
            false,
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
  ): { state: PredictedState; reason: string } {
    const thresholdDays = productType
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

  private calculateConfidence(
    history: ProductEventHistory,
    productType: ProductType | null,
    coldStart: boolean,
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
      },
    };
  }
}
