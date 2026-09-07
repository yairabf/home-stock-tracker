import { z } from 'zod';
import { confirmedProductInputSchema } from '../../product/types/confirmed-product.schema';
export { confirmedProductInputSchema } from '../../product/types/confirmed-product.schema';

export const confirmedGroceryItemInputSchema = z
  .object({
    requestedQuantity: z.number().positive().finite().optional(),
    unit: z.string().optional(),
    note: z.string().optional(),
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
