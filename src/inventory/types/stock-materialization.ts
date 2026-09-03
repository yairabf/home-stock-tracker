import {
  PredictedState,
  ShelfLifePolicyKind,
} from '../../generated/prisma/enums';

export interface ShelfLifeEvidence {
  kind: ShelfLifePolicyKind;
  shelfLifeDays: number | null;
  confidence: number;
}

export interface ForwardStockMaterializationInput {
  quantity: number;
  purchasedAt: Date;
  evaluatedAt: Date;
  shelfLifePolicy: ShelfLifeEvidence | null;
  estimatedConsumptionIntervalDays: number | null;
}

export type ForwardStockMaterializationReason =
  | 'purchase_recorded'
  | 'purchase_forward_estimated'
  | 'purchase_forward_estimated_missing_shelf_life'
  | 'purchase_forward_estimated_missing_consumption'
  | 'purchase_forward_estimated_missing_shelf_life_and_consumption'
  | 'stock_expired';

export interface ForwardStockMaterializationResult {
  estimatedQuantity: number;
  estimatedState:
    typeof PredictedState.likely_available | typeof PredictedState.probably_out;
  confidence: number;
  reason: ForwardStockMaterializationReason;
  evaluatedAt: Date;
}

export interface PurchaseMaterializationInput {
  productId: string;
  quantity: number;
  purchasedAt: Date;
  receivedAt: Date;
}

export interface DailyStockMaterializationInput {
  estimatedQuantity: number | null;
  recordedAt: Date;
  evaluatedAt: Date;
  previousEvaluatedAt: Date;
  shelfLifePolicy: ShelfLifeEvidence | null;
  estimatedConsumptionIntervalDays: number | null;
  explicitState:
    | typeof PredictedState.probably_low
    | typeof PredictedState.probably_out
    | null;
}

export type DailyStockMaterializationReason =
  | 'daily_stock_expired'
  | 'daily_stock_depleted'
  | 'daily_explicit_out'
  | 'daily_explicit_low'
  | 'daily_stock_low'
  | 'daily_stock_available'
  | 'daily_stock_uncertain';

export interface DailyStockMaterializationResult {
  estimatedQuantity: number | null;
  estimatedState: PredictedState;
  confidence: number;
  reason: DailyStockMaterializationReason;
  evaluatedAt: Date;
  elapsedDays: number;
  expectedConsumption: number;
}
