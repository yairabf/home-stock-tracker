import { Injectable } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { validateDecisionAttemptProvenance } from '../llm/decision-routing/decision-attempt-provenance';
import type { ShelfLifePolicyResult } from './shelf-life-policy';
import type { PolicyWriteOutcome } from './shelf-life-policy-writer.service';
import {
  SHELF_LIFE_REGISTRY,
  SHELF_LIFE_REGISTRY_VERSION,
} from './shelf-life-policy-registry';

@Injectable()
export class ShelfLifePolicyLog {
  constructor(private readonly prisma: PrismaService) {}

  async record(
    result: ShelfLifePolicyResult,
    writeOutcome: PolicyWriteOutcome,
  ): Promise<void> {
    for (const candidate of result.attempts ?? []) {
      const attempt = validateDecisionAttemptProvenance(candidate);
      if (!attempt || attempt.task !== 'shelf_life_policy') continue;
      const knownRegistry =
        result.registryVersion === SHELF_LIFE_REGISTRY_VERSION;
      const knownPolicy =
        knownRegistry &&
        SHELF_LIFE_REGISTRY.some((entry) => entry.id === result.policyId);
      const payload = {
        version: 'shelf-life-policy-log-v1',
        attempt,
        writeOutcome,
        modelVersionResolved:
          attempt.provider === 'typesafe' &&
          attempt.resolvedModel !== undefined,
        ...(knownRegistry
          ? { registryVersion: SHELF_LIFE_REGISTRY_VERSION }
          : {}),
        ...(knownPolicy ? { policyId: result.policyId } : {}),
        applied: result.status === 'resolved' && writeOutcome === 'applied',
      };
      try {
        await this.prisma.llmInferenceLog.create({
          data: {
            modelProvider: attempt.provider,
            modelVersion:
              attempt.resolvedModel ?? attempt.configuredModel ?? 'unresolved',
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
        // Diagnostics must not prevent daily inventory evaluation.
      }
    }
  }
}
