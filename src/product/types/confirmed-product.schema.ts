import { z } from 'zod';
import { ProductType } from '../../generated/prisma/enums';

export const confirmedProductInputSchema = z
  .object({
    canonicalName: z.string().trim().min(1),
    aliases: z.array(z.string().trim().min(1)),
    category: z.string().trim().min(1),
    typicalUnit: z.string().nullable(),
    productType: z.enum(ProductType),
    isPerishable: z.boolean(),
  })
  .strict();
