import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { InventoryService } from './inventory.service';
import { PrismaService } from '../prisma/prisma.service';
import { ProductService } from '../product/product.service';
import { RecordInventoryEventDto } from './dto/record-inventory-event.dto';
import { RecordPurchaseDto } from './dto/record-purchase.dto';
import { CompletePurchaseDto } from './dto/complete-purchase.dto';
import { CompletePartialPurchaseDto } from './dto/complete-partial-purchase.dto';
import {
  InventoryEventType,
  GroceryItemStatus,
  ProductNameKind,
} from '../generated/prisma/enums';
import { OperationalLogger } from '../observability/operational-logger.service';

const PRODUCT_ID = '11111111-1111-4111-8111-111111111111';
const PRODUCT_NAMES = {
  names: [
    {
      id: 'name-1',
      productId: PRODUCT_ID,
      displayName: 'milk',
      normalizedName: 'milk',
      kind: ProductNameKind.canonical,
    },
  ],
};

describe('InventoryService', () => {
  let service: InventoryService;
  let prisma: {
    inventoryEvent: {
      create: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
    };
    groceryListItem: {
      findMany: jest.Mock;
      update: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  let productService: { findOne: jest.Mock };
  let operationalLogger: { inventoryAction: jest.Mock };

  beforeEach(async () => {
    prisma = {
      inventoryEvent: {
        create: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
      groceryListItem: {
        findMany: jest.fn(),
        update: jest.fn(),
      },
      $transaction: jest.fn(),
    };
    productService = { findOne: jest.fn() };
    operationalLogger = { inventoryAction: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        InventoryService,
        { provide: PrismaService, useValue: prisma },
        { provide: ProductService, useValue: productService },
        { provide: OperationalLogger, useValue: operationalLogger },
      ],
    }).compile();

    service = module.get(InventoryService);
  });

  describe('recordEvent', () => {
    it('validates the product exists, persists the event, and returns it', async () => {
      productService.findOne.mockResolvedValue({ id: PRODUCT_ID });
      const createdEvent = {
        id: 'event-1',
        productId: PRODUCT_ID,
        eventType: InventoryEventType.STOCK_LOW,
        quantity: 1,
        unit: 'liter',
        timestamp: new Date('2026-08-26T10:00:00.000Z'),
        source: 'hermes_whatsapp',
        confidence: 0.8,
        metadata: { note: 'low' },
      };
      prisma.inventoryEvent.create.mockResolvedValue(createdEvent);

      const dto: RecordInventoryEventDto = {
        productId: PRODUCT_ID,
        eventType: InventoryEventType.STOCK_LOW,
        quantity: 1,
        unit: 'liter',
        source: 'hermes_whatsapp',
        confidence: 0.8,
        metadata: { note: 'low' },
      };

      const result = await service.recordEvent(dto);

      expect(productService.findOne).toHaveBeenCalledWith(PRODUCT_ID);
      expect(prisma.inventoryEvent.create).toHaveBeenCalledWith({
        data: {
          productId: PRODUCT_ID,
          eventType: InventoryEventType.STOCK_LOW,
          quantity: 1,
          unit: 'liter',
          source: 'hermes_whatsapp',
          confidence: 0.8,
          metadata: { note: 'low' },
        },
      });
      expect(result).toEqual(createdEvent);
      expect(operationalLogger.inventoryAction).toHaveBeenCalledWith({
        action: 'record_event',
        outcome: 'success',
        productId: PRODUCT_ID,
        inventoryEventId: 'event-1',
      });
    });

    it('propagates a not-found error and never persists when the product does not exist', async () => {
      productService.findOne.mockRejectedValue(
        new NotFoundException(`No product with id "${PRODUCT_ID}"`),
      );

      const dto: RecordInventoryEventDto = {
        productId: PRODUCT_ID,
        eventType: InventoryEventType.STOCK_OUT,
        source: 'api',
      };

      await expect(service.recordEvent(dto)).rejects.toThrow(NotFoundException);
      expect(prisma.inventoryEvent.create).not.toHaveBeenCalled();
      expect(operationalLogger.inventoryAction).not.toHaveBeenCalled();
    });
  });

  describe('recordPurchase', () => {
    it('validates the product and persists a purchase event', async () => {
      productService.findOne.mockResolvedValue({ id: PRODUCT_ID });
      const createdEvent = {
        id: 'purchase-1',
        productId: PRODUCT_ID,
        eventType: InventoryEventType.PURCHASED,
        quantity: 2,
        unit: 'liter',
        timestamp: new Date('2026-08-26T10:00:00.000Z'),
        source: 'api',
        confidence: null,
        metadata: null,
      };
      prisma.inventoryEvent.create.mockResolvedValue(createdEvent);

      const dto: RecordPurchaseDto = {
        productId: PRODUCT_ID,
        eventType: InventoryEventType.PURCHASED,
        quantity: 2,
        unit: 'liter',
        source: 'api',
      };

      await expect(service.recordPurchase(dto)).resolves.toEqual(createdEvent);
      expect(productService.findOne).toHaveBeenCalledWith(PRODUCT_ID);
      expect(prisma.inventoryEvent.create).toHaveBeenCalledWith({
        data: {
          productId: PRODUCT_ID,
          eventType: InventoryEventType.PURCHASED,
          quantity: 2,
          unit: 'liter',
          source: 'api',
          confidence: undefined,
          metadata: undefined,
        },
      });
      expect(operationalLogger.inventoryAction).toHaveBeenCalledWith({
        action: 'record_purchase',
        outcome: 'success',
        productId: PRODUCT_ID,
        inventoryEventId: 'purchase-1',
      });
    });

    it('records a restock with zero quantity', async () => {
      productService.findOne.mockResolvedValue({ id: PRODUCT_ID });
      const createdEvent = {
        id: 'restock-1',
        productId: PRODUCT_ID,
        eventType: InventoryEventType.RESTOCKED,
        quantity: 0,
        unit: null,
        timestamp: new Date('2026-08-26T10:00:00.000Z'),
        source: 'api',
        confidence: null,
        metadata: null,
      };
      prisma.inventoryEvent.create.mockResolvedValue(createdEvent);

      await expect(
        service.recordPurchase({
          productId: PRODUCT_ID,
          eventType: InventoryEventType.RESTOCKED,
          quantity: 0,
          source: 'api',
        }),
      ).resolves.toEqual(createdEvent);
    });

    it('rejects unsupported event types before product lookup or persistence', async () => {
      const dto = {
        productId: PRODUCT_ID,
        eventType: InventoryEventType.STOCK_LOW,
        source: 'api',
      } as unknown as RecordPurchaseDto;

      await expect(service.recordPurchase(dto)).rejects.toThrow(
        'Purchase eventType must be PURCHASED or RESTOCKED',
      );
      expect(productService.findOne).not.toHaveBeenCalled();
      expect(prisma.inventoryEvent.create).not.toHaveBeenCalled();
      expect(operationalLogger.inventoryAction).not.toHaveBeenCalled();
    });

    it('propagates a missing product error without persisting', async () => {
      productService.findOne.mockRejectedValue(
        new NotFoundException(`No product with id "${PRODUCT_ID}"`),
      );

      await expect(
        service.recordPurchase({
          productId: PRODUCT_ID,
          eventType: InventoryEventType.PURCHASED,
          source: 'api',
        }),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.inventoryEvent.create).not.toHaveBeenCalled();
      expect(operationalLogger.inventoryAction).not.toHaveBeenCalled();
    });
  });

  describe('listEvents', () => {
    it('applies default pagination and no filters when none are given', async () => {
      prisma.inventoryEvent.findMany.mockResolvedValue([]);
      prisma.inventoryEvent.count.mockResolvedValue(0);

      const result = await service.listEvents({});

      expect(prisma.inventoryEvent.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: [{ timestamp: 'desc' }, { id: 'desc' }],
        take: 20,
        skip: 0,
      });
      expect(prisma.inventoryEvent.count).toHaveBeenCalledWith({ where: {} });
      expect(result).toEqual({ items: [], total: 0, limit: 20, offset: 0 });
    });

    it('filters by productId and eventType and paginates the results', async () => {
      const event = {
        id: 'event-1',
        productId: PRODUCT_ID,
        eventType: InventoryEventType.STOCK_OUT,
        quantity: null,
        unit: null,
        timestamp: new Date('2026-08-26T10:00:00.000Z'),
        source: 'api',
        confidence: null,
        metadata: null,
      };
      prisma.inventoryEvent.findMany.mockResolvedValue([event]);
      prisma.inventoryEvent.count.mockResolvedValue(1);

      const result = await service.listEvents({
        productId: PRODUCT_ID,
        eventType: InventoryEventType.STOCK_OUT,
        limit: 5,
        offset: 10,
      });

      const expectedWhere = {
        productId: PRODUCT_ID,
        eventType: InventoryEventType.STOCK_OUT,
      };
      expect(prisma.inventoryEvent.findMany).toHaveBeenCalledWith({
        where: expectedWhere,
        orderBy: [{ timestamp: 'desc' }, { id: 'desc' }],
        take: 5,
        skip: 10,
      });
      expect(prisma.inventoryEvent.count).toHaveBeenCalledWith({
        where: expectedWhere,
      });
      expect(result).toEqual({
        items: [event],
        total: 1,
        limit: 5,
        offset: 10,
      });
    });
  });

  describe('completePurchase', () => {
    const groceryItemId1 = '22222222-2222-4222-8222-222222222222';
    const groceryItemId2 = '33333333-3333-4333-8333-333333333333';

    it('validates product, creates event, updates grocery items in a transaction', async () => {
      productService.findOne.mockResolvedValue({ id: PRODUCT_ID });
      prisma.groceryListItem.findMany.mockResolvedValue([
        {
          id: groceryItemId1,
          productId: PRODUCT_ID,
          status: GroceryItemStatus.pending,
          requestedQuantity: 2,
          unit: 'liter',
          relatedInventoryEventId: null,
        },
        {
          id: groceryItemId2,
          productId: PRODUCT_ID,
          status: GroceryItemStatus.pending,
          requestedQuantity: 4,
          unit: 'liter',
          relatedInventoryEventId: null,
        },
      ]);

      const createdEvent = {
        id: 'event-complete',
        productId: PRODUCT_ID,
        eventType: InventoryEventType.PURCHASED,
        quantity: 6,
        unit: 'liter',
        timestamp: new Date('2026-08-26T12:00:00.000Z'),
        source: 'hermes_whatsapp',
        confidence: 1,
        metadata: null,
      };

      const updatedItem1 = {
        id: groceryItemId1,
        productId: PRODUCT_ID,
        status: GroceryItemStatus.purchased,
        relatedInventoryEventId: createdEvent.id,
        product: PRODUCT_NAMES,
      };
      const updatedItem2 = {
        id: groceryItemId2,
        productId: PRODUCT_ID,
        status: GroceryItemStatus.purchased,
        relatedInventoryEventId: createdEvent.id,
        product: PRODUCT_NAMES,
      };

      prisma.$transaction.mockImplementation(async (callback) => {
        const tx = {
          inventoryEvent: { create: jest.fn().mockResolvedValue(createdEvent) },
          groceryListItem: {
            update: jest
              .fn()
              .mockResolvedValueOnce(updatedItem1)
              .mockResolvedValueOnce(updatedItem2),
          },
        };
        return callback(tx);
      });

      const result = await service.completePurchase({
        productId: PRODUCT_ID,
        quantity: 6,
        unit: 'liter',
        source: 'hermes_whatsapp',
        confidence: 1,
        groceryItemIds: [groceryItemId1, groceryItemId2],
      });

      expect(productService.findOne).toHaveBeenCalledWith(PRODUCT_ID);
      expect(prisma.groceryListItem.findMany).toHaveBeenCalledWith({
        where: { id: { in: [groceryItemId1, groceryItemId2] } },
      });
      expect(result.event.id).toBe(createdEvent.id);
      expect(result.groceryItems).toHaveLength(2);
      expect(result.groceryItems[0].status).toBe(GroceryItemStatus.purchased);
      expect(operationalLogger.inventoryAction).toHaveBeenCalledWith({
        action: 'complete_purchase',
        outcome: 'success',
        productId: PRODUCT_ID,
        inventoryEventId: 'event-complete',
        affectedCount: 2,
      });
    });

    it('deduplicates groceryItemIds before validation', async () => {
      productService.findOne.mockResolvedValue({ id: PRODUCT_ID });
      prisma.groceryListItem.findMany.mockResolvedValue([
        {
          id: groceryItemId1,
          productId: PRODUCT_ID,
          status: GroceryItemStatus.pending,
          relatedInventoryEventId: null,
        },
      ]);

      prisma.$transaction.mockImplementation(async (callback) => {
        const tx = {
          inventoryEvent: {
            create: jest.fn().mockResolvedValue({ id: 'event-1' }),
          },
          groceryListItem: {
            update: jest.fn().mockResolvedValue({
              id: groceryItemId1,
              product: PRODUCT_NAMES,
            }),
          },
        };
        return callback(tx);
      });

      await service.completePurchase({
        productId: PRODUCT_ID,
        source: 'api',
        groceryItemIds: [groceryItemId1, groceryItemId1],
      });

      expect(prisma.groceryListItem.findMany).toHaveBeenCalledWith({
        where: { id: { in: [groceryItemId1] } },
      });
    });

    it('rejects when grocery item not found', async () => {
      productService.findOne.mockResolvedValue({ id: PRODUCT_ID });
      prisma.groceryListItem.findMany.mockResolvedValue([]);

      await expect(
        service.completePurchase({
          productId: PRODUCT_ID,
          source: 'api',
          groceryItemIds: [groceryItemId1],
        }),
      ).rejects.toThrow(BadRequestException);

      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(operationalLogger.inventoryAction).not.toHaveBeenCalled();
    });

    it('rejects when grocery item belongs to different product', async () => {
      productService.findOne.mockResolvedValue({ id: PRODUCT_ID });
      prisma.groceryListItem.findMany.mockResolvedValue([
        {
          id: groceryItemId1,
          productId: 'different-product-id',
          status: GroceryItemStatus.pending,
          relatedInventoryEventId: null,
        },
      ]);

      await expect(
        service.completePurchase({
          productId: PRODUCT_ID,
          source: 'api',
          groceryItemIds: [groceryItemId1],
        }),
      ).rejects.toThrow(BadRequestException);
      expect(operationalLogger.inventoryAction).not.toHaveBeenCalled();
    });

    it('rejects when grocery item status is not pending', async () => {
      productService.findOne.mockResolvedValue({ id: PRODUCT_ID });
      prisma.groceryListItem.findMany.mockResolvedValue([
        {
          id: groceryItemId1,
          productId: PRODUCT_ID,
          status: GroceryItemStatus.purchased,
          relatedInventoryEventId: null,
        },
      ]);

      await expect(
        service.completePurchase({
          productId: PRODUCT_ID,
          source: 'api',
          groceryItemIds: [groceryItemId1],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects when grocery item already has relatedInventoryEventId', async () => {
      productService.findOne.mockResolvedValue({ id: PRODUCT_ID });
      prisma.groceryListItem.findMany.mockResolvedValue([
        {
          id: groceryItemId1,
          productId: PRODUCT_ID,
          status: GroceryItemStatus.pending,
          relatedInventoryEventId: 'existing-event-id',
        },
      ]);

      await expect(
        service.completePurchase({
          productId: PRODUCT_ID,
          source: 'api',
          groceryItemIds: [groceryItemId1],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects with structured per-item errors', async () => {
      productService.findOne.mockResolvedValue({ id: PRODUCT_ID });
      prisma.groceryListItem.findMany.mockResolvedValue([
        {
          id: groceryItemId1,
          productId: 'different-product-id',
          status: GroceryItemStatus.pending,
          relatedInventoryEventId: null,
        },
      ]);

      try {
        await service.completePurchase({
          productId: PRODUCT_ID,
          source: 'api',
          groceryItemIds: [groceryItemId1, groceryItemId2],
        });
        fail('Expected BadRequestException');
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        const response = (error as BadRequestException).getResponse() as {
          errors: Array<{ id: string; reason: string }>;
        };
        expect(response.errors).toHaveLength(2);
      }
    });

    it('uses optimistic locking with status guard in update WHERE clause', async () => {
      productService.findOne.mockResolvedValue({ id: PRODUCT_ID });
      prisma.groceryListItem.findMany.mockResolvedValue([
        {
          id: groceryItemId1,
          productId: PRODUCT_ID,
          status: GroceryItemStatus.pending,
          relatedInventoryEventId: null,
        },
      ]);

      const mockUpdate = jest.fn().mockResolvedValue({
        id: groceryItemId1,
        product: PRODUCT_NAMES,
      });

      prisma.$transaction.mockImplementation(async (callback) => {
        const tx = {
          inventoryEvent: {
            create: jest.fn().mockResolvedValue({ id: 'event-1' }),
          },
          groceryListItem: {
            update: mockUpdate,
          },
        };
        return callback(tx);
      });

      await service.completePurchase({
        productId: PRODUCT_ID,
        source: 'api',
        groceryItemIds: [groceryItemId1],
      });

      // Verify the WHERE clause includes status guard for optimistic locking
      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: groceryItemId1, status: GroceryItemStatus.pending },
        data: {
          status: GroceryItemStatus.purchased,
          relatedInventoryEventId: 'event-1',
        },
        include: {
          product: expect.objectContaining({
            include: expect.objectContaining({ names: expect.any(Object) }),
          }),
        },
      });
    });

    it('propagates NotFoundException when product does not exist', async () => {
      productService.findOne.mockRejectedValue(
        new NotFoundException(`No product with id "${PRODUCT_ID}"`),
      );

      await expect(
        service.completePurchase({
          productId: PRODUCT_ID,
          source: 'api',
          groceryItemIds: [groceryItemId1],
        }),
      ).rejects.toThrow(NotFoundException);

      expect(prisma.groceryListItem.findMany).not.toHaveBeenCalled();
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('completePartialPurchase', () => {
    const groceryItemId1 = '22222222-2222-4222-8222-222222222222';
    const groceryItemId2 = '33333333-3333-4333-8333-333333333333';
    const groceryItemId3 = '44444444-4444-4444-8444-444444444444';

    describe('inclusive mode (completeItemIds)', () => {
      it('completes specified items and skips invalid ones', async () => {
        productService.findOne.mockResolvedValue({ id: PRODUCT_ID });
        // Only groceryItemId1 exists in DB; groceryItemId2 is not found
        prisma.groceryListItem.findMany.mockResolvedValue([
          {
            id: groceryItemId1,
            productId: PRODUCT_ID,
            status: GroceryItemStatus.pending,
            relatedInventoryEventId: null,
          },
        ]);

        const createdEvent = {
          id: 'event-partial',
          productId: PRODUCT_ID,
          eventType: InventoryEventType.PURCHASED,
          quantity: 6,
          unit: 'liter',
          timestamp: new Date('2026-08-26T12:00:00.000Z'),
          source: 'hermes_whatsapp',
          confidence: 1,
          metadata: null,
        };

        const updatedItem1 = {
          id: groceryItemId1,
          productId: PRODUCT_ID,
          status: GroceryItemStatus.purchased,
          relatedInventoryEventId: createdEvent.id,
          product: PRODUCT_NAMES,
        };

        prisma.$transaction.mockImplementation(async (callback) => {
          const tx = {
            inventoryEvent: {
              create: jest.fn().mockResolvedValue(createdEvent),
            },
            groceryListItem: {
              update: jest.fn().mockResolvedValue(updatedItem1),
            },
          };
          return callback(tx);
        });

        const result = await service.completePartialPurchase({
          productId: PRODUCT_ID,
          quantity: 6,
          unit: 'liter',
          source: 'hermes_whatsapp',
          confidence: 1,
          completeItemIds: [groceryItemId1, groceryItemId2],
        });

        expect(productService.findOne).toHaveBeenCalledWith(PRODUCT_ID);
        expect(result.event.id).toBe(createdEvent.id);
        expect(result.completed).toHaveLength(1);
        expect(result.completed[0].id).toBe(groceryItemId1);
        expect(result.skipped).toHaveLength(1);
        expect(result.skipped[0].id).toBe(groceryItemId2);
        expect(result.skipped[0].reason).toBe('not_found');
        expect(operationalLogger.inventoryAction).toHaveBeenCalledWith({
          action: 'complete_partial_purchase',
          outcome: 'success',
          productId: PRODUCT_ID,
          inventoryEventId: 'event-partial',
          affectedCount: 1,
          skippedCount: 1,
        });
      });

      it('skips items belonging to different product', async () => {
        productService.findOne.mockResolvedValue({ id: PRODUCT_ID });
        prisma.groceryListItem.findMany.mockResolvedValue([
          {
            id: groceryItemId1,
            productId: 'different-product-id',
            status: GroceryItemStatus.pending,
            relatedInventoryEventId: null,
          },
        ]);

        await expect(
          service.completePartialPurchase({
            productId: PRODUCT_ID,
            source: 'api',
            completeItemIds: [groceryItemId1],
          }),
        ).rejects.toThrow(BadRequestException);
      });

      it('skips already resolved items', async () => {
        productService.findOne.mockResolvedValue({ id: PRODUCT_ID });
        prisma.groceryListItem.findMany.mockResolvedValue([
          {
            id: groceryItemId1,
            productId: PRODUCT_ID,
            status: GroceryItemStatus.purchased,
            relatedInventoryEventId: null,
          },
        ]);

        await expect(
          service.completePartialPurchase({
            productId: PRODUCT_ID,
            source: 'api',
            completeItemIds: [groceryItemId1],
          }),
        ).rejects.toThrow(BadRequestException);
      });
    });

    describe('exclusive mode (omitItemIds)', () => {
      it('completes all pending except omitted items', async () => {
        productService.findOne.mockResolvedValue({ id: PRODUCT_ID });
        prisma.groceryListItem.findMany
          .mockResolvedValueOnce([
            { id: groceryItemId1 },
            { id: groceryItemId2 },
            { id: groceryItemId3 },
          ])
          .mockResolvedValueOnce([
            {
              id: groceryItemId2,
              productId: PRODUCT_ID,
              status: GroceryItemStatus.pending,
              relatedInventoryEventId: null,
            },
          ]);

        const createdEvent = {
          id: 'event-exclusive',
          productId: PRODUCT_ID,
          eventType: InventoryEventType.PURCHASED,
          quantity: null,
          unit: null,
          timestamp: new Date('2026-08-26T12:00:00.000Z'),
          source: 'api',
          confidence: null,
          metadata: null,
        };

        const updatedItem1 = {
          id: groceryItemId1,
          productId: PRODUCT_ID,
          status: GroceryItemStatus.purchased,
          relatedInventoryEventId: createdEvent.id,
          product: PRODUCT_NAMES,
        };
        const updatedItem3 = {
          id: groceryItemId3,
          productId: PRODUCT_ID,
          status: GroceryItemStatus.purchased,
          relatedInventoryEventId: createdEvent.id,
          product: PRODUCT_NAMES,
        };

        prisma.$transaction.mockImplementation(async (callback) => {
          const tx = {
            inventoryEvent: {
              create: jest.fn().mockResolvedValue(createdEvent),
            },
            groceryListItem: {
              update: jest
                .fn()
                .mockResolvedValueOnce(updatedItem1)
                .mockResolvedValueOnce(updatedItem3),
            },
          };
          return callback(tx);
        });

        const result = await service.completePartialPurchase({
          productId: PRODUCT_ID,
          source: 'api',
          omitItemIds: [groceryItemId2],
        });

        expect(result.completed).toHaveLength(2);
        expect(result.pending).toHaveLength(1);
        expect(result.pending[0].id).toBe(groceryItemId2);
        expect(result.pending[0].reason).toBe('explicitly_omitted');
      });

      it('handles omitItemIds referencing items not in pending list', async () => {
        productService.findOne.mockResolvedValue({ id: PRODUCT_ID });
        // First call: all pending items for product (only groceryItemId1)
        // Second call: lookup items in omitItemIds (groceryItemId2 not found)
        prisma.groceryListItem.findMany
          .mockResolvedValueOnce([{ id: groceryItemId1 }])
          .mockResolvedValueOnce([]);

        const createdEvent = { id: 'event-1' };
        const updatedItem = {
          id: groceryItemId1,
          product: PRODUCT_NAMES,
        };

        prisma.$transaction.mockImplementation(async (callback) => {
          const tx = {
            inventoryEvent: {
              create: jest.fn().mockResolvedValue(createdEvent),
            },
            groceryListItem: {
              update: jest.fn().mockResolvedValue(updatedItem),
            },
          };
          return callback(tx);
        });

        const result = await service.completePartialPurchase({
          productId: PRODUCT_ID,
          source: 'api',
          omitItemIds: [groceryItemId2],
        });

        expect(result.completed).toHaveLength(1);
        expect(result.skipped).toHaveLength(1);
        expect(result.skipped[0].id).toBe(groceryItemId2);
        expect(result.skipped[0].reason).toBe('not_found');
      });
    });

    it('throws when all items fail validation', async () => {
      productService.findOne.mockResolvedValue({ id: PRODUCT_ID });
      prisma.groceryListItem.findMany.mockResolvedValue([]);

      await expect(
        service.completePartialPurchase({
          productId: PRODUCT_ID,
          source: 'api',
          completeItemIds: [groceryItemId1],
        }),
      ).rejects.toThrow(BadRequestException);
      expect(operationalLogger.inventoryAction).not.toHaveBeenCalled();
    });

    it('uses optimistic locking with status guard in update WHERE clause', async () => {
      productService.findOne.mockResolvedValue({ id: PRODUCT_ID });
      prisma.groceryListItem.findMany.mockResolvedValue([
        {
          id: groceryItemId1,
          productId: PRODUCT_ID,
          status: GroceryItemStatus.pending,
          relatedInventoryEventId: null,
        },
      ]);

      const mockUpdate = jest.fn().mockResolvedValue({
        id: groceryItemId1,
        product: PRODUCT_NAMES,
      });

      prisma.$transaction.mockImplementation(async (callback) => {
        const tx = {
          inventoryEvent: {
            create: jest.fn().mockResolvedValue({ id: 'event-1' }),
          },
          groceryListItem: { update: mockUpdate },
        };
        return callback(tx);
      });

      await service.completePartialPurchase({
        productId: PRODUCT_ID,
        source: 'api',
        completeItemIds: [groceryItemId1],
      });

      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: groceryItemId1, status: GroceryItemStatus.pending },
        data: {
          status: GroceryItemStatus.purchased,
          relatedInventoryEventId: 'event-1',
        },
        include: {
          product: expect.objectContaining({
            include: expect.objectContaining({ names: expect.any(Object) }),
          }),
        },
      });
    });

    it('propagates NotFoundException when product does not exist', async () => {
      productService.findOne.mockRejectedValue(
        new NotFoundException(`No product with id "${PRODUCT_ID}"`),
      );

      await expect(
        service.completePartialPurchase({
          productId: PRODUCT_ID,
          source: 'api',
          completeItemIds: [groceryItemId1],
        }),
      ).rejects.toThrow(NotFoundException);

      expect(prisma.groceryListItem.findMany).not.toHaveBeenCalled();
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('completeGroceryPurchase', () => {
    const milkProductId = '22222222-2222-4222-8222-222222222222';
    const riceProductId = '33333333-3333-4333-8333-333333333333';
    const milkItemId = '44444444-4444-4444-8444-444444444444';
    const riceItemId = '55555555-5555-4555-8555-555555555555';
    const secondMilkItemId = '66666666-6666-4666-8666-666666666666';

    const groceryItem = (
      id: string,
      productId: string,
      productName: string,
      status = GroceryItemStatus.pending,
      relatedInventoryEventId: string | null = null,
    ) => ({
      id,
      productId,
      requestedQuantity: null,
      unit: null,
      dateAdded: new Date('2026-08-27T10:00:00.000Z'),
      status,
      note: null,
      source: 'hermes_whatsapp',
      relatedInventoryEventId,
      product: {
        names: [
          {
            id: `name-${productId}`,
            productId,
            displayName: productName,
            normalizedName: productName.toLowerCase(),
            kind: ProductNameKind.canonical,
          },
        ],
      },
    });

    const purchaseEvent = (id: string, productId: string) => ({
      id,
      productId,
      eventType: InventoryEventType.PURCHASED,
      quantity: null,
      unit: null,
      timestamp: new Date('2026-08-27T11:00:00.000Z'),
      source: 'hermes_mcp',
      confidence: null,
      metadata: null,
    });

    it('atomically completes mixed products in request order', async () => {
      const milkItem = groceryItem(milkItemId, milkProductId, 'milk');
      const riceItem = groceryItem(riceItemId, riceProductId, 'rice');
      const secondMilkItem = groceryItem(
        secondMilkItemId,
        milkProductId,
        'milk',
      );
      prisma.groceryListItem.findMany.mockResolvedValue([
        secondMilkItem,
        riceItem,
        milkItem,
      ]);

      const milkEvent = purchaseEvent('milk-event', milkProductId);
      const riceEvent = purchaseEvent('rice-event', riceProductId);
      const createEvent = jest
        .fn()
        .mockResolvedValueOnce(riceEvent)
        .mockResolvedValueOnce(milkEvent);
      const updateItem = jest.fn().mockImplementation(({ where, data }) => {
        const original = [riceItem, milkItem, secondMilkItem].find(
          (item) => item.id === where.id,
        );
        return Promise.resolve({ ...original, ...data });
      });
      prisma.$transaction.mockImplementation((callback) =>
        callback({
          inventoryEvent: { create: createEvent },
          groceryListItem: { update: updateItem },
        }),
      );

      const result = await service.completeGroceryPurchase({
        groceryItemIds: [riceItemId, milkItemId, secondMilkItemId],
        source: 'hermes_mcp',
      });

      expect(createEvent).toHaveBeenNthCalledWith(1, {
        data: {
          productId: riceProductId,
          eventType: InventoryEventType.PURCHASED,
          source: 'hermes_mcp',
        },
      });
      expect(createEvent).toHaveBeenNthCalledWith(2, {
        data: {
          productId: milkProductId,
          eventType: InventoryEventType.PURCHASED,
          source: 'hermes_mcp',
        },
      });
      expect(result.events.map((event) => event.id)).toEqual([
        'rice-event',
        'milk-event',
      ]);
      expect(result.completedItems.map((item) => item.id)).toEqual([
        riceItemId,
        milkItemId,
        secondMilkItemId,
      ]);
      expect(operationalLogger.inventoryAction).toHaveBeenCalledWith({
        action: 'complete_purchase',
        outcome: 'success',
        affectedCount: 3,
      });
      expect(updateItem.mock.calls.map((call) => call[0].data)).toEqual([
        {
          status: GroceryItemStatus.purchased,
          relatedInventoryEventId: 'rice-event',
        },
        {
          status: GroceryItemStatus.purchased,
          relatedInventoryEventId: 'milk-event',
        },
        {
          status: GroceryItemStatus.purchased,
          relatedInventoryEventId: 'milk-event',
        },
      ]);
    });

    it.each([
      { groceryItemIds: [], source: 'hermes_mcp' },
      {
        groceryItemIds: [milkItemId, milkItemId],
        source: 'hermes_mcp',
      },
      { groceryItemIds: [milkItemId], source: '   ' },
    ])('rejects invalid input before reading or writing', async (input) => {
      await expect(service.completeGroceryPurchase(input)).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.groceryListItem.findMany).not.toHaveBeenCalled();
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it.each([
      ['an unknown item', [], milkItemId],
      [
        'an already resolved item',
        [
          groceryItem(
            milkItemId,
            milkProductId,
            'milk',
            GroceryItemStatus.purchased,
            'old-event',
          ),
        ],
        milkItemId,
      ],
    ])('rejects %s before starting a transaction', async (_case, items, id) => {
      prisma.groceryListItem.findMany.mockResolvedValue(items);

      await expect(
        service.completeGroceryPurchase({
          groceryItemIds: [id],
          source: 'hermes_mcp',
        }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('propagates a guarded update failure so the transaction can roll back', async () => {
      const milkItem = groceryItem(milkItemId, milkProductId, 'milk');
      prisma.groceryListItem.findMany.mockResolvedValue([milkItem]);
      const concurrentChange = new Error('record no longer exists');
      const createEvent = jest
        .fn()
        .mockResolvedValue(purchaseEvent('milk-event', milkProductId));
      const updateItem = jest.fn().mockRejectedValue(concurrentChange);
      prisma.$transaction.mockImplementation(async (callback) =>
        callback({
          inventoryEvent: { create: createEvent },
          groceryListItem: { update: updateItem },
        }),
      );

      await expect(
        service.completeGroceryPurchase({
          groceryItemIds: [milkItemId],
          source: 'hermes_mcp',
        }),
      ).rejects.toBe(concurrentChange);
      expect(operationalLogger.inventoryAction).not.toHaveBeenCalled();
      expect(updateItem).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: milkItemId,
            status: GroceryItemStatus.pending,
            relatedInventoryEventId: null,
          },
        }),
      );
    });
  });
});

describe('RecordPurchaseDto validation', () => {
  it('accepts PURCHASED and RESTOCKED events, including zero quantity', async () => {
    for (const eventType of [
      InventoryEventType.PURCHASED,
      InventoryEventType.RESTOCKED,
    ]) {
      const dto = plainToInstance(RecordPurchaseDto, {
        productId: PRODUCT_ID,
        eventType,
        quantity: 0,
      });

      await expect(validate(dto)).resolves.toHaveLength(0);
    }
  });

  it('rejects non-purchase inventory event types', async () => {
    const dto = plainToInstance(RecordPurchaseDto, {
      productId: PRODUCT_ID,
      eventType: InventoryEventType.STOCK_LOW,
      source: 'api',
    });

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'eventType')).toBe(true);
  });

  it('rejects negative quantities', async () => {
    const dto = plainToInstance(RecordPurchaseDto, {
      productId: PRODUCT_ID,
      eventType: InventoryEventType.PURCHASED,
      quantity: -1,
    });

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'quantity')).toBe(true);
  });
});

describe('CompletePurchaseDto validation', () => {
  const groceryItemId = '22222222-2222-4222-8222-222222222222';

  it('validates a correct payload with required fields', async () => {
    const dto = plainToInstance(CompletePurchaseDto, {
      productId: PRODUCT_ID,
      groceryItemIds: [groceryItemId],
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('accepts optional quantity, unit, confidence, and metadata', async () => {
    const dto = plainToInstance(CompletePurchaseDto, {
      productId: PRODUCT_ID,
      quantity: 6,
      unit: 'liter',
      source: 'api',
      confidence: 0.9,
      metadata: { note: 'test' },
      groceryItemIds: [groceryItemId],
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('rejects missing productId', async () => {
    const dto = plainToInstance(CompletePurchaseDto, {
      source: 'api',
      groceryItemIds: [groceryItemId],
    });

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'productId')).toBe(true);
  });

  it('rejects missing groceryItemIds', async () => {
    const dto = plainToInstance(CompletePurchaseDto, {
      productId: PRODUCT_ID,
      source: 'api',
    });

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'groceryItemIds')).toBe(
      true,
    );
  });

  it('rejects empty groceryItemIds array', async () => {
    const dto = plainToInstance(CompletePurchaseDto, {
      productId: PRODUCT_ID,
      source: 'api',
      groceryItemIds: [],
    });

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'groceryItemIds')).toBe(
      true,
    );
  });

  it('rejects non-UUID groceryItemIds', async () => {
    const dto = plainToInstance(CompletePurchaseDto, {
      productId: PRODUCT_ID,
      source: 'api',
      groceryItemIds: ['not-a-uuid'],
    });

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'groceryItemIds')).toBe(
      true,
    );
  });

  it('rejects negative quantity', async () => {
    const dto = plainToInstance(CompletePurchaseDto, {
      productId: PRODUCT_ID,
      quantity: -1,
      source: 'api',
      groceryItemIds: [groceryItemId],
    });

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'quantity')).toBe(true);
  });

  it('accepts zero quantity', async () => {
    const dto = plainToInstance(CompletePurchaseDto, {
      productId: PRODUCT_ID,
      quantity: 0,
      source: 'api',
      groceryItemIds: [groceryItemId],
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('rejects metadata that is not an object', async () => {
    const dto = plainToInstance(CompletePurchaseDto, {
      productId: PRODUCT_ID,
      source: 'api',
      metadata: 'not an object',
      groceryItemIds: [groceryItemId],
    });

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'metadata')).toBe(true);
  });
});

describe('RecordInventoryEventDto validation', () => {
  it('fails when productId is missing', async () => {
    const dto = plainToInstance(RecordInventoryEventDto, {
      eventType: InventoryEventType.STOCK_LOW,
      source: 'api',
    });

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'productId')).toBe(true);
  });

  it('fails when eventType is not a known InventoryEventType', async () => {
    const dto = plainToInstance(RecordInventoryEventDto, {
      productId: PRODUCT_ID,
      eventType: 'NOT_REAL',
      source: 'api',
    });

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'eventType')).toBe(true);
  });

  it('passes for a fully valid payload', async () => {
    const dto = plainToInstance(RecordInventoryEventDto, {
      productId: PRODUCT_ID,
      eventType: InventoryEventType.STOCK_LOW,
      source: 'api',
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('accepts a quantity of 0 (e.g. confirmed zero stock left)', async () => {
    const dto = plainToInstance(RecordInventoryEventDto, {
      productId: PRODUCT_ID,
      eventType: InventoryEventType.STOCK_OUT,
      quantity: 0,
      source: 'api',
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('rejects a negative quantity', async () => {
    const dto = plainToInstance(RecordInventoryEventDto, {
      productId: PRODUCT_ID,
      eventType: InventoryEventType.STOCK_OUT,
      quantity: -1,
      source: 'api',
    });

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'quantity')).toBe(true);
  });

  it('rejects metadata that is not an object', async () => {
    const dto = plainToInstance(RecordInventoryEventDto, {
      productId: PRODUCT_ID,
      eventType: InventoryEventType.STOCK_LOW,
      source: 'api',
      metadata: 'not an object',
    });

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'metadata')).toBe(true);
  });
});

describe('CompletePartialPurchaseDto validation', () => {
  const PRODUCT_ID = '11111111-1111-4111-8111-111111111111';
  const ITEM_ID = '22222222-2222-4222-8222-222222222222';

  it('accepts completeItemIds with all required fields', async () => {
    const dto = plainToInstance(CompletePartialPurchaseDto, {
      productId: PRODUCT_ID,
      completeItemIds: [ITEM_ID],
    });

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('accepts omitItemIds with all required fields', async () => {
    const dto = plainToInstance(CompletePartialPurchaseDto, {
      productId: PRODUCT_ID,
      source: 'api',
      omitItemIds: [ITEM_ID],
    });

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects when both completeItemIds and omitItemIds are provided', async () => {
    const dto = plainToInstance(CompletePartialPurchaseDto, {
      productId: PRODUCT_ID,
      source: 'api',
      completeItemIds: [ITEM_ID],
      omitItemIds: [ITEM_ID],
    });

    const errors = await validate(dto);
    expect(errors.some((error) => error.property === '_xorValidation')).toBe(
      true,
    );
  });

  it('rejects when neither completeItemIds nor omitItemIds is provided', async () => {
    const dto = plainToInstance(CompletePartialPurchaseDto, {
      productId: PRODUCT_ID,
      source: 'api',
    });

    const errors = await validate(dto);
    expect(errors.some((error) => error.property === '_xorValidation')).toBe(
      true,
    );
  });

  it('rejects empty completeItemIds array', async () => {
    const dto = plainToInstance(CompletePartialPurchaseDto, {
      productId: PRODUCT_ID,
      source: 'api',
      completeItemIds: [],
    });

    const errors = await validate(dto);
    expect(errors.some((error) => error.property === 'completeItemIds')).toBe(
      true,
    );
  });

  it('rejects empty omitItemIds array', async () => {
    const dto = plainToInstance(CompletePartialPurchaseDto, {
      productId: PRODUCT_ID,
      source: 'api',
      omitItemIds: [],
    });

    const errors = await validate(dto);
    expect(errors.some((error) => error.property === 'omitItemIds')).toBe(true);
  });

  it('rejects non-UUID item IDs', async () => {
    const dto = plainToInstance(CompletePartialPurchaseDto, {
      productId: PRODUCT_ID,
      source: 'api',
      completeItemIds: ['not-a-uuid'],
    });

    const errors = await validate(dto);
    expect(errors.some((error) => error.property === 'completeItemIds')).toBe(
      true,
    );
  });

  it('accepts optional fields', async () => {
    const dto = plainToInstance(CompletePartialPurchaseDto, {
      productId: PRODUCT_ID,
      quantity: 6,
      unit: 'liter',
      source: 'api',
      confidence: 0.9,
      metadata: { note: 'test' },
      completeItemIds: [ITEM_ID],
    });

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects missing productId', async () => {
    const dto = plainToInstance(CompletePartialPurchaseDto, {
      source: 'api',
      completeItemIds: [ITEM_ID],
    });

    const errors = await validate(dto);
    expect(errors.some((error) => error.property === 'productId')).toBe(true);
  });

  it('rejects negative quantity', async () => {
    const dto = plainToInstance(CompletePartialPurchaseDto, {
      productId: PRODUCT_ID,
      quantity: -1,
      source: 'api',
      completeItemIds: [ITEM_ID],
    });

    const errors = await validate(dto);
    expect(errors.some((error) => error.property === 'quantity')).toBe(true);
  });

  it('accepts zero quantity', async () => {
    const dto = plainToInstance(CompletePartialPurchaseDto, {
      productId: PRODUCT_ID,
      quantity: 0,
      source: 'api',
      completeItemIds: [ITEM_ID],
    });

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });
});
