import { parseEvaluationDataset, type EvaluationCase } from './dataset';
import type { EvaluationObservation } from './observations';
import { createEvaluationReport, scoreCases, wilsonInterval } from './scoring';
import { JEV_PRODUCT_RESOLUTION_VERSION } from '../../product/jev-product-resolution-advisor.service';

function item(
  id: string,
  expected: EvaluationCase['expected'],
): EvaluationCase {
  return {
    id,
    split: 'held_out',
    productGroupIds: [id],
    language: 'other',
    tags: ['typo_alias'],
    context: {
      requestedPhrase: 'a phrased request',
      candidates: ['a', 'b'].map((id) => ({
        id,
        canonicalName: id,
        aliases: [],
        category: null,
        typicalUnit: null,
        productType: null,
        isPerishable: false,
      })),
    },
    expected,
    label: {
      source: 'authored',
      author: 'test-author',
      rationale: 'Test fixture',
      reviewStatus: 'pending',
    },
  };
}
function accepted(
  caseId: string,
  targetProductId = 'a',
  elapsedMs = 10,
): EvaluationObservation {
  return {
    caseId,
    elapsedMs,
    configuredModel: 'jev-1.13.0',
    taskVersion: JEV_PRODUCT_RESOLUTION_VERSION,
    callStatus: 'success',
    resolvedModel: 'jev-1.13.0',
    decision: {
      choice: targetProductId === 'a' ? 'candidate_0' : 'candidate_1',
      confidence: 0.95,
    },
    proposal: {
      recommendation: 'add_alias',
      targetProductId,
      confidence: 0.95,
    },
    usage: { input_tokens: 10, output_tokens: 1 },
    unavailableReason: null,
  };
}
describe('matching metrics', () => {
  it('counts wrong variants, unsafe ambiguous matches, failures and skipped cases honestly', () => {
    const cases = [
      item('correct', { kind: 'match', productId: 'a' }),
      item('wrong', { kind: 'match', productId: 'b' }),
      item('ambiguous', { kind: 'ambiguous', plausibleProductIds: ['a', 'b'] }),
      item('failed', { kind: 'no_match' }),
      item('none', { kind: 'no_match' }),
      item('skipped', { kind: 'no_match' }),
    ];
    const rows: EvaluationObservation[] = [
      accepted('correct', 'a', 10),
      accepted('wrong', 'a', 20),
      accepted('ambiguous', 'a', 30),
      {
        ...accepted('failed', 'a', 40),
        callStatus: 'unavailable',
        resolvedModel: null,
        decision: null,
        proposal: null,
        usage: null,
        unavailableReason: 'network_error',
      },
      {
        ...accepted('none', 'a', 50),
        decision: { choice: 'no_match', confidence: 0.95 },
        proposal: null,
      },
      {
        ...accepted('skipped'),
        callStatus: 'skipped',
        resolvedModel: null,
        decision: null,
        proposal: null,
        usage: null,
      },
    ];
    const result = scoreCases(cases, rows);
    expect(result).toMatchObject({
      precision: { numerator: 1, denominator: 3, value: 1 / 3 },
      coverage: { numerator: 3, denominator: 6, value: 0.5 },
      matchRecall: { numerator: 1, denominator: 2, value: 0.5 },
      unsafeAmbiguousMatches: 1,
      noMatchNull: { numerator: 3, denominator: 3, value: 1 },
      failureRate: { numerator: 1, denominator: 5, value: 0.2 },
      latencyMs: { p50: 30, p95: 50 },
      tokens: { input: 40, output: 4, missingUsageCount: 1 },
    });
  });
  it('uses a Wilson interval with null for no accepted sample', () => {
    expect(wilsonInterval(0, 0)).toBeNull();
    expect(wilsonInterval(50, 50)!.lower).toBeCloseTo(0.92865, 4);
    expect(wilsonInterval(50, 50)!.upper).toBeCloseTo(1, 8);
    const result = scoreCases(
      [item('none', { kind: 'no_match' })],
      [
        {
          ...accepted('none'),
          proposal: null,
          decision: { choice: 'no_match', confidence: 0.95 },
        },
      ],
    );
    expect(result.precision.value).toBeNull();
    expect(result.precisionInterval95).toBeNull();
  });
  it('rejects duplicate or foreign observations rather than scoring them twice', () => {
    const cases = [item('a', { kind: 'match', productId: 'a' })];
    expect(() => scoreCases(cases, [accepted('b')])).toThrow();
    expect(() => scoreCases(cases, [accepted('a'), accepted('a')])).toThrow();
  });
});

describe('launch evidence and slices', () => {
  function fixture() {
    const cases = Array.from({ length: 100 }, (_, i) => {
      const value = item('case-' + i, { kind: 'match', productId: 'p-' + i });
      value.context.candidates[0].id = 'p-' + i;
      value.context.candidates = [value.context.candidates[0]];
      value.split = i < 40 ? 'tuning' : 'held_out';
      value.language = 'hebrew';
      value.tags = [
        'typo_alias',
        'brand_size_variant',
        'ambiguous',
        'related_distinct',
        'missing_candidate',
      ];
      value.label = {
        ...value.label,
        reviewStatus: 'reviewed',
        reviewer: 'test-reviewer',
        reviewedAt: '2026-10-01T08:00:00Z',
      };
      return value;
    });
    const dataset = parseEvaluationDataset({
      schemaVersion: 1,
      datasetVersion: 'test-v1',
      cases,
    });
    const rows = cases.slice(40).map((value) => ({
      ...accepted(value.id),
      proposal: {
        recommendation: 'add_alias' as const,
        targetProductId: value.context.candidates[0].id,
        confidence: 0.95,
      },
    }));
    return {
      dataset,
      rows,
      metadata: {
        evidenceMode: 'live' as const,
        purpose: 'evaluation' as const,
        configuredModel: 'jev-1.13.0',
        startedAt: '2026-10-01T08:00:00Z',
        finishedAt: '2026-10-01T08:01:00Z',
        codeRevision: 'a'.repeat(40),
        codeDirty: false,
        complete: true,
      },
    };
  }
  it('allows sufficient reviewed complete pinned live evidence and exposes slices', () => {
    const { dataset, rows, metadata } = fixture();
    const report = createEvaluationReport(dataset, 'held_out', rows, metadata);
    expect(report.launchEvidence).toBe('eligible');
    expect(
      report.slices.find((slice) => slice.dimension === 'language')?.metrics
        .precision.denominator,
    ).toBe(60);
  });
  it.each([
    'offline',
    'incomplete',
    'unreviewed',
    'mixed-model',
    'dirty-code',
    'too-few',
  ] as const)('makes %s evidence inconclusive', (reason) => {
    const { dataset, rows, metadata } = fixture();
    if (reason === 'offline')
      return expect(
        createEvaluationReport(dataset, 'held_out', rows, {
          ...metadata,
          evidenceMode: 'offline',
        }).launchEvidence,
      ).toBe('inconclusive');
    if (reason === 'incomplete') metadata.complete = false;
    if (reason === 'unreviewed')
      dataset.cases[0].label.reviewStatus = 'pending';
    if (reason === 'mixed-model') rows[0].resolvedModel = 'jev-1.14.0';
    if (reason === 'dirty-code') metadata.codeDirty = true;
    const chosen = reason === 'too-few' ? rows.slice(0, 49) : rows;
    if (reason === 'too-few') metadata.complete = false;
    expect(
      createEvaluationReport(dataset, 'held_out', chosen, metadata)
        .launchEvidence,
    ).toBe('inconclusive');
  });
  it('marks an accuracy failure even when other evidence is also incomplete', () => {
    const { dataset, rows, metadata } = fixture();
    rows[0].proposal.targetProductId = 'wrong';
    rows[1].proposal.targetProductId = 'wrong';
    expect(
      createEvaluationReport(dataset, 'held_out', rows, {
        ...metadata,
        evidenceMode: 'offline',
      }).launchEvidence,
    ).toBe('failed');
  });
});
