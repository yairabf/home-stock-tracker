import { Transform, Type } from 'class-transformer';
import {
  IsDefined,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { GroceryAdditionProductDto } from './policy-aware-add-grocery-item.dto';

export class ConfirmedGroceryItemDto {
  @IsOptional()
  @IsNumber({ allowInfinity: false, allowNaN: false })
  @IsPositive()
  requestedQuantity?: number;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsOptional()
  @IsString()
  note?: string;
}

export class ConfirmNewProductGroceryItemDto {
  @IsDefined()
  @ValidateNested()
  @Type(() => GroceryAdditionProductDto)
  product: GroceryAdditionProductDto;

  @IsDefined()
  @ValidateNested()
  @Type(() => ConfirmedGroceryItemDto)
  groceryItem: ConfirmedGroceryItemDto;
}

export class ConfirmProductAliasGroceryItemDto {
  @IsUUID()
  targetProductId: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  alias: string;

  @IsDefined()
  @ValidateNested()
  @Type(() => ConfirmedGroceryItemDto)
  groceryItem: ConfirmedGroceryItemDto;
}
