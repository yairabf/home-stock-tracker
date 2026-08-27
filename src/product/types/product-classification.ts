import { z } from 'zod';
import { ProductType } from '../../generated/prisma/enums';

const nonBlankString = z.string().trim().min(1);

export const productClassificationInputSchema = z
  .object({
    rawName: nonBlankString,
    hints: z
      .object({
        category: nonBlankString.optional(),
        typicalUnit: nonBlankString.optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

export const productClassificationResultSchema = z
  .object({
    canonicalName: nonBlankString,
    aliases: z.array(nonBlankString),
    category: nonBlankString,
    typicalUnit: nonBlankString.nullable(),
    productType: z.enum(ProductType),
    isPerishable: z.boolean(),
    confidence: z.number().min(0).max(1),
  })
  .strict();

export type ProductClassificationInput = z.infer<
  typeof productClassificationInputSchema
>;

export type ProductClassificationResult = z.infer<
  typeof productClassificationResultSchema
>;
