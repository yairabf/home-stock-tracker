import { PredictedState } from '../../generated/prisma/enums';

export class DeterministicSignalsDto {
  lastPurchaseAt: Date | null;
  lastLowStockSignalAt: Date | null;
  lastStockConfirmationAt: Date | null;
  daysSinceLastPurchase: number | null;
  daysSinceLastLowSignal: number | null;
  productType: string | null;
  eventCount: number;
  coldStart: boolean;
}

export class EstimationResponseDto {
  productId: string;
  predictedState: PredictedState;
  confidenceScore: number;
  reason: string;
  deterministicSignals: DeterministicSignalsDto;

  static fromEstimationResult(result: {
    productId: string;
    predictedState: PredictedState;
    confidenceScore: number;
    reason: string;
    deterministicSignals: {
      lastPurchaseAt: Date | null;
      lastLowStockSignalAt: Date | null;
      lastStockConfirmationAt: Date | null;
      daysSinceLastPurchase: number | null;
      daysSinceLastLowSignal: number | null;
      productType: string | null;
      eventCount: number;
      coldStart: boolean;
    };
  }): EstimationResponseDto {
    const dto = new EstimationResponseDto();
    dto.productId = result.productId;
    dto.predictedState = result.predictedState;
    dto.confidenceScore = result.confidenceScore;
    dto.reason = result.reason;
    dto.deterministicSignals = {
      lastPurchaseAt: result.deterministicSignals.lastPurchaseAt,
      lastLowStockSignalAt: result.deterministicSignals.lastLowStockSignalAt,
      lastStockConfirmationAt:
        result.deterministicSignals.lastStockConfirmationAt,
      daysSinceLastPurchase: result.deterministicSignals.daysSinceLastPurchase,
      daysSinceLastLowSignal: result.deterministicSignals.daysSinceLastLowSignal,
      productType: result.deterministicSignals.productType,
      eventCount: result.deterministicSignals.eventCount,
      coldStart: result.deterministicSignals.coldStart,
    };
    return dto;
  }
}
