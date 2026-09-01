import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ProductService } from '../product/product.service';
import { normalizeProductDisplayName } from '../product/product-name.util';
import { ProductResolutionService } from '../product/product-resolution.service';
import {
  getCanonicalProductName,
  PRODUCT_WITH_NAMES_INCLUDE,
  type ProductWithNames,
} from '../product/types/product-with-names';
import { PRODUCT_NAME_CONFLICT } from '../product/product-name.exception';
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
import {
  type CreateIfMissingGroceryAddition,
  type GroceryAdditionItemInput,
  type GroceryRequestedAddition,
  type PolicyAwareGroceryAddition,
  type PolicyAwareGroceryAdditionResult,
  PendingGroceryItemPolicy,
  UnknownProductPolicy,
  productResolutionActions,
} from './types/policy-aware-grocery-addition';

const SERIALIZATION_RETRIES = 3;

@Injectable()
export class GroceryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly productService: ProductService,
    private readonly productResolutionService: ProductResolutionService,
  ) {}

  async addPolicyAwareItem(
    dto: PolicyAwareGroceryAddition,
  ): Promise<PolicyAwareGroceryAdditionResult> {
    if (dto.unknownProductPolicy === UnknownProductPolicy.propose_if_missing) {
      return this.addProposedProductItem(dto);
    }
    return this.addExplicitProductItem(dto);
  }

  private async addProposedProductItem(
    dto: Extract<
      PolicyAwareGroceryAddition,
      { unknownProductPolicy: UnknownProductPolicy.propose_if_missing }
    >,
  ): Promise<PolicyAwareGroceryAdditionResult> {
    this.validateRequestedQuantity(dto.groceryItem.requestedQuantity);
    const requestedAddition = this.policyAwareRequestEcho(
      dto.productName,
      dto.groceryItem,
    );
    const resolution = await this.productResolutionService.resolve(
      dto.productName,
    );
    const exactMatch = resolution.exactMatch;
    if (exactMatch) {
      return this.runSerializable((tx) =>
        this.addForProductWithinTransaction(
          tx,
          {
            id: exactMatch.id,
            canonicalName: exactMatch.canonicalName,
          },
          dto.groceryItem,
          dto.source,
          requestedAddition,
        ),
      );
    }

    return {
      outcome: 'product_resolution_required',
      requestedAddition,
      candidates: resolution.candidates,
      proposal: resolution.proposal,
      allowedActions: productResolutionActions(resolution.candidates.length),
    };
  }

  private async addExplicitProductItem(
    dto: CreateIfMissingGroceryAddition,
  ): Promise<PolicyAwareGroceryAdditionResult> {
    this.validateRequestedQuantity(dto.groceryItem.requestedQuantity);
    const requestedAddition = this.policyAwareRequestEcho(
      dto.product.canonicalName,
      dto.groceryItem,
    );

    try {
      return await this.runSerializable((tx) =>
        this.createExplicitProductAndGroceryItem(tx, dto, requestedAddition),
      );
    } catch (error) {
      if (!this.isProductNameConflict(error)) {
        throw error;
      }
      const product = await this.findConcurrentExplicitProduct(
        dto.product.canonicalName,
        error,
      );
      return this.runSerializable((tx) =>
        this.addForProductWithinTransaction(
          tx,
          this.groceryProduct(product),
          dto.groceryItem,
          dto.source,
          requestedAddition,
        ),
      );
    }
  }

  private async createExplicitProductAndGroceryItem(
    tx: Prisma.TransactionClient,
    dto: CreateIfMissingGroceryAddition,
    requestedAddition: GroceryRequestedAddition,
  ): Promise<PolicyAwareGroceryAdditionResult> {
    const product =
      await this.productService.findOrCreateExplicitWithinTransaction(
        tx,
        dto.product,
      );
    return this.addForProductWithinTransaction(
      tx,
      this.groceryProduct(product),
      dto.groceryItem,
      dto.source,
      requestedAddition,
    );
  }

  private async findConcurrentExplicitProduct(
    canonicalName: string,
    originalError: unknown,
  ): Promise<ProductWithNames> {
    try {
      return await this.productService.findByExactOrAliasName(canonicalName);
    } catch {
      throw originalError;
    }
  }

  private async addForProductWithinTransaction(
    tx: Prisma.TransactionClient,
    product: { id: string; canonicalName: string },
    groceryItem: GroceryAdditionItemInput,
    source: GroceryItemSource,
    requestedAddition: GroceryRequestedAddition,
  ): Promise<PolicyAwareGroceryAdditionResult> {
    const productName = product.canonicalName;
    if (
      groceryItem.ifPendingExists === PendingGroceryItemPolicy.create_separate
    ) {
      const item = await tx.groceryListItem.create({
        data: this.policyAwareItemData(product.id, groceryItem, source),
      });
      return {
        outcome: 'created',
        createdItem: GroceryItemResponseDto.fromEntity(item, productName),
        existingItems: [],
        requestedAddition,
      };
    }

    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${product.id}, 0))::text AS locked`;
    const existing = await tx.groceryListItem.findMany({
      where: { productId: product.id, status: GroceryItemStatus.pending },
      orderBy: { dateAdded: 'desc' },
    });
    if (existing.length > 0) {
      return {
        outcome: 'confirmation_required',
        createdItem: null,
        existingItems: existing.map((item) =>
          GroceryItemResponseDto.fromEntity(item, productName),
        ),
        requestedAddition,
      };
    }

    const item = await tx.groceryListItem.create({
      data: this.policyAwareItemData(product.id, groceryItem, source),
    });
    return {
      outcome: 'created',
      createdItem: GroceryItemResponseDto.fromEntity(item, productName),
      existingItems: [],
      requestedAddition,
    };
  }

  private groceryProduct(product: ProductWithNames): {
    id: string;
    canonicalName: string;
  } {
    return {
      id: product.id,
      canonicalName: getCanonicalProductName(product),
    };
  }

  private policyAwareItemData(
    productId: string,
    groceryItem: GroceryAdditionItemInput,
    source: GroceryItemSource,
  ) {
    return {
      productId,
      requestedQuantity: groceryItem.requestedQuantity ?? 1,
      unit: groceryItem.unit,
      note: groceryItem.note,
      source,
    };
  }

  private policyAwareRequestEcho(
    productName: string,
    groceryItem: GroceryAdditionItemInput,
  ): GroceryRequestedAddition {
    return {
      productName: normalizeProductDisplayName(productName),
      requestedQuantity: groceryItem.requestedQuantity ?? null,
      unit: groceryItem.unit ?? null,
      note: groceryItem.note ?? null,
      ifPendingExists: groceryItem.ifPendingExists,
    };
  }

  private validateRequestedQuantity(requestedQuantity?: number): void {
    if (requestedQuantity !== undefined) {
      this.validatePositiveQuantity(requestedQuantity);
    }
  }

  private async runSerializable<T>(
    operation: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    for (let attempt = 1; attempt <= SERIALIZATION_RETRIES; attempt += 1) {
      try {
        return await this.prisma.$transaction(operation, {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        });
      } catch (error) {
        if (!this.isPrismaError(error, 'P2034')) {
          throw error;
        }
        if (attempt === SERIALIZATION_RETRIES) {
          throw new ConflictException({
            code: PRODUCT_NAME_CONFLICT,
            message: 'Concurrent product creation did not converge',
          });
        }
      }
    }
    throw new Error('Serializable transaction retries exhausted');
  }

  private isProductNameConflict(error: unknown): boolean {
    if (!(error instanceof ConflictException)) {
      return false;
    }
    const response = error.getResponse();
    return (
      typeof response === 'object' &&
      response !== null &&
      'code' in response &&
      response.code === PRODUCT_NAME_CONFLICT
    );
  }

  private isPrismaError(error: unknown, code: string): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === code
    );
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
