export interface ProductStatisticsResult {
  productId: string;
  avgPurchaseIntervalDays: number | null;
  avgNeedIntervalDays: number | null;
  typicalPurchaseQuantity: number | null;
  estimatedConsumptionIntervalDays: number | null;
  observationCount: number;
  lastPurchaseAt: Date | null;
  lastLowStockSignalAt: Date | null;
  lastStockConfirmationAt: Date | null;
  updatedAt: Date;
}
