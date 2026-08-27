import { Injectable } from '@nestjs/common';
import type { LlmGenerationResult } from '../llm/types/structured-generation';
import type { LlmInferenceLogModel } from '../generated/prisma/models';
import { PrismaService } from '../prisma/prisma.service';
import {
  PRODUCT_CLASSIFICATION_MIN_CONFIDENCE,
  PRODUCT_CLASSIFICATION_PROMPT_VERSION,
} from './product-classifier.service';
import {
  productClassificationResultSchema,
  type ProductClassificationResult,
} from './types/product-classification';

@Injectable()
export class ProductClassificationLogService {
  constructor(private readonly prisma: PrismaService) {}

  async record(
    result: LlmGenerationResult<ProductClassificationResult>,
  ): Promise<LlmInferenceLogModel | null> {
    if (result.status !== 'success') {
      return null;
    }

    const parsed = productClassificationResultSchema.safeParse(result.value);
    const provider = result.provider.trim();
    const model = result.model.trim();
    if (
      !parsed.success ||
      parsed.data.confidence < PRODUCT_CLASSIFICATION_MIN_CONFIDENCE ||
      !provider ||
      !model
    ) {
      return null;
    }

    const classification = parsed.data;
    return this.prisma.llmInferenceLog.create({
      data: {
        modelProvider: provider,
        modelVersion: model,
        promptVersion: PRODUCT_CLASSIFICATION_PROMPT_VERSION,
        confidence: classification.confidence,
        structuredResponse: {
          canonicalName: classification.canonicalName,
          aliases: classification.aliases,
          category: classification.category,
          typicalUnit: classification.typicalUnit,
          productType: classification.productType,
          isPerishable: classification.isPerishable,
          confidence: classification.confidence,
        },
      },
    });
  }
}
