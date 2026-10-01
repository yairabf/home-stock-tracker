import type { LlmGenerationResult } from '../llm/types/structured-generation';
import type { PredictionReasoningResult } from './types/prediction-reasoning';
import type { DeterministicPredictionCandidate } from './types/prediction-result';

export const STOCK_PREDICTION_ADVISOR = Symbol('STOCK_PREDICTION_ADVISOR');

export type StockPredictionAdviceResult =
  | (Extract<
      LlmGenerationResult<PredictionReasoningResult>,
      { status: 'success' }
    > & {
      taskVersion: string;
    })
  | Exclude<
      LlmGenerationResult<PredictionReasoningResult>,
      { status: 'success' }
    >;

export interface StockPredictionAdvisor {
  readonly provider: 'openai' | 'typesafe';
  reason(
    candidate: DeterministicPredictionCandidate,
  ): Promise<StockPredictionAdviceResult>;
}
