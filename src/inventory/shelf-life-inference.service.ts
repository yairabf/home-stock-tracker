import { Injectable } from '@nestjs/common';
import { ProductNameKind } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { OperationalLogger } from '../observability/operational-logger.service';
import {
  ShelfLifeReasoner,
  SHELF_LIFE_INFERENCE_PROMPT_VERSION,
} from './shelf-life-reasoner.service';
import type { ShelfLifeInferenceSummary } from './types/shelf-life-inference';

@Injectable()
export class ShelfLifeInferenceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reasoner: ShelfLifeReasoner,
    private readonly operationalLogger: OperationalLogger,
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
      select: {
        id: true,
        category: true,
        typicalUnit: true,
        productType: true,
        isPerishable: true,
        names: {
          where: { kind: ProductNameKind.canonical },
          select: { displayName: true },
          take: 1,
        },
      },
    });
    const summary: ShelfLifeInferenceSummary = {
      processed: products.length,
      succeeded: 0,
      skipped: 0,
      failed: 0,
    };

    for (const product of products) {
      try {
        const canonicalName = product.names[0]?.displayName;
        if (!canonicalName) {
          summary.skipped += 1;
          continue;
        }
        const result = await this.reasoner.infer({
          productId: product.id,
          canonicalName,
          category: product.category,
          typicalUnit: product.typicalUnit,
          productType: product.productType,
          isPerishable: product.isPerishable,
        });
        if (result.status !== 'success') {
          summary.skipped += 1;
          continue;
        }
        await this.prisma.productShelfLifePolicy.create({
          data: {
            productId: product.id,
            ...result.value,
            modelProvider: result.provider,
            modelVersion: result.model,
            promptVersion: SHELF_LIFE_INFERENCE_PROMPT_VERSION,
            evaluatedAt,
          },
        });
        summary.succeeded += 1;
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
}
