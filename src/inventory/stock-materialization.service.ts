import { Injectable } from '@nestjs/common';
import { materializeStockForward } from './stock-materialization';
import type { StockLedgerTransaction } from './types/stock-ledger';
import type {
  ForwardStockMaterializationResult,
  PurchaseMaterializationInput,
} from './types/stock-materialization';

@Injectable()
export class StockMaterializationService {
  async materializePurchaseWithinTransaction(
    tx: StockLedgerTransaction,
    input: PurchaseMaterializationInput,
  ): Promise<ForwardStockMaterializationResult> {
    const shelfLifePolicy = await tx.productShelfLifePolicy.findUnique({
      where: { productId: input.productId },
      select: { kind: true, shelfLifeDays: true, confidence: true },
    });
    const statistics = await tx.productStatistics.findUnique({
      where: { productId: input.productId },
      select: { estimatedConsumptionIntervalDays: true },
    });

    return materializeStockForward({
      quantity: input.quantity,
      purchasedAt: input.purchasedAt,
      evaluatedAt: input.receivedAt,
      shelfLifePolicy,
      estimatedConsumptionIntervalDays:
        statistics?.estimatedConsumptionIntervalDays ?? null,
    });
  }
}
