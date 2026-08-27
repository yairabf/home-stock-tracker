import type { z } from 'zod';

export interface StructuredGenerationRequest<T> {
  task: string;
  instructions: string;
  input: Record<string, unknown>;
  schemaName: string;
  schema: z.ZodType<T>;
  promptVersion?: string;
}

interface LlmResultMetadata {
  provider: string;
  model: string;
}

export interface LlmSuccess<T> extends LlmResultMetadata {
  status: 'success';
  value: T;
}

export interface LlmRefusal extends LlmResultMetadata {
  status: 'refusal';
}

export interface LlmUnavailable {
  status: 'unavailable';
  provider?: string;
  model?: string;
}

export type LlmGenerationResult<T> =
  LlmSuccess<T> | LlmRefusal | LlmUnavailable;
