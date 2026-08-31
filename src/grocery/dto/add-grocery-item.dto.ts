import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
} from 'class-validator';
import { Transform } from 'class-transformer';

export enum PendingGroceryItemPolicy {
  return_existing = 'return_existing',
  create_separate = 'create_separate',
}

export class AddGroceryItemDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  productName: string;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  requestedQuantity?: number;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsEnum(PendingGroceryItemPolicy)
  ifPendingExists?: PendingGroceryItemPolicy;
}
