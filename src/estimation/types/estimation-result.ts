import { ProductType } from '../../generated/prisma/enums';
import type { PredictionResult } from './prediction-result';

export interface DeterministicSignals {
  lastPurchaseAt: Date | null;
  lastLowStockSignalAt: Date | null;
  lastStockConfirmationAt: Date | null;
  daysSinceLastPurchase: number | null;
  daysSinceLastLowSignal: number | null;
  productType: ProductType | null;
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

export type EstimationResult = PredictionResult;
