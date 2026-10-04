import { executeEvaluation, liveConfiguration } from './runner';
import { hash, REPLAY_VERSION, type StockCase } from './dataset';
import { stockCase, stockDataset } from './fixture';
import { reconstructCase, selectedInputHash } from './reconstruction';
import {
  observationSchema,
  parseRecordedRun,
  type RecordedRun,
} from './observations';
import { JEV_STOCK_PREDICTION_VERSION } from '../../estimation/jev-stock-prediction-advisor.service';
import type { PredictedState } from '../../generated/prisma/enums';
import type { JevDecisionSuccess } from '../../llm/typesafe/jev-decision.types';

function purchase(id: string, occurredAt: string): StockCase['events'][number] {
  return {
    id,
    occurredAt,
    knownAt: occurredAt,
    eventType: 'PURCHASED',
    quantity: 2,
    unit: 'unit',
  };
}
function learnedCase(): StockCase {
  const item = stockCase();
  item.product.productType = null;
  item.tags = ['learned_history'];
  item.events = [
    purchase('purchase-new', '2026-01-01T00:00:00Z'),
    purchase('purchase-old', '2025-12-23T00:00:00Z'),
  ];
  return item;
}
function decision(
  confidence = 0.95,
  choice: PredictedState = 'probably_low',
): JevDecisionSuccess & { choice: PredictedState } {
  const states = [
    'likely_available',
    'probably_low',
    'probably_out',
    'uncertain',
  ];
  return {
    status: 'success',
    provider: 'typesafe',
    task: 'stock_prediction',
    taskVersion: JEV_STOCK_PREDICTION_VERSION,
    model: 'jev-1.14.0',
    choice,
    confidence,
    probabilities: Object.fromEntries(
      states.map((s) => [s, s === choice ? 0.97 : 0.01]),
    ),
    usage: { input_tokens: 12, output_tokens: 4 },
  };
}
function replay(
  item = learnedCase(),
  transport: RecordedRun['rows'][number]['transport'] = decision(),
): RecordedRun {
  const dataset = { ...stockDataset(), cases: [item] };
  return {
    schemaVersion: 1,
    evidenceMode: 'offline',
    datasetHash: hash(dataset),
    inputHash: selectedInputHash(dataset.cases),
    split: 'held_out',
    configuredModel: 'jev-1.13.0',
    taskVersion: JEV_STOCK_PREDICTION_VERSION,
    replayVersion: REPLAY_VERSION,
    rows: [{ caseId: item.id, elapsedMs: 15, transport }],
  };
}
const environment = {
  TYPESAFE_API_KEY: 'private-test-key',
  JEV_MODEL: 'jev-1.13.0',
};
function response(result = decision()) {
  return new Response(
    JSON.stringify({
      model: result.model,
      usage: result.usage,
      answers: {
        stock_state: {
          type: 'choice',
          choice: result.choice,
          confidence: result.confidence,
          probabilities: result.probabilities,
        },
      },
    }),
  );
}

describe('historical stock reconstruction', () => {
  it('recomputes learned statistics and candidate inputs from cutoff evidence', () => {
    const { candidate, bypassReason } = reconstructCase(learnedCase());
    expect(candidate).toMatchObject({
      predictedState: 'uncertain',
      confidenceScore: 0.6,
      signals: {
        eventCount: 2,
        coldStart: false,
        avgPurchaseIntervalDays: 9,
        observationCount: 2,
        hasLearnedStatistics: true,
        daysSinceLastPurchase: 9,
      },
    });
    expect(bypassReason).toBeNull();
  });
  it('keeps future and later-known events, feedback, labels and review out of inputs', () => {
    const item = learnedCase();
    const before = selectedInputHash([item]);
    const candidate = reconstructCase(item).candidate;
    item.events.push(
      purchase('future', '2026-01-11T00:00:00Z'),
      {
        ...purchase('backdated', '2026-01-09T00:00:00Z'),
        knownAt: '2026-01-11T00:00:00Z',
      },
      {
        ...purchase('feedback', '2026-01-11T00:00:00Z'),
        eventType: 'PREDICTION_REJECTED',
      },
    );
    item.confirmations.push({
      evidenceReference: 'confirmation',
      confirmedAt: '2026-01-10T12:00:00Z',
      state: 'out',
      sourceType: 'STOCK_OUT',
    });
    item.review.author = 'different-author';
    expect(selectedInputHash([item])).toBe(before);
    expect(reconstructCase(item).candidate).toEqual(candidate);
  });
  it('uses the latest 20 relevant inputs but all eligible statistics observations', () => {
    const item = learnedCase();
    item.events = Array.from({ length: 25 }, (_, i) =>
      purchase(
        `purchase-${i}`,
        new Date(Date.parse(item.asOf) - (i + 1) * 86400000).toISOString(),
      ),
    );
    const signals = reconstructCase(item).candidate.signals;
    expect(signals.eventCount).toBe(20);
    expect(signals.observationCount).toBe(25);
    expect(signals.avgPurchaseIntervalDays).toBe(1);
  });
  it('uses stable opaque-ID ordering on equal-time evidence', () => {
    const item = learnedCase();
    item.events = [
      purchase('z-event', '2026-01-01T00:00:00Z'),
      {
        ...purchase('a-event', '2026-01-01T00:00:00Z'),
        eventType: 'STOCK_OUT',
      },
    ];
    expect(reconstructCase(item).candidate.authoritative).toBe(true);
    expect(selectedInputHash([item])).toBe(
      selectedInputHash([{ ...item, events: [...item.events].reverse() }]),
    );
  });
});

describe('stock observations', () => {
  it('runs recorded choices through actual mapping/composition without network or database access', async () => {
    const fetcher = jest
      .spyOn(globalThis, 'fetch')
      .mockRejectedValue(new Error('Offline must not call fetch'));
    try {
      const item = learnedCase();
      const dataset = { ...stockDataset(), cases: [item] };
      const run = await executeEvaluation(dataset, 'held_out', {
        mode: 'offline',
        recorded: replay(item),
      });
      expect(run.complete).toBe(true);
      expect(run.evidenceMode).toBe('offline');
      expect(run.observations[0]).toMatchObject({
        callStatus: 'success',
        accepted: true,
        resolvedModel: 'jev-1.14.0',
        elapsedMs: 15,
        usage: { input_tokens: 12, output_tokens: 4 },
        baseline: {
          predictedState: 'uncertain',
          confidenceScore: 0.6,
          llmContributed: false,
        },
        final: {
          predictedState: 'probably_low',
          confidenceScore: 0.6,
          llmContributed: true,
        },
      });
      expect(fetcher).not.toHaveBeenCalled();
      expect(parseRecordedRun(run.recording, dataset, 'held_out')).toEqual(
        replay(item),
      );
    } finally {
      fetcher.mockRestore();
    }
  });
  it.each(['disabled', 'zero_history', 'authoritative', 'high_confidence'])(
    'never requests advice for %s',
    async (reason) => {
      const item = stockCase();
      if (reason === 'disabled') item.product.predictionEnabled = false;
      if (reason === 'authoritative')
        item.events = [
          {
            ...purchase('direct', '2026-01-09T00:00:00Z'),
            eventType: 'STOCK_OUT',
          },
        ];
      if (reason === 'high_confidence')
        item.events = [
          purchase('new', '2026-01-09T00:00:00Z'),
          purchase('old', '2026-01-01T00:00:00Z'),
        ];
      const fetcher = jest.fn<
        ReturnType<typeof fetch>,
        Parameters<typeof fetch>
      >();
      const run = await executeEvaluation(
        { ...stockDataset(), cases: [item] },
        'held_out',
        { mode: 'live', environment, fetcher },
      );
      expect(run.observations[0]).toMatchObject({
        callStatus: 'skipped',
        bypassReason: reason,
        accepted: false,
        resolvedModel: null,
      });
      expect(fetcher).not.toHaveBeenCalled();
    },
  );
  it.each([
    [0.89, 'probably_low', 'low_confidence'],
    [0.95, 'uncertain', 'uncertain'],
  ] as const)(
    'records a validated rejected answer at %s/%s',
    async (confidence, choice, rejectionReason) => {
      const item = learnedCase();
      const run = await executeEvaluation(
        { ...stockDataset(), cases: [item] },
        'held_out',
        {
          mode: 'offline',
          recorded: replay(item, decision(confidence, choice)),
        },
      );
      expect(run.observations[0]).toMatchObject({
        callStatus: 'success',
        accepted: false,
        rejectionReason,
        final: {
          predictedState: 'uncertain',
          confidenceScore: 0.6,
          llmContributed: false,
        },
      });
    },
  );
  it('preserves insufficient cold-start uncertainty while retaining the rejected choice', async () => {
    const item = learnedCase();
    item.events.pop();
    const run = await executeEvaluation(
      { ...stockDataset(), cases: [item] },
      'held_out',
      { mode: 'offline', recorded: replay(item) },
    );
    expect(run.observations[0]).toMatchObject({
      accepted: false,
      rejectionReason: 'insufficient_cold_start',
      coldStart: true,
    });
  });
  it('retains the deterministic final state when accepted advice disagrees', async () => {
    const item = learnedCase();
    item.asOf = '2026-01-12T00:00:00Z';
    const run = await executeEvaluation(
      { ...stockDataset(), cases: [item] },
      'held_out',
      {
        mode: 'offline',
        recorded: replay(item, decision(0.95, 'probably_out')),
      },
    );
    expect(run.observations[0]).toMatchObject({
      accepted: true,
      rawDecision: { choice: 'probably_out' },
      baseline: { predictedState: 'probably_low' },
      final: { predictedState: 'probably_low' },
    });
  });
  it('uses real transport validation and retains actual resolved model and usage with injected live HTTP', async () => {
    const item = learnedCase();
    const fetcher = jest
      .fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>()
      .mockResolvedValue(response());
    const run = await executeEvaluation(
      { ...stockDataset(), cases: [item] },
      'held_out',
      { mode: 'live', environment, fetcher },
    );
    expect(run.configuredModel).toBe('jev-1.13.0');
    expect(run.observations[0]).toMatchObject({
      resolvedModel: 'jev-1.14.0',
      accepted: true,
      usage: { input_tokens: 12, output_tokens: 4 },
    });
    const body = JSON.parse(fetcher.mock.calls[0][1]!.body as string) as Record<
      string,
      unknown
    >;
    expect(JSON.stringify(body)).not.toMatch(
      /safety-case|episode|review|confirmations|childAgeGroups|predictionPreferences/,
    );
    expect(JSON.stringify(run)).not.toContain('private-test-key');
  });
  it.each(['malformed', 'network', 'authentication'])(
    'keeps baseline on %s failure with sanitized reason',
    async (kind) => {
      const item = learnedCase();
      const fetcher = jest.fn<
        ReturnType<typeof fetch>,
        Parameters<typeof fetch>
      >();
      if (kind === 'network')
        fetcher.mockRejectedValue(new Error('private error'));
      else
        fetcher.mockResolvedValue(
          kind === 'malformed'
            ? new Response('not json')
            : new Response('private error', { status: 401 }),
        );
      const run = await executeEvaluation(
        { ...stockDataset(), cases: [item] },
        'held_out',
        { mode: 'live', environment, fetcher },
      );
      expect(run.observations[0]).toMatchObject({
        callStatus: 'unavailable',
        accepted: false,
        failureReason:
          kind === 'malformed'
            ? 'invalid_response'
            : kind === 'network'
              ? 'network_error'
              : 'authentication_error',
      });
      expect(run.observations[0].final).toEqual(run.observations[0].baseline);
      expect(JSON.stringify(run)).not.toContain('private error');
    },
  );
  it('marks cancellation incomplete and schedules no subsequent cases', async () => {
    const first = learnedCase();
    const second = {
      ...learnedCase(),
      id: 'second',
      episodeId: 'second',
      productGroupId: 'second',
    };
    const controller = new AbortController();
    const fetcher = jest
      .fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>()
      .mockImplementation(async () => {
        controller.abort();
        return response();
      });
    const run = await executeEvaluation(
      { ...stockDataset(), cases: [first, second] },
      'held_out',
      { mode: 'live', environment, fetcher },
      { signal: controller.signal },
    );
    expect(run.complete).toBe(false);
    expect(run.observations).toHaveLength(1);
    expect(run.selectedCaseCount).toBe(2);
    expect(fetcher).toHaveBeenCalledTimes(1);
    await expect(
      executeEvaluation(
        { ...stockDataset(), cases: [first, second] },
        'held_out',
        { mode: 'offline', recorded: run.recording },
      ),
    ).rejects.toThrow();
  });
  it('validates configuration and selected dataset before any request', async () => {
    expect(() =>
      liveConfiguration({
        TYPESAFE_API_KEY: 'private-test-key',
        JEV_MODEL: 'latest',
      }),
    ).toThrow();
    const fetcher = jest.fn<
      ReturnType<typeof fetch>,
      Parameters<typeof fetch>
    >();
    await expect(
      executeEvaluation(stockDataset(), 'tuning', {
        mode: 'live',
        environment,
        fetcher,
      }),
    ).rejects.toThrow();
    await expect(
      executeEvaluation(stockDataset(), 'held_out', {
        mode: 'live',
        environment: {},
        fetcher,
      }),
    ).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('rejects invalid derived arithmetic before scheduling live requests', async () => {
    const item = learnedCase();
    item.events.forEach((event) => {
      event.quantity = Number.MAX_VALUE;
    });
    const fetcher = jest.fn<
      ReturnType<typeof fetch>,
      Parameters<typeof fetch>
    >();
    await expect(
      executeEvaluation({ ...stockDataset(), cases: [item] }, 'held_out', {
        mode: 'live',
        environment,
        fetcher,
      }),
    ).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('rejects inconsistent observation statuses', async () => {
    const item = learnedCase();
    const run = await executeEvaluation(
      { ...stockDataset(), cases: [item] },
      'held_out',
      { mode: 'offline', recorded: replay(item) },
    );
    expect(
      observationSchema.safeParse({ ...run.observations[0], accepted: false })
        .success,
    ).toBe(false);
    const row = run.observations[0];
    expect(
      observationSchema.safeParse({
        ...row,
        final: { ...row.final, confidenceScore: 1 },
      }).success,
    ).toBe(false);
    expect(
      observationSchema.safeParse({
        ...row,
        rawDecision: { choice: 'probably_low', confidence: 0.89 },
      }).success,
    ).toBe(false);
    expect(
      observationSchema.safeParse({
        ...row,
        final: { ...row.final, predictedState: 'likely_available' },
      }).success,
    ).toBe(false);
  });
});

describe('recorded run validation', () => {
  it.each([
    'datasetHash',
    'inputHash',
    'taskVersion',
    'replayVersion',
    'split',
  ])('rejects mismatched %s', (field) => {
    const run = { ...replay(), [field]: 'wrong' };
    expect(() =>
      parseRecordedRun(
        run,
        { ...stockDataset(), cases: [learnedCase()] },
        'held_out',
      ),
    ).toThrow();
  });
  it('rejects duplicate, missing, foreign and bypass-incompatible rows', () => {
    const dataset = { ...stockDataset(), cases: [learnedCase()] };
    const run = replay();
    for (const rows of [
      [],
      [...run.rows, ...run.rows],
      [{ ...run.rows[0], caseId: 'foreign' }],
      [{ ...run.rows[0], transport: null }],
    ])
      expect(() =>
        parseRecordedRun({ ...run, rows }, dataset, 'held_out'),
      ).toThrow();
  });
  it('rejects invalid probabilities rather than trusting recorded advice', () => {
    const dataset = { ...stockDataset(), cases: [learnedCase()] };
    const result = decision();
    result.probabilities = { probably_low: 1 };
    expect(() =>
      parseRecordedRun(replay(learnedCase(), result), dataset, 'held_out'),
    ).toThrow();
    result.probabilities = {
      likely_available: 0.7,
      probably_low: 0.1,
      probably_out: 0.1,
      uncertain: 0.1,
    };
    expect(() =>
      parseRecordedRun(replay(learnedCase(), result), dataset, 'held_out'),
    ).toThrow();
  });
});
