import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { InventoryEventType } from '../../generated/prisma/enums';

export class RecordInventoryEventDto {
  @IsUUID()
  @IsNotEmpty()
  productId: string;

  @IsEnum(InventoryEventType)
  @IsNotEmpty()
  eventType: InventoryEventType;

  @IsOptional()
  @IsNumber()
  @Min(0)
  quantity?: number;

  @IsOptional()
  @IsString()
  unit?: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  source: string;

  @IsOptional()
  @IsNumber()
  confidence?: number;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
