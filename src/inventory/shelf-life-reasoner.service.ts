import { Inject, Injectable } from '@nestjs/common';
import { LLM_PROVIDER, type LlmProvider } from '../llm/llm-provider';
import type { LlmGenerationResult } from '../llm/types/structured-generation';
import {
  shelfLifeInferenceInputSchema,
  shelfLifeInferenceResultSchema,
  type ShelfLifeInferenceInput,
  type ShelfLifeInferenceResult,
} from './types/shelf-life-inference';

export const SHELF_LIFE_INFERENCE_PROMPT_VERSION = 'shelf-life-inference-v1';

@Injectable()
export class ShelfLifeReasoner {
  constructor(
    @Inject(LLM_PROVIDER) private readonly llmProvider: LlmProvider,
  ) {}

  async infer(
    input: ShelfLifeInferenceInput,
  ): Promise<LlmGenerationResult<ShelfLifeInferenceResult>> {
    const validatedInput = shelfLifeInferenceInputSchema.parse(input);
    const result = await this.llmProvider.generateStructured({
      task: 'product-shelf-life-inference',
      instructions:
        'Classify intrinsic product shelf life. Return finite days for perishable or degrading goods, otherwise nonperishable with null days. Do not adjust for household size.',
      input: validatedInput,
      schemaName: 'product_shelf_life_policy',
      schema: shelfLifeInferenceResultSchema,
      promptVersion: SHELF_LIFE_INFERENCE_PROMPT_VERSION,
    });

    if (result.status !== 'success') return result;
    const parsed = shelfLifeInferenceResultSchema.safeParse(result.value);
    if (!parsed.success) {
      return {
        status: 'unavailable',
        provider: result.provider,
        model: result.model,
      };
    }
    return { ...result, value: parsed.data };
  }
}
