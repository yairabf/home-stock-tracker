import { JevDecisionClient } from '../../llm/typesafe/jev-decision.client';
import type {
  JevChoiceRequest,
  JevDecisionResult,
} from '../../llm/typesafe/jev-decision.types';
import {
  validateJevChoiceRequest,
  validateJevChoiceResponse,
} from '../../llm/typesafe/jev-decision.validation';
import { hash } from './dataset';
import { callSchema, type RecordedCall } from './recording';

export class ChoiceRecorder extends JevDecisionClient {
  readonly calls: RecordedCall[] = [];
  private cursor = 0;
  private replayError: Error | null = null;
  constructor(
    model: string,
    private readonly replay: RecordedCall[] | undefined,
    config: { typesafeApiKey?: string } = {},
    fetcher?: typeof fetch,
  ) {
    super({ ...config, jevModel: model }, fetcher);
  }

  override async choose(
    request: JevChoiceRequest,
    remainingBudgetMs?: number,
  ): Promise<JevDecisionResult> {
    request = JSON.parse(JSON.stringify(request)) as JevChoiceRequest;
    const started = performance.now();
    const requestHash = hash(request);
    if (validateJevChoiceRequest(request).status !== 'valid')
      throw new Error('Invalid evaluation request');
    let response: JevDecisionResult;
    let elapsedMs: number;
    if (this.replay) {
      const recorded = this.replay[this.cursor++];
      if (
        !recorded ||
        recorded.provider !== 'typesafe' ||
        recorded.requestHash !== requestHash
      ) {
        this.replayError = new Error(
          'Recorded choice does not match runtime request',
        );
        throw this.replayError;
      }
      const transport = recorded.transport;
      if (transport.status === 'success') {
        const validated = validateJevChoiceResponse(
          {
            model: transport.model,
            answers: {
              [request.questionKey]: {
                type: 'choice',
                choice: transport.choice,
                confidence: transport.confidence,
                probabilities: transport.probabilities,
              },
            },
            usage: transport.usage,
          },
          request,
        );
        if (validated.status !== 'valid') {
          this.replayError = new Error('Invalid recorded choice probabilities');
          throw this.replayError;
        }
        response = {
          status: 'success',
          provider: 'typesafe',
          task: request.task,
          taskVersion: request.taskVersion,
          ...validated.value,
        };
      } else
        response = {
          ...transport,
          provider: 'typesafe',
          task: request.task,
          taskVersion: request.taskVersion,
        };
      elapsedMs = recorded.elapsedMs;
    } else {
      response = await super.choose(request, remainingBudgetMs);
      elapsedMs = performance.now() - started;
    }
    const transport =
      response.status === 'success'
        ? {
            status: response.status,
            model: response.model,
            choice: response.choice,
            confidence: response.confidence,
            probabilities: response.probabilities,
            usage: response.usage,
          }
        : { status: response.status, reason: response.reason };
    this.calls.push(
      callSchema.parse({
        provider: 'typesafe',
        requestHash,
        elapsedMs,
        transport,
      }),
    );
    return response;
  }

  finish(): void {
    if (this.replayError) throw this.replayError;
    if (this.replay && this.cursor !== this.replay.length)
      throw new Error('Unused recorded calls');
  }
}
