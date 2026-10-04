import {
  metricsSchema,
  ratio,
  scoreCases,
  sliceMetrics,
  wilsonInterval,
} from './metrics';
import { stockDataset } from './fixture';
import { hash, REPLAY_VERSION } from './dataset';
import { executeEvaluation } from './runner';
import { JEV_STOCK_PREDICTION_VERSION } from '../../estimation/jev-stock-prediction-advisor.service';
import { stockCase } from './fixture';
import { reconstructCase, selectedInputHash } from './reconstruction';
import type { StockCase } from './dataset';
import type { StockObservation } from './observations';

function item(
  id: string,
  truth: 'available' | 'low' | 'out' | null,
): StockCase {
  const c = stockCase();
  c.id = id;
  c.episodeId = id;
  c.productGroupId = id;
  c.product.productType = null;
  c.tags = ['learned_history', 'overlapping'];
  c.events = ['2026-01-01T00:00:00Z', '2025-12-23T00:00:00Z'].map(
    (date, i) => ({
      id: `purchase-${i}`,
      eventType: 'PURCHASED',
      occurredAt: date,
      knownAt: date,
      quantity: 2,
      unit: null,
    }),
  );
  c.confirmations = truth
    ? [
        {
          evidenceReference: id,
          confirmedAt: '2026-01-10T12:00:00Z',
          state: truth,
          sourceType:
            truth === 'available'
              ? 'STOCK_CONFIRMED'
              : truth === 'low'
                ? 'STOCK_LOW'
                : 'STOCK_OUT',
        },
      ]
    : [];
  return c;
}
function row(
  c: StockCase,
  kind: 'accepted_low' | 'accepted_out' | 'rejected' | 'failure' | 'bypass',
  elapsedMs = 10,
): StockObservation {
  const { candidate, bypassReason } = reconstructCase(c);
  const bypass = kind === 'bypass';
  const failure = kind === 'failure';
  const accepted = kind.startsWith('accepted');
  const choice =
    kind === 'accepted_out'
      ? 'probably_out'
      : kind === 'rejected'
        ? 'uncertain'
        : 'probably_low';
  const baseline = {
    predictedState: candidate.predictedState,
    confidenceScore: candidate.confidenceScore,
    llmContributed: false,
  };
  return {
    caseId: c.id,
    inputHash: selectedInputHash([c]),
    bypassReason,
    callStatus: bypass ? 'skipped' : failure ? 'unavailable' : 'success',
    failureReason: failure ? 'network_error' : null,
    resolvedModel: bypass || failure ? null : 'jev-1.13.0',
    elapsedMs,
    usage: bypass || failure ? null : { input_tokens: 10, output_tokens: 2 },
    rawDecision: bypass || failure ? null : { choice, confidence: 0.95 },
    accepted,
    rejectionReason: kind === 'rejected' ? 'uncertain' : null,
    baseline,
    final: accepted
      ? { ...baseline, predictedState: choice, llmContributed: true }
      : baseline,
    coldStart: candidate.signals.coldStart,
    hasLearnedStatistics: candidate.signals.hasLearnedStatistics,
  };
}
function cohort() {
  const cases = [
    item('correct', 'low'),
    item('false-prompt', 'available'),
    item('rejection', 'out'),
    item('failure', 'available'),
    item('direct', 'low'),
    item('missing', null),
  ];
  cases[4].events = [
    {
      id: 'direct-low',
      eventType: 'STOCK_LOW',
      occurredAt: '2026-01-09T00:00:00Z',
      knownAt: '2026-01-09T00:00:00Z',
      quantity: null,
      unit: null,
    },
  ];
  return {
    cases,
    rows: cases.map((c, i) =>
      row(
        c,
        (
          [
            'accepted_out',
            'accepted_low',
            'rejected',
            'failure',
            'bypass',
            'accepted_low',
          ] as const
        )[i],
        (i + 1) * 10,
      ),
    ),
  };
}

describe('stock outcome metrics', () => {
  it('scores actual zero-history runner output without reintroducing stale confidence', async () => {
    const dataset = stockDataset();
    const run = await executeEvaluation(dataset, 'held_out', {
      mode: 'offline',
      recorded: {
        schemaVersion: 1,
        evidenceMode: 'offline',
        datasetHash: hash(dataset),
        inputHash: selectedInputHash(dataset.cases),
        split: 'held_out',
        configuredModel: 'jev-1.13.0',
        taskVersion: JEV_STOCK_PREDICTION_VERSION,
        replayVersion: REPLAY_VERSION,
        rows: [{ caseId: dataset.cases[0].id, elapsedMs: 0, transport: null }],
      },
    });
    const metrics = scoreCases(dataset.cases, run.observations);
    expect(metrics.final.uncertainty).toEqual(ratio(1, 1));
    expect(metrics.provider.bypassReasons).toEqual({ zero_history: 1 });
    expect(metrics.eligibleAcceptance).toEqual(ratio(0, 0));
  });
  it('reports hand-counted binary and exact precision without attributing bypasses to Jev', () => {
    const { cases, rows } = cohort();
    const m = scoreCases(cases, rows);
    expect(m.acceptedLowOutPrecision).toEqual(ratio(1, 2));
    expect(m.acceptedExactLowOutPrecision).toEqual(ratio(0, 2));
    expect(m.final.lowOutPrecision).toEqual(ratio(2, 3));
    expect(m.final.exactLowOutPrecision).toEqual(ratio(1, 3));
    expect(m.baseline.lowOutPrecision).toEqual(ratio(1, 1));
    expect(m.acceptedCount).toBe(3);
    expect(m.rawDisagreementCount).toBe(3);
    expect(m.stateChangeCount).toBe(3);
    expect(m.final.confusion.low.probably_out).toBe(1);
    expect(m.final.confusion.low.probably_low).toBe(1);
    expect(m.final.confusion.available.probably_low).toBe(1);
    expect(m.final.confusion.out.uncertain).toBe(1);
  });
  it('keeps missing labels, failures, coverage and uncertainty denominators distinct', () => {
    const { cases, rows } = cohort();
    const m = scoreCases(cases, rows);
    expect(m.acceptedCoverage).toEqual(ratio(3, 6));
    expect(m.eligibleAcceptance).toEqual(ratio(3, 5));
    expect(m.scoredCoverage).toEqual(ratio(5, 6));
    expect(m.unscoredReasons).toEqual({ missing_confirmation: 1 });
    expect(m.final.uncertainty).toEqual(ratio(2, 6));
    expect(m.baseline.uncertainty).toEqual(ratio(5, 6));
    expect(m.final.needRecall).toEqual(ratio(2, 3));
    expect(m.baseline.needRecall).toEqual(ratio(1, 3));
    expect(m.acceptedFalsePromptProxy).toEqual(ratio(1, 2));
    expect(m.final.falsePromptProxy).toEqual(ratio(1, 3));
    expect(m.rawLowOutPrecision).toEqual(ratio(1, 2));
  });
  it('keeps all selected cases in partial-run coverage denominators', () => {
    const { cases, rows } = cohort();
    const m = scoreCases(cases, rows.slice(0, 1));
    expect(m.selectedCaseCount).toBe(6);
    expect(m.completedCaseCount).toBe(1);
    expect(m.acceptedCoverage).toEqual(ratio(1, 6));
    expect(m.eligibleAcceptance).toEqual(ratio(1, 5));
    expect(m.scoredCoverage).toEqual(ratio(1, 6));
    expect(m.acceptedLowOutPrecision).toEqual(ratio(1, 1));
  });
  it('reports provider diagnostics only for actual calls', () => {
    const { cases, rows } = cohort();
    const m = scoreCases(cases, rows);
    expect(m.provider).toEqual({
      calls: 5,
      successes: 4,
      failures: 1,
      bypasses: 1,
      validatedRejections: 1,
      failureRate: ratio(1, 5),
      failureReasons: { network_error: 1 },
      rejectionReasons: { uncertain: 1 },
      bypassReasons: { authoritative: 1 },
      latencyMs: { p50: 30, p95: 60 },
      tokens: { input: 40, output: 8, missingUsageCount: 1 },
    });
    expect(m.confirmationLagHours).toEqual({ p50: 12, p95: 12 });
  });
  it('returns null for unobserved ratios, latencies and intervals', () => {
    const m = scoreCases([item('unprocessed', null)], []);
    expect(m.acceptedLowOutPrecision).toEqual(ratio(0, 0));
    expect(m.acceptedPrecisionInterval95).toBeNull();
    expect(m.provider.failureRate).toEqual(ratio(0, 0));
    expect(m.provider.latencyMs).toEqual({ p50: null, p95: null });
    expect(m.final.uncertainty).toEqual(ratio(0, 0));
    expect(m.acceptedCoverage).toEqual(ratio(0, 1));
  });
  it('does not score censored or late outcomes as available', () => {
    const c = item('censored', 'low');
    c.events.push({
      id: 'intervening',
      eventType: 'STOCK_CONSUMED',
      occurredAt: '2026-01-10T01:00:00Z',
      knownAt: '2026-01-10T01:00:00Z',
      quantity: 1,
      unit: null,
    });
    const m = scoreCases([c], [row(c, 'accepted_low')]);
    expect(m.acceptedLowOutPrecision).toEqual(ratio(0, 0));
    expect(m.unscoredReasons).toEqual({ intervening_mutation: 1 });
    c.events.pop();
    c.confirmations[0].confirmedAt = '2026-01-12T00:00:00Z';
    expect(scoreCases([c], [row(c, 'accepted_low')]).unscoredReasons).toEqual({
      late_confirmation: 1,
    });
  });
  it('rejects duplicate, foreign or evidence-inconsistent rows and altered baselines', () => {
    const { cases, rows } = cohort();
    expect(() => scoreCases(cases, [rows[0], rows[0]])).toThrow();
    expect(() =>
      scoreCases(cases, [{ ...rows[0], caseId: 'foreign' }]),
    ).toThrow();
    expect(() =>
      scoreCases(cases, [{ ...rows[0], inputHash: '0'.repeat(64) }]),
    ).toThrow();
    expect(() =>
      scoreCases(cases, [{ ...rows[0], coldStart: true }]),
    ).toThrow();
    const r = rows[3];
    expect(() =>
      scoreCases(cases, [
        {
          ...r,
          baseline: { ...r.baseline, predictedState: 'likely_available' },
          final: { ...r.final, predictedState: 'likely_available' },
        },
      ]),
    ).toThrow('Baseline');
  });
  it('validates ratio counts and counter consistency', () => {
    const { cases, rows } = cohort();
    const m = scoreCases(cases, rows);
    expect(
      metricsSchema.safeParse({
        ...m,
        acceptedCoverage: { numerator: 3, denominator: 6, value: 0.9 },
      }).success,
    ).toBe(false);
    expect(metricsSchema.safeParse({ ...m, acceptedCount: 100 }).success).toBe(
      false,
    );
  });
  it('shows finite Wilson intervals at both extremes and no interval without samples', () => {
    expect(wilsonInterval(0, 0)).toBeNull();
    expect(wilsonInterval(50, 50)!.lower).toBeCloseTo(0.92865, 4);
    expect(wilsonInterval(0, 50)!.upper).toBeCloseTo(0.07135, 4);
    expect(wilsonInterval(47, 50)!.lower).toBeLessThan(0.94);
  });
  it('reports overlapping slices with their own denominators and deduplicates tags', () => {
    const { cases, rows } = cohort();
    cases[0].tags.push('overlapping');
    const slices = sliceMetrics(cases, rows);
    expect(
      slices.find(
        (s) => s.dimension === 'cold_start' && s.value === 'cold_start',
      )!.metrics.selectedCaseCount,
    ).toBe(1);
    expect(
      slices.find((s) => s.dimension === 'tag' && s.value === 'overlapping')!
        .metrics.selectedCaseCount,
    ).toBe(6);
    expect(
      slices.find((s) => s.dimension === 'split')!.metrics
        .acceptedLowOutPrecision,
    ).toEqual(ratio(1, 2));
    expect(() =>
      sliceMetrics(cases, [{ ...rows[0], caseId: 'foreign' }]),
    ).toThrow();
  });
});
