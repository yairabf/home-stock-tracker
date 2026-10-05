import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { Prisma } from '../generated/prisma/client';
import { validateDecisionAttemptProvenance } from '../llm/decision-routing/decision-attempt-provenance';
import type {
  ProductUnderstandingResult,
  UnderstandingField,
} from './product-understanding';

export type UnderstandingWriteOutcome =
  'applied' | 'stale' | 'reused' | 'unresolved';
@Injectable()
export class ProductUnderstandingLogService {
  constructor(private readonly prisma: PrismaService) {}

  async record(
    result: ProductUnderstandingResult,
    appliedFields: UnderstandingField[],
    writeOutcome: UnderstandingWriteOutcome,
  ): Promise<void> {
    for (const candidate of result.attempts) {
      const attempt = validateDecisionAttemptProvenance(candidate);
      if (!attempt || attempt.task !== 'product_understanding') continue;
      const model = attempt.resolvedModel ?? attempt.configuredModel;
      if (!model) continue;
      try {
        const payload = {
          version: 'product-understanding-v1',
          attempt,
          modelVersionResolved: attempt.resolvedModel !== undefined,
          writeOutcome,
          appliedFields: attempt.fields.filter((field) =>
            appliedFields.includes(field as UnderstandingField),
          ),
        };
        await this.prisma.llmInferenceLog.create({
          data: {
            modelProvider: attempt.provider,
            modelVersion: model,
            promptVersion: attempt.taskVersion,
            ...(attempt.confidence === undefined
              ? {}
              : { confidence: attempt.confidence }),
            structuredResponse: JSON.parse(
              JSON.stringify(payload),
            ) as Prisma.InputJsonValue,
          },
        });
      } catch {
        /* Diagnostic persistence must not block product writes. */
      }
    }
  }
}
