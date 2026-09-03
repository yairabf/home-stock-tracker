import { PredictedState } from '../../generated/prisma/enums';
import { InventoryEventResponseDto } from './inventory-event-response.dto';

export interface StockProjectionEntity {
  productId: string;
  unit: string;
  recordedQuantity: number | null;
  recordedAt: Date;
  recordedSource: string;
  recordedEventId: string;
  estimatedQuantity: number | null;
  estimatedState: PredictedState;
  confidence: number;
  reason: string;
  predictionId: string | null;
  evaluatedAt: Date;
}

export class StockProjectionResponseDto {
  productId: string;
  unit: string;
  recordedQuantity: number | null;
  recordedAt: Date;
  recordedSource: string;
  recordedEventId: string;
  estimatedQuantity: number | null;
  estimatedState: PredictedState;
  confidence: number;
  reason: string;
  predictionId: string | null;
  evaluatedAt: Date;

  static fromEntity(entity: StockProjectionEntity): StockProjectionResponseDto {
    const dto = new StockProjectionResponseDto();
    dto.productId = entity.productId;
    dto.unit = entity.unit;
    dto.recordedQuantity = entity.recordedQuantity;
    dto.recordedAt = entity.recordedAt;
    dto.recordedSource = entity.recordedSource;
    dto.recordedEventId = entity.recordedEventId;
    dto.estimatedQuantity = entity.estimatedQuantity;
    dto.estimatedState = entity.estimatedState;
    dto.confidence = entity.confidence;
    dto.reason = entity.reason;
    dto.predictionId = entity.predictionId;
    dto.evaluatedAt = entity.evaluatedAt;
    return dto;
  }
}

export class StockMutationResponseDto {
  event: InventoryEventResponseDto;
  stock: StockProjectionResponseDto;
}

export class RecordPurchasesResponseDto {
  items: StockMutationResponseDto[];
}
