import { IsEnum, IsOptional } from 'class-validator';
import { GroceryItemStatus } from '../../generated/prisma/enums';

export class ListGroceryItemsDto {
  @IsOptional()
  @IsEnum(GroceryItemStatus)
  status?: GroceryItemStatus;
}
