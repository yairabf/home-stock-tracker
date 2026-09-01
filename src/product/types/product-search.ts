import { z } from 'zod';
import {
  ProductNameKind,
  type ProductType,
} from '../../generated/prisma/enums';
import {
  normalizeProductDisplayName,
  normalizeProductName,
} from '../product-name.util';
import {
  getCanonicalProductName,
  getProductAliases,
  type ProductWithNames,
} from './product-with-names';

export const PRODUCT_SEARCH_MAX_QUERY_LENGTH = 200;
export const PRODUCT_SEARCH_DEFAULT_LIMIT = 10;
export const PRODUCT_SEARCH_MAX_LIMIT = 20;

export const productSearchInputSchema = z
  .object({
    query: z
      .string()
      .transform(normalizeProductDisplayName)
      .pipe(
        z
          .string()
          .min(1)
          .refine(
            (query) => [...query].length <= PRODUCT_SEARCH_MAX_QUERY_LENGTH,
            `Query must contain at most ${PRODUCT_SEARCH_MAX_QUERY_LENGTH} characters`,
          ),
      )
      .transform(normalizeProductName),
    limit: z
      .number()
      .int()
      .min(1)
      .max(PRODUCT_SEARCH_MAX_LIMIT)
      .default(PRODUCT_SEARCH_DEFAULT_LIMIT),
  })
  .strict();

export type ProductSearchRequest = z.input<typeof productSearchInputSchema>;
export type ProductSearchInput = z.output<typeof productSearchInputSchema>;

export interface ProductSearchProduct {
  id: string;
  canonicalName: string;
  aliases: string[];
  category: string | null;
  typicalUnit: string | null;
  productType: ProductType | null;
  isPerishable: boolean;
  predictionEnabled: boolean;
}

export interface ProductSearchResult {
  exactMatch: ProductSearchProduct | null;
  candidates: ProductSearchProduct[];
}

export const PRODUCT_SEARCH_MATCH_CATEGORIES = [
  'exact',
  'token_prefix',
  'substring',
] as const;

export type ProductSearchMatchCategory =
  (typeof PRODUCT_SEARCH_MATCH_CATEGORIES)[number];

export interface ProductSearchName {
  productId: string;
  kind: ProductNameKind;
  normalizedName: string;
}

export interface ProductSearchMatch extends ProductSearchName {
  matchCategory: ProductSearchMatchCategory;
}

const MATCH_RANK: Record<
  ProductSearchMatchCategory,
  Record<ProductNameKind, number>
> = {
  exact: {
    [ProductNameKind.canonical]: 0,
    [ProductNameKind.alias]: 1,
  },
  token_prefix: {
    [ProductNameKind.canonical]: 2,
    [ProductNameKind.alias]: 3,
  },
  substring: {
    [ProductNameKind.canonical]: 4,
    [ProductNameKind.alias]: 5,
  },
};

export function matchProductName(
  name: ProductSearchName,
  normalizedQuery: string,
): ProductSearchMatch | null {
  const matchCategory = getMatchCategory(name.normalizedName, normalizedQuery);
  return matchCategory ? { ...name, matchCategory } : null;
}

export function compareProductSearchMatches(
  left: ProductSearchMatch,
  right: ProductSearchMatch,
): number {
  return (
    MATCH_RANK[left.matchCategory][left.kind] -
      MATCH_RANK[right.matchCategory][right.kind] ||
    [...left.normalizedName].length - [...right.normalizedName].length ||
    compareUtf8(left.normalizedName, right.normalizedName) ||
    compareUtf8(left.productId, right.productId)
  );
}

export function rankProductSearchMatches(
  matches: ProductSearchMatch[],
  limit = PRODUCT_SEARCH_DEFAULT_LIMIT,
): ProductSearchMatch[] {
  const uniqueProducts = new Map<string, ProductSearchMatch>();

  for (const match of [...matches].sort(compareProductSearchMatches)) {
    if (!uniqueProducts.has(match.productId)) {
      uniqueProducts.set(match.productId, match);
    }
  }

  const boundedLimit = Math.max(
    0,
    Math.min(Math.trunc(limit), PRODUCT_SEARCH_MAX_LIMIT),
  );
  return [...uniqueProducts.values()].slice(0, boundedLimit);
}

export function toProductSearchProduct(
  product: ProductWithNames,
): ProductSearchProduct {
  return {
    id: product.id,
    canonicalName: getCanonicalProductName(product),
    aliases: getProductAliases(product),
    category: product.category,
    typicalUnit: product.typicalUnit,
    productType: product.productType,
    isPerishable: product.isPerishable,
    predictionEnabled: product.predictionEnabled,
  };
}

function getMatchCategory(
  normalizedName: string,
  normalizedQuery: string,
): ProductSearchMatchCategory | null {
  if (normalizedName === normalizedQuery) {
    return 'exact';
  }
  if (isTokenPrefixMatch(normalizedName, normalizedQuery)) {
    return 'token_prefix';
  }
  return normalizedName.includes(normalizedQuery) ? 'substring' : null;
}

function isTokenPrefixMatch(
  normalizedName: string,
  normalizedQuery: string,
): boolean {
  const nameTokens = normalizedName.split(' ');
  const queryTokens = normalizedQuery.split(' ');

  for (
    let start = 0;
    start <= nameTokens.length - queryTokens.length;
    start++
  ) {
    if (
      queryTokens.every((queryToken, offset) =>
        nameTokens[start + offset].startsWith(queryToken),
      )
    ) {
      return true;
    }
  }

  return false;
}

function compareUtf8(left: string, right: string): number {
  return Buffer.compare(Buffer.from(left, 'utf8'), Buffer.from(right, 'utf8'));
}
