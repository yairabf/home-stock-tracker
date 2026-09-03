import { ShelfLifePolicyKind } from '../../generated/prisma/enums';
import { shelfLifeInferenceResultSchema } from './shelf-life-inference';

describe('shelfLifeInferenceResultSchema', () => {
  it.each([
    {
      kind: ShelfLifePolicyKind.finite,
      shelfLifeDays: 7,
      confidence: 0.9,
      rationale: 'Refrigerated dairy product',
    },
    {
      kind: ShelfLifePolicyKind.nonperishable,
      shelfLifeDays: null,
      confidence: 0.8,
      rationale: 'Household durable good',
    },
  ])('accepts a valid policy %#', (policy) => {
    expect(shelfLifeInferenceResultSchema.parse(policy)).toEqual(policy);
  });

  it.each([
    { kind: ShelfLifePolicyKind.finite, shelfLifeDays: null },
    { kind: ShelfLifePolicyKind.nonperishable, shelfLifeDays: 7 },
    { kind: ShelfLifePolicyKind.finite, shelfLifeDays: 0 },
  ])('rejects an invalid policy shape %#', (policy) => {
    expect(() =>
      shelfLifeInferenceResultSchema.parse({
        ...policy,
        confidence: 0.9,
        rationale: 'Invalid combination',
      }),
    ).toThrow();
  });
});
