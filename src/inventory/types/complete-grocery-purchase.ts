import { GroceryItemResponseDto } from '../../grocery/dto/grocery-item-response.dto';
import { InventoryEventResponseDto } from '../dto/inventory-event-response.dto';

export interface CompleteGroceryPurchaseInput {
  groceryItemIds: string[];
  source: string;
}

export interface CompleteGroceryPurchaseResult {
  events: InventoryEventResponseDto[];
  completedItems: GroceryItemResponseDto[];
}
