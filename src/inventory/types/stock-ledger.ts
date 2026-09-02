import { Prisma } from '../../generated/prisma/client';
import { PredictedState } from '../../generated/prisma/enums';

export type StockLedgerTransaction = Prisma.TransactionClient;

export interface StockUnitInput {
  existingUnit?: string | null;
  explicitUnit?: string | null;
  groceryUnit?: string | null;
  typicalUnit?: string | null;
}

export interface StockFactInput extends StockUnitInput {
  productId: string;
  eventId: string;
  quantity: number;
  occurredAt: Date;
  source: string;
  reason: string;
}

export interface StockObservationInput extends StockUnitInput {
  productId: string;
  eventId: string;
  state:
    typeof PredictedState.probably_low | typeof PredictedState.probably_out;
  occurredAt: Date;
  source: string;
  reason: string;
}
