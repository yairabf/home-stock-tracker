import { HttpStatus } from '@nestjs/common';
import {
  PRODUCT_NAME_CONFLICT,
  PRODUCT_NOT_FOUND,
  productNameConflict,
  productNotFound,
} from './product-name.exception';

describe('productNameConflict', () => {
  it('returns the stable product-name conflict contract', () => {
    const exception = productNameConflict();

    expect(exception.getStatus()).toBe(HttpStatus.CONFLICT);
    expect(exception.getResponse()).toEqual({
      code: PRODUCT_NAME_CONFLICT,
      message: 'A product name is already assigned to another product',
    });
  });
});

describe('productNotFound', () => {
  it('returns a stable product identity error', () => {
    const exception = productNotFound('product-1');

    expect(exception.getStatus()).toBe(404);
    expect(exception.getResponse()).toEqual({
      code: PRODUCT_NOT_FOUND,
      message: 'No product with id "product-1"',
    });
  });
});
