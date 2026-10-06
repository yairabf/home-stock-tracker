import type {
  ApplicationDataset,
  ApplicationCase,
  ApplicationTask,
} from './dataset';
import { UNDERSTANDING_FIELDS } from '../../product/product-understanding';
import type { Metrics } from './scoring';

export interface RunMetadata {
  evidenceMode: 'offline' | 'live';
  startedAt: string;
  finishedAt: string;
  codeRevision: string | null;
  codeDirty: boolean;
  dirtyPaths: string[];
  complete: boolean;
  physicalRequests: { typesafe: number; openai: number } | null;
}
export function assessLaunch(
  dataset: ApplicationDataset,
  cases: ApplicationCase[],
  task: ApplicationTask,
  split: string,
  configuredModel: string,
  resolvedModels: string[],
  metrics: Metrics,
  run: RunMetadata,
) {
  const missing: string[] = [];
  if (run.evidenceMode !== 'live') missing.push('offline_evidence');
  if (!run.complete) missing.push('incomplete');
  if (split !== 'held_out') missing.push('tuning_split');
  if (cases.some((c) => c.source !== 'observed'))
    missing.push('authored_evidence');
  if (
    cases.some(
      (c) =>
        !c.review.reviewer ||
        !c.review.reviewedAt ||
        !c.review.evidenceReference,
    )
  )
    missing.push('independent_review_missing');
  if (Date.parse(dataset.frozenAt) >= Date.parse(run.startedAt))
    missing.push('not_frozen_before_run');
  if (!run.codeRevision || run.codeDirty)
    missing.push('missing_or_dirty_revision');
  if (resolvedModels.length !== 1 || resolvedModels[0] !== configuredModel)
    missing.push('resolved_model_mismatch_or_missing');
  if (task === 'product_understanding') {
    if (
      cases.length < 100 ||
      cases.filter((c) => c.language !== 'en').length < 30
    )
      missing.push('insufficient_language_corpus');
    for (const field of UNDERSTANDING_FIELDS)
      if (metrics.fields[field].precision.denominator < 50)
        missing.push(`${field}:fewer_than_50_accepted`);
  } else if (metrics.policies.precision.denominator < 50)
    missing.push('fewer_than_50_accepted_policies');
  const failures: string[] = [];
  const scored =
    task === 'product_understanding'
      ? UNDERSTANDING_FIELDS.map((f) => metrics.fields[f].precision.value)
      : [metrics.policies.precision.value];
  if (
    scored.some(
      (p) => p !== null && p < (task === 'product_understanding' ? 0.95 : 0.98),
    )
  )
    failures.push('precision_below_target');
  if (metrics.safetyViolations) failures.push('safety_violation');
  if (metrics.providers.typesafe.failures + metrics.providers.openai.failures)
    failures.push('provider_failure');
  return {
    launchEvidence: missing.length
      ? ('inconclusive' as const)
      : failures.length
        ? ('failed' as const)
        : ('eligible' as const),
    launchReasons: [...missing, ...failures],
    warnings: [
      'operator_evidence_review_and_rollout_approval_required',
      'clustered_sample_not_universal_accuracy',
      'confidence_not_calibrated',
      'openai_usage_and_resolved_model_unknown',
    ],
  };
}
