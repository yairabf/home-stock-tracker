import {
  applicablePolicies,
  requiresUnsupportedGeneration,
  SHELF_LIFE_REGISTRY,
  validatePolicyRegistry,
} from './shelf-life-policy-registry';
import {
  readShelfLifeContext,
  shelfLifePolicyInputSchema,
  type ShelfLifePolicyInput,
} from './shelf-life-policy';

export const eggInput: ShelfLifePolicyInput = {
  productId: 'egg',
  canonicalName: 'ביצים',
  category: 'eggs',
  typicalUnit: 'unit',
  productType: 'discrete_consumable',
  isPerishable: true,
  context: {
    version: 1,
    storage: 'refrigerated',
    maxTemperatureC: 4,
    preparation: 'raw',
    form: 'shell',
  },
};
describe('shelf-life registry', () => {
  it('uses reviewed exact durations and rejects duplicate/malformed entries', () => {
    expect(
      SHELF_LIFE_REGISTRY.map((entry) => entry.policy.shelfLifeDays),
    ).toEqual([21, 1, null]);
    expect(() =>
      validatePolicyRegistry([SHELF_LIFE_REGISTRY[0], SHELF_LIFE_REGISTRY[0]]),
    ).toThrow();
    expect(() =>
      validatePolicyRegistry([
        {
          ...SHELF_LIFE_REGISTRY[0],
          policy: { ...SHELF_LIFE_REGISTRY[0].policy, shelfLifeDays: null },
        },
      ]),
    ).toThrow();
  });
  it('requires storage facts and identifiable variants', () => {
    expect(applicablePolicies(eggInput).map((entry) => entry.id)).toEqual([
      'raw-shell-eggs-refrigerated',
    ]);
    for (const input of [
      { ...eggInput, context: null },
      { ...eggInput, canonicalName: 'egg salad' },
      { ...eggInput, context: { ...eggInput.context!, maxTemperatureC: 8 } },
      { ...eggInput, isPerishable: false },
    ]) {
      expect(applicablePolicies(input)).toEqual([]);
      expect(requiresUnsupportedGeneration(input)).toBe(false);
    }
  });
  it('distinguishes unsupported evidence from missing facts and ambiguity', () => {
    const fish: ShelfLifePolicyInput = {
      ...eggInput,
      canonicalName: 'raw salmon',
      context: { ...eggInput.context!, form: 'whole_or_pieces' },
    };
    expect(applicablePolicies(fish)).toEqual([]);
    expect(requiresUnsupportedGeneration(fish)).toBe(true);
    expect(requiresUnsupportedGeneration({ ...fish, isPerishable: null })).toBe(
      false,
    );
    expect(
      requiresUnsupportedGeneration({ ...fish, canonicalName: 'fish' }),
    ).toBe(false);
    expect(requiresUnsupportedGeneration({ ...fish, context: null })).toBe(
      false,
    );
  });
  it('never classifies household goods from type/false alone', () => {
    const durable: ShelfLifePolicyInput = {
      ...eggInput,
      canonicalName: 'toilet paper',
      productType: 'household_consumable',
      isPerishable: false,
      context: { ...eggInput.context!, storage: 'ambient' },
    };
    expect(applicablePolicies(durable)[0]?.policy.kind).toBe('nonperishable');
    expect(applicablePolicies({ ...durable, canonicalName: 'bleach' })).toEqual(
      [],
    );
    expect(applicablePolicies({ ...durable, isPerishable: true })).toEqual([]);
  });
  it('parses context strictly and retains nullable metadata', () => {
    expect(
      readShelfLifeContext({
        unrelated: 'preserved',
        shelfLifeContext: eggInput.context,
      }),
    ).toEqual(eggInput.context);
    for (const context of [
      null,
      { ...eggInput.context, version: 2 },
      { ...eggInput.context, maxTemperatureC: NaN },
      { ...eggInput.context, extra: true },
    ])
      expect(readShelfLifeContext({ shelfLifeContext: context })).toBeNull();
    expect(
      shelfLifePolicyInputSchema.parse({ ...eggInput, isPerishable: null })
        .isPerishable,
    ).toBeNull();
    expect(
      shelfLifePolicyInputSchema.safeParse({ ...eggInput, canonicalName: '' })
        .success,
    ).toBe(false);
  });
});
