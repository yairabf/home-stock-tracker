import { InventoryEventResponseDto } from './inventory-event-response.dto';

export class InventoryEventListResponseDto {
  items: InventoryEventResponseDto[];
  total: number;
  limit: number;
  offset: number;
}
