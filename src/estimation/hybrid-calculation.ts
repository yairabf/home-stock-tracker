import { PredictedState, ProductType } from '../generated/prisma/enums';
import type { EstimationResult } from './types/estimation-result';
import type { DeterministicPredictionCandidate } from './types/prediction-result';
import type {
  StockPredictionAdvisor,
  StockPredictionAdviceResult,
} from './stock-prediction-advisor';
import { predictionReasoningResultSchema } from './types/prediction-reasoning';
import { composeJevStockAdvice } from './stock-prediction-policy';
import { JEV_STOCK_PREDICTION_VERSION } from './jev-stock-prediction-advisor.service';

const LLM_ELIGIBILITY_CONFIDENCE = 0.8;
const LLM_ACCEPTANCE_CONFIDENCE = 0.65;
const DETERMINISTIC_CONFIDENCE_WEIGHT = 0.7;
const LLM_CONFIDENCE_WEIGHT = 0.3;

export interface HybridReasoningResult {
  result: EstimationResult;
  outcome: 'success' | 'fallback';
}

export function advisorBypassReason(
  candidate: DeterministicPredictionCandidate,
  provider: StockPredictionAdvisor['provider'],
): 'zero_history' | 'authoritative' | 'high_confidence' | null {
  if (candidate.signals.eventCount === 0) return 'zero_history';
  if (provider === 'typesafe' && candidate.authoritative)
    return 'authoritative';
  if (
    candidate.predictedState !== PredictedState.uncertain &&
    candidate.confidenceScore >= LLM_ELIGIBILITY_CONFIDENCE
  )
    return 'high_confidence';
  return null;
}

export function finalizeCandidate(
  productId: string,
  candidate: DeterministicPredictionCandidate,
): EstimationResult {
  return {
    productId,
    predictedState: candidate.predictedState,
    confidenceScore: candidate.confidenceScore,
    reason: candidate.reason,
    deterministicSignals: candidate.signals,
    recommendedAction: null,
    llmContributed: false,
    llmAttempt: null,
  };
}

export async function applyHybridReasoning(
  productId: string,
  candidate: DeterministicPredictionCandidate,
  advisor: StockPredictionAdvisor,
): Promise<HybridReasoningResult> {
  const deterministicResult = finalizeCandidate(productId, candidate);
  if (candidate.signals.eventCount === 0) {
    return {
      result: {
        ...deterministicResult,
        predictedState: PredictedState.uncertain,
        confidenceScore: 0,
        reason: 'No valid stock history; availability is uncertain',
      },
      outcome: 'success',
    };
  }
  if (advisorBypassReason(candidate, advisor.provider)) {
    return { result: deterministicResult, outcome: 'success' };
  }

  try {
    const llmResult = await advisor.reason(candidate);
    if (!isValidAdvice(llmResult)) {
      return { result: deterministicResult, outcome: 'fallback' };
    }
    if (advisor.provider === 'typesafe') {
      if (
        llmResult.provider !== 'typesafe' ||
        llmResult.taskVersion !== JEV_STOCK_PREDICTION_VERSION
      ) {
        return { result: deterministicResult, outcome: 'fallback' };
      }
      return composeJevStockAdvice(candidate, deterministicResult, llmResult);
    }

    return composeOpenAiAdvice(candidate, deterministicResult, llmResult);
  } catch {
    return {
      result: deterministicResult,
      outcome: 'fallback',
    };
  }
}

type SuccessfulAdvice = Extract<
  StockPredictionAdviceResult,
  { status: 'success' }
>;

function isValidAdvice(
  result: StockPredictionAdviceResult,
): result is SuccessfulAdvice {
  return (
    result.status === 'success' &&
    predictionReasoningResultSchema.safeParse(result.value).success &&
    Boolean(
      result.model?.trim() &&
      result.provider?.trim() &&
      result.taskVersion?.trim(),
    )
  );
}

function composeOpenAiAdvice(
  candidate: DeterministicPredictionCandidate,
  deterministicResult: EstimationResult,
  llmResult: SuccessfulAdvice,
): HybridReasoningResult {
  const accepted = llmResult.value.confidence >= LLM_ACCEPTANCE_CONFIDENCE;
  const llmAttempt = {
    provider: llmResult.provider,
    model: llmResult.model,
    taskVersion: llmResult.taskVersion,
    value: llmResult.value,
    accepted,
  };
  if (!accepted) {
    return {
      result: { ...deterministicResult, llmAttempt },
      outcome: 'fallback',
    };
  }

  return {
    result: {
      ...deterministicResult,
      predictedState:
        candidate.authoritative ||
        candidate.predictedState !== PredictedState.uncertain
          ? candidate.predictedState
          : llmResult.value.predictedState,
      confidenceScore: Math.max(
        0,
        Math.min(
          1,
          DETERMINISTIC_CONFIDENCE_WEIGHT * candidate.confidenceScore +
            LLM_CONFIDENCE_WEIGHT * llmResult.value.confidence,
        ),
      ),
      reason: llmResult.value.reason,
      recommendedAction: llmResult.value.recommendedAction,
      llmContributed: true,
      llmAttempt,
    },
    outcome: 'success',
  };
}

export function buildDisabledResult(
  productId: string,
  productType: ProductType | null,
): EstimationResult {
  return {
    productId,
    predictedState: PredictedState.uncertain,
    confidenceScore: 0.0,
    reason: 'Prediction is disabled for this product',
    recommendedAction: null,
    llmContributed: false,
    llmAttempt: null,
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
      estimatedConsumptionIntervalDays: null,
      observationCount: 0,
      isPerishable: false,
      predictionStrategy: null,
      householdContext: null,
      authoritativeDirectSignal: false,
    },
  };
}
