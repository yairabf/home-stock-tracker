import { Transform, Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
  Validate,
  ValidatorConstraint,
  type ValidatorConstraintInterface,
} from 'class-validator';
import { normalizeProductDisplayName } from '../product-name.util';
import {
  PRODUCT_SEARCH_MAX_LIMIT,
  PRODUCT_SEARCH_MAX_QUERY_LENGTH,
} from '../types/product-search';

@ValidatorConstraint({ name: 'productSearchQueryLength' })
export class ProductSearchQueryLengthConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return (
      typeof value === 'string' &&
      [...value].length <= PRODUCT_SEARCH_MAX_QUERY_LENGTH
    );
  }

  defaultMessage(): string {
    return `query must contain at most ${PRODUCT_SEARCH_MAX_QUERY_LENGTH} characters`;
  }
}

export class SearchProductsQueryDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? normalizeProductDisplayName(value) : value,
  )
  @IsString()
  @IsNotEmpty()
  @Validate(ProductSearchQueryLengthConstraint)
  query: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(PRODUCT_SEARCH_MAX_LIMIT)
  limit?: number;
}
