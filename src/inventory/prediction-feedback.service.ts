import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import {
  FeedbackStatus,
  InventoryEventType,
  PredictedState,
} from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import {
  PredictionFeedbackDto,
  PredictionFeedbackOutcome,
} from './dto/prediction-feedback.dto';
import { PredictionFeedbackResponseDto } from './dto/prediction-feedback-response.dto';

@Injectable()
export class PredictionFeedbackService {
  constructor(private readonly prisma: PrismaService) {}

  async submitFeedback(
    predictionId: string,
    dto: PredictionFeedbackDto & { source: string },
  ): Promise<PredictionFeedbackResponseDto> {
    return this.prisma.$transaction(async (tx) => {
      const prediction = await tx.prediction.findUnique({
        where: { id: predictionId },
      });
      if (!prediction) {
        throw new NotFoundException('Prediction not found');
      }

      this.validateCorrection(dto, prediction.predictedState);
      const feedbackStatus =
        dto.outcome === PredictionFeedbackOutcome.accepted
          ? FeedbackStatus.accepted
          : FeedbackStatus.rejected;
      const updated = await tx.prediction.updateMany({
        where: { id: predictionId, feedbackStatus: FeedbackStatus.pending },
        data: { feedbackStatus },
      });
      if (updated.count !== 1) {
        throw new ConflictException('Prediction feedback was already recorded');
      }

      const event = await tx.inventoryEvent.create({
        data: {
          productId: prediction.productId,
          eventType: this.eventTypeFor(dto.outcome),
          source: dto.source,
          metadata: {
            predictionId,
            predictedState: prediction.predictedState,
            outcome: dto.outcome,
            ...(dto.correctedState && {
              correctedState: dto.correctedState,
            }),
          } as Prisma.InputJsonValue,
        },
      });

      const [acceptedCount, rejectedCount] = await Promise.all([
        tx.prediction.count({
          where: {
            productId: prediction.productId,
            feedbackStatus: FeedbackStatus.accepted,
          },
        }),
        tx.prediction.count({
          where: {
            productId: prediction.productId,
            feedbackStatus: FeedbackStatus.rejected,
          },
        }),
      ]);
      const predictionAccuracy =
        acceptedCount / (acceptedCount + rejectedCount);
      await tx.productStatistics.upsert({
        where: { productId: prediction.productId },
        create: { productId: prediction.productId, predictionAccuracy },
        update: { predictionAccuracy },
      });

      return {
        predictionId,
        productId: prediction.productId,
        feedbackStatus,
        outcome: dto.outcome,
        correctedState: dto.correctedState ?? null,
        feedbackEventId: event.id,
        predictionAccuracy,
      };
    });
  }

  private validateCorrection(
    dto: PredictionFeedbackDto & { source: string },
    predictedState: PredictedState,
  ): void {
    if (
      dto.outcome === PredictionFeedbackOutcome.corrected &&
      dto.correctedState === predictedState
    ) {
      throw new BadRequestException(
        'correctedState must differ from the original predicted state',
      );
    }
  }

  private eventTypeFor(outcome: PredictionFeedbackOutcome): InventoryEventType {
    if (outcome === PredictionFeedbackOutcome.accepted) {
      return InventoryEventType.PREDICTION_ACCEPTED;
    }
    if (outcome === PredictionFeedbackOutcome.rejected) {
      return InventoryEventType.PREDICTION_REJECTED;
    }
    return InventoryEventType.STOCK_CORRECTED;
  }
}
