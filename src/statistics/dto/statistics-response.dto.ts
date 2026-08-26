import { ProductStatisticsResult } from '../types/product-statistics-result';

export class StatisticsResponseDto {
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

  static fromResult(result: ProductStatisticsResult): StatisticsResponseDto {
    const dto = new StatisticsResponseDto();
    dto.productId = result.productId;
    dto.avgPurchaseIntervalDays = result.avgPurchaseIntervalDays;
    dto.avgNeedIntervalDays = result.avgNeedIntervalDays;
    dto.typicalPurchaseQuantity = result.typicalPurchaseQuantity;
    dto.estimatedConsumptionIntervalDays =
      result.estimatedConsumptionIntervalDays;
    dto.observationCount = result.observationCount;
    dto.lastPurchaseAt = result.lastPurchaseAt;
    dto.lastLowStockSignalAt = result.lastLowStockSignalAt;
    dto.lastStockConfirmationAt = result.lastStockConfirmationAt;
    dto.updatedAt = result.updatedAt;
    return dto;
  }
}
