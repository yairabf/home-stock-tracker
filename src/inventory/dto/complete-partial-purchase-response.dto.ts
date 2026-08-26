import { InventoryEventResponseDto } from './inventory-event-response.dto';
import { GroceryItemStatus } from '../../generated/prisma/enums';

export class CompletedItemDto {
  id: string;
  productName: string;
  status: GroceryItemStatus;
}

export class SkippedItemDto {
  id: string;
  reason: 'not_found' | 'wrong_product' | 'already_resolved';
}

export class PendingItemDto {
  id: string;
  reason: 'explicitly_omitted';
}

export class CompletePartialPurchaseResponseDto {
  event: InventoryEventResponseDto;
  completed: CompletedItemDto[];
  skipped: SkippedItemDto[];
  pending: PendingItemDto[];
}
