import { z } from 'zod';
import { shelfLifeInferenceResultSchema } from './types/shelf-life-inference';
import type { ShelfLifePolicyInput } from './shelf-life-policy';

export const SHELF_LIFE_REGISTRY_VERSION = 'shelf-life-policies-v1';
export const COLD_STORAGE_SOURCE =
  'https://www.foodsafety.gov/food-safety-charts/cold-food-storage-charts';
const entrySchema = z
  .object({
    id: z.string().trim().min(1),
    family: z.enum(['eggs', 'poultry', 'durable']),
    policy: shelfLifeInferenceResultSchema,
    source: z.string().trim().min(1),
  })
  .strict();
const registrySchema = z
  .array(entrySchema)
  .min(1)
  .max(254)
  .refine(
    (entries) => new Set(entries.map(({ id }) => id)).size === entries.length,
  );
export type ShelfLifeRegistryEntry = z.infer<typeof entrySchema>;
export function validatePolicyRegistry(
  value: unknown,
): ShelfLifeRegistryEntry[] {
  return registrySchema.parse(value);
}

export const SHELF_LIFE_REGISTRY = validatePolicyRegistry([
  {
    id: 'raw-shell-eggs-refrigerated',
    family: 'eggs',
    source: COLD_STORAGE_SOURCE,
    policy: {
      kind: 'finite',
      shelfLifeDays: 21,
      confidence: 0.9,
      rationale:
        'Raw shell eggs, refrigerated at <=4 C from purchase; conservative 21-day inventory estimate.',
    },
  },
  {
    id: 'raw-poultry-refrigerated',
    family: 'poultry',
    source: COLD_STORAGE_SOURCE,
    policy: {
      kind: 'finite',
      shelfLifeDays: 1,
      confidence: 0.9,
      rationale:
        'Raw chicken or turkey, refrigerated at <=4 C from purchase; conservative one-day inventory estimate.',
    },
  },
  {
    id: 'stable-household-paper-plastic',
    family: 'durable',
    source: 'Application inventory policy, dry nonfood paper/plastic only',
    policy: {
      kind: 'nonperishable',
      shelfLifeDays: null,
      confidence: 0.9,
      rationale:
        'Plain toilet paper or empty plastic refuse bags under normal dry ambient storage; no intrinsic inventory expiration.',
    },
  },
]);

const IDENTITIES = {
  eggs: ['eggs', 'raw eggs', 'shell eggs', 'ביצים', 'ביצי תרנגולת'],
  poultry: [
    'chicken',
    'raw chicken',
    'turkey',
    'raw turkey',
    'עוף',
    'עוף טרי',
    'הודו',
    'הודו טרי',
  ],
  durable: [
    'toilet paper',
    'plastic refuse bags',
    'trash bags',
    'נייר טואלט',
    'שקיות אשפה',
  ],
  unsupported_fish: [
    'salmon',
    'raw salmon',
    'cod',
    'raw cod',
    'trout',
    'raw trout',
    'סלמון',
    'דג סלמון',
    'פורל',
  ],
} as const;

function identity(
  input: ShelfLifePolicyInput,
  family: keyof typeof IDENTITIES,
): boolean {
  const name = input.canonicalName
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
  return (IDENTITIES[family] as readonly string[]).includes(name);
}

export function hasColdRawContext(input: ShelfLifePolicyInput): boolean {
  const context = input.context;
  return (
    context !== null &&
    context.storage === 'refrigerated' &&
    context.maxTemperatureC !== null &&
    context.maxTemperatureC <= 4 &&
    context.maxTemperatureC > 0 &&
    context.preparation === 'raw'
  );
}

export function applicablePolicies(
  input: ShelfLifePolicyInput,
): ShelfLifeRegistryEntry[] {
  return SHELF_LIFE_REGISTRY.filter((entry) => {
    if (entry.family === 'durable')
      return (
        input.context?.storage === 'ambient' &&
        input.productType === 'household_consumable' &&
        input.isPerishable !== true &&
        identity(input, 'durable')
      );
    if (
      !hasColdRawContext(input) ||
      input.isPerishable === false ||
      input.productType === 'household_consumable'
    )
      return false;
    return (
      input.context?.form ===
        (entry.family === 'eggs' ? 'shell' : 'whole_or_pieces') &&
      identity(input, entry.family)
    );
  });
}

export function requiresUnsupportedGeneration(
  input: ShelfLifePolicyInput,
): boolean {
  return (
    identity(input, 'unsupported_fish') &&
    hasColdRawContext(input) &&
    input.context?.form === 'whole_or_pieces' &&
    input.isPerishable === true &&
    input.productType !== 'household_consumable'
  );
}
