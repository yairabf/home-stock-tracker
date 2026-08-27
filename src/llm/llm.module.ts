import { Module } from '@nestjs/common';
import OpenAI from 'openai';
import { LLM_PROVIDER } from './llm-provider';
import { LlmProviderRegistry } from './llm-provider.registry';
import { OpenAiLlmProvider } from './openai/openai-llm.provider';
import {
  DEFAULT_OPENAI_MODEL,
  OPENAI_CLIENT,
  OPENAI_MODEL,
} from './openai/openai.tokens';
import { ObservabilityModule } from '../observability/observability.module';

@Module({
  imports: [ObservabilityModule],
  providers: [
    {
      provide: OPENAI_CLIENT,
      useFactory: (): OpenAI | null => {
        const apiKey = process.env.OPENAI_API_KEY?.trim();
        return apiKey ? new OpenAI({ apiKey }) : null;
      },
    },
    {
      provide: OPENAI_MODEL,
      useFactory: (): string =>
        process.env.LLM_MODEL?.trim() || DEFAULT_OPENAI_MODEL,
    },
    OpenAiLlmProvider,
    {
      provide: LlmProviderRegistry,
      useFactory: (openai: OpenAiLlmProvider): LlmProviderRegistry =>
        new LlmProviderRegistry([openai]),
      inject: [OpenAiLlmProvider],
    },
    {
      provide: LLM_PROVIDER,
      useFactory: (registry: LlmProviderRegistry) =>
        registry.select(process.env.LLM_PROVIDER),
      inject: [LlmProviderRegistry],
    },
  ],
  exports: [LLM_PROVIDER],
})
export class LlmModule {}
