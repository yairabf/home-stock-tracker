import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ProductService } from '../product/product.service';
import {
  getCanonicalProductName,
  PRODUCT_WITH_NAMES_INCLUDE,
} from '../product/types/product-with-names';
import { RecordInventoryEventDto } from './dto/record-inventory-event.dto';
import { RecordPurchaseDto } from './dto/record-purchase.dto';
import { ListInventoryEventsDto } from './dto/list-inventory-events.dto';
import { InventoryEventResponseDto } from './dto/inventory-event-response.dto';
import { InventoryEventListResponseDto } from './dto/inventory-event-list-response.dto';
import { CompletePurchaseDto } from './dto/complete-purchase.dto';
import { CompletePurchaseResponseDto } from './dto/complete-purchase-response.dto';
import { CompletePartialPurchaseDto } from './dto/complete-partial-purchase.dto';
import {
  CompletePartialPurchaseResponseDto,
  CompletedItemDto,
  SkippedItemDto,
  PendingItemDto,
} from './dto/complete-partial-purchase-response.dto';
import { GroceryItemResponseDto } from '../grocery/dto/grocery-item-response.dto';
import {
  InventoryEventType,
  GroceryItemStatus,
  PredictedState,
} from '../generated/prisma/enums';
import {
  CompleteGroceryPurchaseItemInput,
  CompleteGroceryPurchaseInput,
  CompleteGroceryPurchaseResult,
} from './types/complete-grocery-purchase';
import { OperationalLogger } from '../observability/operational-logger.service';
import { StockLedgerService } from './stock-ledger.service';
import { StatisticsService } from '../statistics/statistics.service';

interface PurchaseEventInput {
  productId: string;
  quantity: number;
  unit?: string;
  typicalUnit?: string;
}

@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly productService: ProductService,
    private readonly operationalLogger: OperationalLogger,
    private readonly stockLedgerService: StockLedgerService,
    private readonly statisticsService: StatisticsService,
  ) {}

  async recordPurchase(
    dto: RecordPurchaseDto & { source: string },
  ): Promise<InventoryEventResponseDto> {
    if (dto.eventType !== 'PURCHASED' && dto.eventType !== 'RESTOCKED') {
      throw new BadRequestException(
        'Purchase eventType must be PURCHASED or RESTOCKED',
      );
    }

    const quantity = dto.quantity ?? 1;
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new BadRequestException(
        'Purchase quantity must be a finite positive number',
      );
    }
    const occurredAt = new Date();
    const event = await this.runStockTransaction(async (tx) => {
      const product = await tx.product.findUnique({
        where: { id: dto.productId },
        select: { id: true, typicalUnit: true },
      });
      if (!product) {
        throw new NotFoundException(`No product with id "${dto.productId}"`);
      }
      const createdEvent = await tx.inventoryEvent.create({
        data: {
          productId: dto.productId,
          eventType: dto.eventType,
          quantity,
          unit: dto.unit,
          timestamp: occurredAt,
          source: dto.source,
          confidence: dto.confidence,
          metadata: dto.metadata as Prisma.InputJsonValue | undefined,
        },
      });
      await this.stockLedgerService.resetWithinTransaction(tx, {
        productId: dto.productId,
        eventId: createdEvent.id,
        quantity,
        occurredAt,
        source: dto.source,
        reason: 'purchase_recorded',
        explicitUnit: dto.unit,
        typicalUnit: product.typicalUnit,
      });
      return createdEvent;
    });

    await this.recalculateStatisticsAfterCommit(event.productId);

    this.operationalLogger.inventoryAction({
      action: 'record_purchase',
      outcome: 'success',
      productId: event.productId,
      inventoryEventId: event.id,
    });

    return InventoryEventResponseDto.fromEntity(event);
  }

  private async runStockTransaction<T>(
    operation: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    const maxAttempts = 3;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        return await this.prisma.$transaction(operation, {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        });
      } catch (error) {
        if (
          !this.isRetryableTransactionError(error) ||
          attempt === maxAttempts
        ) {
          throw error;
        }
      }
    }
    throw new Error('Stock transaction retries exhausted');
  }

  private isRetryableTransactionError(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2034'
    );
  }

  private async recalculateStatisticsAfterCommit(
    productId: string,
  ): Promise<void> {
    try {
      await this.statisticsService.calculateProductStatistics(productId);
    } catch {
      this.operationalLogger.inventoryAction({
        action: 'recalculate_statistics',
        outcome: 'failure',
        productId,
        errorType: 'persistence_error',
      });
    }
  }

  async recordEvent(
    dto: RecordInventoryEventDto & { source: string },
  ): Promise<InventoryEventResponseDto> {
    if (
      dto.eventType === InventoryEventType.STOCK_LOW ||
      dto.eventType === InventoryEventType.STOCK_OUT
    ) {
      return this.recordProjectionObservation(dto);
    }
    await this.productService.findOne(dto.productId);

    const event = await this.prisma.inventoryEvent.create({
      data: {
        productId: dto.productId,
        eventType: dto.eventType,
        quantity: dto.quantity,
        unit: dto.unit,
        source: dto.source,
        confidence: dto.confidence,
        metadata: dto.metadata as Prisma.InputJsonValue | undefined,
      },
    });

    this.operationalLogger.inventoryAction({
      action: 'record_event',
      outcome: 'success',
      productId: event.productId,
      inventoryEventId: event.id,
    });

    return InventoryEventResponseDto.fromEntity(event);
  }

  private async recordProjectionObservation(
    dto: RecordInventoryEventDto & { source: string },
  ): Promise<InventoryEventResponseDto> {
    const occurredAt = new Date();
    const event = await this.runStockTransaction(async (tx) => {
      const product = await tx.product.findUnique({
        where: { id: dto.productId },
        select: { id: true, typicalUnit: true },
      });
      if (!product) {
        throw new NotFoundException(`No product with id "${dto.productId}"`);
      }
      const createdEvent = await tx.inventoryEvent.create({
        data: {
          productId: dto.productId,
          eventType: dto.eventType,
          quantity: dto.quantity,
          unit: dto.unit,
          timestamp: occurredAt,
          source: dto.source,
          confidence: dto.confidence,
          metadata: dto.metadata as Prisma.InputJsonValue | undefined,
        },
      });
      await this.stockLedgerService.applyObservationWithinTransaction(tx, {
        productId: dto.productId,
        eventId: createdEvent.id,
        state:
          dto.eventType === InventoryEventType.STOCK_OUT
            ? PredictedState.probably_out
            : PredictedState.probably_low,
        occurredAt,
        source: dto.source,
        reason:
          dto.eventType === InventoryEventType.STOCK_OUT
            ? 'stock_out_reported'
            : 'stock_low_reported',
        explicitUnit: dto.unit,
        typicalUnit: product.typicalUnit,
      });
      return createdEvent;
    });
    await this.recalculateStatisticsAfterCommit(event.productId);
    this.logInventoryEvent(event, 'record_event');
    return InventoryEventResponseDto.fromEntity(event);
  }

  async listEvents(
    query: ListInventoryEventsDto,
  ): Promise<InventoryEventListResponseDto> {
    const where = {
      ...(query.productId && { productId: query.productId }),
      ...(query.eventType && { eventType: query.eventType }),
    };
    const limit = query.limit ?? 20;
    const offset = query.offset ?? 0;

    const [events, total] = await Promise.all([
      this.prisma.inventoryEvent.findMany({
        where,
        orderBy: [{ timestamp: 'desc' }, { id: 'desc' }],
        take: limit,
        skip: offset,
      }),
      this.prisma.inventoryEvent.count({ where }),
    ]);

    return {
      items: events.map((event) => InventoryEventResponseDto.fromEntity(event)),
      total,
      limit,
      offset,
    };
  }

  async completePurchase(
    dto: CompletePurchaseDto & { source: string },
  ): Promise<CompletePurchaseResponseDto> {
    // Deduplicate grocery item IDs
    const uniqueIds = [...new Set(dto.groceryItemIds)];

    // Verify product exists
    const product = await this.productService.findOne(dto.productId);

    // Fetch all referenced grocery items
    const groceryItems = await this.prisma.groceryListItem.findMany({
      where: { id: { in: uniqueIds } },
    });

    // Validate each item
    const errors: Array<{ id: string; reason: string }> = [];
    const validatedIds: string[] = [];

    for (const id of uniqueIds) {
      const item = groceryItems.find((i) => i.id === id);
      if (!item) {
        errors.push({ id, reason: 'Grocery item not found' });
      } else if (item.productId !== dto.productId) {
        errors.push({
          id,
          reason: `Grocery item belongs to product ${item.productId}, not ${dto.productId}`,
        });
      } else if (item.status !== GroceryItemStatus.pending) {
        errors.push({
          id,
          reason: `Grocery item status is "${item.status}", not "pending"`,
        });
      } else if (item.relatedInventoryEventId !== null) {
        errors.push({
          id,
          reason: 'Grocery item is already linked to an inventory event',
        });
      } else {
        validatedIds.push(id);
      }
    }

    if (errors.length > 0) {
      throw new BadRequestException({
        message: 'One or more grocery items are invalid',
        errors,
      });
    }

    // Execute transaction: create event and update grocery items
    const measurement = this.resolveCompletionMeasurement(
      groceryItems,
      dto.quantity,
      dto.unit,
    );
    const occurredAt = new Date();
    const result = await this.runStockTransaction(async (tx) => {
      const event = await tx.inventoryEvent.create({
        data: {
          productId: dto.productId,
          eventType: InventoryEventType.PURCHASED,
          quantity: measurement.quantity,
          unit: measurement.unit,
          timestamp: occurredAt,
          source: dto.source,
          confidence: dto.confidence,
          metadata: dto.metadata as Prisma.InputJsonValue | undefined,
        },
      });

      await this.stockLedgerService.resetWithinTransaction(tx, {
        productId: dto.productId,
        eventId: event.id,
        quantity: measurement.quantity,
        occurredAt,
        source: dto.source,
        reason: 'grocery_purchase_completed',
        explicitUnit: measurement.unit,
        typicalUnit: product.typicalUnit,
      });

      const updatedItems = await Promise.all(
        validatedIds.map((id) =>
          tx.groceryListItem.update({
            where: { id, status: GroceryItemStatus.pending },
            data: {
              status: GroceryItemStatus.purchased,
              relatedInventoryEventId: event.id,
            },
            include: { product: PRODUCT_WITH_NAMES_INCLUDE },
          }),
        ),
      );

      return { event, updatedItems };
    });

    await this.recalculateStatisticsAfterCommit(result.event.productId);

    this.operationalLogger.inventoryAction({
      action: 'complete_purchase',
      outcome: 'success',
      productId: result.event.productId,
      inventoryEventId: result.event.id,
      affectedCount: result.updatedItems.length,
    });

    return {
      event: InventoryEventResponseDto.fromEntity(result.event),
      groceryItems: result.updatedItems.map((item) =>
        GroceryItemResponseDto.fromEntity(
          item,
          getCanonicalProductName(item.product),
        ),
      ),
    };
  }

  async completeGroceryPurchase(
    input: CompleteGroceryPurchaseInput,
  ): Promise<CompleteGroceryPurchaseResult> {
    const selectedItems = this.normalizeCompleteGroceryPurchaseInput(input);
    const groceryItemIds = selectedItems.map((item) => item.groceryItemId);

    const items = await this.prisma.groceryListItem.findMany({
      where: { id: { in: groceryItemIds } },
      include: { product: PRODUCT_WITH_NAMES_INCLUDE },
    });
    const itemsById = new Map(items.map((item) => [item.id, item]));
    const orderedItems = groceryItemIds.map((id) => itemsById.get(id));
    const invalidItems = orderedItems.flatMap((item, index) => {
      if (!item) {
        return [{ id: groceryItemIds[index], reason: 'not_found' }];
      }
      if (
        item.status !== GroceryItemStatus.pending ||
        item.relatedInventoryEventId !== null
      ) {
        return [{ id: item.id, reason: 'already_resolved' }];
      }
      return [];
    });

    if (invalidItems.length > 0) {
      throw new BadRequestException({
        message: 'One or more grocery items cannot be completed',
        errors: invalidItems,
      });
    }

    const validItems = orderedItems.filter(
      (item): item is NonNullable<typeof item> => item !== undefined,
    );
    const eventInputs = this.buildPurchaseEventInputs(
      validItems,
      selectedItems,
    );
    const occurredAt = new Date();
    const result = await this.runStockTransaction(async (tx) => {
      const events = await Promise.all(
        eventInputs.map((eventInput) =>
          tx.inventoryEvent.create({
            data: {
              productId: eventInput.productId,
              eventType: InventoryEventType.PURCHASED,
              source: input.source,
              quantity: eventInput.quantity,
              ...(eventInput.unit !== undefined && { unit: eventInput.unit }),
              timestamp: occurredAt,
            },
          }),
        ),
      );
      await Promise.all(
        events.map((event, index) => {
          const eventInput = eventInputs[index];
          return this.stockLedgerService.resetWithinTransaction(tx, {
            productId: event.productId,
            eventId: event.id,
            quantity: eventInput.quantity,
            occurredAt,
            source: input.source,
            reason: 'grocery_purchase_completed',
            explicitUnit: eventInput.unit,
            typicalUnit: eventInput.typicalUnit,
          });
        }),
      );
      const eventIdsByProduct = new Map(
        events.map((event) => [event.productId, event.id]),
      );
      const completedItems = await Promise.all(
        validItems.map((item) =>
          tx.groceryListItem.update({
            where: {
              id: item.id,
              status: GroceryItemStatus.pending,
              relatedInventoryEventId: null,
            },
            data: {
              status: GroceryItemStatus.purchased,
              relatedInventoryEventId: eventIdsByProduct.get(item.productId),
            },
            include: { product: PRODUCT_WITH_NAMES_INCLUDE },
          }),
        ),
      );
      return { events, completedItems };
    });

    await Promise.all(
      eventInputs.map((eventInput) =>
        this.recalculateStatisticsAfterCommit(eventInput.productId),
      ),
    );

    this.operationalLogger.inventoryAction({
      action: 'complete_purchase',
      outcome: 'success',
      affectedCount: result.completedItems.length,
    });

    return {
      events: result.events.map((event) =>
        InventoryEventResponseDto.fromEntity(event),
      ),
      completedItems: result.completedItems.map((item) =>
        GroceryItemResponseDto.fromEntity(
          item,
          getCanonicalProductName(item.product),
        ),
      ),
    };
  }

  private normalizeCompleteGroceryPurchaseInput(
    input: CompleteGroceryPurchaseInput,
  ): CompleteGroceryPurchaseItemInput[] {
    if (typeof input.source !== 'string' || input.source.trim().length === 0) {
      throw new BadRequestException('Purchase source is required');
    }

    const hasLegacyItems = input.groceryItemIds !== undefined;
    const hasMeasuredItems = input.items !== undefined;
    if (hasLegacyItems === hasMeasuredItems) {
      throw new BadRequestException(
        'Provide exactly one grocery purchase selection',
      );
    }

    const selectedItems = hasLegacyItems
      ? input.groceryItemIds.map((groceryItemId) => ({ groceryItemId }))
      : input.items;
    if (selectedItems.length === 0) {
      throw new BadRequestException('At least one grocery item is required');
    }

    const normalizedItems = selectedItems.map((item) =>
      this.normalizeActualMeasurement(item),
    );
    const itemIds = normalizedItems.map((item) => item.groceryItemId);
    if (new Set(itemIds).size !== itemIds.length) {
      throw new BadRequestException('Grocery item IDs must be unique');
    }

    return normalizedItems;
  }

  private normalizeActualMeasurement(
    item: CompleteGroceryPurchaseItemInput,
  ): CompleteGroceryPurchaseItemInput {
    if (
      item.actualQuantity !== undefined &&
      (!Number.isFinite(item.actualQuantity) || item.actualQuantity <= 0)
    ) {
      throw new BadRequestException(
        `Actual quantity for grocery item ${item.groceryItemId} must be a finite positive number`,
      );
    }
    if (item.actualUnit !== undefined && item.actualQuantity === undefined) {
      throw new BadRequestException(
        `Actual unit for grocery item ${item.groceryItemId} requires actual quantity`,
      );
    }
    if (
      item.actualUnit !== undefined &&
      (typeof item.actualUnit !== 'string' ||
        item.actualUnit.trim().length === 0)
    ) {
      throw new BadRequestException(
        `Actual unit for grocery item ${item.groceryItemId} must not be blank`,
      );
    }

    return {
      ...item,
      ...(item.actualUnit !== undefined && {
        actualUnit: item.actualUnit.trim(),
      }),
    };
  }

  private buildPurchaseEventInputs(
    items: Array<{
      productId: string;
      requestedQuantity: number;
      unit: string | null;
      product: { typicalUnit: string | null };
    }>,
    selectedItems: CompleteGroceryPurchaseItemInput[],
  ): PurchaseEventInput[] {
    const selectionsByProduct = new Map<
      string,
      CompleteGroceryPurchaseItemInput[]
    >();
    items.forEach((item, index) => {
      const selections = selectionsByProduct.get(item.productId) ?? [];
      selections.push(selectedItems[index]);
      selectionsByProduct.set(item.productId, selections);
    });

    const itemsByProduct = new Map<string, Array<(typeof items)[number]>>();
    items.forEach((item) => {
      const productItems = itemsByProduct.get(item.productId) ?? [];
      productItems.push(item);
      itemsByProduct.set(item.productId, productItems);
    });

    return [...selectionsByProduct].map(([productId, selections]) =>
      this.buildPurchaseEventInput(
        productId,
        itemsByProduct.get(productId) ?? [],
        selections,
      ),
    );
  }

  private buildPurchaseEventInput(
    productId: string,
    items: Array<{
      requestedQuantity: number;
      unit: string | null;
      product: { typicalUnit: string | null };
    }>,
    selections: CompleteGroceryPurchaseItemInput[],
  ): PurchaseEventInput {
    const measured = selections.filter(
      (selection) => selection.actualQuantity !== undefined,
    );
    if (measured.length === 0) {
      const groceryUnits = new Set(
        items.flatMap((item) => (item.unit === null ? [] : [item.unit.trim()])),
      );
      if (groceryUnits.has('') || groceryUnits.size > 1) {
        throw new BadRequestException(
          `Grocery units for product ${productId} must match exactly`,
        );
      }
      return {
        productId,
        quantity: items.reduce((sum, item) => sum + item.requestedQuantity, 0),
        unit: [...groceryUnits][0],
        typicalUnit: items[0]?.product.typicalUnit ?? undefined,
      };
    }
    if (measured.length !== selections.length) {
      throw new BadRequestException(
        `Actual quantities for product ${productId} must be supplied for every selected item or none`,
      );
    }

    const units = new Set(measured.map((selection) => selection.actualUnit));
    if (units.size !== 1) {
      throw new BadRequestException(
        `Actual units for product ${productId} must match exactly`,
      );
    }
    const quantity = measured.reduce(
      (sum, selection) => sum + (selection.actualQuantity ?? 0),
      0,
    );
    if (!Number.isFinite(quantity)) {
      throw new BadRequestException(
        `Aggregate actual quantity for product ${productId} must be finite`,
      );
    }

    return {
      productId,
      quantity,
      unit: measured[0].actualUnit,
      typicalUnit: items[0]?.product.typicalUnit ?? undefined,
    };
  }

  async completePartialPurchase(
    dto: CompletePartialPurchaseDto & { source: string },
  ): Promise<CompletePartialPurchaseResponseDto> {
    const product = await this.productService.findOne(dto.productId);

    // Determine mode and target item IDs
    const isInclusiveMode = !!dto.completeItemIds;
    const inputItemIds = isInclusiveMode
      ? dto.completeItemIds!
      : dto.omitItemIds!;

    // In exclusive mode, fetch all pending items for this product first
    let pendingItemIds: string[] = [];
    let pendingItems: Array<{
      id: string;
      requestedQuantity: number;
      unit: string | null;
    }> = [];
    if (!isInclusiveMode) {
      pendingItems = await this.prisma.groceryListItem.findMany({
        where: {
          productId: dto.productId,
          status: GroceryItemStatus.pending,
        },
      });
      pendingItemIds = pendingItems.map((item) => item.id);
    }

    // Fetch all referenced grocery items (inputItemIds in inclusive mode, omitItemIds in exclusive)
    const referencedItems = await this.prisma.groceryListItem.findMany({
      where: { id: { in: inputItemIds } },
    });

    // Build lookup for referenced items
    const referencedById = new Map(
      referencedItems.map((item) => [item.id, item]),
    );

    // Collect validation results
    const completed: CompletedItemDto[] = [];
    const skipped: SkippedItemDto[] = [];
    const pending: PendingItemDto[] = [];
    const validatedIds: string[] = [];

    if (isInclusiveMode) {
      // Inclusive mode: validate each provided item and categorize
      for (const id of inputItemIds) {
        const item = referencedById.get(id);
        if (!item) {
          skipped.push({ id, reason: 'not_found' });
        } else if (item.productId !== dto.productId) {
          skipped.push({ id, reason: 'wrong_product' });
        } else if (item.status !== GroceryItemStatus.pending) {
          skipped.push({ id, reason: 'already_resolved' });
        } else if (item.relatedInventoryEventId !== null) {
          skipped.push({ id, reason: 'already_resolved' });
        } else {
          validatedIds.push(id);
        }
      }
    } else {
      // Exclusive mode: complete all pending except omitted, track omits as pending
      const omitSet = new Set(inputItemIds);
      for (const id of pendingItemIds) {
        if (omitSet.has(id)) {
          pending.push({ id, reason: 'explicitly_omitted' });
        } else {
          validatedIds.push(id);
        }
      }
      // Track any omitted IDs that weren't in pending list
      for (const id of inputItemIds) {
        if (!pendingItemIds.includes(id)) {
          const item = referencedById.get(id);
          if (!item) {
            skipped.push({ id, reason: 'not_found' });
          } else if (item.productId !== dto.productId) {
            skipped.push({ id, reason: 'wrong_product' });
          } else if (item.status !== GroceryItemStatus.pending) {
            skipped.push({ id, reason: 'already_resolved' });
          }
          // If it was pending for a different product, it's wrong_product
          // If it was already resolved, it's already_resolved
          // These are informational skips, not errors
        }
      }
    }

    // If nothing to complete, throw error
    if (validatedIds.length === 0) {
      throw new BadRequestException({
        message: 'No valid items to complete',
        skipped,
        pending,
      });
    }

    // Execute transaction: create event and update grocery items
    const completedItems = (
      isInclusiveMode ? referencedItems : pendingItems
    ).filter((item) => validatedIds.includes(item.id));
    const measurement = this.resolveCompletionMeasurement(
      completedItems,
      dto.quantity,
      dto.unit,
    );
    const occurredAt = new Date();
    const result = await this.runStockTransaction(async (tx) => {
      const event = await tx.inventoryEvent.create({
        data: {
          productId: dto.productId,
          eventType: InventoryEventType.PURCHASED,
          quantity: measurement.quantity,
          unit: measurement.unit,
          timestamp: occurredAt,
          source: dto.source,
          confidence: dto.confidence,
          metadata: dto.metadata as Prisma.InputJsonValue | undefined,
        },
      });

      await this.stockLedgerService.resetWithinTransaction(tx, {
        productId: dto.productId,
        eventId: event.id,
        quantity: measurement.quantity,
        occurredAt,
        source: dto.source,
        reason: 'grocery_purchase_completed',
        explicitUnit: measurement.unit,
        typicalUnit: product.typicalUnit,
      });

      const updatedItems = await Promise.all(
        validatedIds.map((id) =>
          tx.groceryListItem.update({
            where: { id, status: GroceryItemStatus.pending },
            data: {
              status: GroceryItemStatus.purchased,
              relatedInventoryEventId: event.id,
            },
            include: { product: PRODUCT_WITH_NAMES_INCLUDE },
          }),
        ),
      );

      return { event, updatedItems };
    });

    await this.recalculateStatisticsAfterCommit(result.event.productId);

    this.operationalLogger.inventoryAction({
      action: 'complete_partial_purchase',
      outcome: 'success',
      productId: result.event.productId,
      inventoryEventId: result.event.id,
      affectedCount: result.updatedItems.length,
      skippedCount: skipped.length,
    });

    // Build completed items list
    for (const item of result.updatedItems) {
      completed.push({
        id: item.id,
        productName: getCanonicalProductName(item.product),
        status: GroceryItemStatus.purchased,
      });
    }

    return {
      event: InventoryEventResponseDto.fromEntity(result.event),
      completed,
      skipped,
      pending,
    };
  }

  private resolveCompletionMeasurement(
    items: Array<{ requestedQuantity: number; unit: string | null }>,
    explicitQuantity?: number,
    explicitUnit?: string,
  ): { quantity: number; unit?: string } {
    if (
      explicitQuantity !== undefined &&
      (!Number.isFinite(explicitQuantity) || explicitQuantity <= 0)
    ) {
      throw new BadRequestException(
        'Purchase quantity must be a finite positive number',
      );
    }
    if (explicitQuantity !== undefined) {
      return { quantity: explicitQuantity, unit: explicitUnit };
    }
    const units = new Set(
      items.flatMap((item) => (item.unit == null ? [] : [item.unit.trim()])),
    );
    if (units.has('') || units.size > 1) {
      throw new BadRequestException('Completed grocery item units must match');
    }
    return {
      quantity: items.reduce((sum, item) => sum + item.requestedQuantity, 0),
      unit: explicitUnit ?? [...units][0],
    };
  }

  private logInventoryEvent(
    event: { id: string; productId: string },
    action: 'record_event' | 'record_purchase',
  ): void {
    this.operationalLogger.inventoryAction({
      action,
      outcome: 'success',
      productId: event.productId,
      inventoryEventId: event.id,
    });
  }
}
