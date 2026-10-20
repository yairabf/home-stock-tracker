export type AssistedStockUnit =
  | { outcome: 'resolved'; unit: string }
  | { outcome: 'needs_input'; code: 'missing_unit' | 'metadata_conflict' };

export function resolveAssistedStockUnit(
  operation: 'stock_set' | 'purchase',
  explicitUnit: string | undefined,
  existingUnit: string | null,
  typicalUnit: string | null,
): AssistedStockUnit {
  const explicit = explicitUnit?.trim() || null;
  const existing = existingUnit?.trim() || null;
  const typical = typicalUnit?.trim() || null;
  if (operation === 'purchase' && explicit && existing && explicit !== existing)
    return { outcome: 'needs_input', code: 'metadata_conflict' };
  const unit = explicit ?? existing ?? typical;
  return unit
    ? { outcome: 'resolved', unit }
    : { outcome: 'needs_input', code: 'missing_unit' };
}
