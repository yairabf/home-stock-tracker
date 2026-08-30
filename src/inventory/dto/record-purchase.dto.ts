import {
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { InventoryEventType } from '../../generated/prisma/enums';

const PURCHASE_EVENT_TYPES = [
  InventoryEventType.PURCHASED,
  InventoryEventType.RESTOCKED,
] as const;

export class RecordPurchaseDto {
  @IsUUID()
  @IsNotEmpty()
  productId: string;

  @IsIn(PURCHASE_EVENT_TYPES)
  @IsNotEmpty()
  eventType:
    typeof InventoryEventType.PURCHASED | typeof InventoryEventType.RESTOCKED;

  @IsOptional()
  @IsNumber()
  @Min(0)
  quantity?: number;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsOptional()
  @IsNumber()
  confidence?: number;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
