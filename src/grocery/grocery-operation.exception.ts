import {
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { GroceryItemResponseDto } from './dto/grocery-item-response.dto';

export type GroceryErrorCode =
  | 'GROCERY_ITEM_NOT_FOUND'
  | 'GROCERY_ITEM_NOT_PENDING'
  | 'GROCERY_ITEM_CHANGED'
  | 'INVALID_QUANTITY'
  | 'INVALID_UNIT'
  | 'INVALID_NOTE'
  | 'INVALID_UPDATE';

export interface GroceryErrorResponse {
  code: GroceryErrorCode;
  message: string;
  currentItem?: GroceryItemResponseDto;
}

export function groceryNotFound(id: string): NotFoundException {
  return new NotFoundException({
    code: 'GROCERY_ITEM_NOT_FOUND',
    message: `Grocery list item ${id} not found`,
  } satisfies GroceryErrorResponse);
}

export function groceryConflict(
  code: Extract<
    GroceryErrorCode,
    'GROCERY_ITEM_NOT_PENDING' | 'GROCERY_ITEM_CHANGED'
  >,
  message: string,
  currentItem: GroceryItemResponseDto,
): ConflictException {
  return new ConflictException({ code, message, currentItem });
}

export function groceryInvalid(
  code: Exclude<
    GroceryErrorCode,
    | 'GROCERY_ITEM_NOT_FOUND'
    | 'GROCERY_ITEM_NOT_PENDING'
    | 'GROCERY_ITEM_CHANGED'
  >,
  message: string,
): UnprocessableEntityException {
  return new UnprocessableEntityException({ code, message });
}
