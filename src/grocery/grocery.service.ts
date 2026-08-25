import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AddGroceryItemDto } from './dto/add-grocery-item.dto';
import { GroceryItemResponseDto } from './dto/grocery-item-response.dto';
import { normalizeProductName } from './product-name.util';
import {
  GroceryItemSource,
  GroceryItemStatus,
} from '../generated/prisma/enums';

@Injectable()
export class GroceryService {
  constructor(private readonly prisma: PrismaService) {}

  async addItem(dto: AddGroceryItemDto): Promise<GroceryItemResponseDto> {
    const canonicalName = normalizeProductName(dto.productName);
    if (!canonicalName) {
      throw new BadRequestException('productName must not be blank');
    }

    let product = await this.prisma.product.findFirst({
      where: { canonicalName },
    });
    if (!product) {
      product = await this.prisma.product.create({ data: { canonicalName } });
    }

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
    });
    if (!existing) {
      throw new NotFoundException(`Grocery list item ${id} not found`);
    }

    const item = await this.prisma.groceryListItem.update({
      where: { id },
      data: { status: GroceryItemStatus.removed },
      include: { product: true },
    });

    return GroceryItemResponseDto.fromEntity(item, item.product.canonicalName);
  }
}
