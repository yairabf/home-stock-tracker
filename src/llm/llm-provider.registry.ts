import { Injectable } from '@nestjs/common';
import type { LlmProvider } from './llm-provider';

@Injectable()
export class LlmProviderRegistry {
  private readonly providers: Map<string, LlmProvider>;

  constructor(providers: readonly LlmProvider[]) {
    this.providers = new Map(
      providers.map((provider) => [provider.name.toLowerCase(), provider]),
    );
  }

  select(configuredName: string | undefined): LlmProvider {
    const providerName = configuredName?.trim().toLowerCase() || 'openai';
    const provider = this.providers.get(providerName);

    if (!provider) {
      throw new Error(`Unsupported LLM_PROVIDER "${providerName}"`);
    }

    return provider;
  }
}
