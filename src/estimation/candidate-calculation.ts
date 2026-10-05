import {
  PredictedState,
  ProductType,
  InventoryEventType,
} from '../generated/prisma/enums';
import { MS_PER_DAY } from '../common/constants';
import type {
  ProductEvent,
  ProductEventHistory,
} from './types/product-event-history';
import type { DeterministicPredictionCandidate } from './types/prediction-result';

export const STOCK_HISTORY_EVENT_TYPES: InventoryEventType[] = [
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

export interface LearnedStatistics {
  avgPurchaseIntervalDays: number | null;
  avgNeedIntervalDays: number | null;
  estimatedConsumptionIntervalDays: number | null;
  observationCount: number;
}

export interface HouseholdPredictionContext {
  adultsCount: number;
  childrenCount: number;
  childAgeGroups: string[];
  predictionPreferences: Record<string, unknown> | null;
}

export interface ProductPredictionContext {
  productType: ProductType | null;
  isPerishable: boolean | null;
  predictionStrategy: string | null;
}

export function calculateCandidate(
  history: ProductEventHistory,
  stats: LearnedStatistics | null,
  product: ProductPredictionContext,
  household: HouseholdPredictionContext,
  now: number,
): DeterministicPredictionCandidate {
  return new CandidateCalculation(now).build(
    history,
    stats,
    product,
    household,
  );
}

class CandidateCalculation {
  constructor(private readonly now: number) {}
  build(
    eventHistory: ProductEventHistory,
    learnedStats: LearnedStatistics | null,
    product: ProductPredictionContext,
    household: HouseholdPredictionContext,
  ): DeterministicPredictionCandidate {
    const productContext: ProductPredictionContext = {
      productType: product.productType,
      isPerishable: product.isPerishable,
      predictionStrategy: product.predictionStrategy,
    };
    const householdContext: HouseholdPredictionContext = {
      adultsCount: household.adultsCount,
      childrenCount: household.childrenCount,
      childAgeGroups: household.childAgeGroups,
      predictionPreferences: household.predictionPreferences,
    };

    const directResult = this.applyDirectSignalPrecedence(eventHistory);
    const coldStart = this.isColdStart(eventHistory);
    const confidence = this.calculateConfidence(
      eventHistory,
      product.productType,
      coldStart,
      learnedStats !== null,
      learnedStats,
    );

    if (directResult) {
      return this.buildCandidate(
        directResult.state,
        confidence,
        directResult.reason,
        eventHistory,
        productContext,
        coldStart,
        learnedStats,
        householdContext,
        true,
      );
    }

    if (coldStart) {
      return this.buildCandidate(
        PredictedState.uncertain,
        confidence,
        'Insufficient data: fewer than 2 events or less than 7 days since first event',
        eventHistory,
        productContext,
        true,
        learnedStats,
        householdContext,
        false,
      );
    }

    const timeDecayResult = this.applyTimeDecayHeuristics(
      eventHistory,
      product.productType,
      learnedStats,
    );

    return this.buildCandidate(
      timeDecayResult.state,
      confidence,
      timeDecayResult.reason,
      eventHistory,
      productContext,
      false,
      learnedStats,
      householdContext,
      false,
    );
  }

  private applyDirectSignalPrecedence(
    history: ProductEventHistory,
  ): { state: PredictedState; reason: string } | null {
    const { events } = history;
    if (events.length === 0) return null;

    const mostRecent = events[0];
    const now = this.now;
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
      (this.now - history.firstEventAt.getTime()) / MS_PER_DAY;
    return daysSinceFirstEvent < 7;
  }

  private applyTimeDecayHeuristics(
    history: ProductEventHistory,
    productType: ProductType | null,
    learnedStats: LearnedStatistics | null,
  ): { state: PredictedState; reason: string } {
    const hasLearnedInterval =
      learnedStats !== null && learnedStats.avgPurchaseIntervalDays !== null;
    const thresholdDays = hasLearnedInterval
      ? learnedStats.avgPurchaseIntervalDays!
      : productType
        ? (PRODUCT_TYPE_THRESHOLDS[productType] ?? FALLBACK_THRESHOLD_DAYS)
        : FALLBACK_THRESHOLD_DAYS;

    const lastPurchase = history.lastPurchaseAt ?? history.lastRestockAt;
    const daysSincePurchase = lastPurchase
      ? (this.now - lastPurchase.getTime()) / MS_PER_DAY
      : null;

    if (daysSincePurchase === null) {
      return {
        state: PredictedState.uncertain,
        reason:
          'No purchase or restock events recorded; cannot estimate availability',
      };
    }

    if (hasLearnedInterval) {
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

      return {
        state: PredictedState.uncertain,
        reason: `Last purchase ${daysSincePurchase.toFixed(1)} days ago; near learned ${thresholdDays.toFixed(1)}-day interval (within 80-120% range)`,
      };
    } else {
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

  private calculateConfidence(
    history: ProductEventHistory,
    productType: ProductType | null,
    coldStart: boolean,
    hasLearnedStatistics: boolean,
    learnedStats?: LearnedStatistics | null,
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
      const daysSinceSignal = (this.now - lastSignal.getTime()) / MS_PER_DAY;
      if (daysSinceSignal <= 7) confidence += 0.1;
    }

    if (coldStart) confidence -= 0.2;

    if (hasLearnedStatistics) {
      confidence += 0.1;

      if (learnedStats && learnedStats.observationCount >= 5) {
        confidence += 0.1;
      }
    }

    return Math.max(0.0, Math.min(1.0, confidence));
  }

  private buildCandidate(
    predictedState: PredictedState,
    confidenceScore: number,
    reason: string,
    history: ProductEventHistory,
    product: ProductPredictionContext,
    coldStart: boolean,
    learnedStats: LearnedStatistics | null,
    householdContext: HouseholdPredictionContext,
    authoritativeDirectSignal: boolean,
  ): DeterministicPredictionCandidate {
    const now = this.now;
    return {
      predictedState,
      confidenceScore,
      reason,
      authoritative: authoritativeDirectSignal,
      signals: {
        lastPurchaseAt: history.lastPurchaseAt,
        lastLowStockSignalAt: history.lastLowStockAt,
        lastStockConfirmationAt: history.lastStockConfirmationAt,
        daysSinceLastPurchase: history.lastPurchaseAt
          ? (now - history.lastPurchaseAt.getTime()) / MS_PER_DAY
          : null,
        daysSinceLastLowSignal: history.lastLowStockAt
          ? (now - history.lastLowStockAt.getTime()) / MS_PER_DAY
          : null,
        productType: product.productType,
        eventCount: history.eventCount,
        coldStart,
        hasLearnedStatistics: learnedStats !== null,
        avgPurchaseIntervalDays: learnedStats?.avgPurchaseIntervalDays ?? null,
        avgNeedIntervalDays: learnedStats?.avgNeedIntervalDays ?? null,
        estimatedConsumptionIntervalDays:
          learnedStats?.estimatedConsumptionIntervalDays ?? null,
        observationCount: learnedStats?.observationCount ?? 0,
        isPerishable: product.isPerishable,
        predictionStrategy: product.predictionStrategy,
        householdContext,
        authoritativeDirectSignal,
      },
    };
  }
}

export function summarizeHistory(
  productId: string,
  events: ProductEvent[],
): ProductEventHistory {
  let lastPurchaseAt: Date | null = null;
  let lastRestockAt: Date | null = null;
  let lastLowStockAt: Date | null = null;
  let lastStockOutAt: Date | null = null;
  let lastStockConfirmationAt: Date | null = null;

  for (const event of events) {
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
    events.length > 0 ? events[events.length - 1].timestamp : null;

  return {
    productId,
    events: events.map((e) => ({
      id: e.id,
      eventType: e.eventType,
      timestamp: e.timestamp,
      quantity: e.quantity,
      unit: e.unit,
    })),
    firstEventAt,
    lastPurchaseAt,
    lastRestockAt,
    lastLowStockAt,
    lastStockOutAt,
    lastStockConfirmationAt,
    eventCount: events.length,
  };
}
