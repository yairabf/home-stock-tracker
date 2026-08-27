import type {
  LlmGenerationResult,
  StructuredGenerationRequest,
} from './types/structured-generation';

export const LLM_PROVIDER = Symbol('LLM_PROVIDER');

export interface LlmProvider {
  readonly name: string;

  generateStructured<T>(
    request: StructuredGenerationRequest<T>,
  ): Promise<LlmGenerationResult<T>>;
}
