import { Inject, Injectable } from '@nestjs/common';
import { OperationalLogger } from '../observability/operational-logger.service';
import {
  STOCK_WORKFLOW_CONFIG,
  type StockWorkflowConfig,
} from '../config/application-config';
import { StockAdviceExecutor } from './stock-advice-executor.service';
import { StockAdviceWriter } from './stock-advice-writer.service';
import type { DailyAdviceBaseline } from './stock-advice-policy';
import { PrismaService } from '../prisma/prisma.service';
import { DailyStockMaterializationService } from './daily-stock-materialization.service';
import { ShelfLifeInferenceService } from './shelf-life-inference.service';
import type {
  DailyStockWorkflowSummary,
  StockEvaluationSummary,
} from './types/daily-stock-workflow';
import type { ShelfLifeInferenceSummary } from './types/shelf-life-inference';

@Injectable()
export class DailyStockWorkflowService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly shelfLifeInference: ShelfLifeInferenceService,
    private readonly stockMaterialization: DailyStockMaterializationService,
    private readonly operationalLogger: OperationalLogger,
    private readonly advice: StockAdviceExecutor,
    private readonly adviceWriter: StockAdviceWriter,
    @Inject(STOCK_WORKFLOW_CONFIG) private readonly config: StockWorkflowConfig,
  ) {}

  async run(
    evaluatedAt: Date = new Date(),
    productIds?: string[],
  ): Promise<DailyStockWorkflowSummary> {
    const startedAt = new Date();
    this.operationalLogger.stockWorkflow({
      stage: 'start',
      outcome: 'success',
    });

    const shelfLife = await this.inferShelfLifePhase(evaluatedAt, productIds);
    const evaluation = await this.evaluateStockPhase(evaluatedAt, productIds);
    const completedAt = new Date();
    const summary: DailyStockWorkflowSummary = {
      startedAt,
      completedAt,
      durationMs: Math.max(0, completedAt.getTime() - startedAt.getTime()),
      shelfLife,
      evaluation,
    };
    this.operationalLogger.stockWorkflow({
      stage: 'end',
      outcome: shelfLife.failed + evaluation.failed > 0 ? 'failure' : 'success',
      durationMs: summary.durationMs,
      shelfLife,
      evaluation,
    });
    return summary;
  }

  private async inferShelfLifePhase(
    evaluatedAt: Date,
    productIds?: string[],
  ): Promise<ShelfLifeInferenceSummary> {
    try {
      return await this.shelfLifeInference.inferMissingPolicies(
        evaluatedAt,
        productIds,
      );
    } catch {
      return { processed: 0, succeeded: 0, skipped: 0, failed: 1 };
    }
  }

  private async evaluateStockPhase(
    evaluatedAt: Date,
    productIds?: string[],
  ): Promise<StockEvaluationSummary> {
    let projections: Array<{ productId: string }>;
    try {
      projections = await this.prisma.stockProjection.findMany({
        ...(productIds ? { where: { productId: { in: productIds } } } : {}),
        select: { productId: true },
        orderBy: { productId: 'asc' },
      });
    } catch {
      return { processed: 0, succeeded: 0, skipped: 0, failed: 1 };
    }
    const summary: StockEvaluationSummary = {
      processed: projections.length,
      succeeded: 0,
      skipped: 0,
      failed: 0,
    };
    let adviceProducts = 0;
    for (const projection of projections) {
      try {
        const result = await this.stockMaterialization.evaluateProduct(
          projection.productId,
          evaluatedAt,
        );
        summary[result === null ? 'skipped' : 'succeeded'] += 1;
        if (
          result &&
          this.advice.enabled &&
          adviceProducts < this.config.adviceMaxProducts
        ) {
          adviceProducts++;
          await this.adviseProduct(result);
        }
      } catch {
        summary.failed += 1;
        this.operationalLogger.stockWorkflow({
          stage: 'product_failure',
          outcome: 'failure',
          phase: 'evaluation',
          productId: projection.productId,
        });
      }
    }
    return summary;
  }
  private async adviseProduct(baseline: DailyAdviceBaseline): Promise<void> {
    try {
      const result = await this.advice.execute(baseline);
      if (result) await this.adviceWriter.publish(result);
    } catch {
      this.operationalLogger.stockWorkflow({
        stage: 'product_failure',
        outcome: 'failure',
        phase: 'stock_advice',
        productId: baseline.productId,
      });
    }
  }
}
