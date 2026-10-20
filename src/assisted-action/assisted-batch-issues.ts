import type { AssistedIssue } from './assisted-action-result';

export class AssistedBatchIssues extends Error {
  constructor(readonly issues: AssistedIssue[]) {
    super('Assisted action needs input');
  }
}

export function duplicateProductIssues(keys: string[][]): AssistedIssue[] {
  const owners = new Map<string, number>();
  const duplicates = new Set<number>();
  keys.forEach((itemKeys, index) => {
    for (const key of itemKeys) {
      const prior = owners.get(key);
      if (prior !== undefined && prior !== index) {
        duplicates.add(prior);
        duplicates.add(index);
      } else owners.set(key, index);
    }
  });
  return [...duplicates]
    .sort((a, b) => a - b)
    .map((inputIndex) => ({ inputIndex, code: 'duplicate_product' }));
}
