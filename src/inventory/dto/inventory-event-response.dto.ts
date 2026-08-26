import type { InventoryEventModel } from '../../generated/prisma/models';
import { InventoryEventType } from '../../generated/prisma/enums';

export class InventoryEventResponseDto {
  id: string;
  productId: string;
  eventType: InventoryEventType;
  quantity: number | null;
  unit: string | null;
  timestamp: Date;
  source: string;
  confidence: number | null;
  metadata: Record<string, unknown> | null;

  static fromEntity(event: InventoryEventModel): InventoryEventResponseDto {
    const dto = new InventoryEventResponseDto();
    dto.id = event.id;
    dto.productId = event.productId;
    dto.eventType = event.eventType;
    dto.quantity = event.quantity;
    dto.unit = event.unit;
    dto.timestamp = event.timestamp;
    dto.source = event.source;
    dto.confidence = event.confidence;
    dto.metadata = event.metadata as Record<string, unknown> | null;
    return dto;
  }
}
