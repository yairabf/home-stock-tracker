import { Inject, Injectable } from '@nestjs/common';
import { z } from 'zod';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MODEL_CONFIG } from '../config/model-config.module';
import {
  STOCK_WORKFLOW_CONFIG,
  type ModelConfig,
  type StockWorkflowConfig,
} from '../config/application-config';
import {
  STOCK_PREDICTION_ADVISOR,
  type StockPredictionAdvisor,
} from '../estimation/stock-prediction-advisor';
import { composeJevStockAdvice } from '../estimation/stock-prediction-policy';
import { finalizeCandidate } from '../estimation/hybrid-calculation';
import { JEV_STOCK_PREDICTION_VERSION } from '../estimation/jev-stock-prediction-advisor.service';
import { predictionReasoningResultSchema } from '../estimation/types/prediction-reasoning';
import { TASK_BUDGET_MS } from '../llm/typesafe/jev-decision.client';
import { StockAdviceAttempts } from './stock-advice-attempts.service';
import { StockAdviceSnapshot } from './stock-advice-snapshot.service';
import type { DailyAdviceBaseline } from './stock-advice-policy';

export const workflowStockAdviceSchema = z
  .object({
    status: z.literal('success'),
    provider: z.literal('typesafe'),
    model: z.string().regex(/^jev-\d+\.\d+\.\d+$/),
    taskVersion: z.literal(JEV_STOCK_PREDICTION_VERSION),
    value: predictionReasoningResultSchema.extend({
      recommendedAction: z.null(),
      reason: z.string().trim().min(1).max(2048),
    }),
  })
  .strict();
const cachedSchema = z
  .object({ accepted: z.boolean(), advice: workflowStockAdviceSchema })
  .strict();

@Injectable()
export class StockAdviceExecutor {
  constructor(
    private readonly prisma: PrismaService,
    private readonly attempts: StockAdviceAttempts,
    private readonly snapshots: StockAdviceSnapshot,
    @Inject(STOCK_PREDICTION_ADVISOR)
    private readonly advisor: StockPredictionAdvisor,
    @Inject(MODEL_CONFIG) private readonly model: ModelConfig,
    @Inject(STOCK_WORKFLOW_CONFIG)
    private readonly workflow: StockWorkflowConfig,
  ) {}

  get enabled(): boolean {
    return (
      this.workflow.adviceEnabled &&
      this.model.stockPredictionProvider === 'typesafe' &&
      this.advisor.provider === 'typesafe'
    );
  }

  async execute(baseline: DailyAdviceBaseline) {
    if (!this.enabled || !this.model.jevModel) return null;
    const snapshot = await this.snapshots.read(baseline, this.model.jevModel);
    if (!snapshot) return null;
    const { owned, attempt } = await this.attempts.reserve({
      productId: baseline.productId,
      fingerprint: snapshot.fingerprint,
      configuredModel: this.model.jevModel,
      taskVersion: JEV_STOCK_PREDICTION_VERSION,
    });
    let parsed: ReturnType<typeof workflowStockAdviceSchema.safeParse>;
    if (owned) {
      let response: unknown;
      try {
        response = await this.advisor.reason(snapshot.candidate);
      } catch {
        response = null;
      }
      parsed = workflowStockAdviceSchema.safeParse(response);
      if (!parsed.success) {
        await this.finish(attempt.id, {
          status: 'unavailable',
          reason: 'provider_unavailable_or_invalid',
        });
        return {
          attemptId: attempt.id,
          baseline,
          snapshot,
          accepted: false,
          advice: null,
          result: null,
        };
      }
    } else {
      if (attempt.status === 'reserved') {
        await this.prisma.stockAdviceAttempt.updateMany({
          where: {
            id: attempt.id,
            status: 'reserved',
            createdAt: {
              lt: new Date(Date.now() - TASK_BUDGET_MS.stock_prediction),
            },
          },
          data: {
            status: 'abandoned',
            reason: 'reservation_expired',
            completedAt: new Date(),
          },
        });
        return null;
      }
      if (attempt.status !== 'completed') return null;
      const cached = cachedSchema.safeParse(attempt.response);
      if (!cached.success) return null;
      parsed = workflowStockAdviceSchema.safeParse(cached.data.advice);
    }
    if (!parsed.success) return null;
    const composed = composeJevStockAdvice(
      snapshot.candidate,
      finalizeCandidate(baseline.productId, snapshot.candidate),
      parsed.data,
    );
    const accepted = composed.result.llmContributed;
    if (
      owned &&
      !(await this.finish(attempt.id, {
        status: 'completed',
        response: { accepted, advice: parsed.data },
        resolvedModel: parsed.data.model,
        confidence: parsed.data.value.confidence,
        reason: accepted ? 'accepted' : 'uncertain_or_low_confidence',
      }))
    )
      return null;
    return {
      attemptId: attempt.id,
      baseline,
      snapshot,
      accepted,
      advice: parsed.data,
      result: composed.result,
    };
  }

  private async finish(
    id: string,
    data: Prisma.StockAdviceAttemptUpdateManyMutationInput,
  ): Promise<boolean> {
    const result = await this.prisma.stockAdviceAttempt.updateMany({
      where: { id, status: 'reserved' },
      data: { ...data, completedAt: new Date() },
    });
    return result.count === 1;
  }
}

export type ExecutedStockAdvice = NonNullable<
  Awaited<ReturnType<StockAdviceExecutor['execute']>>
>;
