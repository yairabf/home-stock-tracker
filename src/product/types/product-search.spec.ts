import { ProductNameKind, ProductType } from '../../generated/prisma/enums';
import type { ProductWithNames } from './product-with-names';
import {
  PRODUCT_SEARCH_DEFAULT_LIMIT,
  PRODUCT_SEARCH_MAX_LIMIT,
  compareProductSearchMatches,
  matchProductName,
  productSearchInputSchema,
  rankProductSearchMatches,
  toProductSearchProduct,
  type ProductSearchMatch,
  type ProductSearchName,
} from './product-search';

const canonicalName = searchName('product-a', ProductNameKind.canonical);
const aliasName = searchName('product-a', ProductNameKind.alias);

describe('product search input', () => {
  it('normalizes the query and supplies the default limit', () => {
    expect(productSearchInputSchema.parse({ query: '  ３％\t Milk ' })).toEqual(
      {
        query: '3% milk',
        limit: PRODUCT_SEARCH_DEFAULT_LIMIT,
      },
    );
  });

  it.each(['', ' \t\n '])('rejects a blank query: %j', (query) => {
    expect(productSearchInputSchema.safeParse({ query }).success).toBe(false);
  });

  it.each(['M', '🛒'])(
    'accepts 200 normalized %s characters and rejects 201',
    (character) => {
      expect(
        productSearchInputSchema.safeParse({
          query: ` ${character.repeat(200)} `,
        }).success,
      ).toBe(true);
      expect(
        productSearchInputSchema.safeParse({ query: character.repeat(201) })
          .success,
      ).toBe(false);
    },
  );

  it.each([1, PRODUCT_SEARCH_MAX_LIMIT])('accepts limit %s', (limit) => {
    expect(productSearchInputSchema.parse({ query: 'milk', limit }).limit).toBe(
      limit,
    );
  });

  it.each([0, 1.5, PRODUCT_SEARCH_MAX_LIMIT + 1])(
    'rejects invalid limit %s',
    (limit) => {
      expect(
        productSearchInputSchema.safeParse({ query: 'milk', limit }).success,
      ).toBe(false);
    },
  );
});

describe('matchProductName', () => {
  it.each([
    {
      label: 'canonical exact',
      name: canonicalName('milk'),
      query: 'milk',
      category: 'exact',
    },
    {
      label: 'alias exact',
      name: aliasName('milk'),
      query: 'milk',
      category: 'exact',
    },
    {
      label: 'canonical token-prefix',
      name: canonicalName('organic whole milk'),
      query: 'wh mi',
      category: 'token_prefix',
    },
    {
      label: 'alias token-prefix',
      name: aliasName('organic whole milk'),
      query: 'org wh',
      category: 'token_prefix',
    },
    {
      label: 'canonical substring',
      name: canonicalName('buttermilk'),
      query: 'term',
      category: 'substring',
    },
    {
      label: 'alias substring',
      name: aliasName('buttermilk'),
      query: 'term',
      category: 'substring',
    },
  ])('classifies a $label match', ({ name, query, category }) => {
    expect(matchProductName(name, query)).toEqual({
      ...name,
      matchCategory: category,
    });
  });

  it('allows a one-token query to match any stored-name token', () => {
    expect(matchProductName(canonicalName('organic whole milk'), 'wh')).toEqual(
      expect.objectContaining({ matchCategory: 'token_prefix' }),
    );
  });

  it('requires multi-token prefixes to form one contiguous sequence', () => {
    expect(
      matchProductName(canonicalName('organic whole milk'), 'org mi'),
    ).toBe(null);
  });

  it.each([
    ['3% milk', '%'],
    ['under_score milk', '_'],
    ['brand\\milk', '\\'],
  ])('treats %j as literal substring text', (normalizedName, query) => {
    expect(matchProductName(canonicalName(normalizedName), query)).toEqual(
      expect.objectContaining({ matchCategory: 'substring' }),
    );
  });

  it.each([
    ['milk', '%'],
    ['milk', '_'],
    ['brandmilk', '\\'],
  ])('does not treat %j as a wildcard or escape', (normalizedName, query) => {
    expect(matchProductName(canonicalName(normalizedName), query)).toBe(null);
  });

  it('returns null when the name does not match', () => {
    expect(matchProductName(canonicalName('oat drink'), 'milk')).toBe(null);
  });
});

describe('compareProductSearchMatches', () => {
  it.each([
    [
      match('exact', ProductNameKind.canonical),
      match('exact', ProductNameKind.alias),
    ],
    [
      match('exact', ProductNameKind.alias),
      match('token_prefix', ProductNameKind.canonical),
    ],
    [
      match('token_prefix', ProductNameKind.canonical),
      match('token_prefix', ProductNameKind.alias),
    ],
    [
      match('token_prefix', ProductNameKind.alias),
      match('substring', ProductNameKind.canonical),
    ],
    [
      match('substring', ProductNameKind.canonical),
      match('substring', ProductNameKind.alias),
    ],
  ])('applies each match category boundary', (left, right) => {
    expect(compareProductSearchMatches(left, right)).toBeLessThan(0);
  });

  it('ranks shorter matching names first by Unicode character length', () => {
    expect(
      compareProductSearchMatches(
        match('substring', ProductNameKind.alias, 'é'),
        match('substring', ProductNameKind.alias, 'zz'),
      ),
    ).toBeLessThan(0);
  });

  it('uses PostgreSQL C-style byte order for matching names', () => {
    expect(
      compareProductSearchMatches(
        match('substring', ProductNameKind.alias, 'Z'),
        match('substring', ProductNameKind.alias, 'a'),
      ),
    ).toBeLessThan(0);
  });

  it('uses product ID as the final tie-breaker', () => {
    expect(
      compareProductSearchMatches(
        match('substring', ProductNameKind.alias, 'milk', 'product-a'),
        match('substring', ProductNameKind.alias, 'milk', 'product-b'),
      ),
    ).toBeLessThan(0);
  });
});

describe('rankProductSearchMatches', () => {
  it('keeps the best matching name for each product in stable order', () => {
    const matches = [
      match('substring', ProductNameKind.alias, 'milk', 'product-a'),
      match('token_prefix', ProductNameKind.alias, 'milky', 'product-b'),
      match('token_prefix', ProductNameKind.canonical, 'milk', 'product-a'),
    ];

    expect(rankProductSearchMatches(matches)).toEqual([matches[2], matches[1]]);
  });

  it('uses the default result limit', () => {
    const matches = Array.from(
      { length: PRODUCT_SEARCH_DEFAULT_LIMIT + 1 },
      (_, index) =>
        match('substring', ProductNameKind.alias, 'milk', productId(index)),
    );

    expect(rankProductSearchMatches(matches)).toHaveLength(
      PRODUCT_SEARCH_DEFAULT_LIMIT,
    );
  });

  it('honors a smaller limit', () => {
    expect(
      rankProductSearchMatches(
        [
          match('substring', ProductNameKind.alias, 'milk', 'product-a'),
          match('substring', ProductNameKind.alias, 'oat milk', 'product-b'),
        ],
        1,
      ),
    ).toHaveLength(1);
  });

  it('enforces the hard cap for direct callers', () => {
    const matches = Array.from(
      { length: PRODUCT_SEARCH_MAX_LIMIT + 5 },
      (_, index) =>
        match('substring', ProductNameKind.alias, 'milk', productId(index)),
    );

    expect(rankProductSearchMatches(matches, 100)).toHaveLength(
      PRODUCT_SEARCH_MAX_LIMIT,
    );
  });
});

describe('toProductSearchProduct', () => {
  it('returns only compact public facts with approved display spelling', () => {
    expect(toProductSearchProduct(productWithNames())).toEqual({
      id: 'product-id',
      canonicalName: '3% Milk',
      aliases: ['Full Fat Milk', 'Three Percent Milk'],
      category: 'dairy',
      typicalUnit: null,
      productType: ProductType.fast_consumable,
      isPerishable: true,
      predictionEnabled: false,
    });
  });
});

function searchName(productId: string, kind: ProductNameKind) {
  return (normalizedName: string): ProductSearchName => ({
    productId,
    kind,
    normalizedName,
  });
}

function match(
  matchCategory: ProductSearchMatch['matchCategory'],
  kind: ProductNameKind,
  normalizedName = 'milk',
  productId = 'product-a',
): ProductSearchMatch {
  return { productId, kind, normalizedName, matchCategory };
}

function productId(index: number): string {
  return `product-${index.toString().padStart(2, '0')}`;
}

function productWithNames(): ProductWithNames {
  return {
    id: 'product-id',
    category: 'dairy',
    typicalUnit: null,
    productType: ProductType.fast_consumable,
    isPerishable: true,
    predictionStrategy: 'interval',
    predictionEnabled: false,
    config: { internal: true },
    names: [
      productName('canonical', '3% Milk', '3% milk', ProductNameKind.canonical),
      productName(
        'alias-b',
        'Three Percent Milk',
        'three percent milk',
        ProductNameKind.alias,
      ),
      productName(
        'alias-a',
        'Full Fat Milk',
        'full fat milk',
        ProductNameKind.alias,
      ),
    ],
  };
}

function productName(
  id: string,
  displayName: string,
  normalizedName: string,
  kind: ProductNameKind,
): ProductWithNames['names'][number] {
  return { id, productId: 'product-id', displayName, normalizedName, kind };
}
