import { Transform } from 'class-transformer';
import {
  IsDefined,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  ValidateIf,
} from 'class-validator';

export class UpdateGroceryItemDto {
  @IsOptional()
  @IsNumber({ allowInfinity: false, allowNaN: false })
  @IsPositive()
  requestedQuantity?: number;

  @ValidateIf(
    (dto: UpdateGroceryItemDto) => dto.requestedQuantity !== undefined,
  )
  @IsDefined()
  @IsNumber({ allowInfinity: false, allowNaN: false })
  @IsPositive()
  expectedRequestedQuantity?: number;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  unit?: string | null;

  @ValidateIf((dto: UpdateGroceryItemDto) => dto.unit !== undefined)
  @IsDefined()
  @ValidateIf((_, value: unknown) => value !== null)
  @IsString()
  expectedUnit?: string | null;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  note?: string | null;

  @ValidateIf((dto: UpdateGroceryItemDto) => dto.note !== undefined)
  @IsDefined()
  @ValidateIf((_, value: unknown) => value !== null)
  @IsString()
  expectedNote?: string | null;
}
