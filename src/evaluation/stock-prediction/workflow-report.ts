import { hash } from './dataset';
import { workflowBinding, workflowRecordingSchema } from './workflow-recording';
import { selectWorkflowCases, type WorkflowDataset } from './workflow-dataset';
import {
  workflowMetrics,
  workflowObservationSchema,
  type WorkflowObservation,
} from './workflow-metrics';
import { runSchema } from '../application-inference/report';
import type { RunMetadata } from '../application-inference/launch-policy';
import { parseEvaluationReport } from './report';
import { parseWorkflowRecording } from './workflow-recording';
import { runWorkflowEvaluation } from './workflow-runner';

export function createWorkflowReport(
  dataset: WorkflowDataset,
  split: 'held_out' | 'tuning',
  model: string,
  rows: WorkflowObservation[],
  metadata: RunMetadata,
  advisorValue?: unknown,
) {
  const run = runSchema.parse(metadata);
  const cases = selectWorkflowCases(dataset, split);
  const observations = rows.map((r) => workflowObservationSchema.parse(r));
  if (!cases.length || (run.complete && observations.length !== cases.length))
    throw new Error('Invalid workflow completion');
  const metrics = workflowMetrics(cases, observations);
  const advisorReport =
    advisorValue === undefined
      ? null
      : parseEvaluationReport(advisorValue, dataset.history);
  const resolvedModels = [
    ...new Set(
      rows.flatMap((r) =>
        r.calls.flatMap((c) =>
          c.provider === 'typesafe' && c.transport.status === 'success'
            ? [c.transport.model]
            : [],
        ),
      ),
    ),
  ].sort();
  const missing: string[] = [];
  if (run.evidenceMode !== 'live') missing.push('offline_evidence');
  if (split !== 'held_out') missing.push('tuning_split');
  if (!run.complete) missing.push('incomplete');
  if (!run.codeRevision || run.codeDirty)
    missing.push('missing_or_dirty_revision');
  if (Date.parse(dataset.frozenAt) >= Date.parse(run.startedAt))
    missing.push('not_frozen_before_run');
  if (
    cases.some(
      (c) =>
        c.source !== 'historical' ||
        c.review.status !== 'reviewed' ||
        !c.review.episodeComplete ||
        !c.review.evidenceReference,
    )
  )
    missing.push('historical_review_missing');
  if (resolvedModels.length !== 1 || resolvedModels[0] !== model)
    missing.push('resolved_model_mismatch_or_missing');
  if (metrics.final.precision.denominator < 50)
    missing.push('fewer_than_50_scored_recommendations');
  if (
    !advisorReport ||
    advisorReport.launchEvidence !== 'eligible' ||
    advisorReport.configuredModel !== model ||
    advisorReport.codeRevision !== run.codeRevision ||
    advisorReport.split !== split
  )
    missing.push('qualifying_37e_evidence_missing');
  const failed: string[] = [];
  if (
    metrics.final.precision.value !== null &&
    metrics.final.precision.value < 0.95
  )
    failed.push('recommendation_precision_below_95_percent');
  if (metrics.precisionRegressed)
    failed.push('precision_regressed_against_baseline');
  if (metrics.safetyViolations) failed.push('unsafe_application');
  if (metrics.failures) failed.push('provider_or_publication_failure');
  const keys = new Set(
    cases.flatMap((c) => [
      ...c.tags.map((tag) => `tag:${tag}`),
      `type:${c.product.productType ?? 'unknown'}`,
    ]),
  );
  const slices = [...keys].sort().map((key) => {
    const subset = cases.filter(
      (c) =>
        key === `type:${c.product.productType ?? 'unknown'}` ||
        c.tags.some((t) => key === `tag:${t}`),
    );
    const ids = new Set(subset.map((c) => c.id));
    return {
      key,
      metrics: workflowMetrics(
        subset,
        observations.filter((r) => ids.has(r.caseId)),
      ),
    };
  });
  const recording = workflowRecordingSchema.parse({
    ...workflowBinding(dataset, split, model),
    rows: observations.map((r) => ({ caseId: r.caseId, calls: r.calls })),
  });
  return {
    ...recording,
    run,
    observations,
    metrics,
    slices,
    resolvedModels,
    advisorReport,
    launchEvidence: missing.length
      ? ('inconclusive' as const)
      : failed.length
        ? ('failed' as const)
        : ('eligible' as const),
    launchReasons: [...missing, ...failed],
    warnings: [
      'operator_evidence_review_and_rollout_approval_required',
      'near_term_confirmation_is_a_proxy',
      'household_clustering_requires_review',
      'frozen_missing_policies_remain_missing',
    ],
  };
}
export function validateWorkflowReport(
  value: unknown,
  dataset: WorkflowDataset,
) {
  if (!value || typeof value !== 'object')
    throw new Error('Invalid workflow report');
  const raw = value as ReturnType<typeof createWorkflowReport>;
  const expected = createWorkflowReport(
    dataset,
    raw.split,
    raw.configuredModel,
    raw.observations,
    raw.run,
    raw.advisorReport ?? undefined,
  );
  if (hash(expected) !== hash(value))
    throw new Error('Workflow report summaries or bindings differ');
  return expected;
}

export async function replayWorkflowReport(
  value: unknown,
  dataset: WorkflowDataset,
  newDatabaseUrl: string,
) {
  const report = validateWorkflowReport(value, dataset);
  const keys = [
    'schemaVersion',
    'datasetHash',
    'inputHash',
    'workflowVersion',
    'taskVersion',
    'configuredModel',
    'split',
    'rows',
  ];
  const raw = report as unknown as Record<string, unknown>;
  const recording = parseWorkflowRecording(
    Object.fromEntries(keys.map((k) => [k, raw[k]])),
    dataset,
    report.split,
  );
  const observations = await runWorkflowEvaluation(dataset, {
    databaseUrl: newDatabaseUrl,
    split: report.split,
    model: report.configuredModel,
    recording,
  });
  const expected = createWorkflowReport(
    dataset,
    report.split,
    report.configuredModel,
    observations,
    report.run,
    report.advisorReport ?? undefined,
  );
  if (hash(expected) !== hash(value))
    throw new Error('Workflow report differs from isolated runtime replay');
  return expected;
}
