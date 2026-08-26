import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ProductService } from '../product/product.service';
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
import { InventoryEventType, GroceryItemStatus } from '../generated/prisma/enums';

@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly productService: ProductService,
  ) {}

  async recordPurchase(
    dto: RecordPurchaseDto,
  ): Promise<InventoryEventResponseDto> {
    if (
      dto.eventType !== 'PURCHASED' &&
      dto.eventType !== 'RESTOCKED'
    ) {
      throw new BadRequestException(
        'Purchase eventType must be PURCHASED or RESTOCKED',
      );
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

    return InventoryEventResponseDto.fromEntity(event);
  }

  async recordEvent(
    dto: RecordInventoryEventDto,
  ): Promise<InventoryEventResponseDto> {
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
    dto: CompletePurchaseDto,
  ): Promise<CompletePurchaseResponseDto> {
    // Deduplicate grocery item IDs
    const uniqueIds = [...new Set(dto.groceryItemIds)];

    // Verify product exists
    await this.productService.findOne(dto.productId);

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
    const result = await this.prisma.$transaction(async (tx) => {
      const event = await tx.inventoryEvent.create({
        data: {
          productId: dto.productId,
          eventType: InventoryEventType.PURCHASED,
          quantity: dto.quantity,
          unit: dto.unit,
          source: dto.source,
          confidence: dto.confidence,
          metadata: dto.metadata as Prisma.InputJsonValue | undefined,
        },
      });

      const updatedItems = await Promise.all(
        validatedIds.map((id) =>
          tx.groceryListItem.update({
            where: { id, status: GroceryItemStatus.pending },
            data: {
              status: GroceryItemStatus.purchased,
              relatedInventoryEventId: event.id,
            },
            include: { product: true },
          }),
        ),
      );

      return { event, updatedItems };
    });

    return {
      event: InventoryEventResponseDto.fromEntity(result.event),
      groceryItems: result.updatedItems.map((item) =>
        GroceryItemResponseDto.fromEntity(item, item.product.canonicalName),
      ),
    };
  }

  async completePartialPurchase(
    dto: CompletePartialPurchaseDto,
  ): Promise<CompletePartialPurchaseResponseDto> {
    await this.productService.findOne(dto.productId);

    // Determine mode and target item IDs
    const isInclusiveMode = !!dto.completeItemIds;
    const inputItemIds = isInclusiveMode ? dto.completeItemIds! : dto.omitItemIds!;

    // In exclusive mode, fetch all pending items for this product first
    let pendingItemIds: string[] = [];
    if (!isInclusiveMode) {
      const allPending = await this.prisma.groceryListItem.findMany({
        where: {
          productId: dto.productId,
          status: GroceryItemStatus.pending,
        },
        select: { id: true },
      });
      pendingItemIds = allPending.map((item) => item.id);
    }

    // Fetch all referenced grocery items (inputItemIds in inclusive mode, omitItemIds in exclusive)
    const referencedItems = await this.prisma.groceryListItem.findMany({
      where: { id: { in: inputItemIds } },
    });

    // Build lookup for referenced items
    const referencedById = new Map(referencedItems.map((item) => [item.id, item]));

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
    const result = await this.prisma.$transaction(async (tx) => {
      const event = await tx.inventoryEvent.create({
        data: {
          productId: dto.productId,
          eventType: InventoryEventType.PURCHASED,
          quantity: dto.quantity,
          unit: dto.unit,
          source: dto.source,
          confidence: dto.confidence,
          metadata: dto.metadata as Prisma.InputJsonValue | undefined,
        },
      });

      const updatedItems = await Promise.all(
        validatedIds.map((id) =>
          tx.groceryListItem.update({
            where: { id, status: GroceryItemStatus.pending },
            data: {
              status: GroceryItemStatus.purchased,
              relatedInventoryEventId: event.id,
            },
            include: { product: true },
          }),
        ),
      );

      return { event, updatedItems };
    });

    // Build completed items list
    for (const item of result.updatedItems) {
      completed.push({
        id: item.id,
        productName: item.product.canonicalName,
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
}
