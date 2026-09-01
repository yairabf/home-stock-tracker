import type { GroceryItemSource } from '../../generated/prisma/enums';
import type { ExplicitProductCreationInput } from '../../product/types/explicit-product-creation';
import type {
  GroceryConfirmationRequiredResult,
  CreatedGroceryAdditionResult,
} from './policy-aware-grocery-addition';

export interface ConfirmedGroceryItemInput {
  requestedQuantity?: number;
  unit?: string;
  note?: string;
}

interface GroceryCatalogConfirmationBase {
  groceryItem: ConfirmedGroceryItemInput;
  source: GroceryItemSource;
}

export interface ConfirmNewProductGroceryAddition extends GroceryCatalogConfirmationBase {
  product: ExplicitProductCreationInput;
}

export interface ConfirmProductAliasGroceryAddition extends GroceryCatalogConfirmationBase {
  targetProductId: string;
  alias: string;
}

export type GroceryCatalogConfirmationResult =
  CreatedGroceryAdditionResult | GroceryConfirmationRequiredResult;
