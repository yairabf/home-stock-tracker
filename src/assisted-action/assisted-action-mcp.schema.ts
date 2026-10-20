import { z } from 'zod';
import { assistedActionRequestSchema } from './assisted-action-request';
import { assistedActionResponseSchema } from './assisted-action-response.schema';

// MCP discovery requires object roots. Keep variant validation shared with REST.
const [grocery, stock, purchase] = assistedActionRequestSchema.options;
export const assistedActionMcpInputSchema = z
  .object({
    requestId: grocery.shape.requestId,
    operation: z.enum(['grocery_add', 'stock_set', 'purchase']),
    items: z
      .array(
        z.union([
          z
            .object({
              ...grocery.shape.items.element.shape,
              ifPendingExists: z
                .enum(['return_existing', 'create_separate'])
                .optional(),
            })
            .strict(),
          stock.shape.items.element,
          purchase.shape.items.element,
        ]),
      )
      .min(1)
      .max(100),
  })
  .strict()
  .superRefine((value, ctx) => {
    const result = assistedActionRequestSchema.safeParse(value);
    if (!result.success)
      for (const issue of result.error.issues)
        ctx.addIssue({
          code: 'custom',
          path: issue.path,
          message: issue.message,
        });
  });

const [applied, needsInput, unavailable] = assistedActionResponseSchema.options;
export const assistedActionMcpOutputSchema = z
  .object({
    requestId: needsInput.shape.requestId,
    outcome: z.enum(['applied', 'needs_input', 'unavailable']),
    operation: z.enum(['grocery_add', 'stock_set', 'purchase']).optional(),
    receipts: z
      .union([
        applied.options[0].shape.receipts,
        applied.options[1].shape.receipts,
      ])
      .optional(),
    issues: needsInput.shape.issues.optional(),
    retryable: unavailable.shape.retryable.optional(),
    code: unavailable.shape.code.optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    const result = assistedActionResponseSchema.safeParse(value);
    if (!result.success)
      for (const issue of result.error.issues)
        ctx.addIssue({
          code: 'custom',
          path: issue.path,
          message: issue.message,
        });
  });
