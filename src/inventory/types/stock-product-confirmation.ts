import { ConflictException } from '@nestjs/common';
import { z } from 'zod';
import { confirmedProductInputSchema } from '../../product/types/confirmed-product.schema';
import type { ProductWithNames } from '../../product/types/product-with-names';

export const stockProductConfirmationSchema = z
  .object({
    operationId: z.uuid(),
    product: confirmedProductInputSchema.extend({
      typicalUnit: z.string().trim().min(1).nullable(),
    }),
    stock: z
      .object({
        quantity: z.number().positive().finite(),
        unit: z.string().trim().min(1),
      })
      .strict(),
  })
  .strict()
  .refine(
    ({ product, stock }) =>
      product.typicalUnit === null || product.typicalUnit === stock.unit,
    {
      message: 'Product typical unit must match approved stock unit',
      path: ['stock', 'unit'],
    },
  );

export type StockProductConfirmationInput = z.infer<
  typeof stockProductConfirmationSchema
>;
export type StockConfirmationPayload = Omit<
  StockProductConfirmationInput,
  'operationId'
>;

export function encodeConfirmationPayload(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(encodeConfirmationPayload).join(',')}]`;
  }
  if (value !== null && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map(
        (key) =>
          `${JSON.stringify(key)}:${encodeConfirmationPayload(value[key])}`,
      )
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

export function assertCompatibleStockProduct(
  product: ProductWithNames,
  projectionUnit: string | null,
  input: StockConfirmationPayload,
): void {
  const unit = (projectionUnit ?? product.typicalUnit)?.trim();
  if (
    product.category !== input.product.category ||
    product.productType !== input.product.productType ||
    product.isPerishable !== input.product.isPerishable ||
    unit !== input.stock.unit
  ) {
    throw new ConflictException({
      code: 'STOCK_CONFIRMATION_PRODUCT_CONFLICT',
      message:
        'Existing product facts or stock unit differ from the approved proposal; clarify before setting stock',
    });
  }
}
