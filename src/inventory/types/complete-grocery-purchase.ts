import { GroceryItemResponseDto } from '../../grocery/dto/grocery-item-response.dto';
import { InventoryEventResponseDto } from '../dto/inventory-event-response.dto';

export interface CompleteGroceryPurchaseItemInput {
  groceryItemId: string;
  actualQuantity?: number;
  actualUnit?: string;
}

interface CompleteGroceryPurchaseBaseInput {
  source: string;
}

export type CompleteGroceryPurchaseInput =
  | (CompleteGroceryPurchaseBaseInput & {
      groceryItemIds: string[];
      items?: never;
    })
  | (CompleteGroceryPurchaseBaseInput & {
      groceryItemIds?: never;
      items: CompleteGroceryPurchaseItemInput[];
    });

export interface CompleteGroceryPurchaseResult {
  events: InventoryEventResponseDto[];
  completedItems: GroceryItemResponseDto[];
}
