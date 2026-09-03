import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Validate,
  ValidatorConstraint,
  type ValidationArguments,
  type ValidatorConstraintInterface,
} from 'class-validator';
import { StockMutationOperation } from '../types/stock-mutation';

@ValidatorConstraint({ name: 'stockMutationShape' })
class StockMutationShapeConstraint implements ValidatorConstraintInterface {
  validate(_value: unknown, args: ValidationArguments): boolean {
    const request = args.object as UpdateStockDto;
    if (request.operation === StockMutationOperation.mark_out) {
      return request.quantity === undefined && request.unit === undefined;
    }
    if (
      request.operation === StockMutationOperation.set ||
      request.operation === StockMutationOperation.decrement
    ) {
      return request.quantity !== undefined;
    }
    return false;
  }

  defaultMessage(): string {
    return 'Stock mutation fields must match the selected operation';
  }
}

export class UpdateStockDto {
  @IsEnum(StockMutationOperation)
  operation: StockMutationOperation;

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

  @Validate(StockMutationShapeConstraint)
  private readonly _shape?: never;
}
