import { PATH_METADATA, METHOD_METADATA } from '@nestjs/common/constants';
import { RequestMethod } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PredictedState } from '../generated/prisma/enums';
import { PREDICTION_ENGINE } from '../estimation/prediction-engine';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';
import { LowStockRecommendationService } from './low-stock-recommendation.service';
import { PredictionFeedbackService } from './prediction-feedback.service';
import { InventoryEventType } from '../generated/prisma/enums';
import { PredictionFeedbackOutcome } from './dto/prediction-feedback.dto';
import { StockMutationOperation } from './types/stock-mutation';

describe('InventoryController low-stock recommendations', () => {
  let controller: InventoryController;
  let recommendationService: { getRecommendations: jest.Mock };

  beforeEach(async () => {
    recommendationService = { getRecommendations: jest.fn() };
    const module = await Test.createTestingModule({
      controllers: [InventoryController],
      providers: [
        { provide: InventoryService, useValue: {} },
        { provide: PredictionFeedbackService, useValue: {} },
        {
          provide: LowStockRecommendationService,
          useValue: recommendationService,
        },
        { provide: PREDICTION_ENGINE, useValue: {} },
      ],
    }).compile();

    controller = module.get(InventoryController);
  });

  it('delegates once and maps the stable response', async () => {
    recommendationService.getRecommendations.mockResolvedValue([
      {
        productId: 'product-1',
        productName: 'milk',
        predictionId: 'prediction-1',
        predictedState: PredictedState.probably_out,
        confidenceScore: 0.86,
        reason: 'Likely out',
        recommendedAction: null,
      },
    ]);

    await expect(controller.getLowStockRecommendations()).resolves.toEqual({
      recommendations: [
        {
          productId: 'product-1',
          productName: 'milk',
          predictionId: 'prediction-1',
          predictedState: PredictedState.probably_out,
          confidenceScore: 0.86,
          reason: 'Likely out',
          recommendedAction: null,
        },
      ],
    });
    expect(recommendationService.getRecommendations).toHaveBeenCalledTimes(1);
  });

  it('registers an exact static GET path distinct from product estimation', () => {
    const recommendationHandler =
      InventoryController.prototype.getLowStockRecommendations;
    const estimationHandler = InventoryController.prototype.estimateInventory;

    expect(Reflect.getMetadata(PATH_METADATA, recommendationHandler)).toBe(
      'predictions/low-stock',
    );
    expect(Reflect.getMetadata(METHOD_METADATA, recommendationHandler)).toBe(
      RequestMethod.GET,
    );
    expect(Reflect.getMetadata(PATH_METADATA, estimationHandler)).toBe(
      'estimate/:productId',
    );
  });
});

describe('InventoryController provenance', () => {
  const inventoryService = {
    recordEvent: jest.fn(),
    recordPurchase: jest.fn(),
    recordPurchases: jest.fn(),
    updateStock: jest.fn(),
    completePurchase: jest.fn(),
    completePartialPurchase: jest.fn(),
  };
  const predictionFeedbackService = { submitFeedback: jest.fn() };
  const controller = new InventoryController(
    inventoryService as unknown as InventoryService,
    predictionFeedbackService as unknown as PredictionFeedbackService,
    {} as LowStockRecommendationService,
    {} as never,
  );

  beforeEach(() => jest.clearAllMocks());

  it('supplies api provenance to inventory event writes', async () => {
    await controller.recordEvent({
      productId: '00000000-0000-4000-8000-000000000001',
      eventType: InventoryEventType.STOCK_LOW,
    });
    await controller.recordPurchase({
      productId: '00000000-0000-4000-8000-000000000001',
      eventType: InventoryEventType.PURCHASED,
    });

    expect(inventoryService.recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'api' }),
    );
    expect(inventoryService.recordPurchase).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'api' }),
    );
  });

  it('dispatches batch purchases without changing the existing route', async () => {
    const items = [
      { productId: '00000000-0000-4000-8000-000000000001', quantity: 2 },
    ];

    await controller.recordPurchase({
      items,
      purchasedAt: '2026-09-01T10:00:00.000Z',
    });

    expect(inventoryService.recordPurchases).toHaveBeenCalledWith({
      items,
      purchasedAt: '2026-09-01T10:00:00.000Z',
      source: 'api',
    });
    expect(inventoryService.recordPurchase).not.toHaveBeenCalled();
    expect(
      Reflect.getMetadata(
        PATH_METADATA,
        InventoryController.prototype.recordPurchase,
      ),
    ).toBe('purchases');
  });

  it.each([
    [StockMutationOperation.set, { quantity: 4, unit: 'liter' }],
    [StockMutationOperation.decrement, { quantity: 1, unit: 'liter' }],
    [StockMutationOperation.mark_out, {}],
  ])(
    'supplies api provenance to the %s stock operation',
    async (operation, fields) => {
      await controller.updateStock('00000000-0000-4000-8000-000000000001', {
        operation,
        ...fields,
      });

      expect(inventoryService.updateStock).toHaveBeenCalledWith({
        productId: '00000000-0000-4000-8000-000000000001',
        operation,
        ...fields,
        source: 'api',
      });
    },
  );

  it('supplies api provenance to purchase completion writes', async () => {
    await controller.completePurchase({
      productId: '00000000-0000-4000-8000-000000000001',
      groceryItemIds: ['00000000-0000-4000-8000-000000000002'],
    });
    await controller.completePartialPurchase({
      productId: '00000000-0000-4000-8000-000000000001',
      completeItemIds: ['00000000-0000-4000-8000-000000000002'],
    });

    expect(inventoryService.completePurchase).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'api' }),
    );
    expect(inventoryService.completePartialPurchase).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'api' }),
    );
  });

  it('supplies api provenance to prediction feedback', async () => {
    await controller.feedback('00000000-0000-4000-8000-000000000003', {
      outcome: PredictionFeedbackOutcome.accepted,
    });

    expect(predictionFeedbackService.submitFeedback).toHaveBeenCalledWith(
      '00000000-0000-4000-8000-000000000003',
      { outcome: PredictionFeedbackOutcome.accepted, source: 'api' },
    );
  });
});
