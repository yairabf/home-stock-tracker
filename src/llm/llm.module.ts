import { Module } from '@nestjs/common';
import OpenAI from 'openai';
import { LLM_PROVIDER } from './llm-provider';
import { LlmProviderRegistry } from './llm-provider.registry';
import { OpenAiLlmProvider } from './openai/openai-llm.provider';
import { OPENAI_CLIENT, OPENAI_MODEL } from './openai/openai.tokens';
import { ObservabilityModule } from '../observability/observability.module';
import type { ModelConfig } from '../config/application-config';
import { MODEL_CONFIG } from '../config/model-config.module';
import { JevDecisionClient } from './typesafe/jev-decision.client';

@Module({
  imports: [ObservabilityModule],
  providers: [
    {
      provide: OPENAI_CLIENT,
      useFactory: (config: ModelConfig): OpenAI | null =>
        config.openAiApiKey
          ? new OpenAI({ apiKey: config.openAiApiKey })
          : null,
      inject: [MODEL_CONFIG],
    },
    {
      provide: OPENAI_MODEL,
      useFactory: (config: ModelConfig): string => config.llmModel,
      inject: [MODEL_CONFIG],
    },
    {
      provide: JevDecisionClient,
      useFactory: (config: ModelConfig): JevDecisionClient =>
        new JevDecisionClient({
          typesafeApiKey: config.typesafeApiKey,
          jevModel: config.jevModel,
        }),
      inject: [MODEL_CONFIG],
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
      useFactory: (registry: LlmProviderRegistry, config: ModelConfig) =>
        registry.select(config.llmProvider),
      inject: [LlmProviderRegistry, MODEL_CONFIG],
    },
  ],
  exports: [LLM_PROVIDER, JevDecisionClient],
})
export class LlmModule {}
