import { z } from 'zod';
import { ProductType } from '../../generated/prisma/enums';

export const confirmedGroceryItemInputSchema = z
  .object({
    requestedQuantity: z.number().positive().finite().optional(),
    unit: z.string().optional(),
    note: z.string().optional(),
  })
  .strict();

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

export const confirmNewProductInputSchema = z
  .object({
    product: confirmedProductInputSchema,
    groceryItem: confirmedGroceryItemInputSchema,
  })
  .strict();

export const confirmProductAliasInputSchema = z
  .object({
    targetProductId: z.uuid(),
    alias: z.string().trim().min(1),
    groceryItem: confirmedGroceryItemInputSchema,
  })
  .strict();
