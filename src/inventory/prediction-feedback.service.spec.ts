import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  FeedbackStatus,
  InventoryEventType,
  PredictedState,
} from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { PredictionFeedbackOutcome } from './dto/prediction-feedback.dto';
import { PredictionFeedbackService } from './prediction-feedback.service';

describe('PredictionFeedbackService', () => {
  let service: PredictionFeedbackService;
  let tx: any;

  beforeEach(async () => {
    tx = {
      prediction: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'prediction-1',
          productId: 'product-1',
          predictedState: PredictedState.probably_low,
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        count: jest.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(1),
      },
      inventoryEvent: {
        create: jest.fn().mockResolvedValue({ id: 'event-1' }),
      },
      productStatistics: {
        upsert: jest.fn().mockResolvedValue({}),
      },
    };
    const prisma = {
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) =>
        callback(tx),
      ),
    };
    const module = await Test.createTestingModule({
      providers: [
        PredictionFeedbackService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = module.get(PredictionFeedbackService);
  });

  it.each([
    [
      PredictionFeedbackOutcome.accepted,
      FeedbackStatus.accepted,
      InventoryEventType.PREDICTION_ACCEPTED,
    ],
    [
      PredictionFeedbackOutcome.rejected,
      FeedbackStatus.rejected,
      InventoryEventType.PREDICTION_REJECTED,
    ],
  ])('records %s feedback atomically', async (outcome, status, eventType) => {
    const result = await service.submitFeedback('prediction-1', {
      outcome,
      source: 'api',
    });

    expect(tx.prediction.updateMany).toHaveBeenCalledWith({
      where: { id: 'prediction-1', feedbackStatus: FeedbackStatus.pending },
      data: { feedbackStatus: status },
    });
    expect(tx.inventoryEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ eventType, source: 'api' }),
    });
    expect(result).toMatchObject({
      feedbackStatus: status,
      predictionAccuracy: 0.5,
    });
  });

  it('stores a correction as one rejected STOCK_CORRECTED event', async () => {
    await service.submitFeedback('prediction-1', {
      outcome: PredictionFeedbackOutcome.corrected,
      correctedState: PredictedState.probably_out,
      source: 'hermes_whatsapp',
    });

    expect(tx.inventoryEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eventType: InventoryEventType.STOCK_CORRECTED,
        metadata: expect.objectContaining({
          predictionId: 'prediction-1',
          predictedState: PredictedState.probably_low,
          correctedState: PredictedState.probably_out,
          outcome: PredictionFeedbackOutcome.corrected,
        }),
      }),
    });
    expect(tx.productStatistics.upsert).toHaveBeenCalledWith({
      where: { productId: 'product-1' },
      create: { productId: 'product-1', predictionAccuracy: 0.5 },
      update: { predictionAccuracy: 0.5 },
    });
  });

  it('rejects a correction equal to the original state', async () => {
    await expect(
      service.submitFeedback('prediction-1', {
        outcome: PredictionFeedbackOutcome.corrected,
        correctedState: PredictedState.probably_low,
        source: 'api',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.prediction.updateMany).not.toHaveBeenCalled();
  });

  it('returns 404 for an unknown prediction', async () => {
    tx.prediction.findUnique.mockResolvedValue(null);
    await expect(
      service.submitFeedback('missing', {
        outcome: PredictionFeedbackOutcome.accepted,
        source: 'api',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns 409 when a concurrent or repeated submission wins first', async () => {
    tx.prediction.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      service.submitFeedback('prediction-1', {
        outcome: PredictionFeedbackOutcome.accepted,
        source: 'api',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(tx.inventoryEvent.create).not.toHaveBeenCalled();
  });

  it('stops the transaction when the audit event cannot be written', async () => {
    tx.inventoryEvent.create.mockRejectedValue(new Error('write failed'));

    await expect(
      service.submitFeedback('prediction-1', {
        outcome: PredictionFeedbackOutcome.accepted,
        source: 'api',
      }),
    ).rejects.toThrow('write failed');
    expect(tx.productStatistics.upsert).not.toHaveBeenCalled();
  });
});
