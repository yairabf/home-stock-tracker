import { PredictedState } from '../../generated/prisma/enums';
import type { DeterministicSignals } from './estimation-result';
import type { PredictionReasoningResult } from './prediction-reasoning';

export interface LlmPredictionAttempt {
  provider: string;
  model: string;
  value: PredictionReasoningResult;
  accepted: boolean;
}

export interface DeterministicPredictionCandidate {
  predictedState: PredictedState;
  confidenceScore: number;
  reason: string;
  signals: DeterministicSignals;
  authoritative: boolean;
}

export interface PredictionResult {
  predictionId: string | null;
  productId: string;
  predictedState: PredictedState;
  confidenceScore: number;
  reason: string;
  deterministicSignals: DeterministicSignals;
  recommendedAction: string | null;
  llmContributed: boolean;
  llmAttempt: LlmPredictionAttempt | null;
}
