import { normalizeProductName } from '../product/product-name.util';
import {
  UNDERSTANDING_FIELDS,
  type ProductMetadataSnapshot,
} from '../product/product-understanding';
import type { ProductSearchProduct } from '../product/types/product-search';
import { AssistedCatalogConflict } from './assisted-catalog-conflict';

export function assertCatalogIdentitySnapshot(
  current: ProductSearchProduct,
  snapshot: ProductSearchProduct,
): void {
  const names = new Set(current.aliases.map(normalizeProductName));
  if (
    current.id !== snapshot.id ||
    current.canonicalName !== snapshot.canonicalName ||
    snapshot.aliases.some((alias) => !names.has(normalizeProductName(alias)))
  )
    throw new AssistedCatalogConflict('ambiguous_product');
}

export function catalogMetadataUpdate(
  current: ProductMetadataSnapshot,
  prepared: ProductMetadataSnapshot,
  snapshot: ProductMetadataSnapshot | null,
): Partial<ProductMetadataSnapshot> {
  const update: Partial<ProductMetadataSnapshot> = {};
  for (const field of UNDERSTANDING_FIELDS) {
    if (
      snapshot &&
      snapshot[field] !== null &&
      snapshot[field] !== current[field]
    )
      throw new AssistedCatalogConflict('metadata_conflict');
    const value = prepared[field];
    if (value === null) continue;
    if (current[field] !== null && current[field] !== value)
      throw new AssistedCatalogConflict('metadata_conflict');
    if (current[field] === null) Object.assign(update, { [field]: value });
  }
  return update;
}
