import {
  normalizeAliases,
  normalizeProductDisplayName,
  normalizeProductName,
  toProductNameValue,
} from './product-name.util';

describe('normalizeProductDisplayName', () => {
  it('normalizes Unicode and surrounding and repeated whitespace', () => {
    expect(normalizeProductDisplayName('  ３％\t Milk\n')).toBe('3% Milk');
  });

  it('preserves approved display case', () => {
    expect(normalizeProductDisplayName('Three Percent Milk')).toBe(
      'Three Percent Milk',
    );
  });

  it('returns an empty string for blank input', () => {
    expect(normalizeProductDisplayName(' \t\n ')).toBe('');
  });
});

describe('normalizeProductName', () => {
  it.each([
    ['  Milk  ', 'milk'],
    ['MILK', 'milk'],
    ['Café', 'café'],
    ['Café', 'café'],
    ['toilet\t  paper', 'toilet paper'],
  ])('normalizes %j to %j', (rawName, normalizedName) => {
    expect(normalizeProductName(rawName)).toBe(normalizedName);
  });

  it('keeps semantic variants distinct', () => {
    expect(normalizeProductName('3% milk')).not.toBe(
      normalizeProductName('three percent milk'),
    );
  });

  it('uses locale-independent lowercase', () => {
    expect(normalizeProductName('I')).toBe('i');
    expect(normalizeProductName('I')).not.toBe('I'.toLocaleLowerCase('tr'));
  });

  it('returns an empty string for empty or whitespace-only input', () => {
    expect(normalizeProductName('')).toBe('');
    expect(normalizeProductName('   ')).toBe('');
  });
});

describe('toProductNameValue', () => {
  it('returns approved display spelling and its lookup key', () => {
    expect(toProductNameValue('  Three\tPercent Milk  ')).toEqual({
      displayName: 'Three Percent Milk',
      normalizedName: 'three percent milk',
    });
  });
});

describe('normalizeAliases', () => {
  it('returns an empty array when no aliases are given', () => {
    expect(normalizeAliases(undefined, 'milk')).toEqual([]);
  });

  it('normalizes, filters, and deduplicates aliases', () => {
    expect(
      normalizeAliases(
        ['', ' Milk ', '  Moo\tJuice  ', 'MOO JUICE', 'ＣＯＷ JUICE'],
        'milk',
      ),
    ).toEqual(['moo juice', 'cow juice']);
  });
});
