import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProductService } from '../product/product.service';
import {
  AddGroceryItemDto,
  PendingGroceryItemPolicy,
} from './dto/add-grocery-item.dto';
import {
  AddGroceryItemOutcome,
  AddGroceryItemResultDto,
  GroceryRequestedAdditionDto,
} from './dto/add-grocery-item-result.dto';
import { GroceryItemResponseDto } from './dto/grocery-item-response.dto';
import {
  GroceryQuantityMode,
  UpdateGroceryItemDto,
} from './dto/update-grocery-item.dto';
import {
  groceryConflict,
  groceryInvalid,
  groceryNotFound,
} from './grocery-operation.exception';
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

  async addItem(
    dto: AddGroceryItemDto & { source: GroceryItemSource },
  ): Promise<AddGroceryItemResultDto> {
    const product = await this.productService.findOrCreateByExactOrAliasMatch(
      dto.productName,
    );

    if (
      dto.ifPendingExists === PendingGroceryItemPolicy.create_separate
    ) {
      return this.createGroceryItem(product.id, product.canonicalName, dto);
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${product.id}, 0))::text AS locked`;
      const existing = await tx.groceryListItem.findMany({
        where: { productId: product.id, status: GroceryItemStatus.pending },
        orderBy: { dateAdded: 'desc' },
      });
      if (existing.length > 0) {
        return {
          outcome: AddGroceryItemOutcome.confirmation_required,
          createdItem: null,
          existingItems: existing.map((item) =>
            GroceryItemResponseDto.fromEntity(item, product.canonicalName),
          ),
          requestedAddition: GroceryRequestedAdditionDto.fromRequest(dto),
        };
      }

      const item = await tx.groceryListItem.create({
        data: this.addItemData(product.id, dto),
      });
      return this.createdResult(item, product.canonicalName, dto);
    });
  }

  private async createGroceryItem(
    productId: string,
    productName: string,
    dto: AddGroceryItemDto & { source: GroceryItemSource },
  ): Promise<AddGroceryItemResultDto> {
    const item = await this.prisma.groceryListItem.create({
      data: this.addItemData(productId, dto),
    });
    return this.createdResult(item, productName, dto);
  }

  private addItemData(
    productId: string,
    dto: AddGroceryItemDto & { source: GroceryItemSource },
  ) {
    return {
      productId,
      requestedQuantity: dto.requestedQuantity,
      unit: dto.unit,
      note: dto.note,
      source: dto.source,
    };
  }

  private createdResult(
    item: Parameters<typeof GroceryItemResponseDto.fromEntity>[0],
    productName: string,
    dto: AddGroceryItemDto & { source: GroceryItemSource },
  ): AddGroceryItemResultDto {
    return {
      outcome: AddGroceryItemOutcome.created,
      createdItem: GroceryItemResponseDto.fromEntity(item, productName),
      existingItems: [],
      requestedAddition: GroceryRequestedAdditionDto.fromRequest(dto),
    };
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

  async updateItem(
    id: string,
    dto: UpdateGroceryItemDto,
  ): Promise<GroceryItemResponseDto> {
    const existing = await this.prisma.groceryListItem.findUnique({
      where: { id },
      include: { product: true },
    });
    if (!existing) {
      throw groceryNotFound(id);
    }

    const current = GroceryItemResponseDto.fromEntity(
      existing,
      existing.product.canonicalName,
    );
    this.validateUpdate(existing.requestedQuantity, existing.unit, dto, current);

    const requestedQuantity =
      dto.quantityMode === GroceryQuantityMode.increment
        ? existing.requestedQuantity! + dto.quantity
        : dto.quantity;
    const unit =
      dto.quantityMode === GroceryQuantityMode.set && dto.unit !== undefined
        ? dto.unit
        : existing.unit;
    const result = await this.prisma.groceryListItem.updateMany({
      where: {
        id,
        status: GroceryItemStatus.pending,
        requestedQuantity: dto.expectedRequestedQuantity,
        unit: dto.expectedUnit,
      },
      data: { requestedQuantity, unit },
    });
    if (result.count !== 1) {
      await this.throwCurrentUpdateConflict(id);
    }

    return GroceryItemResponseDto.fromEntity(
      { ...existing, requestedQuantity, unit },
      existing.product.canonicalName,
    );
  }

  private validateUpdate(
    requestedQuantity: number | null,
    unit: string | null,
    dto: UpdateGroceryItemDto,
    current: GroceryItemResponseDto,
  ): void {
    if (current.status !== GroceryItemStatus.pending) {
      throw groceryConflict(
        'GROCERY_ITEM_NOT_PENDING',
        `Grocery list item ${current.id} is not pending`,
        current,
      );
    }
    if (
      requestedQuantity !== dto.expectedRequestedQuantity ||
      unit !== dto.expectedUnit
    ) {
      throw groceryConflict(
        'GROCERY_ITEM_CHANGED',
        `Grocery list item ${current.id} changed`,
        current,
      );
    }
    if (!Number.isFinite(dto.quantity) || dto.quantity <= 0) {
      throw groceryInvalid('INVALID_QUANTITY', 'Quantity must be positive');
    }
    if (dto.unit !== undefined && dto.unit.trim().length === 0) {
      throw groceryInvalid('INVALID_UNIT', 'Unit must not be empty');
    }
    if (
      dto.quantityMode === GroceryQuantityMode.increment &&
      requestedQuantity === null
    ) {
      throw groceryInvalid(
        'QUANTITY_UNSPECIFIED',
        'Cannot increment an unspecified quantity',
      );
    }
    if (
      dto.quantityMode === GroceryQuantityMode.increment &&
      dto.unit !== undefined &&
      normalizeUnit(dto.unit) !== normalizeUnit(unit)
    ) {
      throw groceryInvalid(
        'UNIT_MISMATCH',
        'Increment unit must match the current unit',
      );
    }
  }

  private async throwCurrentUpdateConflict(id: string): Promise<never> {
    const latest = await this.prisma.groceryListItem.findUnique({
      where: { id },
      include: { product: true },
    });
    if (!latest) {
      throw groceryNotFound(id);
    }
    const current = GroceryItemResponseDto.fromEntity(
      latest,
      latest.product.canonicalName,
    );
    const code =
      latest.status === GroceryItemStatus.pending
        ? 'GROCERY_ITEM_CHANGED'
        : 'GROCERY_ITEM_NOT_PENDING';
    const message =
      code === 'GROCERY_ITEM_CHANGED'
        ? `Grocery list item ${id} changed`
        : `Grocery list item ${id} is not pending`;
    throw groceryConflict(code, message, current);
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

function normalizeUnit(unit: string | null): string | null {
  return unit?.trim().toLocaleLowerCase() ?? null;
}
