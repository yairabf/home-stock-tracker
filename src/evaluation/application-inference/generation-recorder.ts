import type { LlmProvider } from '../../llm/llm-provider';
import type {
  StructuredGenerationRequest,
  LlmGenerationResult,
} from '../../llm/types/structured-generation';
import { hash, generationTransportSchema } from './dataset';
import { callSchema, type RecordedCall } from './recording';

export function generationRequestHash<T>(
  request: StructuredGenerationRequest<T>,
): string {
  return hash({
    task: request.task,
    instructions: request.instructions,
    input: request.input,
    schemaName: request.schemaName,
    promptVersion: request.promptVersion ?? null,
  });
}

export class GenerationRecorder implements LlmProvider {
  readonly name = 'openai';
  readonly calls: RecordedCall[] = [];
  private cursor = 0;
  private replayError: Error | null = null;
  constructor(
    private readonly replay: RecordedCall[] | undefined,
    private readonly provider?: LlmProvider,
  ) {}

  async generateStructured<T>(
    request: StructuredGenerationRequest<T>,
  ): Promise<LlmGenerationResult<T>> {
    const requestHash = generationRequestHash(request);
    const started = performance.now();
    let result: LlmGenerationResult<T>;
    let elapsedMs: number;
    if (this.replay) {
      const recorded = this.replay[this.cursor++];
      if (
        !recorded ||
        recorded.provider !== 'openai' ||
        recorded.requestHash !== requestHash
      ) {
        this.replayError = new Error(
          'Recorded generation does not match runtime request',
        );
        throw this.replayError;
      }
      const transport = generationTransportSchema.parse(recorded.transport);
      if (transport.status === 'success') {
        const parsed = request.schema.safeParse(transport.value);
        if (!parsed.success) {
          this.replayError = new Error('Invalid generated schema');
          throw this.replayError;
        }
        result = { ...transport, value: parsed.data };
      } else result = transport;
      elapsedMs = recorded.elapsedMs;
    } else {
      if (!this.provider) throw new Error('Generation provider missing');
      result = await this.provider.generateStructured(request);
      elapsedMs = performance.now() - started;
    }
    const transport =
      result.status === 'unavailable' ? { status: 'unavailable' } : result;
    this.calls.push(
      callSchema.parse({
        provider: 'openai',
        requestHash,
        elapsedMs,
        transport,
      }),
    );
    return result;
  }

  finish(): void {
    if (this.replayError) throw this.replayError;
    if (this.replay && this.cursor !== this.replay.length)
      throw new Error('Unused recorded generation');
  }
}
