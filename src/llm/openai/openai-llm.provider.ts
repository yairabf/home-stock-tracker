import { Inject, Injectable } from '@nestjs/common';
import OpenAI from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';
import type { LlmProvider } from '../llm-provider';
import type {
  LlmGenerationResult,
  StructuredGenerationRequest,
} from '../types/structured-generation';
import { OPENAI_CLIENT, OPENAI_MODEL } from './openai.tokens';
import { OperationalLogger } from '../../observability/operational-logger.service';

@Injectable()
export class OpenAiLlmProvider implements LlmProvider {
  readonly name = 'openai';

  constructor(
    @Inject(OPENAI_CLIENT) private readonly client: OpenAI | null,
    @Inject(OPENAI_MODEL) private readonly model: string,
    private readonly operationalLogger: OperationalLogger,
  ) {}

  async generateStructured<T>(
    request: StructuredGenerationRequest<T>,
  ): Promise<LlmGenerationResult<T>> {
    if (!this.client) {
      this.logFailure();
      return this.unavailable();
    }

    try {
      const response = await this.parseResponse(request);

      if (response.output_parsed !== null) {
        return {
          status: 'success',
          provider: this.name,
          model: this.model,
          value: response.output_parsed,
        };
      }

      if (
        response.output.some(
          (item) =>
            item.type === 'message' &&
            item.content.some((content) => content.type === 'refusal'),
        )
      ) {
        return {
          status: 'refusal',
          provider: this.name,
          model: this.model,
        };
      }

      this.logFailure();
      return this.unavailable();
    } catch {
      this.logFailure();
      return this.unavailable();
    }
  }

  private async parseResponse<T>(request: StructuredGenerationRequest<T>) {
    const client = this.client;
    if (!client) throw new Error('Provider unavailable');
    const body = {
      model: this.model,
      instructions: request.instructions,
      input: JSON.stringify(request.input),
      text: { format: zodTextFormat(request.schema, request.schemaName) },
    };
    if (request.budgetMs === undefined) return client.responses.parse(body);
    if (
      !Number.isFinite(request.budgetMs) ||
      request.budgetMs <= 0 ||
      request.budgetMs > 10_000
    )
      throw new Error('Invalid generation budget');
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const expired = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(new Error('Generation deadline exceeded'));
      }, request.budgetMs);
    });
    try {
      return await Promise.race([
        client.responses.parse(body, {
          timeout: request.budgetMs,
          maxRetries: 0,
          signal: controller.signal,
        }),
        expired,
      ]);
    } finally {
      clearTimeout(timer);
    }
  }

  private unavailable(): LlmGenerationResult<never> {
    return {
      status: 'unavailable',
      provider: this.name,
      model: this.model,
    };
  }

  private logFailure(): void {
    this.operationalLogger.llmIntegration({
      outcome: 'failure',
      provider: 'openai',
      errorType: 'provider_error',
    });
  }
}
