import {
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ArrayNotEmpty,
  ArrayUnique,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class CompletePurchaseDto {
  @IsUUID()
  @IsNotEmpty()
  productId: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  quantity?: number;

  @IsString()
  @IsOptional()
  unit?: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  source: string;

  @IsNumber()
  @IsOptional()
  confidence?: number;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, unknown>;

  @IsArray()
  @IsUUID('4', { each: true })
  @ArrayNotEmpty()
  @ArrayUnique()
  groceryItemIds: string[];
}
