import { Transform } from 'class-transformer';
import {
  IsDefined,
  IsEnum,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  ValidateIf,
} from 'class-validator';

export enum GroceryQuantityMode {
  set = 'set',
  increment = 'increment',
}

export class UpdateGroceryItemDto {
  @IsEnum(GroceryQuantityMode)
  quantityMode: GroceryQuantityMode;

  @IsNumber({ allowInfinity: false, allowNaN: false })
  @IsPositive()
  quantity: number;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  unit?: string;

  @IsDefined()
  @ValidateIf((_, value: unknown) => value !== null)
  @IsNumber({ allowInfinity: false, allowNaN: false })
  @IsPositive()
  expectedRequestedQuantity: number | null;

  @IsDefined()
  @ValidateIf((_, value: unknown) => value !== null)
  @IsString()
  expectedUnit: string | null;
}
