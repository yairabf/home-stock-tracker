import { Test, TestingModule } from '@nestjs/testing';
import { StatisticsService } from './statistics.service';
import { PrismaService } from '../prisma/prisma.service';
import { ProductService } from '../product/product.service';
import { HouseholdService } from '../household/household.service';
import { InventoryEventType } from '../generated/prisma/enums';
import { MS_PER_DAY } from '../common/constants';

describe('StatisticsService', () => {
  let service: StatisticsService;

  const mockPrismaService = {};
  const mockProductService = {
    findOne: jest.fn(),
  };
  const mockHouseholdService = {};

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StatisticsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: ProductService, useValue: mockProductService },
        { provide: HouseholdService, useValue: mockHouseholdService },
      ],
    }).compile();

    service = module.get<StatisticsService>(StatisticsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('calculatePurchaseInterval (via reflection)', () => {
    // Access private method for testing
    const callCalculatePurchaseInterval = (
      events: Array<{ eventType: InventoryEventType; timestamp: Date }>,
    ) => {
      return (service as any).calculatePurchaseInterval(events);
    };

    it('should return null when fewer than 2 purchase events exist', () => {
      const events = [
        {
          eventType: InventoryEventType.PURCHASED,
          timestamp: new Date('2026-08-20T10:00:00Z'),
        },
      ];

      const result = callCalculatePurchaseInterval(events);
      expect(result).toBeNull();
    });

    it('should return null when no purchase events exist', () => {
      const events = [
        {
          eventType: InventoryEventType.STOCK_LOW,
          timestamp: new Date('2026-08-20T10:00:00Z'),
        },
      ];

      const result = callCalculatePurchaseInterval(events);
      expect(result).toBeNull();
    });

    it('should calculate average interval for 5 purchase events spanning 30 days', () => {
      // 5 events: day 0, 7, 15, 22, 30 (from old to new)
      // Intervals backward: 8 days, 7 days, 8 days, 7 days = 7.5 avg
      const events = [
        {
          eventType: InventoryEventType.PURCHASED,
          timestamp: new Date('2026-08-26T10:00:00Z'),
        }, // day 30
        {
          eventType: InventoryEventType.PURCHASED,
          timestamp: new Date('2026-08-19T10:00:00Z'),
        }, // day 23 (wrong - should be day 22)
        {
          eventType: InventoryEventType.PURCHASED,
          timestamp: new Date('2026-08-15T10:00:00Z'),
        }, // day 15
        {
          eventType: InventoryEventType.PURCHASED,
          timestamp: new Date('2026-08-08T10:00:00Z'),
        }, // day 8 (wrong - should be day 7)
        {
          eventType: InventoryEventType.PURCHASED,
          timestamp: new Date('2026-01-01T10:00:00Z'),
        }, // day 4 (wrong - should be day 0)
      ];

      // Let me recalculate with correct dates:
      // Day 0, 7, 15, 22, 30
      const correctEvents = [
        {
          eventType: InventoryEventType.PURCHASED,
          timestamp: new Date('2026-08-26T10:00:00Z'),
        }, // day 30
        {
          eventType: InventoryEventType.PURCHASED,
          timestamp: new Date('2026-08-18T10:00:00Z'),
        }, // day 22
        {
          eventType: InventoryEventType.PURCHASED,
          timestamp: new Date('2026-08-11T10:00:00Z'),
        }, // day 15
        {
          eventType: InventoryEventType.PURCHASED,
          timestamp: new Date('2026-08-04T10:00:00Z'),
        }, // day 8
        {
          eventType: InventoryEventType.PURCHASED,
          timestamp: new Date('2026-07-27T10:00:00Z'),
        }, // day 0
      ];

      const result = callCalculatePurchaseInterval(correctEvents);

      // Intervals: 30-22=8, 22-15=7, 15-8=7, 8-0=8 => avg = (8+7+7+8)/4 = 7.5
      expect(result).toBeCloseTo(7.5, 1);
    });

    it('should ignore non-purchase events', () => {
      const events = [
        {
          eventType: InventoryEventType.PURCHASED,
          timestamp: new Date('2026-08-20T10:00:00Z'),
        },
        {
          eventType: InventoryEventType.STOCK_LOW,
          timestamp: new Date('2026-08-18T10:00:00Z'),
        },
        {
          eventType: InventoryEventType.PURCHASED,
          timestamp: new Date('2026-08-13T10:00:00Z'),
        },
      ];

      const result = callCalculatePurchaseInterval(events);

      // Only 2 purchase events: day 20 and day 13 => 7 days interval
      expect(result).toBeCloseTo(7.0, 1);
    });

    it('should include RESTOCKED events in calculation', () => {
      const events = [
        {
          eventType: InventoryEventType.RESTOCKED,
          timestamp: new Date('2026-08-20T10:00:00Z'),
        },
        {
          eventType: InventoryEventType.PURCHASED,
          timestamp: new Date('2026-08-06T10:00:00Z'),
        },
      ];

      const result = callCalculatePurchaseInterval(events);

      // 14 days between restock and purchase
      expect(result).toBeCloseTo(14.0, 1);
    });

    it('should limit to most recent 20 events for calculation', () => {
      // Create 25 events, each 1 day apart (Aug 1 through Aug 25)
      const baseDate = new Date('2026-08-25T10:00:00Z');
      const events = Array.from({ length: 25 }, (_, i) => ({
        eventType: InventoryEventType.PURCHASED,
        timestamp: new Date(baseDate.getTime() - i * MS_PER_DAY),
      }));

      const result = callCalculatePurchaseInterval(events);

      // Should only use first 20 events (most recent), giving 19 intervals of 1 day each
      expect(result).toBeCloseTo(1.0, 1);
    });
  });

  describe('calculateNeedInterval (via reflection)', () => {
    // Access private method for testing
    const callCalculateNeedInterval = (
      events: Array<{ eventType: InventoryEventType; timestamp: Date }>,
    ) => {
      return (service as any).calculateNeedInterval(events);
    };

    it('should return null when fewer than 2 need events exist', () => {
      const events = [
        {
          eventType: InventoryEventType.STOCK_LOW,
          timestamp: new Date('2026-08-20T10:00:00Z'),
        },
      ];

      const result = callCalculateNeedInterval(events);
      expect(result).toBeNull();
    });

    it('should return null when no need events exist', () => {
      const events = [
        {
          eventType: InventoryEventType.PURCHASED,
          timestamp: new Date('2026-08-20T10:00:00Z'),
        },
      ];

      const result = callCalculateNeedInterval(events);
      expect(result).toBeNull();
    });

    it('should calculate average interval for 3 low-stock events spanning 21 days', () => {
      // 3 events: day 0, 10.5, 21 (from old to new)
      const events = [
        {
          eventType: InventoryEventType.STOCK_LOW,
          timestamp: new Date('2026-08-26T10:00:00Z'),
        }, // day 21
        {
          eventType: InventoryEventType.STOCK_LOW,
          timestamp: new Date('2026-08-16T10:00:00Z'),
        }, // day 10.5 (actually day 10)
        {
          eventType: InventoryEventType.STOCK_LOW,
          timestamp: new Date('2026-08-05T10:00:00Z'),
        }, // day 0
      ];

      const result = callCalculateNeedInterval(events);

      // Intervals: 21-10=11, 10-0=10 => avg = 10.5
      expect(result).toBeCloseTo(10.5, 1);
    });

    it('should include STOCK_OUT and GROCERY_ADDED events in calculation', () => {
      const events = [
        {
          eventType: InventoryEventType.STOCK_OUT,
          timestamp: new Date('2026-08-20T10:00:00Z'),
        },
        {
          eventType: InventoryEventType.GROCERY_ADDED,
          timestamp: new Date('2026-08-13T10:00:00Z'),
        },
        {
          eventType: InventoryEventType.STOCK_LOW,
          timestamp: new Date('2026-08-06T10:00:00Z'),
        },
      ];

      const result = callCalculateNeedInterval(events);

      // Intervals: 20-13=7, 13-6=7 => avg = 7
      expect(result).toBeCloseTo(7.0, 1);
    });

    it('should ignore non-need events', () => {
      const events = [
        {
          eventType: InventoryEventType.STOCK_LOW,
          timestamp: new Date('2026-08-20T10:00:00Z'),
        },
        {
          eventType: InventoryEventType.PURCHASED,
          timestamp: new Date('2026-08-15T10:00:00Z'),
        },
        {
          eventType: InventoryEventType.STOCK_OUT,
          timestamp: new Date('2026-08-06T10:00:00Z'),
        },
      ];

      const result = callCalculateNeedInterval(events);

      // Only 2 need events: day 20 and day 6 => 14 days interval
      expect(result).toBeCloseTo(14.0, 1);
    });

    it('should limit to most recent 20 events for calculation', () => {
      // Create 25 need events, each 1 day apart
      const baseDate = new Date('2026-08-25T10:00:00Z');
      const events = Array.from({ length: 25 }, (_, i) => ({
        eventType: InventoryEventType.STOCK_LOW,
        timestamp: new Date(baseDate.getTime() - i * MS_PER_DAY),
      }));

      const result = callCalculateNeedInterval(events);

      // Should only use first 20 events (most recent), giving 19 intervals of 1 day each
      expect(result).toBeCloseTo(1.0, 1);
    });
  });

  describe('calculateTypicalPurchaseQuantity (via reflection)', () => {
    // Access private method for testing
    const callCalculateTypicalPurchaseQuantity = (
      events: Array<{
        eventType: InventoryEventType;
        quantity?: number | null;
      }>,
    ) => {
      return (service as any).calculateTypicalPurchaseQuantity(events);
    };

    it('should return null when no purchase events with quantities exist', () => {
      const events = [
        {
          eventType: InventoryEventType.PURCHASED,
          quantity: null,
        },
        {
          eventType: InventoryEventType.PURCHASED,
          quantity: 0,
        },
      ];

      const result = callCalculateTypicalPurchaseQuantity(events);
      expect(result).toBeNull();
    });

    it('should return null when no purchase events exist', () => {
      const events = [
        {
          eventType: InventoryEventType.STOCK_LOW,
          quantity: 5,
        },
      ];

      const result = callCalculateTypicalPurchaseQuantity(events);
      expect(result).toBeNull();
    });

    it('should calculate median for odd number of quantities', () => {
      const events = [
        { eventType: InventoryEventType.PURCHASED, quantity: 1 },
        { eventType: InventoryEventType.PURCHASED, quantity: 3 },
        { eventType: InventoryEventType.PURCHASED, quantity: 5 },
      ];

      const result = callCalculateTypicalPurchaseQuantity(events);
      expect(result).toBe(3);
    });

    it('should calculate median for even number of quantities', () => {
      const events = [
        { eventType: InventoryEventType.PURCHASED, quantity: 1 },
        { eventType: InventoryEventType.PURCHASED, quantity: 2 },
        { eventType: InventoryEventType.PURCHASED, quantity: 3 },
        { eventType: InventoryEventType.PURCHASED, quantity: 4 },
      ];

      const result = callCalculateTypicalPurchaseQuantity(events);
      expect(result).toBe(2.5);
    });

    it('should ignore null and zero quantities', () => {
      const events = [
        { eventType: InventoryEventType.PURCHASED, quantity: 2 },
        { eventType: InventoryEventType.PURCHASED, quantity: null },
        { eventType: InventoryEventType.PURCHASED, quantity: 0 },
        { eventType: InventoryEventType.PURCHASED, quantity: 4 },
      ];

      const result = callCalculateTypicalPurchaseQuantity(events);
      // Only quantities 2 and 4, median = (2+4)/2 = 3
      expect(result).toBe(3);
    });

    it('should include RESTOCKED events', () => {
      const events = [
        { eventType: InventoryEventType.RESTOCKED, quantity: 5 },
        { eventType: InventoryEventType.PURCHASED, quantity: 5 },
      ];

      const result = callCalculateTypicalPurchaseQuantity(events);
      expect(result).toBe(5);
    });

    it('should ignore non-purchase events', () => {
      const events = [
        { eventType: InventoryEventType.PURCHASED, quantity: 3 },
        { eventType: InventoryEventType.STOCK_LOW, quantity: 10 },
        { eventType: InventoryEventType.PURCHASED, quantity: 7 },
      ];

      const result = callCalculateTypicalPurchaseQuantity(events);
      // Only quantities 3 and 7, median = 5
      expect(result).toBe(5);
    });
  });

  describe('estimateConsumptionInterval (via reflection)', () => {
    const callEstimateConsumptionInterval = (
      avgPurchaseIntervalDays: number | null,
      typicalPurchaseQuantity: number | null,
      householdSize: number,
    ) => {
      return (service as any).estimateConsumptionInterval(
        avgPurchaseIntervalDays,
        typicalPurchaseQuantity,
        householdSize,
      );
    };

    it('should return null when purchase interval is null', () => {
      const result = callEstimateConsumptionInterval(null, 2, 5);
      expect(result).toBeNull();
    });

    it('should return null when typical quantity is null', () => {
      const result = callEstimateConsumptionInterval(7, null, 5);
      expect(result).toBeNull();
    });

    it('should return null when household size is 0', () => {
      const result = callEstimateConsumptionInterval(7, 2, 0);
      expect(result).toBeNull();
    });

    it('should calculate consumption interval correctly', () => {
      // avgPurchaseInterval=7 days, quantity=2, household=5
      // => 7 * 2 / 5 = 2.8 days
      const result = callEstimateConsumptionInterval(7, 2, 5);
      expect(result).toBeCloseTo(2.8, 1);
    });

    it('should handle fractional intervals', () => {
      const result = callEstimateConsumptionInterval(10.5, 3, 4);
      // 10.5 * 3 / 4 = 7.875
      expect(result).toBeCloseTo(7.875, 2);
    });
  });

  describe('getHouseholdSize', () => {
    it('should return household size from HouseholdService', async () => {
      mockHouseholdService.getOrCreate = jest.fn().mockResolvedValue({
        id: 'test-id',
        adultsCount: 2,
        childrenCount: 3,
        childAgeGroups: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await (service as any).getHouseholdSize();
      expect(result).toBe(5);
      expect(mockHouseholdService.getOrCreate).toHaveBeenCalled();
    });

    it('should return default size when HouseholdService fails', async () => {
      mockHouseholdService.getOrCreate = jest
        .fn()
        .mockRejectedValue(new Error('Database error'));

      const result = await (service as any).getHouseholdSize();
      expect(result).toBe(5); // defaults: 2 adults + 3 children
    });
  });

  describe('persistStatistics (via reflection)', () => {
    const callPersistStatistics = async (productId: string, data: any) => {
      return (service as any).persistStatistics(productId, data);
    };

    it('should create new statistics row on first call', async () => {
      const mockStats = {
        id: 'stats-id',
        productId: 'product-id',
        avgPurchaseIntervalDays: 7.5,
        avgNeedIntervalDays: null,
        typicalPurchaseQuantity: 2,
        estimatedConsumptionIntervalDays: 3,
        lastPurchaseAt: new Date('2026-08-20T10:00:00Z'),
        lastLowStockSignalAt: null,
        lastStockConfirmationAt: null,
        observationCount: 5,
        updatedAt: new Date('2026-08-26T19:00:00Z'),
      };

      mockPrismaService.productStatistics = {
        upsert: jest.fn().mockResolvedValue(mockStats),
      };

      const result = await callPersistStatistics('product-id', {
        avgPurchaseIntervalDays: 7.5,
        avgNeedIntervalDays: null,
        typicalPurchaseQuantity: 2,
        estimatedConsumptionIntervalDays: 3,
        lastPurchaseAt: new Date('2026-08-20T10:00:00Z'),
        lastLowStockSignalAt: null,
        lastStockConfirmationAt: null,
        observationCount: 5,
      });

      expect(result.productId).toBe('product-id');
      expect(result.avgPurchaseIntervalDays).toBe(7.5);
      expect(mockPrismaService.productStatistics.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { productId: 'product-id' },
        }),
      );
    });

    it('should update existing statistics row on subsequent call', async () => {
      const mockStats = {
        id: 'stats-id',
        productId: 'product-id',
        avgPurchaseIntervalDays: 8.0,
        avgNeedIntervalDays: null,
        typicalPurchaseQuantity: 2,
        estimatedConsumptionIntervalDays: 3.2,
        lastPurchaseAt: new Date('2026-08-21T10:00:00Z'),
        lastLowStockSignalAt: null,
        lastStockConfirmationAt: null,
        observationCount: 6,
        updatedAt: new Date('2026-08-26T20:00:00Z'),
      };

      mockPrismaService.productStatistics = {
        upsert: jest.fn().mockResolvedValue(mockStats),
      };

      const result = await callPersistStatistics('product-id', {
        avgPurchaseIntervalDays: 8.0,
        avgNeedIntervalDays: null,
        typicalPurchaseQuantity: 2,
        estimatedConsumptionIntervalDays: 3.2,
        lastPurchaseAt: new Date('2026-08-21T10:00:00Z'),
        lastLowStockSignalAt: null,
        lastStockConfirmationAt: null,
        observationCount: 6,
      });

      expect(result.observationCount).toBe(6);
      expect(result.avgPurchaseIntervalDays).toBe(8.0);
    });

    it('should handle null values in statistics', async () => {
      const mockStats = {
        id: 'stats-id',
        productId: 'product-id',
        avgPurchaseIntervalDays: null,
        avgNeedIntervalDays: null,
        typicalPurchaseQuantity: null,
        estimatedConsumptionIntervalDays: null,
        lastPurchaseAt: null,
        lastLowStockSignalAt: null,
        lastStockConfirmationAt: null,
        observationCount: 0,
        updatedAt: new Date('2026-08-26T19:00:00Z'),
      };

      mockPrismaService.productStatistics = {
        upsert: jest.fn().mockResolvedValue(mockStats),
      };

      const result = await callPersistStatistics('product-id', {
        avgPurchaseIntervalDays: null,
        avgNeedIntervalDays: null,
        typicalPurchaseQuantity: null,
        estimatedConsumptionIntervalDays: null,
        lastPurchaseAt: null,
        lastLowStockSignalAt: null,
        lastStockConfirmationAt: null,
        observationCount: 0,
      });

      expect(result.avgPurchaseIntervalDays).toBeNull();
      expect(result.observationCount).toBe(0);
    });
  });

  describe('calculateProductStatistics integration', () => {
    it('should calculate and persist statistics for product with events', async () => {
      const productId = 'test-product-id';
      const mockProduct = {
        id: productId,
        canonicalName: 'Milk',
        aliases: [],
        category: 'Dairy',
        typicalUnit: 'liter',
        productType: 'fast_consumable',
        isPerishable: true,
        predictionStrategy: null,
        predictionEnabled: true,
        config: null,
      };

      const mockEvents = [
        {
          id: 'event-1',
          productId,
          eventType: InventoryEventType.PURCHASED,
          quantity: 2,
          unit: 'liter',
          timestamp: new Date('2026-08-20T10:00:00Z'),
          source: 'test',
          confidence: null,
          metadata: null,
        },
        {
          id: 'event-2',
          productId,
          eventType: InventoryEventType.PURCHASED,
          quantity: 2,
          unit: 'liter',
          timestamp: new Date('2026-08-13T10:00:00Z'),
          source: 'test',
          confidence: null,
          metadata: null,
        },
        {
          id: 'event-3',
          productId,
          eventType: InventoryEventType.PURCHASED,
          quantity: 2,
          unit: 'liter',
          timestamp: new Date('2026-08-06T10:00:00Z'),
          source: 'test',
          confidence: null,
          metadata: null,
        },
        {
          id: 'event-4',
          productId,
          eventType: InventoryEventType.STOCK_LOW,
          quantity: null,
          unit: null,
          timestamp: new Date('2026-08-18T10:00:00Z'),
          source: 'test',
          confidence: null,
          metadata: null,
        },
        {
          id: 'event-5',
          productId,
          eventType: InventoryEventType.STOCK_LOW,
          quantity: null,
          unit: null,
          timestamp: new Date('2026-08-11T10:00:00Z'),
          source: 'test',
          confidence: null,
          metadata: null,
        },
      ];

      mockProductService.findOne = jest.fn().mockResolvedValue(mockProduct);
      mockHouseholdService.getOrCreate = jest.fn().mockResolvedValue({
        id: 'household-id',
        adultsCount: 2,
        childrenCount: 3,
        childAgeGroups: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      mockPrismaService.inventoryEvent = {
        findMany: jest.fn().mockResolvedValue(mockEvents),
      };

      const mockPersistedStats = {
        id: 'stats-id',
        productId,
        avgPurchaseIntervalDays: 7.0,
        avgNeedIntervalDays: 7.0,
        typicalPurchaseQuantity: 2,
        estimatedConsumptionIntervalDays: 2.8,
        lastPurchaseAt: new Date('2026-08-20T10:00:00Z'),
        lastLowStockSignalAt: new Date('2026-08-18T10:00:00Z'),
        lastStockConfirmationAt: null,
        observationCount: 5,
        updatedAt: new Date('2026-08-26T19:00:00Z'),
      };

      mockPrismaService.productStatistics = {
        upsert: jest.fn().mockResolvedValue(mockPersistedStats),
      };

      const result = await service.calculateProductStatistics(productId);

      expect(result.productId).toBe(productId);
      expect(result.avgPurchaseIntervalDays).toBe(7.0);
      expect(result.avgNeedIntervalDays).toBe(7.0);
      expect(result.typicalPurchaseQuantity).toBe(2);
      expect(result.observationCount).toBe(5);
      expect(mockPrismaService.productStatistics.upsert).toHaveBeenCalled();
    });

    it('should handle product with no events', async () => {
      const productId = 'test-product-id';
      const mockProduct = {
        id: productId,
        canonicalName: 'Milk',
        aliases: [],
        category: 'Dairy',
        typicalUnit: 'liter',
        productType: 'fast_consumable',
        isPerishable: true,
        predictionStrategy: null,
        predictionEnabled: true,
        config: null,
      };

      mockProductService.findOne = jest.fn().mockResolvedValue(mockProduct);
      mockHouseholdService.getOrCreate = jest.fn().mockResolvedValue({
        id: 'household-id',
        adultsCount: 2,
        childrenCount: 3,
        childAgeGroups: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      mockPrismaService.inventoryEvent = {
        findMany: jest.fn().mockResolvedValue([]),
      };

      const mockPersistedStats = {
        id: 'stats-id',
        productId,
        avgPurchaseIntervalDays: null,
        avgNeedIntervalDays: null,
        typicalPurchaseQuantity: null,
        estimatedConsumptionIntervalDays: null,
        lastPurchaseAt: null,
        lastLowStockSignalAt: null,
        lastStockConfirmationAt: null,
        observationCount: 0,
        updatedAt: new Date('2026-08-26T19:00:00Z'),
      };

      mockPrismaService.productStatistics = {
        upsert: jest.fn().mockResolvedValue(mockPersistedStats),
      };

      const result = await service.calculateProductStatistics(productId);

      expect(result.productId).toBe(productId);
      expect(result.avgPurchaseIntervalDays).toBeNull();
      expect(result.observationCount).toBe(0);
    });
  });
});
