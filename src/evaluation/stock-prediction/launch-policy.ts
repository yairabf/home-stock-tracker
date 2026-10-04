import type { StockMetrics } from './metrics';

export interface LaunchInput {
  evidenceMode: 'offline' | 'live';
  purpose: 'smoke' | 'evaluation';
  complete: boolean;
  split: 'tuning' | 'held_out';
  codeRevision: string | null;
  codeDirty: boolean;
  configuredModel: string;
  resolvedModels: string[];
  selectedCaseCount: number;
  datasetSummary: {
    historicalCount: number;
    reviewedCount: number;
    frozenCount: number;
  };
  metrics: StockMetrics;
}
export function assessLaunch(input: LaunchInput) {
  const reasons: string[] = [];
  if (input.evidenceMode !== 'live') reasons.push('offline_evidence');
  if (input.purpose !== 'evaluation') reasons.push('smoke_only');
  if (!input.complete) reasons.push('incomplete');
  if (input.split !== 'held_out') reasons.push('tuning_split');
  if (input.datasetSummary.historicalCount !== input.selectedCaseCount)
    reasons.push('non_historical_cases');
  if (input.datasetSummary.reviewedCount !== input.selectedCaseCount)
    reasons.push('review_incomplete');
  if (input.datasetSummary.frozenCount !== input.selectedCaseCount)
    reasons.push('labels_not_frozen_before_run');
  if (input.codeRevision === null) reasons.push('missing_code_revision');
  if (input.codeDirty) reasons.push('dirty_relevant_code');
  if (
    input.resolvedModels.length !== 1 ||
    input.resolvedModels[0] !== input.configuredModel
  )
    reasons.push('model_mismatch_or_missing');
  if (input.metrics.acceptedLowOutPrecision.denominator < 50)
    reasons.push('fewer_than_50_accepted_outcomes');
  const qualified = reasons.length === 0;
  const accuracyFailed =
    input.metrics.acceptedLowOutPrecision.value !== null &&
    input.metrics.acceptedLowOutPrecision.value < 0.95;
  if (accuracyFailed) reasons.push('precision_below_95_percent');
  if (input.metrics.provider.failures > 0) reasons.push('provider_failures');
  return {
    launchEvidence: !qualified
      ? ('inconclusive' as const)
      : accuracyFailed || input.metrics.provider.failures > 0
        ? ('failed' as const)
        : ('eligible' as const),
    launchReasons: reasons,
    warnings: [
      'small_clustered_sample_not_universal_accuracy',
      'confidence_is_not_calibrated_probability',
      'near_term_confirmation_is_a_proxy',
      'slice_coverage_requires_human_review',
      'operator_rollout_approval_required',
    ],
  };
}
