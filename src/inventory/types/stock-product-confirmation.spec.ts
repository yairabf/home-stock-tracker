import { randomUUID } from 'node:crypto';
import { ProductType } from '../../generated/prisma/enums';
import type { ProductWithNames } from '../../product/types/product-with-names';
import {
  assertCompatibleStockProduct,
  encodeConfirmationPayload,
  stockProductConfirmationSchema,
} from './stock-product-confirmation';

describe('Stock product confirmation contract', () => {
  const input = {
    operationId: randomUUID(),
    product: {
      canonicalName: '3% milk',
      aliases: [],
      category: 'dairy',
      typicalUnit: 'liter',
      productType: ProductType.fast_consumable,
      isPerishable: true,
    },
    stock: { quantity: 2, unit: 'liter' },
  };

  it.each([0, -1, NaN, Infinity])(
    'rejects invalid set quantity %s',
    (quantity) => {
      expect(
        stockProductConfirmationSchema.safeParse({
          ...input,
          stock: { ...input.stock, quantity },
        }).success,
      ).toBe(false);
    },
  );

  it('requires an operation UUID, explicit compatible unit and strict fields', () => {
    for (const value of [
      { ...input, operationId: 'bad' },
      { ...input, source: 'api' },
      { ...input, stock: { quantity: 2 } },
      { ...input, stock: { quantity: 2, unit: ' ' } },
      { ...input, stock: { quantity: 2, unit: 'carton' } },
      { ...input, stock: { ...input.stock, operation: 'decrement' } },
      { ...input, product: { ...input.product, id: randomUUID() } },
    ])
      expect(stockProductConfirmationSchema.safeParse(value).success).toBe(
        false,
      );
  });

  it('compares approved values independently of object-key order, retaining arrays', () => {
    expect(encodeConfirmationPayload({ a: 1, b: { x: 2, y: 3 } })).toBe(
      encodeConfirmationPayload({ b: { y: 3, x: 2 }, a: 1 }),
    );
    expect(encodeConfirmationPayload({ aliases: ['a', 'b'] })).not.toBe(
      encodeConfirmationPayload({ aliases: ['b', 'a'] }),
    );
    expect(encodeConfirmationPayload(input.stock)).not.toBe(
      encodeConfirmationPayload({ ...input.stock, quantity: 3 }),
    );
  });

  it('rejects incompatible facts or unknown units, preferring actual projection units', () => {
    const product = {
      ...input.product,
      id: randomUUID(),
      names: [],
    } as unknown as ProductWithNames;
    expect(() =>
      assertCompatibleStockProduct(product, null, input),
    ).not.toThrow();
    expect(() =>
      assertCompatibleStockProduct(product, 'carton', input),
    ).toThrow();
    expect(() =>
      assertCompatibleStockProduct(
        { ...product, typicalUnit: null },
        null,
        input,
      ),
    ).toThrow();
    expect(() =>
      assertCompatibleStockProduct(
        { ...product, category: 'other' },
        null,
        input,
      ),
    ).toThrow();
    expect(() =>
      assertCompatibleStockProduct(
        { ...product, isPerishable: false },
        null,
        input,
      ),
    ).toThrow();
    expect(() =>
      assertCompatibleStockProduct(
        { ...product, typicalUnit: 'carton' },
        'liter',
        input,
      ),
    ).not.toThrow();
  });
});
