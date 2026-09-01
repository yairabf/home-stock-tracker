import type { ProductNameValue } from './types/product-name';

export function normalizeProductDisplayName(rawName: string): string {
  return rawName.normalize('NFKC').trim().replace(/\s+/gu, ' ');
}

export function normalizeProductName(rawName: string): string {
  return normalizeProductDisplayName(rawName).toLowerCase();
}

export function toProductNameValue(rawName: string): ProductNameValue {
  const displayName = normalizeProductDisplayName(rawName);
  return {
    displayName,
    normalizedName: displayName.toLowerCase(),
  };
}

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
