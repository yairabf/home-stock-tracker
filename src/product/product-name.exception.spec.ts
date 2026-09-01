import { HttpStatus } from '@nestjs/common';
import {
  PRODUCT_NAME_CONFLICT,
  productNameConflict,
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
