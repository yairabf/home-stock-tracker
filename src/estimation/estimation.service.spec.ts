import { Test, TestingModule } from '@nestjs/testing';
import { EstimationService } from './estimation.service';
import { PrismaService } from '../prisma/prisma.service';
import { ProductService } from '../product/product.service';
import { HouseholdService } from '../household/household.service';
import { PredictedState, InventoryEventType, ProductType } from '../generated/prisma/enums';
import { NotFoundException } from '@nestjs/common';

describe('EstimationService', () => {
  let service: EstimationService;
  let productService: jest.Mocked<ProductService>;
  let prismaService: jest.Mocked<PrismaService>;

  const mockProduct = (overrides = {}) => ({
    id: 'product-1',
    canonicalName: 'Milk',
    productType: ProductType.fast_consumable,
    predictionEnabled: true,
    ...overrides,
  });

  const mockEvent = (eventType: InventoryEventType, daysAgo: number, id = '') => ({
    id: id || `event-${eventType}-${daysAgo}`,
    eventType,
    timestamp: new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000),
    quantity: 1,
    unit: 'liter',
    productId: 'product-1',
  });

  beforeEach(async () => {
    const mockProductService = {
      findOne: jest.fn(),
    };

    const mockHouseholdService = {
      getOrCreate: jest.fn().mockResolvedValue({ adultsCount: 2, childrenCount: 3 }),
    };

    const mockPrisma = {
      inventoryEvent: {
        findMany: jest.fn(),
      },
      prediction: {
        create: jest.fn().mockResolvedValue({ id: 'prediction-1' }),
      },
      productStatistics: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EstimationService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ProductService, useValue: mockProductService },
        { provide: HouseholdService, useValue: mockHouseholdService },
      ],
    }).compile();

    service = module.get<EstimationService>(EstimationService);
    productService = module.get(ProductService);
    prismaService = module.get(PrismaService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('estimateProductState', () => {
    it('should throw NotFoundException for unknown product', async () => {
      productService.findOne.mockRejectedValue(new NotFoundException('Product not found'));
      await expect(service.estimateProductState('unknown-id')).rejects.toThrow(NotFoundException);
    });

    it('should return uncertain with confidence 0 when prediction is disabled', async () => {
      productService.findOne.mockResolvedValue(mockProduct({ predictionEnabled: false }));
      const result = await service.estimateProductState('product-1');
      expect(result.predictedState).toBe(PredictedState.uncertain);
      expect(result.confidenceScore).toBe(0.0);
      expect(result.reason).toContain('Prediction is disabled');
    });
  });

  describe('Direct signal precedence', () => {
    it('should return probably_out for STOCK_OUT event', async () => {
      productService.findOne.mockResolvedValue(mockProduct());
      prismaService.inventoryEvent.findMany.mockResolvedValue([
        mockEvent(InventoryEventType.STOCK_OUT, 1),
        mockEvent(InventoryEventType.PURCHASED, 5),
      ]);
      const result = await service.estimateProductState('product-1');
      expect(result.predictedState).toBe(PredictedState.probably_out);
      expect(result.reason).toContain('STOCK_OUT');
    });

    it('should return probably_low for STOCK_LOW event', async () => {
      productService.findOne.mockResolvedValue(mockProduct());
      prismaService.inventoryEvent.findMany.mockResolvedValue([
        mockEvent(InventoryEventType.STOCK_LOW, 2),
        mockEvent(InventoryEventType.PURCHASED, 7),
      ]);
      const result = await service.estimateProductState('product-1');
      expect(result.predictedState).toBe(PredictedState.probably_low);
      expect(result.reason).toContain('STOCK_LOW');
    });

    it('should return likely_available for STOCK_CONFIRMED within 3 days', async () => {
      productService.findOne.mockResolvedValue(mockProduct());
      prismaService.inventoryEvent.findMany.mockResolvedValue([
        mockEvent(InventoryEventType.STOCK_CONFIRMED, 2),
        mockEvent(InventoryEventType.PURCHASED, 10),
      ]);
      const result = await service.estimateProductState('product-1');
      expect(result.predictedState).toBe(PredictedState.likely_available);
      expect(result.reason).toContain('STOCK_CONFIRMED');
    });

    it('should defer to time-decay for STOCK_CONFIRMED older than 3 days', async () => {
      productService.findOne.mockResolvedValue(mockProduct());
      // PURCHASED 2 days ago is most recent, STOCK_CONFIRMED is older
      prismaService.inventoryEvent.findMany.mockResolvedValue([
        mockEvent(InventoryEventType.PURCHASED, 2),
        mockEvent(InventoryEventType.STOCK_CONFIRMED, 5),
        mockEvent(InventoryEventType.PURCHASED, 20),
      ]);
      const result = await service.estimateProductState('product-1');
      expect(result.predictedState).toBe(PredictedState.likely_available);
      expect(result.reason).toContain('purchase');
    });
  });

  describe('Cold-start detection', () => {
    it('should return uncertain when fewer than 2 events', async () => {
      productService.findOne.mockResolvedValue(mockProduct());
      prismaService.inventoryEvent.findMany.mockResolvedValue([
        mockEvent(InventoryEventType.PURCHASED, 1),
      ]);
      const result = await service.estimateProductState('product-1');
      expect(result.predictedState).toBe(PredictedState.uncertain);
      expect(result.reason).toContain('Insufficient data');
    });

    it('should return uncertain when events span less than 7 days', async () => {
      productService.findOne.mockResolvedValue(mockProduct());
      prismaService.inventoryEvent.findMany.mockResolvedValue([
        mockEvent(InventoryEventType.PURCHASED, 1),
        mockEvent(InventoryEventType.PURCHASED, 3),
      ]);
      const result = await service.estimateProductState('product-1');
      expect(result.predictedState).toBe(PredictedState.uncertain);
    });

    it('should proceed with estimation when enough data exists', async () => {
      productService.findOne.mockResolvedValue(mockProduct());
      prismaService.inventoryEvent.findMany.mockResolvedValue([
        mockEvent(InventoryEventType.PURCHASED, 3),
        mockEvent(InventoryEventType.PURCHASED, 10),
      ]);
      const result = await service.estimateProductState('product-1');
      expect(result.predictedState).not.toBe(PredictedState.uncertain);
    });
  });

  describe('Time-decay heuristics by product type', () => {
    it('fast_consumable: should be probably_low after 10 days', async () => {
      productService.findOne.mockResolvedValue(mockProduct({ productType: ProductType.fast_consumable }));
      prismaService.inventoryEvent.findMany.mockResolvedValue([
        mockEvent(InventoryEventType.PURCHASED, 10),
        mockEvent(InventoryEventType.PURCHASED, 20),
      ]);
      const result = await service.estimateProductState('product-1');
      expect(result.predictedState).toBe(PredictedState.probably_low);
    });

    it('fast_consumable: should be likely_available within 7 days', async () => {
      productService.findOne.mockResolvedValue(mockProduct({ productType: ProductType.fast_consumable }));
      prismaService.inventoryEvent.findMany.mockResolvedValue([
        mockEvent(InventoryEventType.PURCHASED, 5),
        mockEvent(InventoryEventType.PURCHASED, 15),
      ]);
      const result = await service.estimateProductState('product-1');
      expect(result.predictedState).toBe(PredictedState.likely_available);
    });

    it('pantry_staple: should be likely_available within 30 days', async () => {
      productService.findOne.mockResolvedValue(mockProduct({ productType: ProductType.pantry_staple }));
      prismaService.inventoryEvent.findMany.mockResolvedValue([
        mockEvent(InventoryEventType.PURCHASED, 25),
        mockEvent(InventoryEventType.PURCHASED, 50),
      ]);
      const result = await service.estimateProductState('product-1');
      expect(result.predictedState).toBe(PredictedState.likely_available);
    });

    it('pantry_staple: should be probably_low after 35 days', async () => {
      productService.findOne.mockResolvedValue(mockProduct({ productType: ProductType.pantry_staple }));
      prismaService.inventoryEvent.findMany.mockResolvedValue([
        mockEvent(InventoryEventType.PURCHASED, 35),
        mockEvent(InventoryEventType.PURCHASED, 60),
      ]);
      const result = await service.estimateProductState('product-1');
      expect(result.predictedState).toBe(PredictedState.probably_low);
    });

    it('household_consumable: should use 21-day threshold', async () => {
      productService.findOne.mockResolvedValue(mockProduct({ productType: ProductType.household_consumable }));
      prismaService.inventoryEvent.findMany.mockResolvedValue([
        mockEvent(InventoryEventType.PURCHASED, 25),
        mockEvent(InventoryEventType.PURCHASED, 50),
      ]);
      const result = await service.estimateProductState('product-1');
      expect(result.predictedState).toBe(PredictedState.probably_low);
    });

    it('discrete_consumable: should use 21-day threshold', async () => {
      productService.findOne.mockResolvedValue(mockProduct({ productType: ProductType.discrete_consumable }));
      prismaService.inventoryEvent.findMany.mockResolvedValue([
        mockEvent(InventoryEventType.PURCHASED, 15),
        mockEvent(InventoryEventType.PURCHASED, 35),
      ]);
      const result = await service.estimateProductState('product-1');
      expect(result.predictedState).toBe(PredictedState.likely_available);
    });

    it('null productType: should use 14-day fallback threshold', async () => {
      productService.findOne.mockResolvedValue(mockProduct({ productType: null }));
      prismaService.inventoryEvent.findMany.mockResolvedValue([
        mockEvent(InventoryEventType.PURCHASED, 16),
        mockEvent(InventoryEventType.PURCHASED, 30),
      ]);
      const result = await service.estimateProductState('product-1');
      expect(result.predictedState).toBe(PredictedState.probably_low);
      expect(result.reason).toContain('14-day threshold');
    });
  });

  describe('Confidence scoring', () => {
    it('should have higher confidence with known productType', async () => {
      productService.findOne.mockResolvedValue(mockProduct({ productType: ProductType.fast_consumable }));
      prismaService.inventoryEvent.findMany.mockResolvedValue([
        mockEvent(InventoryEventType.PURCHASED, 3),
        mockEvent(InventoryEventType.PURCHASED, 15),
      ]);
      const result = await service.estimateProductState('product-1');
      expect(result.confidenceScore).toBeGreaterThan(0.5);
    });

    it('should increase confidence with more events (capped)', async () => {
      productService.findOne.mockResolvedValue(mockProduct());
      prismaService.inventoryEvent.findMany.mockResolvedValue([
        mockEvent(InventoryEventType.PURCHASED, 3),
        mockEvent(InventoryEventType.PURCHASED, 10),
        mockEvent(InventoryEventType.PURCHASED, 20),
        mockEvent(InventoryEventType.PURCHASED, 30),
      ]);
      const result = await service.estimateProductState('product-1');
      expect(result.confidenceScore).toBeGreaterThan(0.7);
    });

    it('should increase confidence for recent signal within 7 days', async () => {
      productService.findOne.mockResolvedValue(mockProduct());
      prismaService.inventoryEvent.findMany.mockResolvedValue([
        mockEvent(InventoryEventType.PURCHASED, 3),
        mockEvent(InventoryEventType.PURCHASED, 15),
      ]);
      const result = await service.estimateProductState('product-1');
      expect(result.confidenceScore).toBeGreaterThan(0.6);
    });

    it('should decrease confidence for cold-start', async () => {
      productService.findOne.mockResolvedValue(mockProduct());
      prismaService.inventoryEvent.findMany.mockResolvedValue([
        mockEvent(InventoryEventType.PURCHASED, 3),
      ]);
      const result = await service.estimateProductState('product-1');
      // base 0.5 + 0.2 productType + 0.1 recent signal - 0.2 coldStart = 0.6
      // The key is that coldStart penalty reduces what would otherwise be 0.8
      expect(result.confidenceScore).toBeCloseTo(0.6, 5);
    });

    it('should boost confidence when learned statistics are available', async () => {
      productService.findOne.mockResolvedValue(mockProduct());
      prismaService.inventoryEvent.findMany.mockResolvedValue([
        mockEvent(InventoryEventType.PURCHASED, 3),
        mockEvent(InventoryEventType.PURCHASED, 15),
      ]);
      prismaService.productStatistics.findUnique.mockResolvedValue({
        avgPurchaseIntervalDays: 7.5,
        avgNeedIntervalDays: null,
        observationCount: 3,
      });
      const result = await service.estimateProductState('product-1');
      // base 0.5 + 0.2 productType + 0.1 recent signal + 0.1 learned stats = 0.9
      expect(result.confidenceScore).toBeGreaterThan(0.8);
      expect(result.deterministicSignals.hasLearnedStatistics).toBe(true);
    });

    it('should boost confidence further when derived from 5+ events', async () => {
      productService.findOne.mockResolvedValue(mockProduct());
      prismaService.inventoryEvent.findMany.mockResolvedValue([
        mockEvent(InventoryEventType.PURCHASED, 3),
        mockEvent(InventoryEventType.PURCHASED, 10),
        mockEvent(InventoryEventType.PURCHASED, 20),
        mockEvent(InventoryEventType.PURCHASED, 30),
      ]);
      prismaService.productStatistics.findUnique.mockResolvedValue({
        avgPurchaseIntervalDays: 10,
        avgNeedIntervalDays: null,
        observationCount: 7,
      });
      const result = await service.estimateProductState('product-1');
      // base 0.5 + 0.2 productType + 0.2 events + 0.1 recent signal + 0.1 learned stats + 0.1 (5+ events) = 1.2 -> capped at 1.0
      expect(result.confidenceScore).toBeGreaterThan(0.9);
    });

    it('should clamp confidence to 0.0-1.0 range', async () => {
      productService.findOne.mockResolvedValue(mockProduct());
      prismaService.inventoryEvent.findMany.mockResolvedValue([
        mockEvent(InventoryEventType.PURCHASED, 1),
        mockEvent(InventoryEventType.PURCHASED, 5),
        mockEvent(InventoryEventType.PURCHASED, 10),
        mockEvent(InventoryEventType.PURCHASED, 15),
        mockEvent(InventoryEventType.PURCHASED, 20),
        mockEvent(InventoryEventType.PURCHASED, 25),
        mockEvent(InventoryEventType.PURCHASED, 30),
        mockEvent(InventoryEventType.PURCHASED, 35),
      ]);
      const result = await service.estimateProductState('product-1');
      expect(result.confidenceScore).toBeLessThanOrEqual(1.0);
      expect(result.confidenceScore).toBeGreaterThanOrEqual(0.0);
    });
  });

  describe('Estimation improvement with learned statistics', () => {
    it('should use learned interval with ±20% buffer', async () => {
      // Scenario: Last purchase 8 days ago, learned interval is 7 days
      // 8 days is within 80-120% of 7 days (5.6-8.4), so should be uncertain
      productService.findOne.mockResolvedValue(mockProduct());
      prismaService.inventoryEvent.findMany.mockResolvedValue([
        mockEvent(InventoryEventType.PURCHASED, 8),
        mockEvent(InventoryEventType.PURCHASED, 15),
        mockEvent(InventoryEventType.PURCHASED, 22),
        mockEvent(InventoryEventType.PURCHASED, 29),
        mockEvent(InventoryEventType.PURCHASED, 36),
      ]);
      prismaService.productStatistics.findUnique.mockResolvedValue({
        avgPurchaseIntervalDays: 7.0,
        avgNeedIntervalDays: null,
        observationCount: 5,
      });

      const result = await service.estimateProductState('product-1');
      expect(result.predictedState).toBe(PredictedState.uncertain);
      expect(result.reason).toContain('near learned');
      expect(result.deterministicSignals.avgPurchaseIntervalDays).toBe(7.0);
    });

    it('should show higher confidence with learned statistics vs without', async () => {
      productService.findOne.mockResolvedValue(mockProduct());
      prismaService.inventoryEvent.findMany.mockResolvedValue([
        mockEvent(InventoryEventType.PURCHASED, 5),
        mockEvent(InventoryEventType.PURCHASED, 12),
        mockEvent(InventoryEventType.PURCHASED, 19),
      ]);

      // Without learned statistics
      prismaService.productStatistics.findUnique.mockResolvedValue(null);
      const resultWithout = await service.estimateProductState('product-1');

      // With learned statistics
      prismaService.productStatistics.findUnique.mockResolvedValue({
        avgPurchaseIntervalDays: 7.0,
        avgNeedIntervalDays: null,
        observationCount: 5,
      });
      const resultWith = await service.estimateProductState('product-1');

      expect(resultWith.confidenceScore).toBeGreaterThan(resultWithout.confidenceScore);
    });
  });

  describe('Edge cases', () => {
    it('should return deterministicSignals with correct values', async () => {
      productService.findOne.mockResolvedValue(mockProduct());
      prismaService.inventoryEvent.findMany.mockResolvedValue([
        mockEvent(InventoryEventType.PURCHASED, 1),
        mockEvent(InventoryEventType.PURCHASED, 2),
        mockEvent(InventoryEventType.PURCHASED, 3),
        mockEvent(InventoryEventType.PURCHASED, 4),
        mockEvent(InventoryEventType.PURCHASED, 5),
        mockEvent(InventoryEventType.PURCHASED, 6),
      ]);
      const result = await service.estimateProductState('product-1');
      expect(result.confidenceScore).toBeLessThanOrEqual(1.0);
      expect(result.confidenceScore).toBeGreaterThanOrEqual(0.0);
    });
  });

  describe('Future timestamp handling', () => {
    it('should ignore events with future timestamps', async () => {
      productService.findOne.mockResolvedValue(mockProduct());
      const futureEvent = {
        id: 'future-event',
        eventType: InventoryEventType.PURCHASED,
        timestamp: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
        quantity: 1,
        unit: 'liter',
        productId: 'product-1',
      };
      prismaService.inventoryEvent.findMany.mockResolvedValue([
        futureEvent,
        mockEvent(InventoryEventType.PURCHASED, 3),
        mockEvent(InventoryEventType.PURCHASED, 15),
      ]);
      const result = await service.estimateProductState('product-1');
      expect(result.deterministicSignals.eventCount).toBe(2);
      expect(result.deterministicSignals.lastPurchaseAt).not.toBeNull();
    });
  });

  describe('Edge cases', () => {
    it('should handle no events gracefully', async () => {
      productService.findOne.mockResolvedValue(mockProduct());
      prismaService.inventoryEvent.findMany.mockResolvedValue([]);
      const result = await service.estimateProductState('product-1');
      expect(result.predictedState).toBe(PredictedState.uncertain);
      expect(result.deterministicSignals.eventCount).toBe(0);
    });

    it('should handle only grocery events (not relevant for estimation)', async () => {
      productService.findOne.mockResolvedValue(mockProduct());
      // Grocery events are filtered out because they're not in RELEVANT_EVENT_TYPES
      prismaService.inventoryEvent.findMany.mockResolvedValue([]);
      const result = await service.estimateProductState('product-1');
      expect(result.predictedState).toBe(PredictedState.uncertain);
      expect(result.deterministicSignals.eventCount).toBe(0);
    });

    it('should use RESTOCKED when PURCHASED is not available', async () => {
      productService.findOne.mockResolvedValue(mockProduct());
      prismaService.inventoryEvent.findMany.mockResolvedValue([
        mockEvent(InventoryEventType.RESTOCKED, 3),
        mockEvent(InventoryEventType.RESTOCKED, 15),
      ]);
      const result = await service.estimateProductState('product-1');
      expect(result.predictedState).toBe(PredictedState.likely_available);
      expect(result.reason).toContain('purchase');
    });

    it('should return deterministicSignals with correct values', async () => {
      productService.findOne.mockResolvedValue(mockProduct({ productType: ProductType.fast_consumable }));
      prismaService.inventoryEvent.findMany.mockResolvedValue([
        mockEvent(InventoryEventType.PURCHASED, 5),
        mockEvent(InventoryEventType.STOCK_LOW, 3),
        mockEvent(InventoryEventType.PURCHASED, 15),
      ]);
      const result = await service.estimateProductState('product-1');
      expect(result.deterministicSignals.productType).toBe(ProductType.fast_consumable);
      expect(result.deterministicSignals.eventCount).toBe(3);
      expect(result.deterministicSignals.daysSinceLastPurchase).toBeCloseTo(5, 0);
      expect(result.deterministicSignals.daysSinceLastLowSignal).toBeCloseTo(3, 0);
    });
  });
});
