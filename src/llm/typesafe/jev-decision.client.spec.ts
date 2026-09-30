import { JevDecisionClient } from './jev-decision.client';
import type {
  JevChoiceRequest,
  JevDecisionUnavailable,
  JevUnavailableReason,
} from './jev-decision.types';

const CONFIG = { typesafeApiKey: 'private-test-key', jevModel: 'jev-1.13.0' };
const REQUEST: JevChoiceRequest = {
  task: 'product_resolution',
  taskVersion: 'jev-product-resolution-v1',
  questionKey: 'match',
  state: { name: 'milk' },
  instructions: 'Choose a matching product.',
  criteria: { milk: 'same product', none: null },
};

function successResponse(request = REQUEST, choice = 'milk'): Response {
  return new Response(
    JSON.stringify({
      model: 'jev-2.0.0',
      answers: {
        [request.questionKey]: {
          type: 'choice',
          choice,
          confidence: 0.95,
          probabilities: { [choice]: 0.8, none: 0.2 },
        },
      },
      usage: { input_tokens: 20, output_tokens: 3 },
      privateMetadata: 'raw provider detail',
    }),
    { status: 200 },
  );
}

function unavailable(
  reason: JevUnavailableReason,
  request = REQUEST,
): JevDecisionUnavailable {
  return {
    status: 'unavailable',
    provider: 'typesafe',
    model: CONFIG.jevModel,
    task: request.task,
    taskVersion: request.taskVersion,
    reason,
  };
}

describe('JevDecisionClient HTTP', () => {
  let fetcher: jest.MockedFunction<typeof fetch>;
  let client: JevDecisionClient;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(Math, 'random').mockReturnValue(0);
    fetcher = jest.fn();
    client = new JevDecisionClient(CONFIG, fetcher);
  });

  afterEach(() => {
    const timers = jest.getTimerCount();
    jest.restoreAllMocks();
    jest.clearAllTimers();
    jest.useRealTimers();
    expect(timers).toBe(0);
  });

  function requestSignal(): AbortSignal {
    const signal = fetcher.mock.calls[0][1]?.signal;
    if (!signal) throw new Error('Expected a request AbortSignal');
    return signal;
  }

  function requestBody(): string {
    const body = fetcher.mock.calls[0][1]?.body;
    if (typeof body !== 'string')
      throw new Error('Expected a JSON request body');
    return body;
  }

  it('constructs without fetching', () => {
    expect(client.configured).toBe(true);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('sends one authenticated Choice question with redirects disabled', async () => {
    fetcher.mockImplementationOnce((_url, init) => {
      expect(init?.signal?.aborted).toBe(false);
      return Promise.resolve(successResponse());
    });
    const result = await client.choose(REQUEST);
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe('https://api.typesafe.ai/v1/systemone');
    expect(init).toEqual({
      method: 'POST',
      redirect: 'error',
      signal: requestSignal(),
      headers: {
        Authorization: 'Bearer private-test-key',
        'Content-Type': 'application/json',
      },
      body: requestBody(),
    });
    expect(requestSignal()).toBeInstanceOf(AbortSignal);
    const body: unknown = JSON.parse(requestBody());
    expect(body).toEqual({
      model: 'jev-1.13.0',
      state: REQUEST.state,
      questions: {
        match: {
          type: 'choice',
          instructions: REQUEST.instructions,
          criteria: REQUEST.criteria,
        },
      },
    });
    expect(result).toEqual({
      status: 'success',
      provider: 'typesafe',
      model: 'jev-2.0.0',
      task: REQUEST.task,
      taskVersion: REQUEST.taskVersion,
      choice: 'milk',
      confidence: 0.95,
      probabilities: { milk: 0.8, none: 0.2 },
      usage: { input_tokens: 20, output_tokens: 3 },
    });
    expect(JSON.stringify(result)).not.toContain('private-test-key');
    expect(JSON.stringify(result)).not.toContain('raw provider detail');
  });

  it('preserves prediction provenance and reserved-looking question keys', async () => {
    const request: JevChoiceRequest = {
      ...REQUEST,
      task: 'stock_prediction',
      taskVersion: 'jev-stock-prediction-v1',
      questionKey: '__proto__',
      criteria: { ['__proto__']: 'same product', none: null },
    };
    fetcher.mockResolvedValueOnce(successResponse(request, '__proto__'));
    const result = await client.choose(request);
    const body = JSON.parse(requestBody()) as {
      questions: Record<string, { criteria: Record<string, unknown> }>;
    };
    expect(Object.hasOwn(body.questions, '__proto__')).toBe(true);
    expect(Object.hasOwn(body.questions.__proto__.criteria, '__proto__')).toBe(
      true,
    );
    expect(result).toMatchObject({
      status: 'success',
      task: 'stock_prediction',
      taskVersion: request.taskVersion,
      model: 'jev-2.0.0',
    });
  });

  it.each([
    {},
    { typesafeApiKey: 'test-key' },
    { jevModel: 'jev-1.13.0' },
    { typesafeApiKey: '', jevModel: 'jev-1.13.0' },
  ])('makes no request for incomplete configuration', async (config) => {
    const disabled = new JevDecisionClient(config, fetcher);
    expect(await disabled.choose(REQUEST)).toEqual({
      ...unavailable('not_configured'),
      model: config.jevModel,
    });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('rejects invalid request JSON without networking', async () => {
    const request = { ...REQUEST, state: { quantity: NaN } };
    expect(await client.choose(request)).toEqual(
      unavailable('invalid_request'),
    );
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('does not send after the monotonic budget has elapsed during preparation', async () => {
    jest
      .spyOn(performance, 'now')
      .mockReturnValueOnce(0)
      .mockReturnValue(10_000);
    expect(await client.choose(REQUEST)).toEqual(
      unavailable('deadline_exceeded'),
    );
    expect(fetcher).not.toHaveBeenCalled();
  });

  it.each([
    [302, 'provider_error'],
    [400, 'request_rejected'],
    [401, 'authentication_error'],
    [403, 'authentication_error'],
    [404, 'request_rejected'],
    [408, 'request_rejected'],
    [422, 'request_rejected'],
    [501, 'provider_error'],
    [505, 'provider_error'],
    [599, 'provider_error'],
  ] as const)(
    'contains HTTP %i without reading raw error bodies',
    async (status, reason) => {
      const response = new Response('private raw body and headers', { status });
      const bodyRead = jest.spyOn(response, 'text');
      fetcher.mockResolvedValueOnce(response);
      expect(await client.choose(REQUEST)).toEqual(unavailable(reason));
      expect(bodyRead).not.toHaveBeenCalled();
      expect(fetcher).toHaveBeenCalledTimes(1);
      expect(requestSignal().aborted).toBe(true);
    },
  );

  it.each(['throw', 'reject'])(
    'contains a fetch %s without exposing exceptions',
    async (mode) => {
      const error = new Error('private key, prompt and provider error');
      if (mode === 'throw')
        fetcher.mockImplementationOnce(() => {
          throw error;
        });
      else fetcher.mockRejectedValueOnce(error);
      expect(await client.choose(REQUEST)).toEqual(
        unavailable('network_error'),
      );
    },
  );

  it.each(['invalid JSON', 'invalid schema'])(
    'rejects %s success bodies safely',
    async (mode) => {
      fetcher.mockResolvedValueOnce(
        new Response(
          mode === 'invalid JSON'
            ? 'private non-JSON body'
            : JSON.stringify({ privateData: 'not a Choice answer' }),
        ),
      );
      expect(await client.choose(REQUEST)).toEqual(
        unavailable('invalid_response'),
      );
      expect(fetcher).toHaveBeenCalledTimes(1);
    },
  );

  it.each([
    [new SyntaxError('private JSON detail'), 'invalid_response'],
    [new TypeError('private body read failure'), 'network_error'],
    [new Error('private provider detail'), 'network_error'],
  ] as const)('contains body consumption failures', async (error, reason) => {
    const response = successResponse();
    jest.spyOn(response, 'text').mockRejectedValueOnce(error);
    fetcher.mockResolvedValueOnce(response);
    expect(await client.choose(REQUEST)).toEqual(unavailable(reason));
  });

  describe.each([
    ['product_resolution', 'jev-product-resolution-v1', 10_000],
    ['stock_prediction', 'jev-stock-prediction-v1', 15_000],
  ] as const)('%s deadline', (task, taskVersion, budget) => {
    const request: JevChoiceRequest = { ...REQUEST, task, taskVersion };

    it('aborts hanging fetch work within the task budget', async () => {
      const aborted = jest.fn();
      fetcher.mockImplementationOnce(
        (_url, init) =>
          new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener(
              'abort',
              () => {
                aborted();
                reject(new Error('private abort detail'));
              },
              { once: true },
            );
          }),
      );
      const pending = client.choose(request);
      const settled = jest.fn();
      void pending.then(settled);
      await jest.advanceTimersByTimeAsync(budget - 1);
      expect(settled).not.toHaveBeenCalled();
      expect(requestSignal().aborted).toBe(false);
      await jest.advanceTimersByTimeAsync(1);
      expect(await pending).toEqual(unavailable('deadline_exceeded', request));
      expect(aborted).toHaveBeenCalledTimes(1);
      expect(fetcher).toHaveBeenCalledTimes(1);
    });

    it('aborts hanging body consumption within the task budget', async () => {
      const response = successResponse(request);
      const aborted = jest.fn();
      const bodyRead = jest.spyOn(response, 'text').mockImplementationOnce(
        () =>
          new Promise((_resolve, reject) => {
            requestSignal().addEventListener(
              'abort',
              () => {
                aborted();
                reject(new Error('private body abort detail'));
              },
              { once: true },
            );
          }),
      );
      fetcher.mockResolvedValueOnce(response);
      const pending = client.choose(request);
      await jest.advanceTimersByTimeAsync(0);
      expect(bodyRead).toHaveBeenCalledTimes(1);
      await jest.advanceTimersByTimeAsync(budget - 1);
      expect(requestSignal().aborted).toBe(false);
      await jest.advanceTimersByTimeAsync(1);
      expect(await pending).toEqual(unavailable('deadline_exceeded', request));
      expect(aborted).toHaveBeenCalledTimes(1);
    });
  });

  it('shares one budget between fetch and body consumption', async () => {
    const response = successResponse();
    jest
      .spyOn(response, 'text')
      .mockImplementationOnce(() => new Promise(() => {}));
    fetcher.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          setTimeout(() => resolve(response), 9_000);
        }),
    );
    const pending = client.choose(REQUEST);
    await jest.advanceTimersByTimeAsync(9_000);
    expect(jest.getTimerCount()).toBe(1);
    await jest.advanceTimersByTimeAsync(1_000);
    expect(await pending).toEqual(unavailable('deadline_exceeded'));
    expect(requestSignal().aborted).toBe(true);
  });

  it('bounds an abort-ignoring fetch and contains its late rejection', async () => {
    let rejectLate: (reason: Error) => void = () => {
      throw new Error('Fetch was not started');
    };
    fetcher.mockImplementationOnce(
      () =>
        new Promise<Response>((_resolve, reject) => {
          rejectLate = reject;
        }),
    );
    const pending = client.choose(REQUEST);
    await jest.advanceTimersByTimeAsync(10_000);
    expect(await pending).toEqual(unavailable('deadline_exceeded'));
    expect(requestSignal().aborted).toBe(true);
    rejectLate(new Error('late private provider detail'));
    await jest.advanceTimersByTimeAsync(0);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('uses monotonic time despite wall-clock changes', async () => {
    fetcher.mockImplementationOnce(() => new Promise(() => {}));
    const pending = client.choose(REQUEST);
    const elapsed = performance.now();
    jest.setSystemTime(new Date('2040-01-01T00:00:00Z'));
    expect(performance.now()).toBe(elapsed);
    await jest.advanceTimersByTimeAsync(10_000);
    expect(await pending).toEqual(unavailable('deadline_exceeded'));
  });

  it('contains a late rejection from abort-ignoring body work', async () => {
    let rejectLate: (reason: Error) => void = () => {
      throw new Error('Body was not read');
    };
    const response = successResponse();
    jest.spyOn(response, 'text').mockImplementationOnce(
      () =>
        new Promise<string>((_resolve, reject) => {
          rejectLate = reject;
        }),
    );
    fetcher.mockResolvedValueOnce(response);
    const pending = client.choose(REQUEST);
    await jest.advanceTimersByTimeAsync(10_000);
    expect(await pending).toEqual(unavailable('deadline_exceeded'));
    rejectLate(new Error('late private body detail'));
    await jest.advanceTimersByTimeAsync(0);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  describe('bounded retry', () => {
    function retryResponse(status = 503, retryAfter?: string): Response {
      return new Response('private provider error', {
        status,
        headers: retryAfter === undefined ? {} : { 'Retry-After': retryAfter },
      });
    }

    function queueRetry(response = retryResponse()): Response {
      fetcher
        .mockResolvedValueOnce(response)
        .mockResolvedValueOnce(successResponse());
      return response;
    }

    it.each([429, 529, 500, 502, 503, 504])(
      'retries HTTP %i once and returns a validated success',
      async (status) => {
        const response = queueRetry(retryResponse(status));
        const read = jest.spyOn(response, 'text');
        const cancel = jest.spyOn(response.body!, 'cancel');
        const pending = client.choose(REQUEST);
        await jest.advanceTimersByTimeAsync(249);
        expect(fetcher).toHaveBeenCalledTimes(1);
        expect(cancel).toHaveBeenCalledTimes(1);
        await jest.advanceTimersByTimeAsync(1);
        expect(await pending).toMatchObject({
          status: 'success',
          model: 'jev-2.0.0',
          taskVersion: REQUEST.taskVersion,
        });
        expect(fetcher).toHaveBeenCalledTimes(2);
        expect(fetcher.mock.calls[1]).toEqual(fetcher.mock.calls[0]);
        expect(read).not.toHaveBeenCalled();
      },
    );

    it.each([429, 529, 500, 502, 503, 504])(
      'exhausts HTTP %i after exactly two attempts',
      async (status) => {
        fetcher.mockImplementation(() =>
          Promise.resolve(retryResponse(status)),
        );
        const pending = client.choose(REQUEST);
        await jest.advanceTimersByTimeAsync(250);
        expect(await pending).toEqual(
          unavailable(status === 429 ? 'rate_limited' : 'provider_error'),
        );
        await jest.advanceTimersByTimeAsync(20_000);
        expect(fetcher).toHaveBeenCalledTimes(2);
      },
    );

    it.each([
      [401, 'authentication_error'],
      [403, 'authentication_error'],
      [422, 'request_rejected'],
      [501, 'provider_error'],
    ] as const)(
      'contains second HTTP %i without retrying again',
      async (status, reason) => {
        fetcher
          .mockResolvedValueOnce(retryResponse())
          .mockResolvedValueOnce(retryResponse(status));
        const pending = client.choose(REQUEST);
        await jest.advanceTimersByTimeAsync(250);
        expect(await pending).toEqual(unavailable(reason));
        expect(fetcher).toHaveBeenCalledTimes(2);
      },
    );

    it.each([
      [0, 250],
      [0.5, 375],
      [1, 500],
    ])('bounds jitter %s to a %i ms backoff', async (jitter, delay) => {
      jest.spyOn(Math, 'random').mockReturnValue(jitter);
      queueRetry();
      const pending = client.choose(REQUEST);
      await jest.advanceTimersByTimeAsync(delay - 1);
      expect(fetcher).toHaveBeenCalledTimes(1);
      await jest.advanceTimersByTimeAsync(1);
      expect(await pending).toMatchObject({ status: 'success' });
      expect(fetcher).toHaveBeenCalledTimes(2);
    });

    it.each([
      ['2', 2_000],
      ['0001', 1_000],
      ['0', 250],
      [' 1 ', 1_000],
    ])(
      'honors Retry-After seconds %s for at least %i ms',
      async (header, delay) => {
        queueRetry(retryResponse(429, header));
        const pending = client.choose(REQUEST);
        await jest.advanceTimersByTimeAsync(delay - 1);
        expect(fetcher).toHaveBeenCalledTimes(1);
        await jest.advanceTimersByTimeAsync(1);
        expect(await pending).toMatchObject({ status: 'success' });
      },
    );

    it.each([
      'Wed, 30 Sep 2026 12:00:02 GMT',
      'Wednesday, 30-Sep-26 12:00:02 GMT',
      'Wed Sep 30 12:00:02 2026',
    ])('honors Retry-After HTTP date %s', async (header) => {
      jest.setSystemTime(new Date('2026-09-30T12:00:00Z'));
      queueRetry(retryResponse(503, header));
      const pending = client.choose(REQUEST);
      await jest.advanceTimersByTimeAsync(1_999);
      expect(fetcher).toHaveBeenCalledTimes(1);
      await jest.advanceTimersByTimeAsync(1);
      expect(await pending).toMatchObject({ status: 'success' });
    });

    it.each([
      '',
      'nonsense',
      '-1',
      '1.5',
      '+1',
      '1e3',
      'Infinity',
      '2026-10-01',
      'Mon, 30 Feb 2026 12:00:02 GMT',
      'Wed, 30 Sep 2026 25:00:02 GMT',
    ])('ignores malformed Retry-After %s', async (header) => {
      queueRetry(retryResponse(503, header));
      const pending = client.choose(REQUEST);
      await jest.advanceTimersByTimeAsync(249);
      expect(fetcher).toHaveBeenCalledTimes(1);
      await jest.advanceTimersByTimeAsync(1);
      expect(await pending).toMatchObject({ status: 'success' });
    });

    it('uses local backoff for a past HTTP date', async () => {
      jest.setSystemTime(new Date('2026-09-30T12:00:00Z'));
      queueRetry(retryResponse(503, 'Wed, 30 Sep 2026 11:59:59 GMT'));
      const pending = client.choose(REQUEST);
      await jest.advanceTimersByTimeAsync(249);
      expect(fetcher).toHaveBeenCalledTimes(1);
      await jest.advanceTimersByTimeAsync(1);
      expect(await pending).toMatchObject({ status: 'success' });
    });

    it.each(['10', '11', '9'.repeat(400)])(
      'stops immediately if Retry-After %s consumes the budget',
      async (header) => {
        queueRetry(retryResponse(429, header));
        expect(await client.choose(REQUEST)).toEqual(
          unavailable('deadline_exceeded'),
        );
        expect(fetcher).toHaveBeenCalledTimes(1);
        expect(requestSignal().aborted).toBe(true);
      },
    );

    it('rejects an HTTP date beyond the budget without another attempt', async () => {
      jest.setSystemTime(new Date('2026-09-30T12:00:00Z'));
      queueRetry(retryResponse(503, 'Wed, 30 Sep 2026 12:00:15 GMT'));
      expect(await client.choose(REQUEST)).toEqual(
        unavailable('deadline_exceeded'),
      );
      expect(fetcher).toHaveBeenCalledTimes(1);
    });

    it.each([
      [
        'invalid JSON',
        new Response('private invalid JSON'),
        'invalid_response',
      ],
      ['invalid schema', new Response('{}'), 'invalid_response'],
      ['network rejection', new Error('private fetch detail'), 'network_error'],
    ] as const)(
      'contains second-attempt %s',
      async (_label, result, reason) => {
        fetcher.mockResolvedValueOnce(retryResponse());
        if (result instanceof Error) fetcher.mockRejectedValueOnce(result);
        else fetcher.mockResolvedValueOnce(result);
        const pending = client.choose(REQUEST);
        await jest.advanceTimersByTimeAsync(250);
        expect(await pending).toEqual(unavailable(reason));
        expect(fetcher).toHaveBeenCalledTimes(2);
      },
    );

    it('does not retry if first-attempt time leaves no room for backoff', async () => {
      fetcher.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve(retryResponse()), 9_750);
          }),
      );
      const pending = client.choose(REQUEST);
      await jest.advanceTimersByTimeAsync(9_750);
      expect(await pending).toEqual(unavailable('deadline_exceeded'));
      expect(fetcher).toHaveBeenCalledTimes(1);
    });

    it.each([
      ['product_resolution', 10_000],
      ['stock_prediction', 15_000],
    ] as const)(
      'keeps the original %s deadline during second fetch',
      async (task, budget) => {
        const request = { ...REQUEST, task };
        fetcher.mockResolvedValueOnce(retryResponse()).mockImplementationOnce(
          (_url, init) =>
            new Promise((_resolve, reject) => {
              init?.signal?.addEventListener(
                'abort',
                () => reject(new Error('private abort')),
                { once: true },
              );
            }),
        );
        const pending = client.choose(request);
        await jest.advanceTimersByTimeAsync(budget - 1);
        expect(fetcher).toHaveBeenCalledTimes(2);
        expect(requestSignal().aborted).toBe(false);
        await jest.advanceTimersByTimeAsync(1);
        expect(await pending).toEqual(
          unavailable('deadline_exceeded', request),
        );
        expect(requestSignal().aborted).toBe(true);
      },
    );

    it('shares first fetch, retry delay and second body consumption in one budget', async () => {
      const response = successResponse();
      jest
        .spyOn(response, 'text')
        .mockImplementationOnce(() => new Promise(() => {}));
      fetcher
        .mockImplementationOnce(
          () =>
            new Promise((resolve) => {
              setTimeout(() => resolve(retryResponse(503, '1')), 8_000);
            }),
        )
        .mockResolvedValueOnce(response);
      const pending = client.choose(REQUEST);
      await jest.advanceTimersByTimeAsync(8_999);
      expect(fetcher).toHaveBeenCalledTimes(1);
      await jest.advanceTimersByTimeAsync(1);
      expect(fetcher).toHaveBeenCalledTimes(2);
      await jest.advanceTimersByTimeAsync(1_000);
      expect(await pending).toEqual(unavailable('deadline_exceeded'));
      expect(requestSignal().aborted).toBe(true);
    });

    it('does not send a retry after expiry while its delay callback is queued', async () => {
      queueRetry();
      const pending = client.choose(REQUEST);
      await jest.advanceTimersByTimeAsync(0);
      expect(jest.getTimerCount()).toBe(2);
      jest.advanceTimersByTime(10_000);
      expect(await pending).toEqual(unavailable('deadline_exceeded'));
      expect(fetcher).toHaveBeenCalledTimes(1);
      expect(requestSignal().aborted).toBe(true);
    });

    it('bounds body cancellation before retry by the same deadline', async () => {
      const response = queueRetry();
      jest
        .spyOn(response.body!, 'cancel')
        .mockImplementationOnce(() => new Promise(() => {}));
      const pending = client.choose(REQUEST);
      await jest.advanceTimersByTimeAsync(10_000);
      expect(await pending).toEqual(unavailable('deadline_exceeded'));
      expect(fetcher).toHaveBeenCalledTimes(1);
    });

    it('contains a body cancellation exception without another request', async () => {
      const response = queueRetry();
      jest
        .spyOn(response.body!, 'cancel')
        .mockRejectedValueOnce(new Error('private cancellation error'));
      expect(await client.choose(REQUEST)).toEqual(
        unavailable('network_error'),
      );
      expect(fetcher).toHaveBeenCalledTimes(1);
    });

    it('rechecks the budget after releasing the first response body', async () => {
      const response = queueRetry(retryResponse(503, '9'));
      jest.spyOn(response.body!, 'cancel').mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            setTimeout(resolve, 1_000);
          }),
      );
      const pending = client.choose(REQUEST);
      await jest.advanceTimersByTimeAsync(1_000);
      expect(await pending).toEqual(unavailable('deadline_exceeded'));
      expect(fetcher).toHaveBeenCalledTimes(1);
    });

    it('contains a late rejection from an abort-ignoring second fetch', async () => {
      let rejectLate: (reason: Error) => void = () => {
        throw new Error('Second fetch was not started');
      };
      fetcher.mockResolvedValueOnce(retryResponse()).mockImplementationOnce(
        () =>
          new Promise<Response>((_resolve, reject) => {
            rejectLate = reject;
          }),
      );
      const pending = client.choose(REQUEST);
      await jest.advanceTimersByTimeAsync(10_000);
      expect(await pending).toEqual(unavailable('deadline_exceeded'));
      rejectLate(new Error('private late retry error'));
      await jest.advanceTimersByTimeAsync(0);
      expect(fetcher).toHaveBeenCalledTimes(2);
    });
  });

  it('snapshots option membership before awaiting the provider', async () => {
    const request = { ...REQUEST, criteria: { milk: 'same', none: null } };
    fetcher.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          setTimeout(() => resolve(successResponse()), 1);
        }),
    );
    const pending = client.choose(request);
    delete (request.criteria as Record<string, unknown>).milk;
    await jest.advanceTimersByTimeAsync(1);
    expect(await pending).toMatchObject({ status: 'success', choice: 'milk' });
  });
});
