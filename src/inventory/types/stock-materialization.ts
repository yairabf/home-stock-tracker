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
