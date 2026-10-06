import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MODEL_CONFIG } from '../config/model-config.module';
import type { ModelConfig } from '../config/application-config';
import { OperationalLogger } from '../observability/operational-logger.service';
import { composeJevStockAdvice } from '../estimation/stock-prediction-policy';
import { finalizeCandidate } from '../estimation/hybrid-calculation';
import type { EstimationResult } from '../estimation/types/estimation-result';
import type { DeterministicPredictionCandidate } from '../estimation/types/prediction-result';
import { serializePredictionEvidence } from '../estimation/prediction-reasoning-input';
import { StockAdviceSnapshot } from './stock-advice-snapshot.service';
import type { ExecutedStockAdvice } from './stock-advice-executor.service';

export type StockAdviceApplication =
  'not_applied' | 'applied' | 'stale' | 'persistence_failed';
class StaleStockAdvice extends Error {}

@Injectable()
export class StockAdviceWriter {
  constructor(
    private readonly prisma: PrismaService,
    private readonly snapshots: StockAdviceSnapshot,
    @Inject(MODEL_CONFIG) private readonly model: ModelConfig,
    private readonly logger: OperationalLogger,
  ) {}

  async publish(
    executed: ExecutedStockAdvice,
  ): Promise<StockAdviceApplication> {
    let application: StockAdviceApplication = 'not_applied';
    let predictionId = executed.baseline.predictionId;
    if (executed.accepted && executed.advice && this.model.jevModel) {
      try {
        predictionId = await this.apply(executed);
        application = 'applied';
      } catch (error) {
        application =
          error instanceof StaleStockAdvice ||
          (error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === 'P2034')
            ? 'stale'
            : 'persistence_failed';
      }
    }
    await this.record(executed, application, predictionId);
    return application;
  }

  private async apply(executed: ExecutedStockAdvice): Promise<string> {
    const { baseline, advice } = executed;
    if (!advice) throw new StaleStockAdvice();
    return this.prisma.$transaction(
      async (tx) => {
        // Parent-first locks serialize metadata changes and event inserts before projection publication.
        await tx.$queryRaw`SELECT "id" FROM "Product" WHERE "id" = ${baseline.productId} FOR UPDATE`;
        await tx.$queryRaw`SELECT "id" FROM "StockProjection" WHERE "productId" = ${baseline.productId} FOR UPDATE`;
        await tx.$queryRaw`SELECT "id" FROM "ProductStatistics" WHERE "productId" = ${baseline.productId} FOR SHARE`;
        await tx.$queryRaw`SELECT "id" FROM "ProductShelfLifePolicy" WHERE "productId" = ${baseline.productId} FOR SHARE`;
        await tx.$queryRaw`SELECT "id" FROM "Household" FOR SHARE`;
        const snapshot = await this.snapshots.read(
          baseline,
          this.model.jevModel!,
          tx,
        );
        if (!snapshot || snapshot.fingerprint !== executed.snapshot.fingerprint)
          throw new StaleStockAdvice();
        const { result } = composeJevStockAdvice(
          snapshot.candidate,
          finalizeCandidate(baseline.productId, snapshot.candidate),
          advice,
        );
        if (!result.llmContributed) throw new StaleStockAdvice();
        const prediction = await this.createPrediction(
          tx,
          executed,
          snapshot.candidate,
          result,
        );
        const updated = await tx.stockProjection.updateMany({
          where: {
            id: baseline.projectionId,
            revision: baseline.revision,
            predictionId: baseline.predictionId,
          },
          data: {
            estimatedState: result.predictedState,
            confidence: result.confidenceScore,
            reason: result.reason,
            predictionId: prediction.id,
            revision: { increment: 1 },
          },
        });
        if (updated.count !== 1) throw new StaleStockAdvice();
        await tx.stockAdviceAttempt.update({
          where: { id: executed.attemptId },
          data: {
            applicationStatus: 'applied',
            appliedPredictionId: prediction.id,
          },
        });
        return prediction.id;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  private async createPrediction(
    tx: Prisma.TransactionClient,
    executed: ExecutedStockAdvice,
    candidate: DeterministicPredictionCandidate,
    result: EstimationResult,
  ) {
    const { baseline, advice } = executed;
    if (!advice) throw new StaleStockAdvice();
    const original = await tx.prediction.findUniqueOrThrow({
      where: { id: baseline.predictionId },
    });
    const signals = original.deterministicSignals;
    return tx.prediction.create({
      data: {
        productId: baseline.productId,
        predictedState: result.predictedState,
        confidenceScore: result.confidenceScore,
        reason: result.reason,
        recommendedAction: null,
        predictedAt: baseline.evaluatedAt,
        llmResult: advice.value,
        modelProviderVersion: `typesafe/${advice.model}`,
        deterministicSignals: {
          ...(signals !== null &&
          typeof signals === 'object' &&
          !Array.isArray(signals)
            ? signals
            : {}),
          stockAdvice: {
            version: 'daily-stock-advice-v1',
            attemptId: executed.attemptId,
            fingerprint: executed.snapshot.fingerprint,
            candidate: serializePredictionEvidence(candidate),
          },
        } as Prisma.InputJsonValue,
      },
    });
  }

  private async record(
    executed: ExecutedStockAdvice,
    application: StockAdviceApplication,
    predictionId: string,
  ): Promise<void> {
    const { advice, baseline, attemptId } = executed;
    try {
      if (application !== 'applied')
        await this.prisma.stockAdviceAttempt.update({
          where: { id: attemptId },
          data: { applicationStatus: application },
        });
      await this.prisma.llmInferenceLog.create({
        data: {
          predictionId,
          modelProvider: 'typesafe',
          modelVersion: advice?.model ?? this.model.jevModel!,
          promptVersion: 'daily-stock-advice-v1',
          confidence: advice?.value.confidence ?? null,
          structuredResponse: {
            version: 'daily-stock-advice-v1',
            task: 'stock_prediction',
            operationId: attemptId,
            accepted: executed.accepted,
            applicationStatus: application,
            status: advice ? 'validated' : 'unavailable',
            routingReason: advice
              ? executed.accepted
                ? 'accepted'
                : 'uncertain_or_low_confidence'
              : 'provider_unavailable_or_invalid',
            configuredModel: this.model.jevModel!,
            resolvedModel: advice?.model ?? null,
            value: advice?.value ?? null,
          },
        },
      });
    } catch {
      this.logger.predictionPersistence({
        outcome: 'failure',
        productId: baseline.productId,
        predictionId,
        errorType: 'persistence_error',
      });
    }
    this.logger.predictionRun({
      action: 'estimate',
      outcome: application === 'applied' ? 'success' : 'fallback',
      productId: baseline.productId,
      predictionId,
    });
  }
}
