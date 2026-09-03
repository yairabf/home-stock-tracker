import {
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  IsISO8601,
  Matches,
} from 'class-validator';
import { Transform } from 'class-transformer';
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
  @IsNumber({ allowInfinity: false, allowNaN: false })
  @IsPositive()
  quantity?: number;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  unit?: string;

  @IsOptional()
  @IsNumber()
  confidence?: number;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @IsISO8601({ strict: true, strictSeparator: true })
  @Matches(/(?:Z|[+-]\d{2}:\d{2})$/i, {
    message: 'purchasedAt must include an explicit timezone',
  })
  purchasedAt?: string;
}
