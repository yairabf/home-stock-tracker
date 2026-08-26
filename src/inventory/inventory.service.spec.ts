import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { InventoryService } from './inventory.service';
import { PrismaService } from '../prisma/prisma.service';
import { ProductService } from '../product/product.service';
import { RecordInventoryEventDto } from './dto/record-inventory-event.dto';
import { InventoryEventType } from '../generated/prisma/enums';

const PRODUCT_ID = '11111111-1111-4111-8111-111111111111';

describe('InventoryService', () => {
  let service: InventoryService;
  let prisma: {
    inventoryEvent: {
      create: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
    };
  };
  let productService: { findOne: jest.Mock };

  beforeEach(async () => {
    prisma = {
      inventoryEvent: {
        create: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
    };
    productService = { findOne: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        InventoryService,
        { provide: PrismaService, useValue: prisma },
        { provide: ProductService, useValue: productService },
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

  it('trims whitespace from source and rejects a whitespace-only value', async () => {
    const trimmed = plainToInstance(RecordInventoryEventDto, {
      productId: PRODUCT_ID,
      eventType: InventoryEventType.STOCK_LOW,
      source: '  api  ',
    });
    expect(trimmed.source).toBe('api');

    const blank = plainToInstance(RecordInventoryEventDto, {
      productId: PRODUCT_ID,
      eventType: InventoryEventType.STOCK_LOW,
      source: '   ',
    });
    const errors = await validate(blank);

    expect(errors.some((error) => error.property === 'source')).toBe(true);
  });
});
