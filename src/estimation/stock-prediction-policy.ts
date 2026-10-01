import { PredictedState } from '../generated/prisma/enums';
import {
  explainJevStockState,
  JEV_STOCK_PREDICTION_MIN_CONFIDENCE,
} from './jev-stock-prediction-advisor.service';
import type { StockPredictionAdviceResult } from './stock-prediction-advisor';
import type { EstimationResult } from './types/estimation-result';
import type { DeterministicPredictionCandidate } from './types/prediction-result';

export function hasSufficientColdStartEvidence(
  candidate: DeterministicPredictionCandidate,
): boolean {
  const s = candidate.signals;
  const intervals = [
    s.avgPurchaseIntervalDays,
    s.avgNeedIntervalDays,
    s.estimatedConsumptionIntervalDays,
  ];
  return (
    s.eventCount >= 2 &&
    s.hasLearnedStatistics &&
    s.observationCount >= 2 &&
    intervals.some(
      (value) => value !== null && Number.isFinite(value) && value > 0,
    ) &&
    s.daysSinceLastPurchase !== null &&
    Number.isFinite(s.daysSinceLastPurchase) &&
    s.daysSinceLastPurchase >= 0
  );
}

export function composeJevStockAdvice(
  candidate: DeterministicPredictionCandidate,
  deterministic: EstimationResult,
  advice: Extract<StockPredictionAdviceResult, { status: 'success' }>,
): { result: EstimationResult; outcome: 'success' | 'fallback' } {
  const accepted =
    advice.value.confidence >= JEV_STOCK_PREDICTION_MIN_CONFIDENCE &&
    advice.value.predictedState !== PredictedState.uncertain &&
    (candidate.predictedState !== PredictedState.uncertain ||
      !candidate.signals.coldStart ||
      hasSufficientColdStartEvidence(candidate));
  const llmAttempt = {
    provider: advice.provider,
    model: advice.model,
    taskVersion: advice.taskVersion,
    value: advice.value,
    accepted,
  };
  if (!accepted)
    return { result: { ...deterministic, llmAttempt }, outcome: 'fallback' };
  const predictedState =
    candidate.predictedState === PredictedState.uncertain
      ? advice.value.predictedState
      : candidate.predictedState;
  return {
    result: {
      ...deterministic,
      predictedState,
      confidenceScore: Math.min(
        candidate.confidenceScore,
        advice.value.confidence,
      ),
      reason: explainJevStockState(candidate, predictedState),
      recommendedAction: null,
      llmContributed: true,
      llmAttempt,
    },
    outcome: 'success',
  };
}
