import {
  inspectDataset,
  evaluationHash,
  selectedInputHash,
  type EvaluationCase,
  type EvaluationDataset,
  type EvaluationSplit,
} from './dataset';
import { observationSchema, type EvaluationObservation } from './observations';
import {
  evaluationReportSchema,
  metricsSchema,
  type EvaluationMetrics,
  type EvaluationReport,
} from './report-contract';
import {
  JEV_PRODUCT_RESOLUTION_MIN_CONFIDENCE,
  JEV_PRODUCT_RESOLUTION_VERSION,
} from '../../product/jev-product-resolution-advisor.service';

export function ratio(numerator: number, denominator: number) {
  return {
    numerator,
    denominator,
    value: denominator ? numerator / denominator : null,
  };
}

export function wilsonInterval(correct: number, total: number) {
  if (!total) return null;
  const z = 1.959963984540054;
  const p = correct / total;
  const denominator = 1 + (z * z) / total;
  const center = (p + (z * z) / (2 * total)) / denominator;
  const half =
    (z * Math.sqrt((p * (1 - p)) / total + (z * z) / (4 * total * total))) /
    denominator;
  return {
    lower: Math.max(0, center - half),
    upper: Math.min(1, center + half),
  };
}

function percentile(values: number[], p: number): number | null {
  if (!values.length) return null;
  return [...values].sort((a, b) => a - b)[Math.ceil(values.length * p) - 1];
}

export function scoreCases(
  cases: EvaluationCase[],
  rows: EvaluationObservation[],
): EvaluationMetrics {
  const byId = new Map(cases.map((item) => [item.id, item]));
  const observations = rows.map((row) => observationSchema.parse(row));
  if (
    byId.size !== cases.length ||
    rows.length !== cases.length ||
    new Set(rows.map((row) => row.caseId)).size !== rows.length ||
    rows.some((row) => !byId.has(row.caseId))
  )
    throw new Error('Scoring requires one observation per evaluated case');
  const accepted = observations.filter(
    (row) => row.proposal?.recommendation === 'add_alias',
  );
  const correct = accepted.filter((row) => {
    const truth = byId.get(row.caseId)!.expected;
    return (
      truth.kind === 'match' &&
      row.proposal?.recommendation === 'add_alias' &&
      row.proposal.targetProductId === truth.productId
    );
  }).length;
  const ambiguous = observations.filter(
    (row) => byId.get(row.caseId)!.expected.kind === 'ambiguous',
  );
  const noMatch = observations.filter(
    (row) => byId.get(row.caseId)!.expected.kind === 'no_match',
  );
  const successes = observations.filter((row) => row.callStatus === 'success');
  const failures = observations.filter(
    (row) => row.callStatus === 'unavailable',
  );
  const attempted = observations.filter((row) => row.callStatus !== 'skipped');
  const failureReasons: EvaluationMetrics['failureReasons'] = {};
  for (const failure of failures)
    failureReasons[failure.unavailableReason] =
      (failureReasons[failure.unavailableReason] ?? 0) + 1;
  return metricsSchema.parse({
    caseCount: cases.length,
    precision: ratio(correct, accepted.length),
    coverage: ratio(accepted.length, cases.length),
    matchRecall: ratio(
      correct,
      cases.filter((item) => item.expected.kind === 'match').length,
    ),
    ambiguityClarification: ratio(
      ambiguous.filter(
        (row) => row.proposal?.recommendation === 'ask_user_to_choose',
      ).length,
      ambiguous.length,
    ),
    noMatchNull: ratio(
      noMatch.filter((row) => row.proposal === null).length,
      noMatch.length,
    ),
    unsafeAmbiguousMatches: ambiguous.filter(
      (row) => row.proposal?.recommendation === 'add_alias',
    ).length,
    unsafeNoMatchMatches: noMatch.filter(
      (row) => row.proposal?.recommendation === 'add_alias',
    ).length,
    successCount: successes.length,
    unavailableCount: failures.length,
    skippedCount: observations.length - attempted.length,
    failureRate: ratio(failures.length, attempted.length),
    failureReasons,
    latencyMs: {
      p50: percentile(
        attempted.map((row) => row.elapsedMs),
        0.5,
      ),
      p95: percentile(
        attempted.map((row) => row.elapsedMs),
        0.95,
      ),
    },
    tokens: {
      input: successes.reduce((sum, row) => sum + row.usage.input_tokens, 0),
      output: successes.reduce((sum, row) => sum + row.usage.output_tokens, 0),
      missingUsageCount: failures.length,
    },
    precisionInterval95: wilsonInterval(correct, accepted.length),
  });
}

export interface ReportMetadata {
  evidenceMode: 'offline' | 'live';
  purpose: 'evaluation' | 'smoke';
  configuredModel: string;
  startedAt: string;
  finishedAt: string;
  codeRevision: string | null;
  codeDirty: boolean;
  complete: boolean;
}

function launchGate(
  report: Omit<
    EvaluationReport,
    'launchEvidence' | 'launchReasons' | 'warnings'
  >,
) {
  const reasons: string[] = [];
  const { metrics } = report;
  const failed =
    (metrics.precision.value !== null && metrics.precision.value < 0.98) ||
    metrics.unsafeAmbiguousMatches > 0 ||
    metrics.unsafeNoMatchMatches > 0;
  if (failed) reasons.push('accuracy_or_safety_failed');
  if (report.evidenceMode !== 'live') reasons.push('offline_evidence');
  if (report.purpose !== 'evaluation') reasons.push('connectivity_smoke_only');
  if (!report.complete) reasons.push('incomplete');
  if (report.split !== 'held_out') reasons.push('tuning_split');
  if (!report.datasetSummary.corpusEligible)
    reasons.push('insufficient_corpus');
  if (!report.datasetSummary.labelsReviewed)
    reasons.push('labels_not_independently_reviewed');
  if (report.codeRevision === null) reasons.push('missing_code_revision');
  if (report.codeDirty) reasons.push('uncommitted_evaluation_or_adapter_code');
  if (
    report.resolvedModels.length !== 1 ||
    report.resolvedModels[0] !== report.configuredModel
  )
    reasons.push('model_mismatch_or_missing');
  if (metrics.unavailableCount) reasons.push('provider_failures');
  if (metrics.precision.denominator < 50)
    reasons.push('fewer_than_50_accepted_matches');
  return {
    launchEvidence: failed
      ? ('failed' as const)
      : reasons.length
        ? ('inconclusive' as const)
        : ('eligible' as const),
    launchReasons: reasons,
    warnings: [
      'small_sample_not_universal_accuracy',
      'confidence_is_service_policy',
      ...(report.datasetSummary.confirmedCount < report.datasetSummary.caseCount
        ? ['authored_examples_are_not_household_confirmations']
        : []),
    ],
  };
}

function sliceMetrics(
  cases: EvaluationCase[],
  rows: EvaluationObservation[],
): EvaluationReport['slices'] {
  const groups = new Map<
    string,
    {
      dimension: 'split' | 'language' | 'tag';
      value: string;
      cases: EvaluationCase[];
    }
  >();
  for (const item of cases) {
    for (const [dimension, value] of [
      ['split', item.split],
      ['language', item.language],
      ...item.tags.map((tag) => ['tag', tag]),
    ] as ['split' | 'language' | 'tag', string][]) {
      const key = `${dimension}:${value}`;
      const group = groups.get(key) ?? { dimension, value, cases: [] };
      group.cases.push(item);
      groups.set(key, group);
    }
  }
  return [...groups.values()].map(({ dimension, value, cases: subset }) => {
    const ids = new Set(subset.map((item) => item.id));
    return {
      dimension,
      value,
      metrics: scoreCases(
        subset,
        rows.filter((row) => ids.has(row.caseId)),
      ),
    };
  });
}

export function createEvaluationReport(
  dataset: EvaluationDataset,
  split: EvaluationSplit,
  rows: EvaluationObservation[],
  metadata: ReportMetadata,
): EvaluationReport {
  const selected = dataset.cases.filter((item) => item.split === split);
  const ids = new Set(rows.map((row) => row.caseId));
  const evaluated = selected.filter((item) => ids.has(item.id));
  const report: Omit<
    EvaluationReport,
    'launchEvidence' | 'launchReasons' | 'warnings'
  > = {
    schemaVersion: 1 as const,
    ...metadata,
    datasetVersion: dataset.datasetVersion,
    datasetHash: evaluationHash(dataset),
    inputHash: selectedInputHash(selected),
    split,
    confidenceGate: JEV_PRODUCT_RESOLUTION_MIN_CONFIDENCE,
    taskVersion: JEV_PRODUCT_RESOLUTION_VERSION,
    selectedCaseCount: selected.length,
    datasetSummary: inspectDataset(dataset),
    observations: rows,
    resolvedModels: [
      ...new Set(
        rows.flatMap((row) => (row.resolvedModel ? [row.resolvedModel] : [])),
      ),
    ].sort(),
    metrics: scoreCases(evaluated, rows),
    slices: sliceMetrics(evaluated, rows),
  };
  return evaluationReportSchema.parse({ ...report, ...launchGate(report) });
}

export function summarizeReport(report: EvaluationReport): string {
  const { precision, coverage } = report.metrics;
  return [
    `${report.evidenceMode} ${report.split}: ${report.observations.length}/${report.selectedCaseCount} cases`,
    `Accepted precision: ${precision.value === null ? 'n/a' : (precision.value * 100).toFixed(2) + '%'} (${precision.numerator}/${precision.denominator})`,
    `Candidate coverage: ${coverage.value === null ? 'n/a' : (coverage.value * 100).toFixed(2) + '%'} (${coverage.numerator}/${coverage.denominator})`,
    `Launch evidence: ${report.launchEvidence}; ${report.launchReasons.join(', ') || 'operator review required'}`,
  ].join('\n');
}
