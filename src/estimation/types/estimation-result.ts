import { PredictedState, ProductType } from '../../generated/prisma/enums';

export interface DeterministicSignals {
  lastPurchaseAt: Date | null;
  lastLowStockSignalAt: Date | null;
  lastStockConfirmationAt: Date | null;
  daysSinceLastPurchase: number | null;
  daysSinceLastLowSignal: number | null;
  productType: ProductType | null;
  eventCount: number;
  coldStart: boolean;
}

export interface EstimationResult {
  productId: string;
  predictedState: PredictedState;
  confidenceScore: number;
  reason: string;
  deterministicSignals: DeterministicSignals;
}
