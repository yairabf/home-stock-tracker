import { safetyDataset } from './fixture';
import { createReport, parseReport, replayRows } from './report';
import { binding } from './recording';
import { scoreCases } from './scoring';
import { assessLaunch, type RunMetadata } from './launch-policy';
import { UNDERSTANDING_FIELDS } from '../../product/product-understanding';
import type { ApplicationCase } from './dataset';
import type { Observation } from './observations';

const metadata: RunMetadata = {
  evidenceMode: 'offline',
  startedAt: '2026-10-06T10:00:00Z',
  finishedAt: '2026-10-06T10:01:00Z',
  codeRevision: 'a'.repeat(40),
  codeDirty: false,
  dirtyPaths: [],
  complete: true,
  physicalRequests: null,
};
async function bypassReport() {
  const original = safetyDataset();
  const d = {
    ...original,
    cases: original.cases.filter((c) => c.caseId === 'understanding-5'),
  };
  const recording = {
    ...binding(d, 'product_understanding', 'held_out', 'jev-1.13.0'),
    rows: [{ caseId: 'understanding-5', calls: [] }],
  };
  const rows = await replayRows(recording, d);
  return {
    dataset: d,
    report: createReport(
      d,
      'product_understanding',
      'held_out',
      'jev-1.13.0',
      rows,
      metadata,
    ),
  };
}
describe('Application report verification and launch policy', () => {
  it('recomputes authored evidence as inconclusive with null inference denominators', async () => {
    const { dataset, report } = await bypassReport();
    expect(await parseReport(report, dataset)).toEqual(report);
    expect(report.launchEvidence).toBe('inconclusive');
    expect(report.metrics.fields.isPerishable.precision.value).toBeNull();
    expect(report.metrics.fields.isPerishable.suppliedPreservation.value).toBe(
      1,
    );
  });
  it('rejects edited summaries, outcomes, versions, hashes, duplicates and unknown fields', async () => {
    const { dataset, report } = await bypassReport();
    const edits = [
      { ...report, launchEvidence: 'eligible' },
      { ...report, metrics: { ...report.metrics, selected: 50 } },
      { ...report, inputHash: '0'.repeat(64) },
      { ...report, versions: { ...report.versions, policy: 'changed' } },
      { ...report, rows: [...report.rows, ...report.rows] },
      { ...report, secret: 'forbidden' },
      { ...report, observations: [] },
    ];
    for (const edited of edits)
      await expect(parseReport(edited, dataset)).rejects.toThrow();
  });
  it('keeps unfinished cases in coverage and distinguishes not-run from abstention', () => {
    const d = safetyDataset();
    const cases = d.cases.filter((c) => c.task === 'product_understanding');
    const report = createReport(
      d,
      'product_understanding',
      'held_out',
      'jev-1.13.0',
      [],
      { ...metadata, complete: false },
    );
    expect(report.metrics.modelCallCoverage).toEqual({
      numerator: 0,
      denominator: 9,
      value: 0,
    });
    expect(scoreCases(cases, []).fields.category.reasons.not_run).toBe(9);
    expect(report.launchReasons).toContain('incomplete');
    expect(() =>
      createReport(
        d,
        'product_understanding',
        'held_out',
        'jev-1.13.0',
        [],
        metadata,
      ),
    ).toThrow();
  });
  it('counts accepted must-abstain fields as safety violations and missing usage as unknown', () => {
    const c = safetyDataset().cases[0];
    if (c.task !== 'product_understanding') throw new Error('Wrong fixture');
    const row: Observation = {
      task: c.task,
      caseId: c.caseId,
      fields: Object.fromEntries(
        UNDERSTANDING_FIELDS.map((f) => [
          f,
          { status: 'uncertain', reason: 'unknown' },
        ]),
      ) as Extract<Observation, { task: 'product_understanding' }>['fields'],
      calls: [],
    };
    row.fields.isPerishable = {
      status: 'resolved',
      source: 'jev',
      value: false,
      confidence: 0.99,
    };
    const metrics = scoreCases([c], [row]);
    expect(metrics.safetyViolations).toBe(1);
    expect(metrics.fields.isPerishable.precision).toEqual({
      numerator: 0,
      denominator: 1,
      value: 0,
    });
    expect(metrics.fields.category.abstentionCorrectness.value).toBe(1);
  });
  it('requires qualifying denominators for every field and fails qualified bad precision', () => {
    const original = safetyDataset();
    const seed = original.cases[0];
    if (seed.task !== 'product_understanding') throw new Error('Wrong fixture');
    const values = {
      category: 'dairy',
      productType: 'fast_consumable',
      typicalUnit: 'liter',
      isPerishable: true,
    } as const;
    const cases: ApplicationCase[] = Array.from({ length: 100 }, (_, i) => ({
      ...seed,
      caseId: `observed-${i}`,
      semanticGroupId: `group-${i}`,
      source: 'observed',
      language: i < 30 ? 'he' : 'en',
      review: {
        author: 'author',
        reviewer: 'reviewer',
        reviewedAt: '2026-10-01T00:00:00Z',
        evidenceReference: `evidence-${i}`,
      },
      expected: Object.fromEntries(
        UNDERSTANDING_FIELDS.map((f) => [
          f,
          { kind: 'values', values: [values[f]] },
        ]),
      ) as typeof seed.expected,
    }));
    const rows: Observation[] = cases.map((c) => ({
      task: 'product_understanding',
      caseId: c.caseId,
      fields: Object.fromEntries(
        UNDERSTANDING_FIELDS.map((f) => [
          f,
          {
            status: 'resolved',
            source: 'jev',
            value: values[f],
            confidence: 0.99,
          },
        ]),
      ) as Extract<Observation, { task: 'product_understanding' }>['fields'],
      calls: [],
    }));
    const d = { ...original, cases };
    const run = {
      ...metadata,
      evidenceMode: 'live' as const,
      physicalRequests: { typesafe: 400, openai: 0 },
    };
    const assess = (data: Observation[], models = ['jev-1.13.0']) =>
      assessLaunch(
        d,
        cases,
        'product_understanding',
        'held_out',
        'jev-1.13.0',
        models,
        scoreCases(cases, data),
        run,
      );
    expect(assess(rows).launchEvidence).toBe('eligible');
    const few = rows.map((r, i) =>
      i < 51
        ? {
            ...r,
            fields: {
              ...r.fields,
              isPerishable: {
                status: 'uncertain' as const,
                reason: 'unknown' as const,
              },
            },
          }
        : r,
    );
    expect(assess(few).launchEvidence).toBe('inconclusive');
    const wrong = rows.map((r, i) =>
      i < 6
        ? {
            ...r,
            fields: {
              ...r.fields,
              isPerishable: {
                status: 'resolved' as const,
                source: 'jev' as const,
                value: false,
              },
            },
          }
        : r,
    );
    expect(assess(wrong).launchEvidence).toBe('failed');
    expect(assess(rows, ['jev-1.14.0']).launchEvidence).toBe('inconclusive');
  });
});
