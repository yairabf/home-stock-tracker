import { Prisma } from '../src/generated/prisma/client';
import { ProductNameKind } from '../src/generated/prisma/enums';
import type { PrismaService } from '../src/prisma/prisma.service';
import { toProductNameValue } from '../src/product/product-name.util';

type ProductFixtureInput = Omit<
  Prisma.ProductCreateInput,
  'canonicalName' | 'aliases' | 'names'
> & {
  canonicalName: string;
  aliases?: string[];
};

export async function createProductFixture(
  prisma: PrismaService,
  input: ProductFixtureInput,
) {
  const { canonicalName, aliases: rawAliases = [], ...metadata } = input;
  const canonical = toProductNameValue(canonicalName);
  const seen = new Set([canonical.normalizedName]);
  const aliases = rawAliases.map(toProductNameValue).filter((alias) => {
    if (!alias.normalizedName || seen.has(alias.normalizedName)) {
      return false;
    }
    seen.add(alias.normalizedName);
    return true;
  });

  return prisma.product.create({
    data: {
      ...metadata,
      names: {
        create: [
          { ...canonical, kind: ProductNameKind.canonical },
          ...aliases.map((alias) => ({
            ...alias,
            kind: ProductNameKind.alias,
          })),
        ],
      },
    },
  });
}
