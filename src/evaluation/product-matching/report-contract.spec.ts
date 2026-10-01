import { inspectDataset, parseEvaluationDataset } from './dataset';
import { JEV_PRODUCT_RESOLUTION_VERSION } from '../../product/jev-product-resolution-advisor.service';
import {
  evaluationReportSchema,
  type EvaluationReport,
} from './report-contract';

function emptyReport(): EvaluationReport {
  const summary = inspectDataset(
    parseEvaluationDataset({
      schemaVersion: 1,
      datasetVersion: 'test-v1',
      cases: [
        {
          id: 'empty',
          split: 'held_out',
          productGroupIds: ['empty-group'],
          language: 'hebrew',
          tags: ['missing_candidate'],
          context: { requestedPhrase: 'חלב', candidates: [] },
          expected: { kind: 'no_match' },
          label: {
            source: 'authored',
            author: 'fixture-author',
            reviewStatus: 'pending',
            rationale: 'No supplied candidate.',
          },
        },
      ],
    }),
  );
  const ratio = { numerator: 0, denominator: 0, value: null };
  return {
    schemaVersion: 1,
    evidenceMode: 'offline',
    purpose: 'evaluation',
    startedAt: '2026-10-01T08:00:00Z',
    finishedAt: '2026-10-01T08:00:01Z',
    codeRevision: null,
    codeDirty: false,
    datasetVersion: 'test-v1',
    datasetHash: summary.datasetHash,
    inputHash: 'a'.repeat(64),
    split: 'held_out',
    confidenceGate: 0.9,
    configuredModel: 'jev-1.13.0',
    resolvedModels: [],
    taskVersion: JEV_PRODUCT_RESOLUTION_VERSION,
    complete: false,
    selectedCaseCount: 1,
    datasetSummary: summary,
    observations: [],
    slices: [],
    metrics: {
      caseCount: 0,
      precision: ratio,
      coverage: ratio,
      matchRecall: ratio,
      ambiguityClarification: ratio,
      noMatchNull: ratio,
      unsafeAmbiguousMatches: 0,
      unsafeNoMatchMatches: 0,
      successCount: 0,
      unavailableCount: 0,
      skippedCount: 0,
      failureRate: ratio,
      failureReasons: {},
      latencyMs: { p50: null, p95: null },
      tokens: { input: 0, output: 0, missingUsageCount: 0 },
      precisionInterval95: null,
    },
    launchEvidence: 'inconclusive',
    launchReasons: ['incomplete'],
    warnings: [],
  };
}

describe('evaluation report boundary', () => {
  it('represents an interrupted offline run without claiming evidence eligibility', () => {
    expect(evaluationReportSchema.safeParse(emptyReport()).success).toBe(true);
  });

  it.each([
    'complete',
    'dataset hash',
    'case count',
    'unknown field',
    'moving model',
    'invalid confidence interval',
    'offline eligibility',
    'sample bound',
  ] as const)('rejects inconsistent or unsafe %s', (kind) => {
    const report = emptyReport();
    if (kind === 'complete') report.complete = true;
    if (kind === 'dataset hash') report.datasetHash = 'b'.repeat(64);
    if (kind === 'case count') report.metrics.caseCount = 1;
    if (kind === 'moving model') report.configuredModel = 'jev-latest';
    if (kind === 'invalid confidence interval')
      report.metrics.precisionInterval95 = { lower: 0.9, upper: 0.1 };
    if (kind === 'offline eligibility') report.launchEvidence = 'eligible';
    if (kind === 'sample bound') report.selectedCaseCount = 201;
    const input =
      kind === 'unknown field' ? { ...report, apiKey: 'private' } : report;
    expect(evaluationReportSchema.safeParse(input).success).toBe(false);
  });
});
