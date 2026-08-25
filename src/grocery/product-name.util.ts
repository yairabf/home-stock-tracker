/** Trims and case-folds a product name so lookups are whitespace/case-insensitive. */
export function normalizeProductName(rawName: string): string {
  return rawName.trim().toLowerCase();
}
