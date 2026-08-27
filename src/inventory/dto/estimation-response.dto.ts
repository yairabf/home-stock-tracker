import { PredictedState } from '../../generated/prisma/enums';
import type { PredictionResult } from '../../estimation/types/prediction-result';

export class DeterministicSignalsDto {
  lastPurchaseAt: Date | null;
  lastLowStockSignalAt: Date | null;
  lastStockConfirmationAt: Date | null;
  daysSinceLastPurchase: number | null;
  daysSinceLastLowSignal: number | null;
  productType: string | null;
  eventCount: number;
  coldStart: boolean;
  hasLearnedStatistics: boolean;
  avgPurchaseIntervalDays: number | null;
  avgNeedIntervalDays: number | null;
  estimatedConsumptionIntervalDays: number | null;
  observationCount: number;
  isPerishable: boolean;
  predictionStrategy: string | null;
  householdContext: {
    adultsCount: number;
    childrenCount: number;
    childAgeGroups: string[];
    predictionPreferences: Record<string, unknown> | null;
  } | null;
  authoritativeDirectSignal: boolean;
}

export class EstimationResponseDto {
  productId: string;
  predictedState: PredictedState;
  confidenceScore: number;
  reason: string;
  recommendedAction: string | null;
  llmContributed: boolean;
  deterministicSignals: DeterministicSignalsDto;

  static fromEstimationResult(result: PredictionResult): EstimationResponseDto {
    const dto = new EstimationResponseDto();
    dto.productId = result.productId;
    dto.predictedState = result.predictedState;
    dto.confidenceScore = result.confidenceScore;
    dto.reason = result.reason;
    dto.recommendedAction = result.recommendedAction;
    dto.llmContributed = result.llmContributed;
    dto.deterministicSignals = {
      lastPurchaseAt: result.deterministicSignals.lastPurchaseAt,
      lastLowStockSignalAt: result.deterministicSignals.lastLowStockSignalAt,
      lastStockConfirmationAt:
        result.deterministicSignals.lastStockConfirmationAt,
      daysSinceLastPurchase: result.deterministicSignals.daysSinceLastPurchase,
      daysSinceLastLowSignal:
        result.deterministicSignals.daysSinceLastLowSignal,
      productType: result.deterministicSignals.productType,
      eventCount: result.deterministicSignals.eventCount,
      coldStart: result.deterministicSignals.coldStart,
      hasLearnedStatistics: result.deterministicSignals.hasLearnedStatistics,
      avgPurchaseIntervalDays:
        result.deterministicSignals.avgPurchaseIntervalDays,
      avgNeedIntervalDays: result.deterministicSignals.avgNeedIntervalDays,
      estimatedConsumptionIntervalDays:
        result.deterministicSignals.estimatedConsumptionIntervalDays,
      observationCount: result.deterministicSignals.observationCount,
      isPerishable: result.deterministicSignals.isPerishable,
      predictionStrategy: result.deterministicSignals.predictionStrategy,
      householdContext: result.deterministicSignals.householdContext,
      authoritativeDirectSignal:
        result.deterministicSignals.authoritativeDirectSignal,
    };
    return dto;
  }
}
