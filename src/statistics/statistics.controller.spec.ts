import { Test, TestingModule } from '@nestjs/testing';
import { StatisticsController } from './statistics.controller';
import { StatisticsService } from './statistics.service';
import { NotFoundException } from '@nestjs/common';

describe('StatisticsController', () => {
  let controller: StatisticsController;
  let service: StatisticsService;

  const mockStatisticsService = {
    calculateProductStatistics: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [StatisticsController],
      providers: [
        { provide: StatisticsService, useValue: mockStatisticsService },
      ],
    }).compile();

    controller = module.get<StatisticsController>(StatisticsController);
    service = module.get<StatisticsService>(StatisticsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('calculate', () => {
    it('should return statistics for valid product', async () => {
      const productId = 'product-id';
      const mockResult = {
        productId,
        avgPurchaseIntervalDays: 7.5,
        avgNeedIntervalDays: 10.2,
        typicalPurchaseQuantity: 2.0,
        estimatedConsumptionIntervalDays: 3.0,
        observationCount: 12,
        lastPurchaseAt: new Date('2026-08-20T10:00:00Z'),
        lastLowStockSignalAt: new Date('2026-08-25T14:00:00Z'),
        lastStockConfirmationAt: null,
        updatedAt: new Date('2026-08-26T19:00:00Z'),
      };

      mockStatisticsService.calculateProductStatistics.mockResolvedValue(
        mockResult,
      );

      const result = await controller.calculate(productId);

      expect(result.productId).toBe(productId);
      expect(result.avgPurchaseIntervalDays).toBe(7.5);
      expect(result.observationCount).toBe(12);
      expect(service.calculateProductStatistics).toHaveBeenCalledWith(productId);
    });

    it('should throw NotFoundException for unknown product', async () => {
      const productId = 'unknown-id';
      mockStatisticsService.calculateProductStatistics.mockRejectedValue(
        new NotFoundException('Product not found'),
      );

      await expect(controller.calculate(productId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw InternalServerErrorException on calculation failure', async () => {
      const productId = 'product-id';
      mockStatisticsService.calculateProductStatistics.mockRejectedValue(
        new Error('Database error'),
      );

      await expect(controller.calculate(productId)).rejects.toThrow(
        'Failed to calculate product statistics',
      );
    });
  });
});
