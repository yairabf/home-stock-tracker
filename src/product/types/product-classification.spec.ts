import { ProductType } from '../../generated/prisma/enums';
import {
  productClassificationInputSchema,
  productClassificationResultSchema,
} from './product-classification';

const validResult = {
  canonicalName: 'milk',
  aliases: ['whole milk'],
  category: 'dairy',
  typicalUnit: 'liter',
  productType: ProductType.fast_consumable,
  isPerishable: true,
  confidence: 0.95,
};

describe('product classification contracts', () => {
  it('accepts and trims a valid input and result', () => {
    expect(
      productClassificationInputSchema.parse({ rawName: '  milk  ' }),
    ).toEqual({ rawName: 'milk' });

    expect(
      productClassificationResultSchema.parse({
        ...validResult,
        canonicalName: '  milk  ',
      }),
    ).toEqual(validResult);
  });

  it('rejects a blank input or required result string', () => {
    expect(
      productClassificationInputSchema.safeParse({ rawName: '   ' }).success,
    ).toBe(false);
    expect(
      productClassificationResultSchema.safeParse({
        ...validResult,
        canonicalName: '',
      }).success,
    ).toBe(false);
  });

  it('rejects missing result fields', () => {
    const { category: _category, ...missingCategory } = validResult;

    expect(
      productClassificationResultSchema.safeParse(missingCategory).success,
    ).toBe(false);
  });

  it('rejects product types outside the persisted enum', () => {
    expect(
      productClassificationResultSchema.safeParse({
        ...validResult,
        productType: 'unknown',
      }).success,
    ).toBe(false);
  });

  it.each([-0.01, 1.01])(
    'rejects confidence %s outside zero through one',
    (confidence) => {
      expect(
        productClassificationResultSchema.safeParse({
          ...validResult,
          confidence,
        }).success,
      ).toBe(false);
    },
  );
});
