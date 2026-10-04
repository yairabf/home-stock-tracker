import { stockCase, stockDataset } from './fixture';
import { executeEvaluation } from './runner';
import {
  createEvaluationReport,
  parseEvaluationReport,
  summarizeReport,
} from './report';
import { reportSchema } from './report-contract';
import { hash, type StockDataset } from './dataset';

// Historical/reviewer fields below are unit-test fixtures, never launch evidence.
function cohort(count = 50, wrong = 0): StockDataset {
  return {
    ...stockDataset(),
    cases: Array.from({ length: count }, (_, i) => ({
      ...stockCase(),
      id: `case-${i}`,
      episodeId: `episode-${i}`,
      productGroupId: `group-${i}`,
      source: 'historical' as const,
      product: { ...stockCase().product, productType: null },
      events: ['2026-01-01T00:00:00Z', '2025-12-23T00:00:00Z'].map((at, j) => ({
        id: `purchase-${i}-${j}`,
        occurredAt: at,
        knownAt: at,
        eventType: 'PURCHASED' as const,
        quantity: 2,
        unit: 'unit',
      })),
      confirmations: [
        {
          evidenceReference: `label-${i}`,
          confirmedAt: '2026-01-10T12:00:00Z',
          state: i < wrong ? ('available' as const) : ('low' as const),
          sourceType: 'STOCK_CORRECTED' as const,
        },
      ],
      review: {
        author: 'test-author',
        status: 'reviewed' as const,
        reviewer: 'test-reviewer',
        reviewedAt: '2026-01-11T00:00:00Z',
        evidenceReference: `review-${i}`,
        episodeComplete: true,
      },
    })),
  };
}
async function run(
  dataset = cohort(),
  failFirst = false,
  signal?: AbortSignal,
) {
  let calls = 0;
  const execution = await executeEvaluation(
    dataset,
    'held_out',
    {
      mode: 'live',
      environment: { TYPESAFE_API_KEY: 'test-key', JEV_MODEL: 'jev-1.13.0' },
      fetcher: async () => {
        if (failFirst && calls++ === 0)
          return new Response('{}', { status: 401 });
        return new Response(
          JSON.stringify({
            model: 'jev-1.13.0',
            usage: { input_tokens: 12, output_tokens: 4 },
            answers: {
              stock_state: {
                type: 'choice',
                choice: 'probably_low',
                confidence: 0.95,
                probabilities: {
                  likely_available: 0.01,
                  probably_low: 0.97,
                  probably_out: 0.01,
                  uncertain: 0.01,
                },
              },
            },
          }),
        );
      },
    },
    {
      signal,
      purpose: 'evaluation',
      codeRevision: 'a'.repeat(40),
      codeDirty: false,
    },
  );
  return {
    dataset,
    execution,
    report: createEvaluationReport(dataset, execution),
  };
}

describe('evaluation report and launch evidence', () => {
  it('round-trips a report through dataset-bound validation', async () => {
    const { dataset, report } = await run();
    expect(report.launchEvidence).toBe('eligible');
    expect(report.metrics.acceptedLowOutPrecision).toEqual({
      numerator: 50,
      denominator: 50,
      value: 1,
    });
    expect(
      parseEvaluationReport(JSON.parse(JSON.stringify(report)), dataset),
    ).toEqual(report);
    expect(summarizeReport(report)).toContain('100.00% (50/50)');
    expect(summarizeReport(report)).not.toMatch(
      /test-key|test-reviewer|label-0|review-0/,
    );
  });
  it('uses the inclusive 95% boundary', async () => {
    expect((await run(cohort(60, 3))).report.launchEvidence).toBe('eligible');
    const { report } = await run(cohort(60, 4));
    expect(report.launchEvidence).toBe('failed');
    expect(report.launchReasons).toContain('precision_below_95_percent');
  });
  it('requires 50 scored accepted outcomes, without counting missing labels', async () => {
    expect((await run(cohort(49))).report.launchEvidence).toBe('inconclusive');
    const dataset = cohort();
    dataset.cases[0].confirmations = [];
    const { report } = await run(dataset);
    expect(report.metrics.acceptedCount).toBe(50);
    expect(report.metrics.acceptedLowOutPrecision.denominator).toBe(49);
    expect(report.launchEvidence).toBe('inconclusive');
  });
  it('fails otherwise qualifying evidence when a provider call fails', async () => {
    const { report } = await run(cohort(51), true);
    expect(report.metrics.acceptedLowOutPrecision.denominator).toBe(50);
    expect(report.launchEvidence).toBe('failed');
    expect(report.launchReasons).toEqual(['provider_failures']);
  });
  it.each([
    ['offline_evidence', { evidenceMode: 'offline' }],
    ['smoke_only', { purpose: 'smoke' }],
    ['dirty_relevant_code', { codeDirty: true }],
    ['missing_code_revision', { codeRevision: null }],
  ])('keeps %s inconclusive', async (reason, patch) => {
    const { dataset, execution } = await run();
    const report = createEvaluationReport(dataset, { ...execution, ...patch });
    expect(report.launchEvidence).toBe('inconclusive');
    expect(report.launchReasons).toContain(reason);
  });
  it('requires historical provenance and held-out cases', async () => {
    const authored = cohort();
    authored.cases.forEach((c) => {
      c.source = 'authored';
    });
    expect((await run(authored)).report.launchReasons).toContain(
      'non_historical_cases',
    );
    const { dataset, execution } = await run();
    dataset.cases.forEach((c) => {
      c.split = 'tuning';
    });
    execution.split = 'tuning';
    execution.recording.split = 'tuning';
    execution.datasetHash = hash(dataset);
    execution.recording.datasetHash = hash(dataset);
    const report = createEvaluationReport(dataset, execution);
    expect(report.launchEvidence).toBe('inconclusive');
    expect(report.launchReasons).toContain('tuning_split');
  });
  it('requires labels frozen before the run', async () => {
    const dataset = cohort();
    dataset.cases.forEach((c) => {
      c.review.reviewedAt = '2099-01-11T00:00:00Z';
    });
    const { report } = await run(dataset);
    expect(report.launchEvidence).toBe('inconclusive');
    expect(report.launchReasons).toContain('labels_not_frozen_before_run');
  });
  it('requires the resolved model to match the configured pin', async () => {
    const { dataset, execution } = await run();
    execution.configuredModel = 'jev-1.14.0';
    execution.recording.configuredModel = 'jev-1.14.0';
    const report = createEvaluationReport(dataset, execution);
    expect(report.launchEvidence).toBe('inconclusive');
    expect(report.launchReasons).toContain('model_mismatch_or_missing');
  });
  it('reports a cancelled run with zero completed cases and nullable precision', async () => {
    const controller = new AbortController();
    controller.abort();
    const { report } = await run(cohort(), false, controller.signal);
    expect(report.complete).toBe(false);
    expect(report.observations).toHaveLength(0);
    expect(report.metrics.acceptedLowOutPrecision.value).toBeNull();
    expect(report.launchEvidence).toBe('inconclusive');
  });
  it('rejects forged launch verdicts, counts, transport and provenance', async () => {
    const { dataset, report } = await run(cohort(49));
    for (const mutate of [
      (r: typeof report) => {
        r.launchEvidence = 'eligible';
      },
      (r: typeof report) => {
        r.metrics.acceptedLowOutPrecision.denominator = 50;
      },
      (r: typeof report) => {
        r.datasetSummary.historicalCount = 0;
      },
      (r: typeof report) => {
        r.recording.rows[0].elapsedMs += 1;
      },
      (r: typeof report) => {
        r.codeRevision = 'invalid';
      },
      (r: typeof report) => {
        r.finishedAt = '2020-01-01T00:00:00Z';
      },
    ]) {
      const altered = structuredClone(report);
      mutate(altered);
      expect(reportSchema.safeParse(altered).success).toBe(false);
      expect(() => parseEvaluationReport(altered, dataset)).toThrow();
    }
  });
  it('recalculates all metrics and rejects altered labels against the original dataset', async () => {
    const { dataset, report } = await run();
    const changed = structuredClone(report);
    changed.metrics.stateChangeCount = 0;
    expect(() => parseEvaluationReport(changed, dataset)).toThrow();
    dataset.cases[0].confirmations[0].state = 'available';
    expect(() => parseEvaluationReport(report, dataset)).toThrow();
  });
});
