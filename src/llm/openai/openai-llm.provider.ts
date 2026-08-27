import { Inject, Injectable } from '@nestjs/common';
import OpenAI from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';
import type { LlmProvider } from '../llm-provider';
import type {
  LlmGenerationResult,
  StructuredGenerationRequest,
} from '../types/structured-generation';
import { OPENAI_CLIENT, OPENAI_MODEL } from './openai.tokens';

@Injectable()
export class OpenAiLlmProvider implements LlmProvider {
  readonly name = 'openai';

  constructor(
    @Inject(OPENAI_CLIENT) private readonly client: OpenAI | null,
    @Inject(OPENAI_MODEL) private readonly model: string,
  ) {}

  async generateStructured<T>(
    request: StructuredGenerationRequest<T>,
  ): Promise<LlmGenerationResult<T>> {
    if (!this.client) {
      return this.unavailable();
    }

    try {
      const response = await this.client.responses.parse({
        model: this.model,
        instructions: request.instructions,
        input: JSON.stringify(request.input),
        text: {
          format: zodTextFormat(request.schema, request.schemaName),
        },
      });

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

      return this.unavailable();
    } catch {
      return this.unavailable();
    }
  }

  private unavailable(): LlmGenerationResult<never> {
    return {
      status: 'unavailable',
      provider: this.name,
      model: this.model,
    };
  }
}
