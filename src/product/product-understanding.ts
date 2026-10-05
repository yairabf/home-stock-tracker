import { z } from 'zod';
import { ProductType } from '../generated/prisma/enums';
import type {
  DecisionAttemptProvenance,
  FieldOutcome,
} from '../llm/decision-routing/decision-routing.types';

export const PRODUCT_UNDERSTANDING = Symbol('PRODUCT_UNDERSTANDING');
export const UNDERSTANDING_FIELDS = [
  'category',
  'productType',
  'typicalUnit',
  'isPerishable',
] as const;
export type UnderstandingField = (typeof UNDERSTANDING_FIELDS)[number];
const label = z
  .string()
  .refine((value) => value.trim().length > 0, 'Expected a nonblank label');
export const metadataSchema = z
  .object({
    category: label.nullable(),
    productType: z.enum(ProductType).nullable(),
    typicalUnit: label.nullable(),
    isPerishable: z.boolean().nullable(),
  })
  .strict();
export type ProductMetadataSnapshot = z.infer<typeof metadataSchema>;
export const understandingInputSchema = z
  .object({
    rawName: z.string().trim().min(1),
    metadata: metadataSchema,
    categories: z.array(z.string()),
    units: z.array(z.string()),
  })
  .strict();
export type ProductUnderstandingInput = z.infer<
  typeof understandingInputSchema
>;
type MetadataValue<K extends UnderstandingField> = NonNullable<
  ProductMetadataSnapshot[K]
>;
export type MetadataOutcome<K extends UnderstandingField> =
  | (Extract<FieldOutcome, { status: 'resolved' }> & {
      value: MetadataValue<K>;
      confidence?: number;
    })
  | Exclude<FieldOutcome, { status: 'resolved' }>;
export type MetadataOutcomes = {
  [K in UnderstandingField]: MetadataOutcome<K>;
};
export interface ProductUnderstandingResult {
  fields: MetadataOutcomes;
  attempts: DecisionAttemptProvenance[];
}
export interface ProductUnderstanding {
  understand(
    input: ProductUnderstandingInput,
  ): Promise<ProductUnderstandingResult>;
}

export function initialUnderstanding(
  metadata: ProductMetadataSnapshot,
): ProductUnderstandingResult {
  const fields = Object.fromEntries(
    UNDERSTANDING_FIELDS.map((field) => [
      field,
      metadata[field] === null
        ? { status: 'unavailable' }
        : { status: 'resolved', source: 'supplied', value: metadata[field] },
    ]),
  ) as MetadataOutcomes;
  return { fields, attempts: [] };
}

export function acceptedMetadata(
  snapshot: ProductMetadataSnapshot,
  result: ProductUnderstandingResult,
): Partial<ProductMetadataSnapshot> {
  const update: Partial<ProductMetadataSnapshot> = {};
  for (const field of UNDERSTANDING_FIELDS) {
    const outcome = result.fields[field];
    if (snapshot[field] !== null || outcome.status !== 'resolved') continue;
    const parsed = metadataSchema.shape[field].safeParse(outcome.value);
    if (parsed.success && parsed.data !== null)
      Object.assign(update, { [field]: parsed.data });
  }
  return update;
}

export function metadataSnapshot(
  input: ProductMetadataSnapshot,
): ProductMetadataSnapshot {
  return Object.fromEntries(
    UNDERSTANDING_FIELDS.map((field) => [field, input[field]]),
  ) as ProductMetadataSnapshot;
}
