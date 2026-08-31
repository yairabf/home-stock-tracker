import type { AddGroceryItemDto } from './add-grocery-item.dto';
import type { GroceryItemResponseDto } from './grocery-item-response.dto';

export enum AddGroceryItemOutcome {
  created = 'created',
  confirmation_required = 'confirmation_required',
}

export class GroceryRequestedAdditionDto {
  requestedQuantity: number | null;
  unit: string | null;
  note: string | null;

  static fromRequest(dto: AddGroceryItemDto): GroceryRequestedAdditionDto {
    return {
      requestedQuantity: dto.requestedQuantity ?? null,
      unit: dto.unit ?? null,
      note: dto.note ?? null,
    };
  }
}

export class AddGroceryItemResultDto {
  outcome: AddGroceryItemOutcome;
  createdItem: GroceryItemResponseDto | null;
  existingItems: GroceryItemResponseDto[];
  requestedAddition: GroceryRequestedAdditionDto;
}
