import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProductService } from '../product/product.service';
import { AddGroceryItemDto } from './dto/add-grocery-item.dto';
import { GroceryItemResponseDto } from './dto/grocery-item-response.dto';
import {
  GroceryItemSource,
  GroceryItemStatus,
} from '../generated/prisma/enums';

@Injectable()
export class GroceryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly productService: ProductService,
  ) {}

  async addItem(dto: AddGroceryItemDto): Promise<GroceryItemResponseDto> {
    const product = await this.productService.findOrCreateByExactOrAliasMatch(
      dto.productName,
    );

    const item = await this.prisma.groceryListItem.create({
      data: {
        productId: product.id,
        requestedQuantity: dto.requestedQuantity,
        unit: dto.unit,
        note: dto.note,
        source: dto.source ?? GroceryItemSource.api,
      },
    });

    return GroceryItemResponseDto.fromEntity(item, product.canonicalName);
  }

  async listItems(
    status: GroceryItemStatus = GroceryItemStatus.pending,
  ): Promise<GroceryItemResponseDto[]> {
    const items = await this.prisma.groceryListItem.findMany({
      where: { status },
      include: { product: true },
      orderBy: { dateAdded: 'desc' },
    });

    return items.map((item) =>
      GroceryItemResponseDto.fromEntity(item, item.product.canonicalName),
    );
  }

  async removeItem(id: string): Promise<GroceryItemResponseDto> {
    const existing = await this.prisma.groceryListItem.findUnique({
      where: { id },
      include: { product: true },
    });
    if (!existing) {
      throw new NotFoundException(`Grocery list item ${id} not found`);
    }
    if (existing.status !== GroceryItemStatus.pending) {
      throw new ConflictException(`Grocery list item ${id} is not pending`);
    }

    const result = await this.prisma.groceryListItem.updateMany({
      where: { id, status: GroceryItemStatus.pending },
      data: { status: GroceryItemStatus.removed },
    });
    if (result.count !== 1) {
      throw new ConflictException(`Grocery list item ${id} is not pending`);
    }

    return GroceryItemResponseDto.fromEntity(
      { ...existing, status: GroceryItemStatus.removed },
      existing.product.canonicalName,
    );
  }
}
