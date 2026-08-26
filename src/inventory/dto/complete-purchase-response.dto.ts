import { InventoryEventResponseDto } from './inventory-event-response.dto';
import { GroceryItemResponseDto } from '../../grocery/dto/grocery-item-response.dto';

export class CompletePurchaseResponseDto {
  event: InventoryEventResponseDto;
  groceryItems: GroceryItemResponseDto[];
}
