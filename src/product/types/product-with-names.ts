import { Prisma } from '../../generated/prisma/client';
import { ProductNameKind } from '../../generated/prisma/enums';

export const PRODUCT_NAMES_ORDER_BY = [
  { kind: 'asc' as const },
  { normalizedName: 'asc' as const },
  { id: 'asc' as const },
] satisfies Prisma.ProductNameOrderByWithRelationInput[];

export const PRODUCT_WITH_NAMES_ARGS = {
  include: {
    names: {
      orderBy: PRODUCT_NAMES_ORDER_BY,
    },
  },
} satisfies Prisma.ProductDefaultArgs;

export const PRODUCT_WITH_NAMES_INCLUDE = PRODUCT_WITH_NAMES_ARGS;

export type ProductWithNames = Prisma.ProductGetPayload<
  typeof PRODUCT_WITH_NAMES_ARGS
>;

export function getCanonicalProductName(product: ProductWithNames): string {
  const canonicalNames = product.names.filter(
    ({ kind }) => kind === ProductNameKind.canonical,
  );
  if (canonicalNames.length !== 1) {
    throw new Error(
      `Product ${product.id} must have exactly one canonical name`,
    );
  }
  return canonicalNames[0].displayName;
}

export function getProductAliases(product: ProductWithNames): string[] {
  return product.names
    .filter(({ kind }) => kind === ProductNameKind.alias)
    .sort(
      (left, right) =>
        left.normalizedName.localeCompare(right.normalizedName) ||
        left.id.localeCompare(right.id),
    )
    .map(({ displayName }) => displayName);
}
