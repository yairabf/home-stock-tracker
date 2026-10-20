import { z } from 'zod';
import { metadataSchema } from '../product/product-understanding';
import type { GroceryItemResponseDto } from '../grocery/dto/grocery-item-response.dto';
import type { StockMutationResponseDto } from '../inventory/dto/stock-mutation-response.dto';
import type { ProductSearchProduct } from '../product/types/product-search';

const name = z.string().trim().min(1).max(300);
export const assistedIdentityResultSchema = z.discriminatedUnion('outcome', [
  z
    .object({
      outcome: z.literal('existing'),
      productId: z.uuid(),
      confidence: z.number().min(0).max(1),
    })
    .strict(),
  z
    .object({
      outcome: z.literal('new'),
      canonicalName: name,
      confidence: z.number().min(0).max(1),
    })
    .strict(),
  z.object({ outcome: z.literal('unknown') }).strict(),
]);
export type AssistedIdentityResult = z.infer<
  typeof assistedIdentityResultSchema
>;
export type AssistedIssueCode =
  | 'ambiguous_product'
  | 'missing_unit'
  | 'metadata_conflict'
  | 'alias_conflict'
  | 'duplicate_product';
export interface AssistedIssue {
  inputIndex: number;
  code: AssistedIssueCode;
  candidates?: ProductSearchProduct[];
}
interface ReceiptBase {
  inputIndex: number;
  suppliedName: string | null;
  productId: string;
  canonicalName: string;
  catalogAction: 'existing' | 'alias_added' | 'created';
  unresolvedMetadata: Array<keyof z.infer<typeof metadataSchema>>;
}
export interface AssistedGroceryReceipt extends ReceiptBase {
  itemAction: 'created' | 'returned_existing';
  groceryItem: GroceryItemResponseDto;
}
export interface AssistedStockReceipt extends ReceiptBase {
  inventory: StockMutationResponseDto;
}
export type AssistedAppliedResult = {
  outcome: 'applied';
  requestId: string;
} & (
  | { operation: 'grocery_add'; receipts: AssistedGroceryReceipt[] }
  | { operation: 'stock_set' | 'purchase'; receipts: AssistedStockReceipt[] }
);
export type AssistedActionResult =
  | AssistedAppliedResult
  | { outcome: 'needs_input'; requestId: string; issues: AssistedIssue[] }
  | {
      outcome: 'unavailable';
      requestId: string;
      retryable: boolean;
      code:
        'provider_deadline' | 'provider_unavailable' | 'concurrency_exhausted';
    };
