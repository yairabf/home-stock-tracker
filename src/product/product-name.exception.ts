import { ConflictException } from '@nestjs/common';

export const PRODUCT_NAME_CONFLICT = 'PRODUCT_NAME_CONFLICT' as const;

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
