import { Inject, Injectable } from '@nestjs/common';
import { LLM_PROVIDER, type LlmProvider } from '../llm/llm-provider';
import type { LlmGenerationResult } from '../llm/types/structured-generation';
import { ProductSearchService } from './product-search.service';
import { ProductResolutionLogService } from './product-resolution-log.service';
import {
  PRODUCT_RESOLUTION_MAX_CANDIDATES,
  PRODUCT_RESOLUTION_MAX_CONTEXT_BYTES,
  PRODUCT_RESOLUTION_MIN_CONFIDENCE,
  PRODUCT_RESOLUTION_PROMPT_VERSION,
  PRODUCT_RESOLUTION_TIMEOUT_MS,
  productResolutionContextSchema,
  productResolutionProposalSchema,
  type ProductResolutionContext,
  type ProductResolutionProposal,
  type ProductResolutionResult,
} from './types/product-resolution';

@Injectable()
export class ProductResolutionService {
  constructor(
    private readonly productSearchService: ProductSearchService,
    @Inject(LLM_PROVIDER) private readonly llmProvider: LlmProvider,
    private readonly resolutionLog: ProductResolutionLogService,
  ) {}

  async resolve(rawName: string): Promise<ProductResolutionResult> {
    const search = await this.productSearchService.search({
      query: rawName,
      limit: PRODUCT_RESOLUTION_MAX_CANDIDATES,
    });
    if (search.exactMatch) {
      return { ...search, proposal: null };
    }

    const context = this.buildContext(rawName, search.candidates);
    if (!context) {
      return { ...search, proposal: null };
    }

    const proposal = await this.generateProposal(context);
    return { ...search, proposal };
  }

  private buildContext(
    rawName: string,
    candidates: ProductResolutionResult['candidates'],
  ): ProductResolutionContext | null {
    const parsed = productResolutionContextSchema.safeParse({
      requestedPhrase: rawName,
      candidates: candidates.map((candidate) => ({
        id: candidate.id,
        canonicalName: candidate.canonicalName,
        aliases: candidate.aliases,
        category: candidate.category,
        typicalUnit: candidate.typicalUnit,
        productType: candidate.productType,
        isPerishable: candidate.isPerishable,
      })),
    });
    if (!parsed.success) {
      return null;
    }

    const bytes = Buffer.byteLength(JSON.stringify(parsed.data), 'utf8');
    return bytes <= PRODUCT_RESOLUTION_MAX_CONTEXT_BYTES ? parsed.data : null;
  }

  private async generateProposal(
    context: ProductResolutionContext,
  ): Promise<ProductResolutionProposal | null> {
    let result: LlmGenerationResult<ProductResolutionProposal>;
    try {
      result = await this.withTimeout(
        this.llmProvider.generateStructured({
          task: 'product-resolution-advice',
          instructions:
            'Recommend one advisory product-resolution action using only the supplied phrase and candidate facts. Advice never performs or authorizes a write.',
          input: context,
          schemaName: 'product_resolution_proposal',
          schema: productResolutionProposalSchema,
          promptVersion: PRODUCT_RESOLUTION_PROMPT_VERSION,
        }),
      );
    } catch {
      return null;
    }

    if (result.status !== 'success') {
      return null;
    }
    const parsed = productResolutionProposalSchema.safeParse(result.value);
    if (
      !parsed.success ||
      parsed.data.confidence < PRODUCT_RESOLUTION_MIN_CONFIDENCE ||
      !this.referencesKnownCandidates(parsed.data, context)
    ) {
      return null;
    }
    const validatedResult = { ...result, value: parsed.data };
    try {
      await this.resolutionLog.record(validatedResult);
    } catch {
      // Diagnostic logging must not block advisory resolution.
    }
    return parsed.data;
  }

  private referencesKnownCandidates(
    proposal: ProductResolutionProposal,
    context: ProductResolutionContext,
  ): boolean {
    const candidateIds = new Set(context.candidates.map(({ id }) => id));
    if (proposal.recommendation === 'add_alias') {
      return candidateIds.has(proposal.targetProductId);
    }
    if (proposal.recommendation === 'ask_user_to_choose') {
      return proposal.candidateProductIds.every((id) => candidateIds.has(id));
    }
    return true;
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
