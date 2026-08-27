import type { LlmProvider } from './llm-provider';
import { LlmProviderRegistry } from './llm-provider.registry';

const fakeProvider = (name: string): LlmProvider => ({
  name,
  generateStructured: jest.fn(),
});

describe('LlmProviderRegistry', () => {
  it('selects the configured provider case-insensitively', () => {
    const openai = fakeProvider('openai');
    const anthropic = fakeProvider('anthropic');
    const registry = new LlmProviderRegistry([openai, anthropic]);

    expect(registry.select(' Anthropic ')).toBe(anthropic);
  });

  it('defaults to OpenAI when no provider is configured', () => {
    const openai = fakeProvider('openai');
    const registry = new LlmProviderRegistry([openai]);

    expect(registry.select(undefined)).toBe(openai);
  });

  it('fails clearly for an unsupported provider', () => {
    const registry = new LlmProviderRegistry([fakeProvider('openai')]);

    expect(() => registry.select('openrouter')).toThrow(
      'Unsupported LLM_PROVIDER "openrouter"',
    );
  });
});
