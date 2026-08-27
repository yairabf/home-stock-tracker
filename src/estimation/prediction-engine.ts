import type { PredictionResult } from './types/prediction-result';

export const PREDICTION_ENGINE = Symbol('PREDICTION_ENGINE');

export interface PredictionEngine {
  predictProduct(productId: string): Promise<PredictionResult>;
}
