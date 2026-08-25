/** Trims and case-folds a product name so lookups are whitespace/case-insensitive. */
export function normalizeProductName(rawName: string): string {
  return rawName.trim().toLowerCase();
}

/**
 * Normalizes a raw alias list against an already-normalized `canonicalName`:
 * trims and case-folds each alias, drops empty/whitespace-only entries and any
 * alias equal to the canonical name, and dedupes the rest.
 */
export function normalizeAliases(
  rawAliases: string[] | undefined,
  canonicalName: string,
): string[] {
  if (!rawAliases) {
    return [];
  }

  const normalized = new Set<string>();
  for (const rawAlias of rawAliases) {
    const alias = normalizeProductName(rawAlias);
    if (!alias || alias === canonicalName) {
      continue;
    }
    normalized.add(alias);
  }

  return [...normalized];
}
