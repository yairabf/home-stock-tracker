import { PATH_METADATA, METHOD_METADATA } from '@nestjs/common/constants';
import { RequestMethod } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PredictedState } from '../generated/prisma/enums';
import { PREDICTION_ENGINE } from '../estimation/prediction-engine';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';
import { LowStockRecommendationService } from './low-stock-recommendation.service';
import { PredictionFeedbackService } from './prediction-feedback.service';

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
