import {
  Body,
  BadRequestException,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { GroceryService } from './grocery.service';
import { PolicyAwareAddGroceryItemDto } from './dto/policy-aware-add-grocery-item.dto';
import { GroceryItemResponseDto } from './dto/grocery-item-response.dto';
import { ListGroceryItemsDto } from './dto/list-grocery-items.dto';
import { GroceryItemSource } from '../generated/prisma/enums';
import { UpdateGroceryItemDto } from './dto/update-grocery-item.dto';
import { SetGroceryItemQuantityDto } from './dto/set-grocery-item-quantity.dto';
import {
  ConfirmNewProductGroceryItemDto,
  ConfirmProductAliasGroceryItemDto,
} from './dto/confirm-grocery-catalog-decision.dto';
import type { GroceryCatalogConfirmationResult } from './types/confirmed-grocery-catalog-decision';
import {
  UnknownProductPolicy,
  type PolicyAwareGroceryAddition,
  type PolicyAwareGroceryAdditionResult,
} from './types/policy-aware-grocery-addition';

@Controller('grocery/items')
export class GroceryController {
  constructor(private readonly groceryService: GroceryService) {}

  @Post()
  addItem(
    @Body() dto: PolicyAwareAddGroceryItemDto,
  ): Promise<PolicyAwareGroceryAdditionResult> {
    return this.groceryService.addPolicyAwareItem(this.policyAwareRequest(dto));
  }

  @Post('confirm-new-product')
  confirmNewProduct(
    @Body() dto: ConfirmNewProductGroceryItemDto,
  ): Promise<GroceryCatalogConfirmationResult> {
    return this.groceryService.confirmNewProduct({
      ...dto,
      source: GroceryItemSource.api,
    });
  }

  @Post('confirm-product-alias')
  confirmProductAlias(
    @Body() dto: ConfirmProductAliasGroceryItemDto,
  ): Promise<GroceryCatalogConfirmationResult> {
    return this.groceryService.confirmProductAlias({
      ...dto,
      source: GroceryItemSource.api,
    });
  }

  private policyAwareRequest(
    dto: PolicyAwareAddGroceryItemDto,
  ): PolicyAwareGroceryAddition {
    if (dto.unknownProductPolicy === UnknownProductPolicy.create_if_missing) {
      if (!dto.product) {
        throw new BadRequestException(
          'product is required for create_if_missing',
        );
      }
      return {
        unknownProductPolicy: dto.unknownProductPolicy,
        product: dto.product,
        groceryItem: dto.groceryItem,
        source: GroceryItemSource.api,
      };
    }
    if (!dto.productName) {
      throw new BadRequestException(
        'productName is required for propose_if_missing',
      );
    }
    return {
      unknownProductPolicy: dto.unknownProductPolicy,
      productName: dto.productName,
      groceryItem: dto.groceryItem,
      source: GroceryItemSource.api,
    };
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

  @Patch(':id/quantity')
  setQuantity(
    @Param('id') id: string,
    @Body() dto: SetGroceryItemQuantityDto,
  ): Promise<GroceryItemResponseDto> {
    return this.groceryService.setQuantity(id, dto);
  }

  @Patch(':id')
  updateItem(
    @Param('id') id: string,
    @Body() dto: UpdateGroceryItemDto,
  ): Promise<GroceryItemResponseDto> {
    return this.groceryService.updateItem(id, dto);
  }
}
