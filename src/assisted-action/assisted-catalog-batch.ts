import type { Prisma } from '../generated/prisma/client';
import type { PreparedCatalogProduct } from './assisted-preparation';
import type {
  AssistedCatalogWriter,
  AppliedCatalogProduct,
} from './assisted-catalog-writer.service';
import { AssistedCatalogConflict } from './assisted-catalog-conflict';
import {
  AssistedBatchIssues,
  duplicateProductIssues,
} from './assisted-batch-issues';

export async function applyPreparedCatalogBatch(
  tx: Prisma.TransactionClient,
  prepared: PreparedCatalogProduct[],
  catalog: AssistedCatalogWriter,
): Promise<AppliedCatalogProduct[]> {
  const products: AppliedCatalogProduct[] = [];
  for (const [inputIndex, product] of prepared.entries()) {
    try {
      products.push(await catalog.applyWithinTransaction(tx, product));
    } catch (error) {
      if (error instanceof AssistedCatalogConflict)
        throw new AssistedBatchIssues([{ inputIndex, code: error.code }]);
      throw error;
    }
  }
  const duplicates = duplicateProductIssues(
    products.map(({ product }) => [product.id]),
  );
  if (duplicates.length) throw new AssistedBatchIssues(duplicates);
  return products;
}
