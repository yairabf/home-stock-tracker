import { Type, Transform } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDefined,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Validate,
  ValidateIf,
  ValidateNested,
  ValidatorConstraint,
  type ValidatorConstraintInterface,
  type ValidationArguments,
} from 'class-validator';
import { ProductType } from '../../generated/prisma/enums';
import {
  PendingGroceryItemPolicy,
  UnknownProductPolicy,
} from '../types/policy-aware-grocery-addition';

export class GroceryAdditionProductDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  canonicalName: string;

  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  aliases: string[];

  @IsString()
  @IsNotEmpty()
  category: string;

  @ValidateIf((_object, value: unknown) => value !== null)
  @IsString()
  @IsDefined()
  typicalUnit: string | null;

  @IsEnum(ProductType)
  productType: ProductType;

  @IsBoolean()
  isPerishable: boolean;
}

export class GroceryAdditionItemDto {
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

  @IsOptional()
  @IsEnum(PendingGroceryItemPolicy)
  ifPendingExists: PendingGroceryItemPolicy =
    PendingGroceryItemPolicy.return_existing;
}

@ValidatorConstraint({ name: 'policyAwareGroceryAdditionShape' })
class PolicyAwareGroceryAdditionShape implements ValidatorConstraintInterface {
  validate(_value: unknown, args: ValidationArguments): boolean {
    const request = args.object as PolicyAwareAddGroceryItemDto;
    if (
      request.unknownProductPolicy === UnknownProductPolicy.create_if_missing
    ) {
      return request.product !== undefined && request.productName === undefined;
    }
    if (
      request.unknownProductPolicy === UnknownProductPolicy.propose_if_missing
    ) {
      return request.product === undefined && request.productName !== undefined;
    }
    return false;
  }

  defaultMessage(): string {
    return 'Product input must match unknownProductPolicy';
  }
}

export class PolicyAwareAddGroceryItemDto {
  @IsEnum(UnknownProductPolicy)
  @Validate(PolicyAwareGroceryAdditionShape)
  unknownProductPolicy: UnknownProductPolicy =
    UnknownProductPolicy.create_if_missing;

  @IsOptional()
  @ValidateNested()
  @Type(() => GroceryAdditionProductDto)
  product?: GroceryAdditionProductDto;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  productName?: string;

  @IsDefined()
  @ValidateNested()
  @Type(() => GroceryAdditionItemDto)
  groceryItem: GroceryAdditionItemDto;
}
