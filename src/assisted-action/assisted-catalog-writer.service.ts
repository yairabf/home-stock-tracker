import { Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { ProductNameKind } from '../generated/prisma/enums';
import {
  normalizeProductDisplayName,
  normalizeProductName,
} from '../product/product-name.util';
import { metadataSnapshot } from '../product/product-understanding';
import { toProductSearchProduct } from '../product/types/product-search';
import {
  PRODUCT_WITH_NAMES_ARGS,
  type ProductWithNames,
} from '../product/types/product-with-names';
import type { PreparedCatalogProduct } from './assisted-preparation';
import { AssistedCatalogConflict } from './assisted-catalog-conflict';
import {
  assertCatalogIdentitySnapshot,
  catalogMetadataUpdate,
} from './assisted-catalog-policy';

export interface AppliedCatalogProduct {
  product: ProductWithNames;
  catalogAction: 'existing' | 'alias_added' | 'created';
}

// Retry the entire owning transaction with the same prepared decisions, never AI.
export function isAssistedCatalogWriteRace(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === 'P2002' || error.code === 'P2034')
  );
}

@Injectable()
export class AssistedCatalogWriter {
  // Caller must use Serializable and include its action and receipt in this transaction.
  async applyWithinTransaction(
    tx: Prisma.TransactionClient,
    prepared: PreparedCatalogProduct,
  ): Promise<AppliedCatalogProduct> {
    const current = await this.resolveCurrent(tx, prepared);
    const alias = prepared.suppliedName;
    const aliasOwner = alias
      ? await tx.productName.findUnique({
          where: { normalizedName: normalizeProductName(alias) },
          select: { productId: true },
        })
      : null;
    if (aliasOwner && aliasOwner.productId !== current?.id)
      throw new AssistedCatalogConflict('alias_conflict');
    if (!current) return this.create(tx, prepared);
    const update = catalogMetadataUpdate(
      metadataSnapshot(current),
      prepared.metadata,
      prepared.existing,
    );
    if (Object.keys(update).length)
      await tx.product.update({ where: { id: current.id }, data: update });
    const addAlias = alias !== null && aliasOwner === null;
    if (addAlias)
      await tx.productName.create({
        data: {
          productId: current.id,
          displayName: alias.trim(),
          normalizedName: normalizeProductName(alias),
          kind: ProductNameKind.alias,
        },
      });
    const product = await tx.product.findUniqueOrThrow({
      where: { id: current.id },
      ...PRODUCT_WITH_NAMES_ARGS,
    });
    return { product, catalogAction: addAlias ? 'alias_added' : 'existing' };
  }

  private async resolveCurrent(
    tx: Prisma.TransactionClient,
    prepared: PreparedCatalogProduct,
  ): Promise<ProductWithNames | null> {
    if (prepared.existing) {
      const current = await tx.product.findUnique({
        where: { id: prepared.existing.id },
        ...PRODUCT_WITH_NAMES_ARGS,
      });
      if (!current) throw new AssistedCatalogConflict('ambiguous_product');
      assertCatalogIdentitySnapshot(
        toProductSearchProduct(current),
        prepared.existing,
      );
      return current;
    }
    const owner = await tx.productName.findUnique({
      where: { normalizedName: normalizeProductName(prepared.canonicalName) },
      include: { product: PRODUCT_WITH_NAMES_ARGS },
    });
    return owner?.product ?? null;
  }

  private async create(
    tx: Prisma.TransactionClient,
    prepared: PreparedCatalogProduct,
  ): Promise<AppliedCatalogProduct> {
    const canonicalName = normalizeProductDisplayName(prepared.canonicalName);
    const normalizedName = normalizeProductName(canonicalName);
    const alias = prepared.suppliedName;
    const names = [
      {
        displayName: canonicalName,
        normalizedName,
        kind: ProductNameKind.canonical as ProductNameKind,
      },
    ];
    if (alias !== null && normalizeProductName(alias) !== normalizedName)
      names.push({
        displayName: alias.trim(),
        normalizedName: normalizeProductName(alias),
        kind: ProductNameKind.alias,
      });
    const product = await tx.product.create({
      data: { ...prepared.metadata, names: { create: names } },
      ...PRODUCT_WITH_NAMES_ARGS,
    });
    return { product, catalogAction: 'created' };
  }
}
