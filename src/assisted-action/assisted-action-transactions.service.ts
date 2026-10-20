import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AssistedActionRequest } from './assisted-action-request';
import type { AssistedAppliedResult } from './assisted-action-result';
import {
  assistedActionResponseSchema,
  type AssistedActionWireResult,
} from './assisted-action-response.schema';
import { assertAssistedReplayMatches } from './assisted-action-replay';
import { isAssistedCatalogWriteRace } from './assisted-catalog-writer.service';
import { AssistedBatchIssues } from './assisted-batch-issues';

type AppliedWireResult = Extract<
  AssistedActionWireResult,
  { outcome: 'applied' }
>;
type ReceiptReader = Pick<Prisma.TransactionClient, 'assistedActionReceipt'>;

@Injectable()
export class AssistedActionTransactions {
  constructor(private readonly prisma: PrismaService) {}

  async findReplay(
    request: AssistedActionRequest,
    hash: string,
    reader: ReceiptReader = this.prisma,
  ): Promise<AppliedWireResult | null> {
    const saved = await reader.assistedActionReceipt.findUnique({
      where: { requestId: request.requestId },
    });
    if (!saved) return null;
    assertAssistedReplayMatches(saved.requestHash, hash);
    const response = assistedActionResponseSchema.parse(saved.response);
    if (
      response.outcome !== 'applied' ||
      response.requestId !== request.requestId ||
      response.operation !== request.operation ||
      saved.operation !== request.operation
    )
      throw new Error('Invalid persisted assisted-action receipt');
    return response;
  }

  async execute(
    request: AssistedActionRequest,
    hash: string,
    action: (tx: Prisma.TransactionClient) => Promise<AssistedAppliedResult>,
    onCommitted?: (response: AppliedWireResult) => Promise<void>,
  ): Promise<AssistedActionWireResult> {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const result = await this.prisma.$transaction(
          async (tx) => {
            const replay = await this.findReplay(request, hash, tx);
            if (replay) return { response: replay, created: false };
            const response = this.serialize(await action(tx), request);
            await tx.assistedActionReceipt.create({
              data: {
                requestId: request.requestId,
                requestHash: hash,
                operation: request.operation,
                response: z.json().parse(response) as Prisma.InputJsonValue,
              },
            });
            return { response, created: true };
          },
          {
            isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
            timeout: 15_000,
          },
        );
        if (result.created) await onCommitted?.(result.response);
        return result.response;
      } catch (error) {
        // The failed transaction is rolled back before looking for a concurrent winner.
        const replay = await this.findReplay(request, hash);
        if (replay) return replay;
        if (error instanceof AssistedBatchIssues)
          return {
            outcome: 'needs_input',
            requestId: request.requestId,
            issues: error.issues,
          };
        if (!isAssistedCatalogWriteRace(error)) throw error;
      }
    }
    return {
      outcome: 'unavailable',
      requestId: request.requestId,
      retryable: true,
      code: 'concurrency_exhausted',
    };
  }

  private serialize(
    result: AssistedAppliedResult,
    request: AssistedActionRequest,
  ): AppliedWireResult {
    const response = assistedActionResponseSchema.parse(
      JSON.parse(JSON.stringify(result)),
    );
    if (
      response.outcome !== 'applied' ||
      response.requestId !== request.requestId ||
      response.operation !== request.operation ||
      response.receipts.length !== request.items.length
    )
      throw new Error('Invalid assisted-action result');
    return response;
  }
}
