import { Inject, Injectable } from '@nestjs/common';
import { LLM_PROVIDER, type LlmProvider } from '../llm/llm-provider';
import type {
  StockPredictionAdvisor,
  StockPredictionAdviceResult,
} from './stock-prediction-advisor';
import { serializePredictionEvidence } from './prediction-reasoning-input';
import type { DeterministicPredictionCandidate } from './types/prediction-result';
import { predictionReasoningResultSchema } from './types/prediction-reasoning';

export const PREDICTION_REASONING_PROMPT_VERSION = 'prediction-reasoning-v1';

@Injectable()
export class PredictionReasoner implements StockPredictionAdvisor {
  readonly provider = 'openai' as const;
  constructor(
    @Inject(LLM_PROVIDER) private readonly llmProvider: LlmProvider,
  ) {}

  async reason(
    candidate: DeterministicPredictionCandidate,
  ): Promise<StockPredictionAdviceResult> {
    const input = serializePredictionEvidence(candidate);
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

    return {
      ...result,
      value: parsed.data,
      taskVersion: PREDICTION_REASONING_PROMPT_VERSION,
    };
  }
}
