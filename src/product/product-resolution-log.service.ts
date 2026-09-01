import { Injectable } from '@nestjs/common';
import type { LlmGenerationResult } from '../llm/types/structured-generation';
import type { LlmInferenceLogModel } from '../generated/prisma/models';
import { PrismaService } from '../prisma/prisma.service';
import {
  PRODUCT_RESOLUTION_MIN_CONFIDENCE,
  PRODUCT_RESOLUTION_PROMPT_VERSION,
  productResolutionProposalSchema,
  type ProductResolutionProposal,
} from './types/product-resolution';

@Injectable()
export class ProductResolutionLogService {
  constructor(private readonly prisma: PrismaService) {}

  async record(
    result: LlmGenerationResult<ProductResolutionProposal>,
  ): Promise<LlmInferenceLogModel | null> {
    if (result.status !== 'success') {
      return null;
    }

    const parsed = productResolutionProposalSchema.safeParse(result.value);
    const provider = result.provider.trim();
    const model = result.model.trim();
    if (
      !parsed.success ||
      parsed.data.confidence < PRODUCT_RESOLUTION_MIN_CONFIDENCE ||
      !provider ||
      !model
    ) {
      return null;
    }

    return this.prisma.llmInferenceLog.create({
      data: {
        modelProvider: provider,
        modelVersion: model,
        promptVersion: PRODUCT_RESOLUTION_PROMPT_VERSION,
        confidence: parsed.data.confidence,
        structuredResponse: {
          status: 'validated',
          proposal: parsed.data,
        },
      },
    });
  }
}
