import { Injectable } from '@nestjs/common';
import { normalizeProductName } from '../product/product-name.util';
import { AssistedCatalogPreparation } from './assisted-catalog-preparation.service';
import type { AssistedActionRequest } from './assisted-action-request';
import type {
  CatalogPreparationResult,
  PreparedCatalogProduct,
} from './assisted-preparation';
import type { AssistedIssue } from './assisted-action-result';
import { duplicateProductIssues } from './assisted-batch-issues';

export type PreparedBatch =
  | { outcome: 'prepared'; products: PreparedCatalogProduct[] }
  | { outcome: 'needs_input'; issues: AssistedIssue[] }
  | Extract<CatalogPreparationResult, { outcome: 'unavailable' }>;

@Injectable()
export class AssistedBatchPreparation {
  constructor(private readonly catalog: AssistedCatalogPreparation) {}

  async prepare(items: AssistedActionRequest['items']): Promise<PreparedBatch> {
    const duplicates = duplicateProductIssues(
      items.map((item: AssistedActionRequest['items'][number]) => [
        item.productId
          ? `id:${item.productId}`
          : `name:${normalizeProductName(item.productName!)}`,
      ]),
    );
    if (duplicates.length)
      return { outcome: 'needs_input', issues: duplicates };
    const expiresAt = performance.now() + 60_000;
    const results: CatalogPreparationResult[] =
      new Array<CatalogPreparationResult>(items.length);
    let next = 0;
    const worker = async () => {
      while (next < items.length) {
        const index = next++;
        results[index] = await this.catalog.prepare(items[index], expiresAt);
      }
    };
    await Promise.all(
      Array.from({ length: Math.min(4, items.length) }, worker),
    );
    return this.collect(results);
  }

  private collect(results: CatalogPreparationResult[]): PreparedBatch {
    const unavailable = results.find(
      (result) => result.outcome === 'unavailable',
    );
    if (unavailable?.outcome === 'unavailable') return unavailable;
    const issues: AssistedIssue[] = [];
    const products: PreparedCatalogProduct[] = [];
    results.forEach((result, inputIndex) => {
      if (result.outcome === 'prepared') products.push(result.product);
      else if (result.outcome === 'needs_input')
        issues.push({
          inputIndex,
          code: result.code,
          ...(result.candidates ? { candidates: result.candidates } : {}),
        });
    });
    if (issues.length) return { outcome: 'needs_input', issues };
    const duplicates = duplicateProductIssues(
      products.map((product) => [
        `name:${normalizeProductName(product.canonicalName)}`,
        ...(product.existing ? [`id:${product.existing.id}`] : []),
      ]),
    );
    return duplicates.length
      ? { outcome: 'needs_input', issues: duplicates }
      : { outcome: 'prepared', products };
  }
}
