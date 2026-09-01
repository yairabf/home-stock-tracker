import { ConflictException, NotFoundException } from '@nestjs/common';

export const PRODUCT_NAME_CONFLICT = 'PRODUCT_NAME_CONFLICT' as const;
export const PRODUCT_NOT_FOUND = 'PRODUCT_NOT_FOUND' as const;

export interface ProductNameConflictResponse {
  code: typeof PRODUCT_NAME_CONFLICT;
  message: string;
}

export function productNameConflict(): ConflictException {
  return new ConflictException({
    code: PRODUCT_NAME_CONFLICT,
    message: 'A product name is already assigned to another product',
  } satisfies ProductNameConflictResponse);
}

export function productNotFound(id: string): NotFoundException {
  return new NotFoundException({
    code: PRODUCT_NOT_FOUND,
    message: `No product with id "${id}"`,
  });
}
