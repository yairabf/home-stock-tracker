import { ShelfLifePolicyKind, PredictedState } from '../generated/prisma/enums';
import { StockMaterializationService } from './stock-materialization.service';
import type { StockLedgerTransaction } from './types/stock-ledger';

describe('StockMaterializationService', () => {
  const productShelfLifePolicy = { findUnique: jest.fn() };
  const productStatistics = { findUnique: jest.fn() };
  const tx = {
    productShelfLifePolicy,
    productStatistics,
  } as unknown as StockLedgerTransaction;
  const service = new StockMaterializationService();

  beforeEach(() => {
    jest.clearAllMocks();
    productShelfLifePolicy.findUnique.mockResolvedValue({
      kind: ShelfLifePolicyKind.finite,
      shelfLifeDays: 10,
      confidence: 0.9,
    });
    productStatistics.findUnique.mockResolvedValue({
      estimatedConsumptionIntervalDays: 2,
    });
  });

  it('loads only the evidence needed and materializes the purchase', async () => {
    await expect(
      service.materializePurchaseWithinTransaction(tx, {
        productId: 'product-1',
        quantity: 5,
        purchasedAt: new Date('2026-09-01T08:00:00.000Z'),
        receivedAt: new Date('2026-09-03T08:00:00.000Z'),
      }),
    ).resolves.toMatchObject({
      estimatedQuantity: 4,
      estimatedState: PredictedState.likely_available,
      confidence: 0.9,
    });
    expect(productShelfLifePolicy.findUnique).toHaveBeenCalledWith({
      where: { productId: 'product-1' },
      select: { kind: true, shelfLifeDays: true, confidence: true },
    });
    expect(productStatistics.findUnique).toHaveBeenCalledWith({
      where: { productId: 'product-1' },
      select: { estimatedConsumptionIntervalDays: true },
    });
  });

  it('passes absent evidence through the non-blocking fallback', async () => {
    productShelfLifePolicy.findUnique.mockResolvedValue(null);
    productStatistics.findUnique.mockResolvedValue(null);

    await expect(
      service.materializePurchaseWithinTransaction(tx, {
        productId: 'product-1',
        quantity: 5,
        purchasedAt: new Date('2026-09-01T08:00:00.000Z'),
        receivedAt: new Date('2026-09-03T08:00:00.000Z'),
      }),
    ).resolves.toMatchObject({
      estimatedQuantity: 5,
      confidence: 0.6,
      reason: 'purchase_forward_estimated_missing_shelf_life_and_consumption',
    });
  });
});
