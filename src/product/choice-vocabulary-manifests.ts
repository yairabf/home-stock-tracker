export type VocabularyKind = 'category' | 'unit';

export interface ChoiceVocabularyManifest {
  readonly version: string;
  readonly seeds: readonly string[];
}

export const CHOICE_VOCABULARY_MANIFESTS = {
  category: {
    version: 'product-category-v1',
    seeds: [
      'dairy and eggs',
      'fruit and vegetables',
      'meat and fish',
      'bread and bakery',
      'grains and legumes',
      'canned and pantry goods',
      'frozen foods',
      'snacks and sweets',
      'beverages',
      'cleaning and laundry',
      'personal care',
      'other household supplies',
    ],
  },
  unit: {
    version: 'product-unit-v1',
    seeds: ['item', 'pack', 'kg', 'g', 'liter', 'ml'],
  },
} as const satisfies Record<VocabularyKind, ChoiceVocabularyManifest>;
