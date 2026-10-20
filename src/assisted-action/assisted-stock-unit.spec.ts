import { resolveAssistedStockUnit } from './assisted-stock-unit';

describe('assisted stock units', () => {
  it.each(['stock_set', 'purchase'] as const)(
    'requires a supported unit for %s',
    (operation) => {
      expect(
        resolveAssistedStockUnit(operation, undefined, null, null),
      ).toEqual({ outcome: 'needs_input', code: 'missing_unit' });
      expect(
        resolveAssistedStockUnit(operation, undefined, 'liter', 'bottle'),
      ).toEqual({ outcome: 'resolved', unit: 'liter' });
      expect(
        resolveAssistedStockUnit(operation, undefined, null, 'liter'),
      ).toEqual({ outcome: 'resolved', unit: 'liter' });
    },
  );
  it('allows an explicitly reported stock set to change the unit without converting quantity', () => {
    expect(
      resolveAssistedStockUnit('stock_set', ' bottles ', 'liter', 'liter'),
    ).toEqual({ outcome: 'resolved', unit: 'bottles' });
  });
  it('rejects a purchase unit conflicting with the projection', () => {
    expect(
      resolveAssistedStockUnit('purchase', 'bottle', 'liter', 'bottle'),
    ).toEqual({ outcome: 'needs_input', code: 'metadata_conflict' });
  });
  it('accepts explicit purchase units when untracked or matching', () => {
    for (const existing of [null, 'bottle'])
      expect(
        resolveAssistedStockUnit('purchase', 'bottle', existing, 'liter'),
      ).toEqual({ outcome: 'resolved', unit: 'bottle' });
  });
  it('does not treat blank metadata as a usable unit', () => {
    expect(resolveAssistedStockUnit('purchase', undefined, null, ' ')).toEqual({
      outcome: 'needs_input',
      code: 'missing_unit',
    });
  });
});
