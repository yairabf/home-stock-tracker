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

  @IsOptional()
  @IsNumber()
  confidence?: number;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
