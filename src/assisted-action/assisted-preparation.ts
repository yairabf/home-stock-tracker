import type { ProductSearchProduct } from '../product/types/product-search';
import type {
  ProductMetadataSnapshot,
  ProductUnderstandingResult,
} from '../product/product-understanding';
import type { AssistedIssueCode } from './assisted-action-result';

export interface IdentityEvidence {
  provider: string;
  model: string;
  promptVersion: string;
  confidence: number;
}
export interface PreparedCatalogProduct {
  suppliedName: string | null;
  canonicalName: string;
  aliasToAdd: string | null;
  existing: ProductSearchProduct | null;
  metadata: ProductMetadataSnapshot;
  identityEvidence: IdentityEvidence | null;
  understanding: ProductUnderstandingResult | null;
  unitDefaulted?: boolean;
}
export type PreparationFailure =
  | {
      outcome: 'needs_input';
      code: AssistedIssueCode;
      candidates?: ProductSearchProduct[];
    }
  | {
      outcome: 'unavailable';
      code: 'provider_deadline' | 'provider_unavailable';
      retryable: true;
    };
export type CatalogPreparationResult =
  { outcome: 'prepared'; product: PreparedCatalogProduct } | PreparationFailure;

export class PreparationDeadline extends Error {}

export function remainingPreparationMs(expiresAt: number): number {
  const remaining = expiresAt - performance.now();
  if (!Number.isFinite(remaining) || remaining <= 0)
    throw new PreparationDeadline();
  return remaining;
}

export async function withinPreparationDeadline<T>(
  expiresAt: number,
  work: () => Promise<T>,
): Promise<T> {
  const remaining = remainingPreparationMs(expiresAt);
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      work(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new PreparationDeadline()), remaining);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
