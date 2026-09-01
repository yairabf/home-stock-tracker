import { ProductNameKind } from '../../generated/prisma/enums';
import type { ProductWithNames } from './product-with-names';
import {
  getCanonicalProductName,
  getProductAliases,
} from './product-with-names';

describe('product with names', () => {
  it('assembles approved canonical and ordered alias display names', () => {
    const product = productWithNames([
      name('canonical-id', '3% Milk', '3% milk', ProductNameKind.canonical),
      name(
        'alias-b',
        'Three Percent Milk',
        'three percent milk',
        ProductNameKind.alias,
      ),
      name('alias-a', 'Full Fat Milk', 'full fat milk', ProductNameKind.alias),
    ]);

    expect(getCanonicalProductName(product)).toBe('3% Milk');
    expect(getProductAliases(product)).toEqual([
      'Full Fat Milk',
      'Three Percent Milk',
    ]);
  });

  it.each([
    { names: [] },
    {
      names: [name('a', 'Milk', 'milk'), name('b', 'Dairy', 'dairy')],
    },
  ])('rejects a product without exactly one canonical name', ({ names }) => {
    expect(() => getCanonicalProductName(productWithNames(names))).toThrow(
      'Product product-id must have exactly one canonical name',
    );
  });
});

function productWithNames(names: ProductWithNames['names']): ProductWithNames {
  return {
    id: 'product-id',
    category: null,
    typicalUnit: null,
    productType: null,
    isPerishable: false,
    predictionStrategy: null,
    predictionEnabled: true,
    config: null,
    names,
  };
}

function name(
  id: string,
  displayName: string,
  normalizedName: string,
  kind: ProductNameKind = ProductNameKind.canonical,
): ProductWithNames['names'][number] {
  return {
    id,
    productId: 'product-id',
    displayName,
    normalizedName,
    kind,
  };
}
