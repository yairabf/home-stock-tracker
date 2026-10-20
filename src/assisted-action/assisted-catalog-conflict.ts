import type { AssistedIssueCode } from './assisted-action-result';

export class AssistedCatalogConflict extends Error {
  constructor(readonly code: AssistedIssueCode) {
    super(`Catalog decision could not be applied: ${code}`);
    this.name = 'AssistedCatalogConflict';
  }
}
