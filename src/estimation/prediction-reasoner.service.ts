import { Inject, Injectable } from '@nestjs/common';
import { LLM_PROVIDER, type LlmProvider } from '../llm/llm-provider';
import type { LlmGenerationResult } from '../llm/types/structured-generation';
import type { DeterministicPredictionCandidate } from './types/prediction-result';
import {
  predictionReasoningInputSchema,
  predictionReasoningResultSchema,
  type PredictionReasoningResult,
} from './types/prediction-reasoning';

export const PREDICTION_REASONING_PROMPT_VERSION = 'prediction-reasoning-v1';

@Injectable()
export class PredictionReasoner {
  constructor(
    @Inject(LLM_PROVIDER) private readonly llmProvider: LlmProvider,
  ) {}

  async reason(
    candidate: DeterministicPredictionCandidate,
  ): Promise<LlmGenerationResult<PredictionReasoningResult>> {
    const input = predictionReasoningInputSchema.parse({
      deterministicCandidate: {
        predictedState: candidate.predictedState,
        confidenceScore: candidate.confidenceScore,
        reason: candidate.reason,
        authoritative: candidate.authoritative,
      },
      signals: {
        ...candidate.signals,
        lastPurchaseAt: candidate.signals.lastPurchaseAt?.toISOString() ?? null,
        lastLowStockSignalAt:
          candidate.signals.lastLowStockSignalAt?.toISOString() ?? null,
        lastStockConfirmationAt:
          candidate.signals.lastStockConfirmationAt?.toISOString() ?? null,
      },
    });
    const result = await this.llmProvider.generateStructured({
      task: 'inventory-prediction-reasoning',
      instructions:
        'Assess likely household stock using only the supplied structured evidence. Do not assume exact quantities.',
      input,
      schemaName: 'inventory_prediction_reasoning',
      schema: predictionReasoningResultSchema,
      promptVersion: PREDICTION_REASONING_PROMPT_VERSION,
    });

    if (result.status !== 'success') {
      return result;
    }

    const parsed = predictionReasoningResultSchema.safeParse(result.value);
    if (!parsed.success) {
      return {
        status: 'unavailable',
        provider: result.provider,
        model: result.model,
      };
    }

    return { ...result, value: parsed.data };
  }
}
