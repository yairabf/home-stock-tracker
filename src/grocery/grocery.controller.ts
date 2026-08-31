import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { GroceryService } from './grocery.service';
import { AddGroceryItemDto } from './dto/add-grocery-item.dto';
import { GroceryItemResponseDto } from './dto/grocery-item-response.dto';
import { ListGroceryItemsDto } from './dto/list-grocery-items.dto';
import { GroceryItemSource } from '../generated/prisma/enums';
import { UpdateGroceryItemDto } from './dto/update-grocery-item.dto';
import { AddGroceryItemResultDto } from './dto/add-grocery-item-result.dto';

@Controller('grocery/items')
export class GroceryController {
  constructor(private readonly groceryService: GroceryService) {}

  @Post()
  addItem(@Body() dto: AddGroceryItemDto): Promise<AddGroceryItemResultDto> {
    return this.groceryService.addItem({
      ...dto,
      source: GroceryItemSource.api,
    });
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

  @Patch(':id')
  updateItem(
    @Param('id') id: string,
    @Body() dto: UpdateGroceryItemDto,
  ): Promise<GroceryItemResponseDto> {
    return this.groceryService.updateItem(id, dto);
  }
}
