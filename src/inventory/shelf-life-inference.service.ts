import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OperationalLogger } from '../observability/operational-logger.service';
import { SHELF_LIFE_POLICY, type ShelfLifePolicy } from './shelf-life-policy';
import {
  POLICY_PRODUCT_SELECT,
  policyInput,
  ShelfLifePolicyWriter,
} from './shelf-life-policy-writer.service';
import type { ShelfLifeInferenceSummary } from './types/shelf-life-inference';
import { ShelfLifePolicyLog } from './shelf-life-policy-log.service';

@Injectable()
export class ShelfLifeInferenceService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(SHELF_LIFE_POLICY) private readonly reasoner: ShelfLifePolicy,
    private readonly operationalLogger: OperationalLogger,
    private readonly writer: ShelfLifePolicyWriter,
    private readonly policyLog: ShelfLifePolicyLog,
  ) {}

  async inferMissingPolicies(
    evaluatedAt: Date = new Date(),
    productIds?: string[],
  ): Promise<ShelfLifeInferenceSummary> {
    const products = await this.prisma.product.findMany({
      where: {
        shelfLifePolicy: null,
        ...(productIds ? { id: { in: productIds } } : {}),
      },
      select: POLICY_PRODUCT_SELECT,
    });
    const summary: ShelfLifeInferenceSummary = {
      processed: products.length,
      succeeded: 0,
      skipped: 0,
      failed: 0,
    };

    for (const product of products) {
      try {
        const input = policyInput(product);
        if (!input) {
          summary.skipped += 1;
          continue;
        }
        const result = await this.reasoner.infer(input);
        const outcome = await this.writer.write(input, result, evaluatedAt);
        await this.recordSafely(result, outcome);
        summary[outcome === 'applied' ? 'succeeded' : 'skipped'] += 1;
      } catch {
        summary.failed += 1;
        this.operationalLogger.stockWorkflow({
          stage: 'product_failure',
          outcome: 'failure',
          phase: 'shelf_life',
          productId: product.id,
        });
      }
    }
    return summary;
  }

  private async recordSafely(
    result: Parameters<ShelfLifePolicyLog['record']>[0],
    outcome: Parameters<ShelfLifePolicyLog['record']>[1],
  ): Promise<void> {
    try {
      await this.policyLog.record(result, outcome);
    } catch {
      /* Diagnostics must not change policy workflow outcomes. */
    }
  }
}
