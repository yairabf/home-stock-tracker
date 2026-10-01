import { Inject, Injectable } from '@nestjs/common';
import { LLM_PROVIDER, type LlmProvider } from '../llm/llm-provider';
import type {
  ProductResolutionAdvisor,
  ProductResolutionAdviceResult,
} from './product-resolution-advisor';
import {
  PRODUCT_RESOLUTION_PROMPT_VERSION,
  PRODUCT_RESOLUTION_TIMEOUT_MS,
  productResolutionProposalSchema,
  type ProductResolutionContext,
} from './types/product-resolution';

@Injectable()
export class OpenAiProductResolutionAdvisor implements ProductResolutionAdvisor {
  constructor(@Inject(LLM_PROVIDER) private readonly provider: LlmProvider) {}

  async advise(
    context: ProductResolutionContext,
  ): Promise<ProductResolutionAdviceResult> {
    try {
      const result = await this.withTimeout(
        this.provider.generateStructured({
          task: 'product-resolution-advice',
          instructions:
            'Recommend one advisory product-resolution action using only the supplied phrase and candidate facts. Advice never performs or authorizes a write.',
          input: context,
          schemaName: 'product_resolution_proposal',
          schema: productResolutionProposalSchema,
          promptVersion: PRODUCT_RESOLUTION_PROMPT_VERSION,
        }),
      );
      return result.status === 'success'
        ? { ...result, taskVersion: PRODUCT_RESOLUTION_PROMPT_VERSION }
        : { status: 'unavailable' };
    } catch {
      return { status: 'unavailable' };
    }
  }

  private async withTimeout<T>(operation: Promise<T>): Promise<T> {
    let timeout: NodeJS.Timeout | undefined;
    const timeoutPromise = new Promise<never>((_resolve, reject) => {
      timeout = setTimeout(
        () => reject(new Error('Product resolution provider timed out')),
        PRODUCT_RESOLUTION_TIMEOUT_MS,
      );
    });

    try {
      return await Promise.race([operation, timeoutPromise]);
    } finally {
      if (timeout) {
        clearTimeout(timeout);
      }
    }
  }
}
