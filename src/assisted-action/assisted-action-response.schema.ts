import { z } from 'zod';
import {
  groceryItemOutputSchema,
  productSearchProductOutputSchema,
  stockMutationOutputSchema,
} from '../common/operation-response.schema';
import { UNDERSTANDING_FIELDS } from '../product/product-understanding';

const receipt = {
  inputIndex: z.number().int().min(0).max(99),
  suppliedName: z.string().trim().min(1).max(300).nullable(),
  productId: z.uuid(),
  canonicalName: z.string().trim().min(1).max(300),
  catalogAction: z.enum(['existing', 'alias_added', 'created']),
  unresolvedMetadata: z.array(z.enum(UNDERSTANDING_FIELDS)).max(4),
};
const groceryReceipt = z
  .object({
    ...receipt,
    itemAction: z.enum(['created', 'returned_existing']),
    groceryItem: groceryItemOutputSchema.strict(),
  })
  .strict();
const stockReceipt = z
  .object({
    ...receipt,
    inventory: stockMutationOutputSchema.strict(),
  })
  .strict();
const applied = { outcome: z.literal('applied'), requestId: z.uuid() };
const appliedSchema = z.discriminatedUnion('operation', [
  z
    .object({
      ...applied,
      operation: z.literal('grocery_add'),
      receipts: z.array(groceryReceipt).min(1).max(100),
    })
    .strict(),
  z
    .object({
      ...applied,
      operation: z.enum(['stock_set', 'purchase']),
      receipts: z.array(stockReceipt).min(1).max(100),
    })
    .strict(),
]);
export const assistedActionResponseSchema = z.union([
  appliedSchema,
  z
    .object({
      outcome: z.literal('needs_input'),
      requestId: z.uuid(),
      issues: z
        .array(
          z
            .object({
              inputIndex: z.number().int().min(0).max(99),
              code: z.enum([
                'ambiguous_product',
                'missing_unit',
                'metadata_conflict',
                'alias_conflict',
                'duplicate_product',
              ]),
              candidates: z
                .array(productSearchProductOutputSchema)
                .max(20)
                .optional(),
            })
            .strict(),
        )
        .min(1)
        .max(100),
    })
    .strict(),
  z
    .object({
      outcome: z.literal('unavailable'),
      requestId: z.uuid(),
      retryable: z.boolean(),
      code: z.enum([
        'provider_deadline',
        'provider_unavailable',
        'concurrency_exhausted',
      ]),
    })
    .strict(),
]);
export type AssistedActionWireResult = z.infer<
  typeof assistedActionResponseSchema
>;
