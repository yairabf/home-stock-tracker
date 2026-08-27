import { Inject, Injectable } from '@nestjs/common';
import { LLM_PROVIDER, type LlmProvider } from '../llm/llm-provider';
import type { LlmGenerationResult } from '../llm/types/structured-generation';
import { normalizeAliases, normalizeProductName } from './product-name.util';
import {
  type ProductClassificationInput,
  type ProductClassificationResult,
  productClassificationInputSchema,
  productClassificationResultSchema,
} from './types/product-classification';

export const PRODUCT_CLASSIFICATION_MIN_CONFIDENCE = 0.8;
export const PRODUCT_CLASSIFICATION_PROMPT_VERSION =
  'product-classification-v1';

@Injectable()
export class ProductClassifier {
  constructor(
    @Inject(LLM_PROVIDER) private readonly llmProvider: LlmProvider,
  ) {}

  async classify(
    input: ProductClassificationInput,
  ): Promise<LlmGenerationResult<ProductClassificationResult>> {
    const validatedInput = productClassificationInputSchema.parse(input);
    const result = await this.llmProvider.generateStructured({
      task: 'product-classification',
      instructions:
        'Classify one household product using only the supplied product name and hints.',
      input: validatedInput,
      schemaName: 'product_classification',
      schema: productClassificationResultSchema,
      promptVersion: PRODUCT_CLASSIFICATION_PROMPT_VERSION,
    });

    if (result.status !== 'success') {
      return result;
    }

    const parsed = productClassificationResultSchema.safeParse(result.value);
    if (
      !parsed.success ||
      parsed.data.confidence < PRODUCT_CLASSIFICATION_MIN_CONFIDENCE
    ) {
      return {
        status: 'unavailable',
        provider: result.provider,
        model: result.model,
      };
    }

    const canonicalName = normalizeProductName(parsed.data.canonicalName);
    return {
      ...result,
      value: {
        ...parsed.data,
        canonicalName,
        aliases: normalizeAliases(parsed.data.aliases, canonicalName),
        category: parsed.data.category.trim(),
        typicalUnit: parsed.data.typicalUnit?.trim() || null,
      },
    };
  }
}
