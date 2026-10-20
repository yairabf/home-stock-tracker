import { z } from 'zod';
import { metadataSchema } from '../product/product-understanding';
import { resolvePurchaseTimestamp } from '../inventory/types/purchase-contract';

export const MAX_ASSISTED_ITEMS = 100;
const text = z.string().trim().min(1);
const quantity = z.number().finite().positive();
const identity = {
  productId: z
    .uuid()
    .transform((id) => id.toLowerCase())
    .optional(),
  productName: text.max(300).optional(),
  metadata: metadataSchema.partial().optional(),
  unit: text.optional(),
};
const hasOneIdentity = (item: { productId?: string; productName?: string }) =>
  (item.productId !== undefined) !== (item.productName !== undefined);
const identityError = {
  message: 'Provide exactly one productId or productName',
};
const groceryItem = z
  .object({
    ...identity,
    quantity: quantity.optional(),
    note: z.string().optional(),
    ifPendingExists: z
      .enum(['return_existing', 'create_separate'])
      .default('return_existing'),
  })
  .strict()
  .refine(hasOneIdentity, identityError);
const stockItem = z
  .object({ ...identity, quantity })
  .strict()
  .refine(hasOneIdentity, identityError);
const purchaseItem = z
  .object({
    ...identity,
    quantity,
    purchasedAt: z.iso.datetime({ offset: true }).optional(),
  })
  .strict()
  .refine(hasOneIdentity, identityError);
const requestId = z.uuid().transform((id) => id.toLowerCase());

export const assistedActionRequestSchema = z.discriminatedUnion('operation', [
  z
    .object({
      requestId,
      operation: z.literal('grocery_add'),
      items: z.array(groceryItem).min(1).max(MAX_ASSISTED_ITEMS),
    })
    .strict(),
  z
    .object({
      requestId,
      operation: z.literal('stock_set'),
      items: z.array(stockItem).min(1).max(MAX_ASSISTED_ITEMS),
    })
    .strict(),
  z
    .object({
      requestId,
      operation: z.literal('purchase'),
      items: z.array(purchaseItem).min(1).max(MAX_ASSISTED_ITEMS),
    })
    .strict(),
]);

export type AssistedActionRequest = z.infer<typeof assistedActionRequestSchema>;
export type AssistedActionOperation = AssistedActionRequest['operation'];

// Call once on arrival, before preparation; replay uses the persisted receipt.
export function parseAssistedActionRequest(
  raw: unknown,
  receivedAt = new Date(),
): AssistedActionRequest {
  const request = assistedActionRequestSchema.parse(raw);
  if (request.operation === 'purchase') {
    for (const item of request.items)
      resolvePurchaseTimestamp(item.purchasedAt, receivedAt);
  }
  return request;
}
