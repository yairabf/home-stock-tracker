import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { GroceryService } from './grocery.service';
import { AddGroceryItemDto } from './dto/add-grocery-item.dto';
import { GroceryItemResponseDto } from './dto/grocery-item-response.dto';
import { ListGroceryItemsDto } from './dto/list-grocery-items.dto';

@Controller('grocery/items')
export class GroceryController {
  constructor(private readonly groceryService: GroceryService) {}

  @Post()
  addItem(@Body() dto: AddGroceryItemDto): Promise<GroceryItemResponseDto> {
    return this.groceryService.addItem(dto);
  }

  @Get()
  listItems(
    @Query() query: ListGroceryItemsDto,
  ): Promise<GroceryItemResponseDto[]> {
    return this.groceryService.listItems(query.status);
  }

  @Delete(':id')
  removeItem(@Param('id') id: string): Promise<GroceryItemResponseDto> {
    return this.groceryService.removeItem(id);
  }
}
