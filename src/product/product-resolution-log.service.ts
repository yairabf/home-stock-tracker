import { Injectable } from '@nestjs/common';
import type { ProductResolutionAdviceResult } from './product-resolution-advisor';
import type { LlmInferenceLogModel } from '../generated/prisma/models';
import { PrismaService } from '../prisma/prisma.service';
import {
  PRODUCT_RESOLUTION_MIN_CONFIDENCE,
  productResolutionProposalSchema,
} from './types/product-resolution';

@Injectable()
export class ProductResolutionLogService {
  constructor(private readonly prisma: PrismaService) {}

  async record(
    result: ProductResolutionAdviceResult,
  ): Promise<LlmInferenceLogModel | null> {
    if (
      result.status !== 'success' ||
      typeof result.provider !== 'string' ||
      typeof result.model !== 'string' ||
      typeof result.taskVersion !== 'string'
    ) {
      return null;
    }

    const parsed = productResolutionProposalSchema.safeParse(result.value);
    const provider = result.provider.trim();
    const model = result.model.trim();
    const taskVersion = result.taskVersion.trim();
    if (
      !parsed.success ||
      parsed.data.confidence < PRODUCT_RESOLUTION_MIN_CONFIDENCE ||
      !provider ||
      !model ||
      !taskVersion
    ) {
      return null;
    }

    return this.prisma.llmInferenceLog.create({
      data: {
        modelProvider: provider,
        modelVersion: model,
        promptVersion: taskVersion,
        confidence: parsed.data.confidence,
        structuredResponse: {
          status: 'validated',
          proposal: parsed.data,
        },
      },
    });
  }
}
