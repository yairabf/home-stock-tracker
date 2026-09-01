import type { GroceryListItemModel } from '../../generated/prisma/models';
import {
  GroceryItemSource,
  GroceryItemStatus,
} from '../../generated/prisma/enums';

export class GroceryItemResponseDto {
  id: string;
  productId: string;
  productName: string;
  requestedQuantity: number;
  unit: string | null;
  dateAdded: Date;
  status: GroceryItemStatus;
  note: string | null;
  source: GroceryItemSource;
  relatedInventoryEventId: string | null;

  static fromEntity(
    item: GroceryListItemModel,
    productName: string,
  ): GroceryItemResponseDto {
    const dto = new GroceryItemResponseDto();
    dto.id = item.id;
    dto.productId = item.productId;
    dto.productName = productName;
    dto.requestedQuantity = item.requestedQuantity;
    dto.unit = item.unit;
    dto.dateAdded = item.dateAdded;
    dto.status = item.status;
    dto.note = item.note;
    dto.source = item.source;
    dto.relatedInventoryEventId = item.relatedInventoryEventId;
    return dto;
  }
}
