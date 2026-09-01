import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProductService } from '../product/product.service';
import {
  getCanonicalProductName,
  PRODUCT_WITH_NAMES_INCLUDE,
} from '../product/types/product-with-names';
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
import { SetGroceryItemQuantityDto } from './dto/set-grocery-item-quantity.dto';
import { UpdateGroceryItemDto } from './dto/update-grocery-item.dto';
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
    if (dto.requestedQuantity !== undefined) {
      this.validatePositiveQuantity(dto.requestedQuantity);
    }
    const product = await this.productService.findOrCreateByExactOrAliasMatch(
      dto.productName,
    );

    if (dto.ifPendingExists === PendingGroceryItemPolicy.create_separate) {
      return this.createGroceryItem(
        product.id,
        getCanonicalProductName(product),
        dto,
      );
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
            GroceryItemResponseDto.fromEntity(
              item,
              getCanonicalProductName(product),
            ),
          ),
          requestedAddition: GroceryRequestedAdditionDto.fromRequest(dto),
        };
      }

      const item = await tx.groceryListItem.create({
        data: this.addItemData(product.id, dto),
      });
      return this.createdResult(item, getCanonicalProductName(product), dto);
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
      requestedQuantity: dto.requestedQuantity ?? 1,
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
      include: { product: PRODUCT_WITH_NAMES_INCLUDE },
      orderBy: { dateAdded: 'desc' },
    });

    return items.map((item) =>
      GroceryItemResponseDto.fromEntity(
        item,
        getCanonicalProductName(item.product),
      ),
    );
  }

  async setQuantity(
    id: string,
    dto: SetGroceryItemQuantityDto,
  ): Promise<GroceryItemResponseDto> {
    this.validatePositiveQuantity(dto.requestedQuantity);
    this.validatePositiveQuantity(dto.expectedRequestedQuantity);
    const existing = await this.prisma.groceryListItem.findUnique({
      where: { id },
      include: { product: PRODUCT_WITH_NAMES_INCLUDE },
    });
    if (!existing) {
      throw groceryNotFound(id);
    }

    const current = GroceryItemResponseDto.fromEntity(
      existing,
      getCanonicalProductName(existing.product),
    );
    if (existing.status !== GroceryItemStatus.pending) {
      throw groceryConflict(
        'GROCERY_ITEM_NOT_PENDING',
        `Grocery list item ${id} is not pending`,
        current,
      );
    }
    if (existing.requestedQuantity !== dto.expectedRequestedQuantity) {
      throw groceryConflict(
        'GROCERY_ITEM_CHANGED',
        `Grocery list item ${id} changed`,
        current,
      );
    }

    const result = await this.prisma.groceryListItem.updateMany({
      where: {
        id,
        status: GroceryItemStatus.pending,
        requestedQuantity: dto.expectedRequestedQuantity,
      },
      data: { requestedQuantity: dto.requestedQuantity },
    });
    if (result.count !== 1) {
      await this.throwCurrentUpdateConflict(id);
    }

    return GroceryItemResponseDto.fromEntity(
      { ...existing, requestedQuantity: dto.requestedQuantity },
      getCanonicalProductName(existing.product),
    );
  }

  async updateItem(
    id: string,
    dto: UpdateGroceryItemDto,
  ): Promise<GroceryItemResponseDto> {
    const existing = await this.prisma.groceryListItem.findUnique({
      where: { id },
      include: { product: PRODUCT_WITH_NAMES_INCLUDE },
    });
    if (!existing) {
      throw groceryNotFound(id);
    }

    const current = GroceryItemResponseDto.fromEntity(
      existing,
      getCanonicalProductName(existing.product),
    );
    this.validateUpdate(existing, dto, current);
    const data = this.updatedFields(dto);
    const expected = this.expectedFields(dto);
    const result = await this.prisma.groceryListItem.updateMany({
      where: { id, status: GroceryItemStatus.pending, ...expected },
      data,
    });
    if (result.count !== 1) {
      await this.throwCurrentUpdateConflict(id);
    }

    return GroceryItemResponseDto.fromEntity(
      { ...existing, ...data },
      getCanonicalProductName(existing.product),
    );
  }

  private validateUpdate(
    existing: {
      requestedQuantity: number;
      unit: string | null;
      note: string | null;
    },
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
    this.validateUpdateShape(dto);
    if (
      (dto.requestedQuantity !== undefined &&
        existing.requestedQuantity !== dto.expectedRequestedQuantity) ||
      (dto.unit !== undefined && existing.unit !== dto.expectedUnit) ||
      (dto.note !== undefined && existing.note !== dto.expectedNote)
    ) {
      throw groceryConflict(
        'GROCERY_ITEM_CHANGED',
        `Grocery list item ${current.id} changed`,
        current,
      );
    }
  }

  private validateUpdateShape(dto: UpdateGroceryItemDto): void {
    const updates = [dto.requestedQuantity, dto.unit, dto.note];
    if (updates.every((value) => value === undefined)) {
      throw groceryInvalid(
        'INVALID_UPDATE',
        'No grocery item fields supplied for update',
      );
    }
    this.validateSelectedField(
      dto.requestedQuantity,
      dto.expectedRequestedQuantity,
      'INVALID_QUANTITY',
      'requestedQuantity',
    );
    this.validateSelectedField(
      dto.unit,
      dto.expectedUnit,
      'INVALID_UNIT',
      'unit',
    );
    this.validateSelectedField(
      dto.note,
      dto.expectedNote,
      'INVALID_NOTE',
      'note',
    );
    if (dto.requestedQuantity !== undefined) {
      this.validatePositiveQuantity(dto.requestedQuantity);
      this.validatePositiveQuantity(dto.expectedRequestedQuantity as number);
    }
    if (typeof dto.unit === 'string' && dto.unit.trim().length === 0) {
      throw groceryInvalid('INVALID_UNIT', 'Unit must not be empty');
    }
    if (typeof dto.note === 'string' && dto.note.trim().length === 0) {
      throw groceryInvalid('INVALID_NOTE', 'Note must not be empty');
    }
  }

  private validatePositiveQuantity(quantity: number): void {
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw groceryInvalid('INVALID_QUANTITY', 'Quantity must be positive');
    }
  }

  private validateSelectedField(
    value: unknown,
    expected: unknown,
    code: 'INVALID_QUANTITY' | 'INVALID_UNIT' | 'INVALID_NOTE',
    field: string,
  ): void {
    if (value !== undefined && expected === undefined) {
      throw groceryInvalid(code, `Expected ${field} is required`);
    }
    if (value === undefined && expected !== undefined) {
      throw groceryInvalid(code, `Expected ${field} requires an update value`);
    }
  }

  private updatedFields(dto: UpdateGroceryItemDto): {
    requestedQuantity?: number;
    unit?: string | null;
    note?: string | null;
  } {
    return {
      ...(dto.requestedQuantity !== undefined
        ? { requestedQuantity: dto.requestedQuantity }
        : {}),
      ...(dto.unit !== undefined ? { unit: this.trimNullable(dto.unit) } : {}),
      ...(dto.note !== undefined ? { note: this.trimNullable(dto.note) } : {}),
    };
  }

  private expectedFields(dto: UpdateGroceryItemDto): {
    requestedQuantity?: number;
    unit?: string | null;
    note?: string | null;
  } {
    return {
      ...(dto.requestedQuantity !== undefined
        ? { requestedQuantity: dto.expectedRequestedQuantity }
        : {}),
      ...(dto.unit !== undefined ? { unit: dto.expectedUnit } : {}),
      ...(dto.note !== undefined ? { note: dto.expectedNote } : {}),
    };
  }

  private trimNullable(value: string | null): string | null {
    return typeof value === 'string' ? value.trim() : value;
  }

  private async throwCurrentUpdateConflict(id: string): Promise<never> {
    const latest = await this.prisma.groceryListItem.findUnique({
      where: { id },
      include: { product: PRODUCT_WITH_NAMES_INCLUDE },
    });
    if (!latest) {
      throw groceryNotFound(id);
    }
    const current = GroceryItemResponseDto.fromEntity(
      latest,
      getCanonicalProductName(latest.product),
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
      include: { product: PRODUCT_WITH_NAMES_INCLUDE },
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
      getCanonicalProductName(existing.product),
    );
  }
}
