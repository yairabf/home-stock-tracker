import { z } from 'zod';
import { ProductType, ShelfLifePolicyKind } from '../../generated/prisma/enums';

const nonBlankString = z.string().trim().min(1);

export const shelfLifeInferenceInputSchema = z
  .object({
    productId: nonBlankString,
    canonicalName: nonBlankString,
    category: nonBlankString.nullable(),
    typicalUnit: nonBlankString.nullable(),
    productType: z.enum(ProductType).nullable(),
    isPerishable: z.boolean(),
  })
  .strict();

export const shelfLifeInferenceResultSchema = z
  .object({
    kind: z.enum(ShelfLifePolicyKind),
    shelfLifeDays: z.number().positive().finite().nullable(),
    confidence: z.number().min(0).max(1),
    rationale: nonBlankString,
  })
  .strict()
  .superRefine((value, context) => {
    const valid =
      (value.kind === ShelfLifePolicyKind.finite &&
        value.shelfLifeDays !== null) ||
      (value.kind === ShelfLifePolicyKind.nonperishable &&
        value.shelfLifeDays === null);
    if (!valid) {
      context.addIssue({
        code: 'custom',
        path: ['shelfLifeDays'],
        message:
          'Finite policies require shelf-life days; nonperishable policies require null',
      });
    }
  });

export type ShelfLifeInferenceInput = z.infer<
  typeof shelfLifeInferenceInputSchema
>;
export type ShelfLifeInferenceResult = z.infer<
  typeof shelfLifeInferenceResultSchema
>;

export interface ShelfLifeInferenceSummary {
  processed: number;
  succeeded: number;
  skipped: number;
  failed: number;
}
