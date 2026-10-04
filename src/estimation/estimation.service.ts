import {
  applyHybridReasoning,
  buildDisabledResult,
} from './hybrid-calculation';
import {
  calculateCandidate,
  STOCK_HISTORY_EVENT_TYPES,
  summarizeHistory,
  type LearnedStatistics,
} from './candidate-calculation';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProductService } from '../product/product.service';
import { HouseholdService } from '../household/household.service';
import { EstimationResult } from './types/estimation-result';
import { ProductEventHistory } from './types/product-event-history';
import type { PredictionEngine } from './prediction-engine';
import type { ProductWithNames } from '../product/types/product-with-names';
import type {
  DeterministicPredictionCandidate,
  PredictionResult,
} from './types/prediction-result';
import { Prisma } from '../generated/prisma/client';
import { OperationalLogger } from '../observability/operational-logger.service';
import {
  STOCK_PREDICTION_ADVISOR,
  type StockPredictionAdvisor,
} from './stock-prediction-advisor';

@Injectable()
export class EstimationService implements PredictionEngine {
  private readonly logger = new Logger(EstimationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly productService: ProductService,
    private readonly householdService: HouseholdService,
    @Inject(STOCK_PREDICTION_ADVISOR)
    private readonly predictionReasoner: StockPredictionAdvisor,
    private readonly operationalLogger: OperationalLogger,
  ) {}

  /**
   * Fetch learned statistics for a product, if available.
   */
  private async fetchProductStatistics(
    productId: string,
  ): Promise<LearnedStatistics | null> {
    const stats = await this.prisma.productStatistics.findUnique({
      where: { productId },
      select: {
        avgPurchaseIntervalDays: true,
        avgNeedIntervalDays: true,
        estimatedConsumptionIntervalDays: true,
        observationCount: true,
      },
    });

    return stats;
  }

  async estimateProductState(productId: string): Promise<PredictionResult> {
    return this.predictProduct(productId);
  }

  async predictProduct(productId: string): Promise<PredictionResult> {
    const product = await this.productService.findOne(productId);
    const prediction = product.predictionEnabled
      ? await applyHybridReasoning(
          productId,
          await this.buildDeterministicCandidate(product),
          this.predictionReasoner,
        )
      : {
          result: buildDisabledResult(productId, product.productType),
          outcome: 'success' as const,
        };

    const predictionId = await this.savePrediction(prediction.result);
    this.operationalLogger.predictionRun({
      action: 'estimate',
      outcome: prediction.outcome,
      productId,
      predictionId: predictionId ?? undefined,
    });
    return { ...prediction.result, predictionId };
  }

  private async buildDeterministicCandidate(
    product: ProductWithNames,
  ): Promise<DeterministicPredictionCandidate> {
    const [eventHistory, learnedStats, household] = await Promise.all([
      this.fetchProductEventHistory(product.id),
      this.fetchProductStatistics(product.id),
      this.householdService.getOrCreate(),
    ]);
    return calculateCandidate(
      eventHistory,
      learnedStats,
      product,
      household,
      Date.now(),
    );
  }

  private async fetchProductEventHistory(
    productId: string,
  ): Promise<ProductEventHistory> {
    const now = Date.now();
    const events = await this.prisma.inventoryEvent.findMany({
      where: {
        productId,
        eventType: { in: STOCK_HISTORY_EVENT_TYPES },
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

    return summarizeHistory(
      productId,
      validEvents.map((e) => ({
        id: e.id,
        eventType: e.eventType,
        timestamp: e.timestamp,
        quantity: e.quantity ?? undefined,
        unit: e.unit ?? undefined,
      })),
    );
  }

  private async savePrediction(
    result: EstimationResult,
  ): Promise<string | null> {
    try {
      const prediction = await this.prisma.prediction.create({
        data: {
          productId: result.productId,
          predictedState: result.predictedState,
          confidenceScore: result.confidenceScore,
          reason: result.reason,
          recommendedAction: result.recommendedAction,
          llmResult:
            result.llmContributed && result.llmAttempt
              ? (result.llmAttempt.value as Prisma.InputJsonValue)
              : undefined,
          modelProviderVersion:
            result.llmContributed && result.llmAttempt
              ? `${result.llmAttempt.provider}/${result.llmAttempt.model}`
              : null,
          deterministicSignals: {
            lastPurchaseAt:
              result.deterministicSignals.lastPurchaseAt?.toISOString() ?? null,
            lastLowStockSignalAt:
              result.deterministicSignals.lastLowStockSignalAt?.toISOString() ??
              null,
            lastStockConfirmationAt:
              result.deterministicSignals.lastStockConfirmationAt?.toISOString() ??
              null,
            daysSinceLastPurchase:
              result.deterministicSignals.daysSinceLastPurchase,
            daysSinceLastLowSignal:
              result.deterministicSignals.daysSinceLastLowSignal,
            productType: result.deterministicSignals.productType,
            eventCount: result.deterministicSignals.eventCount,
            coldStart: result.deterministicSignals.coldStart,
            hasLearnedStatistics:
              result.deterministicSignals.hasLearnedStatistics,
            avgPurchaseIntervalDays:
              result.deterministicSignals.avgPurchaseIntervalDays,
            avgNeedIntervalDays:
              result.deterministicSignals.avgNeedIntervalDays,
            estimatedConsumptionIntervalDays:
              result.deterministicSignals.estimatedConsumptionIntervalDays,
            observationCount: result.deterministicSignals.observationCount,
            isPerishable: result.deterministicSignals.isPerishable,
            predictionStrategy: result.deterministicSignals.predictionStrategy,
            householdContext: result.deterministicSignals.householdContext
              ? {
                  ...result.deterministicSignals.householdContext,
                  childAgeGroups:
                    this.predictionReasoner.provider === 'typesafe'
                      ? []
                      : result.deterministicSignals.householdContext
                          .childAgeGroups,
                  predictionPreferences:
                    this.predictionReasoner.provider === 'typesafe'
                      ? null
                      : (result.deterministicSignals.householdContext
                          .predictionPreferences as Prisma.InputJsonValue | null),
                }
              : null,
            authoritativeDirectSignal:
              result.deterministicSignals.authoritativeDirectSignal,
          },
        },
      });

      await this.saveInferenceAttempt(prediction.id, result);
      this.operationalLogger.predictionPersistence({
        outcome: 'success',
        productId: result.productId,
        predictionId: prediction.id,
      });
      return prediction.id;
    } catch {
      this.operationalLogger.predictionPersistence({
        outcome: 'failure',
        productId: result.productId,
        errorType: 'persistence_error',
      });
      return null;
    }
  }

  private async saveInferenceAttempt(
    predictionId: string,
    result: EstimationResult,
  ): Promise<void> {
    const attempt = result.llmAttempt;
    if (!attempt) return;
    try {
      await this.prisma.llmInferenceLog.create({
        data: {
          predictionId,
          modelProvider: attempt.provider,
          modelVersion: attempt.model,
          promptVersion: attempt.taskVersion,
          structuredResponse:
            attempt.provider === 'typesafe'
              ? {
                  status: 'validated',
                  accepted: attempt.accepted,
                  value: attempt.value,
                }
              : attempt.value,
          confidence: attempt.value.confidence,
        },
      });
    } catch {
      this.operationalLogger.predictionPersistence({
        outcome: 'failure',
        productId: result.productId,
        predictionId,
        errorType: 'persistence_error',
      });
    }
  }
}
