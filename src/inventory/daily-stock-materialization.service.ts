import { Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { InventoryEventType, PredictedState } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { materializeDailyStock } from './stock-materialization';

const EXPLICIT_STATES = [
  InventoryEventType.STOCK_LOW,
  InventoryEventType.STOCK_OUT,
];

@Injectable()
export class DailyStockMaterializationService {
  constructor(private readonly prisma: PrismaService) {}

  async evaluateProduct(productId: string, evaluatedAt: Date = new Date()) {
    const projection = await this.prisma.stockProjection.findUnique({
      where: { productId },
      select: {
        id: true,
        productId: true,
        estimatedQuantity: true,
        recordedAt: true,
        recordedEventId: true,
        evaluatedAt: true,
      },
    });
    if (!projection) return null;

    const [policy, statistics, latestExplicitSignal] = await Promise.all([
      this.prisma.productShelfLifePolicy.findUnique({
        where: { productId },
        select: { kind: true, shelfLifeDays: true, confidence: true },
      }),
      this.prisma.productStatistics.findUnique({
        where: { productId },
        select: { estimatedConsumptionIntervalDays: true },
      }),
      this.prisma.inventoryEvent.findFirst({
        where: {
          productId,
          eventType: { in: EXPLICIT_STATES },
          timestamp: { gte: projection.recordedAt, lte: evaluatedAt },
        },
        select: { eventType: true },
        orderBy: { timestamp: 'desc' },
      }),
    ]);
    const explicitState =
      latestExplicitSignal?.eventType === InventoryEventType.STOCK_OUT
        ? PredictedState.probably_out
        : latestExplicitSignal?.eventType === InventoryEventType.STOCK_LOW
          ? PredictedState.probably_low
          : null;
    const result = materializeDailyStock({
      estimatedQuantity: projection.estimatedQuantity,
      recordedAt: projection.recordedAt,
      previousEvaluatedAt: projection.evaluatedAt,
      evaluatedAt,
      shelfLifePolicy: policy,
      estimatedConsumptionIntervalDays:
        statistics?.estimatedConsumptionIntervalDays ?? null,
      explicitState,
    });

    return this.prisma.$transaction(async (tx) => {
      const prediction = await tx.prediction.create({
        data: {
          productId,
          predictedState: result.estimatedState,
          confidenceScore: result.confidence,
          predictedAt: result.evaluatedAt,
          reason: result.reason,
          recommendedAction: null,
          deterministicSignals: {
            source: 'daily_stock_workflow',
            previousEvaluatedAt: projection.evaluatedAt.toISOString(),
            evaluatedAt: result.evaluatedAt.toISOString(),
            recordedAt: projection.recordedAt.toISOString(),
            elapsedDays: result.elapsedDays,
            expectedConsumption: result.expectedConsumption,
            estimatedConsumptionIntervalDays:
              statistics?.estimatedConsumptionIntervalDays ?? null,
            shelfLifePolicy: policy
              ? {
                  kind: policy.kind,
                  shelfLifeDays: policy.shelfLifeDays,
                  confidence: policy.confidence,
                }
              : null,
            explicitState,
          } satisfies Prisma.InputJsonObject,
        },
      });
      const updated = await tx.stockProjection.updateMany({
        where: {
          id: projection.id,
          recordedEventId: projection.recordedEventId,
          evaluatedAt: projection.evaluatedAt,
        },
        data: {
          estimatedQuantity: result.estimatedQuantity,
          estimatedState: result.estimatedState,
          confidence: result.confidence,
          reason: result.reason,
          predictionId: prediction.id,
          evaluatedAt: result.evaluatedAt,
        },
      });
      if (updated.count !== 1) {
        throw new Error('Stock projection changed during daily evaluation');
      }
      return { ...result, predictionId: prediction.id };
    });
  }
}
