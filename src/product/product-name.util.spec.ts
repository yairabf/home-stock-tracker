import { normalizeAliases, normalizeProductName } from './product-name.util';

describe('normalizeProductName', () => {
  it('trims leading and trailing whitespace', () => {
    expect(normalizeProductName('  Milk  ')).toBe('milk');
  });

  it('case-folds to lowercase', () => {
    expect(normalizeProductName('MILK')).toBe('milk');
  });

  it('leaves an already-normalized name unchanged', () => {
    expect(normalizeProductName('milk')).toBe('milk');
  });

  it('returns an empty string for empty input', () => {
    expect(normalizeProductName('')).toBe('');
  });

  it('returns an empty string for whitespace-only input', () => {
    expect(normalizeProductName('   ')).toBe('');
  });
});

describe('normalizeAliases', () => {
  it('returns an empty array when no aliases are given', () => {
    expect(normalizeAliases(undefined, 'milk')).toEqual([]);
  });

  it('trims and case-folds each alias', () => {
    expect(normalizeAliases(['  Moo Juice  ', 'COW JUICE'], 'milk')).toEqual([
      'moo juice',
      'cow juice',
    ]);
  });

  it('drops empty and whitespace-only aliases', () => {
    expect(normalizeAliases(['', '   ', 'moo juice'], 'milk')).toEqual([
      'moo juice',
    ]);
  });

  it('drops an alias equal to the normalized canonical name', () => {
    expect(normalizeAliases(['Milk', 'moo juice'], 'milk')).toEqual([
      'moo juice',
    ]);
  });

  it('dedupes case-insensitive duplicate aliases', () => {
    expect(normalizeAliases(['moo juice', 'MOO JUICE'], 'milk')).toEqual([
      'moo juice',
    ]);
  });
});
