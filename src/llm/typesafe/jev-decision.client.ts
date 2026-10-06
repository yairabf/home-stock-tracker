import type { ModelConfig } from '../../config/application-config';
import type {
  JevChoiceRequest,
  JevDecisionResult,
  JevDecisionUnavailable,
  JevTask,
  JevUnavailableReason,
} from './jev-decision.types';
import {
  validateJevChoiceRequest,
  validateJevChoiceResponse,
} from './jev-decision.validation';

const CHOICE_ENDPOINT = 'https://api.typesafe.ai/v1/systemone';
const RETRYABLE_STATUSES = new Set([429, 529, 500, 502, 503, 504]);
export const TASK_BUDGET_MS: Record<JevTask, number> = {
  product_resolution: 10_000,
  product_understanding: 10_000,
  shelf_life_policy: 15_000,
  stock_prediction: 15_000,
};

export class JevDecisionClient {
  constructor(
    private readonly configuration: Pick<
      ModelConfig,
      'typesafeApiKey' | 'jevModel'
    >,
    private readonly fetcher: typeof fetch = globalThis.fetch,
  ) {}

  get configured(): boolean {
    return Boolean(
      this.configuration.typesafeApiKey && this.configuration.jevModel,
    );
  }

  get model(): string | undefined {
    return this.configuration.jevModel;
  }

  async choose(
    request: JevChoiceRequest,
    remainingBudgetMs?: number,
  ): Promise<JevDecisionResult> {
    const maximum = TASK_BUDGET_MS[request.task];
    if (maximum === undefined)
      return this.unavailable(request, 'invalid_request');
    if (
      remainingBudgetMs !== undefined &&
      (!Number.isFinite(remainingBudgetMs) || remainingBudgetMs <= 0)
    )
      return this.unavailable(request, 'deadline_exceeded');
    const budget =
      remainingBudgetMs === undefined
        ? maximum
        : Math.min(maximum, remainingBudgetMs);
    if (!Number.isFinite(budget) || budget <= 0)
      return this.unavailable(request, 'deadline_exceeded');
    const expiresAt = performance.now() + budget;
    if (!this.configured) return this.unavailable(request, 'not_configured');
    const parsed = validateJevChoiceRequest(request);
    if (parsed.status === 'invalid')
      return this.unavailable(request, parsed.reason);
    const validatedRequest = {
      ...parsed.value,
      criteria: { ...parsed.value.criteria },
    };
    let body: string;
    try {
      body = this.requestBody(validatedRequest);
    } catch {
      return this.unavailable(validatedRequest, 'invalid_request');
    }
    if (performance.now() >= expiresAt)
      return this.unavailable(validatedRequest, 'deadline_exceeded');
    const deadline = new ChoiceDeadline(expiresAt);
    try {
      const result = await this.execute(validatedRequest, body, deadline);
      return deadline.expired()
        ? this.unavailable(validatedRequest, 'deadline_exceeded')
        : result;
    } catch {
      return this.unavailable(
        validatedRequest,
        deadline.expired() ? 'deadline_exceeded' : 'network_error',
      );
    } finally {
      deadline.dispose();
    }
  }

  private requestBody(request: JevChoiceRequest): string {
    return JSON.stringify({
      model: this.model,
      state: request.state,
      questions: {
        [request.questionKey]: {
          type: 'choice',
          instructions: request.instructions,
          criteria: request.criteria,
        },
      },
    });
  }

  private async execute(
    request: JevChoiceRequest,
    body: string,
    deadline: ChoiceDeadline,
  ): Promise<JevDecisionResult> {
    for (let attempt = 0; attempt < 2; attempt++) {
      if (deadline.expired())
        return this.unavailable(request, 'deadline_exceeded');
      const response = await this.send(body, deadline);
      if (deadline.expired())
        return this.unavailable(request, 'deadline_exceeded');
      if (response.ok) return this.readResponse(response, request, deadline);
      if (attempt === 1 || !RETRYABLE_STATUSES.has(response.status))
        return this.unavailable(request, httpFailureReason(response.status));
      const delay = Math.max(
        250 + Math.random() * 250,
        retryAfterMs(response.headers.get('Retry-After')),
      );
      if (delay >= deadline.remaining())
        return this.unavailable(request, 'deadline_exceeded');
      if (response.body) await deadline.wait(response.body.cancel());
      if (delay >= deadline.remaining())
        return this.unavailable(request, 'deadline_exceeded');
      await deadline.sleep(delay);
    }
    return this.unavailable(request, 'provider_error');
  }

  private send(body: string, deadline: ChoiceDeadline): Promise<Response> {
    return deadline.wait(
      this.fetcher(CHOICE_ENDPOINT, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.configuration.typesafeApiKey}`,
          'Content-Type': 'application/json',
        },
        body,
        redirect: 'error',
        signal: deadline.controller.signal,
      }),
    );
  }

  private async readResponse(
    response: Response,
    request: JevChoiceRequest,
    deadline: ChoiceDeadline,
  ): Promise<JevDecisionResult> {
    if (deadline.expired())
      return this.unavailable(request, 'deadline_exceeded');
    let raw: unknown;
    try {
      const text = await deadline.wait(response.text());
      raw = JSON.parse(text) as unknown;
    } catch (error) {
      return this.unavailable(
        request,
        error instanceof SyntaxError ? 'invalid_response' : 'network_error',
      );
    }
    const parsed = validateJevChoiceResponse(raw, request);
    if (parsed.status === 'invalid')
      return this.unavailable(request, parsed.reason);
    return {
      status: 'success',
      provider: 'typesafe',
      task: request.task,
      taskVersion: request.taskVersion,
      ...parsed.value,
    };
  }

  private unavailable(
    request: JevChoiceRequest,
    reason: JevUnavailableReason,
  ): JevDecisionUnavailable {
    return {
      status: 'unavailable',
      provider: 'typesafe',
      model: this.model,
      task: request.task,
      taskVersion: request.taskVersion,
      reason,
    };
  }
}

function retryAfterMs(value: string | null): number {
  if (!value) return 0;
  const trimmed = value.trim();
  if (/^\d+$/.test(trimmed)) return Number(trimmed) * 1_000;
  // HTTP dates are UTC, including asctime values that omit the GMT suffix.
  const date = new Date(trimmed.endsWith('GMT') ? trimmed : `${trimmed} GMT`);
  if (!Number.isFinite(date.getTime())) return 0;
  const utc = date.toUTCString();
  const weekday = [
    'Sunday',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
  ][date.getUTCDay()];
  // Accept the three HTTP-date formats, excluding normalized invalid calendars.
  const rfc850 = `${weekday}, ${utc.slice(5, 7)}-${utc.slice(8, 11)}-${utc.slice(14, 16)} ${utc.slice(17, 25)} GMT`;
  const asctime = `${utc.slice(0, 3)} ${utc.slice(8, 11)} ${String(date.getUTCDate()).padStart(2, ' ')} ${utc.slice(17, 25)} ${utc.slice(12, 16)}`;
  if (trimmed !== utc && trimmed !== rfc850 && trimmed !== asctime) return 0;
  return Math.max(0, date.getTime() - Date.now());
}

function httpFailureReason(status: number): JevUnavailableReason {
  if (status === 401 || status === 403) return 'authentication_error';
  if (status === 429) return 'rate_limited';
  if (status >= 400 && status < 500) return 'request_rejected';
  return 'provider_error';
}

class ChoiceDeadline {
  readonly controller = new AbortController();
  private readonly expiration: Promise<never>;
  private timer: ReturnType<typeof setTimeout>;

  constructor(private readonly expiresAt: number) {
    this.expiration = new Promise((_, reject) => {
      this.timer = setTimeout(
        () => {
          this.controller.abort();
          reject(new Error('Choice deadline exceeded'));
        },
        Math.max(0, expiresAt - performance.now()),
      );
    });
  }

  expired(): boolean {
    return this.controller.signal.aborted || this.remaining() <= 0;
  }

  remaining(): number {
    return Math.max(0, this.expiresAt - performance.now());
  }

  wait<T>(operation: Promise<T>): Promise<T> {
    return Promise.race([operation, this.expiration]);
  }

  async sleep(delay: number): Promise<void> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await this.wait(
        new Promise<void>((resolve) => {
          timer = setTimeout(resolve, delay);
        }),
      );
    } finally {
      clearTimeout(timer);
    }
  }

  dispose(): void {
    clearTimeout(this.timer);
    this.controller.abort();
  }
}
