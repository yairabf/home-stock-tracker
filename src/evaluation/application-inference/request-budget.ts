export class RequestBudget {
  readonly requests = { typesafe: 0, openai: 0 };
  readonly controller = new AbortController();
  private readonly expiresAt: number;
  private readonly timer: ReturnType<typeof setTimeout>;
  private readonly cancel = () => this.controller.abort();
  constructor(
    private readonly maximum: number,
    durationMs: number,
    private readonly signal?: AbortSignal,
  ) {
    this.expiresAt = performance.now() + durationMs;
    this.timer = setTimeout(this.cancel, durationMs);
    if (signal?.aborted) this.cancel();
    signal?.addEventListener('abort', this.cancel, { once: true });
  }
  get stopped(): boolean {
    return (
      this.controller.signal.aborted ||
      performance.now() >= this.expiresAt ||
      this.requests.typesafe + this.requests.openai >= this.maximum
    );
  }
  remainingMs(): number {
    return Math.max(0, this.expiresAt - performance.now());
  }
  fetch(
    provider: 'typesafe' | 'openai',
    fetcher: typeof fetch = globalThis.fetch,
  ): typeof fetch {
    return async (input, init) => {
      if (this.stopped) throw new Error('Evaluation request budget exhausted');
      this.requests[provider]++;
      const prior =
        init?.signal ?? (input instanceof Request ? input.signal : undefined);
      const signal = prior
        ? AbortSignal.any([prior, this.controller.signal])
        : this.controller.signal;
      return fetcher(input, { ...init, signal });
    };
  }
  dispose(): void {
    clearTimeout(this.timer);
    this.signal?.removeEventListener('abort', this.cancel);
  }
}
