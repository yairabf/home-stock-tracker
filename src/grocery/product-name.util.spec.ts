import { normalizeProductName } from './product-name.util';

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
