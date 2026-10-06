import type { PerishabilityComparison } from './perishability-comparison-contract';
import type { RequestCapture } from './perishability-request-capture';

type Label = PerishabilityComparison['labels'][number]['expected'];
const ratio = (n: number, d: number) => (d === 0 ? null : n / d);
function newCounts(labels: Map<string, Label>) {
  const values = [...labels.values()];
  return {
    expected: labels.size,
    observed: 0,
    missing: 0,
    valueLabeled: values.filter((l) => l.kind === 'values').length,
    abstainLabeled: values.filter((l) => l.kind === 'abstain').length,
    unscored: values.filter((l) => l.kind === 'unscored').length,
    rawCorrect: 0,
    rawWrong: 0,
    rawUnknown: 0,
    rawUnscored: 0,
    acceptedCorrect: 0,
    acceptedWrong: 0,
    acceptedOnAbstain: 0,
    acceptedUnscored: 0,
    lowConfidence: 0,
    failures: 0,
    abstainResolved: 0,
  };
}
function countRow(
  row: RequestCapture,
  expected: Label,
  counts: ReturnType<typeof newCounts>,
  failureReasons: Record<string, number>,
) {
  if (row.call.provider !== 'typesafe')
    throw new Error('Only TypeSafe comparison calls');
  const transport = row.call.transport;
  if (transport.status !== 'success') {
    counts.failures++;
    failureReasons[transport.reason] =
      (failureReasons[transport.reason] ?? 0) + 1;
    return;
  }
  if (transport.choice === 'unknown') counts.rawUnknown++;
  else if (expected.kind === 'unscored') counts.rawUnscored++;
  else if (
    expected.kind === 'values' &&
    expected.values.includes(transport.choice === 'perishable')
  )
    counts.rawCorrect++;
  else counts.rawWrong++;
  if (
    row.outcome.status === 'uncertain' &&
    row.outcome.reason === 'low_confidence'
  )
    counts.lowConfidence++;
  if (row.outcome.status === 'resolved') {
    if (expected.kind === 'unscored') counts.acceptedUnscored++;
    else if (expected.kind === 'abstain') counts.acceptedOnAbstain++;
    else if (expected.values.includes(row.outcome.value as boolean))
      counts.acceptedCorrect++;
    else counts.acceptedWrong++;
  } else if (expected.kind === 'abstain' && transport.choice === 'unknown')
    counts.abstainResolved++;
}
function variantMetrics(
  variant: PerishabilityComparison['variants'][number],
  labels: Map<string, Label>,
) {
  const counts = newCounts(labels);
  counts.observed = variant.rows.length;
  counts.missing = labels.size - variant.rows.length;
  const failureReasons: Record<string, number> = {};
  for (const row of variant.rows)
    countRow(row, labels.get(row.caseId)!, counts, failureReasons);
  return {
    variantId: variant.definition.variantId,
    complete: variant.complete,
    counts,
    failureReasons,
    rawSubstantiveAccuracy: ratio(
      counts.rawCorrect,
      counts.rawCorrect + counts.rawWrong,
    ),
    acceptedPrecision: ratio(
      counts.acceptedCorrect,
      counts.acceptedCorrect + counts.acceptedWrong + counts.acceptedOnAbstain,
    ),
    acceptedCoverage: ratio(
      counts.acceptedCorrect + counts.acceptedWrong,
      counts.valueLabeled,
    ),
    ambiguousAbstention: ratio(counts.abstainResolved, counts.abstainLabeled),
  };
}
function rawChoice(row: RequestCapture) {
  return row.call.provider === 'typesafe' &&
    row.call.transport.status === 'success'
    ? row.call.transport.choice
    : null;
}
function correct(row: RequestCapture, label: Label, accepted: boolean) {
  if (label.kind !== 'values') return false;
  if (accepted)
    return (
      row.outcome.status === 'resolved' &&
      label.values.includes(row.outcome.value as boolean)
    );
  const choice = rawChoice(row);
  return (
    choice !== null &&
    choice !== 'unknown' &&
    label.values.includes(choice === 'perishable')
  );
}
function pairMetrics(
  baseline: PerishabilityComparison['variants'][number],
  variant: PerishabilityComparison['variants'][number],
  labels: Map<string, Label>,
) {
  const base = new Map(baseline.rows.map((r) => [r.caseId, r]));
  const counts = {
    paired: 0,
    bothSuccessful: 0,
    rawDisagreements: 0,
    acceptanceDisagreements: 0,
    rawCorrectGains: 0,
    rawCorrectLosses: 0,
    acceptedCorrectGains: 0,
    acceptedCorrectLosses: 0,
  };
  for (const row of variant.rows) {
    const prior = base.get(row.caseId);
    if (!prior) continue;
    counts.paired++;
    const before = rawChoice(prior),
      after = rawChoice(row);
    if (before !== null && after !== null) {
      counts.bothSuccessful++;
      if (before !== after) counts.rawDisagreements++;
    }
    if (
      (row.outcome.status === 'resolved') !==
        (prior.outcome.status === 'resolved') ||
      (row.outcome.status === 'resolved' &&
        prior.outcome.status === 'resolved' &&
        row.outcome.value !== prior.outcome.value)
    )
      counts.acceptanceDisagreements++;
    const label = labels.get(row.caseId)!;
    if (!correct(prior, label, false) && correct(row, label, false))
      counts.rawCorrectGains++;
    if (correct(prior, label, false) && !correct(row, label, false))
      counts.rawCorrectLosses++;
    if (!correct(prior, label, true) && correct(row, label, true))
      counts.acceptedCorrectGains++;
    if (correct(prior, label, true) && !correct(row, label, true))
      counts.acceptedCorrectLosses++;
  }
  return {
    baselineId: baseline.definition.variantId,
    variantId: variant.definition.variantId,
    ...counts,
    unpaired: labels.size - counts.paired,
  };
}
export function comparisonMetrics(comparison: PerishabilityComparison) {
  const labels = new Map(comparison.labels.map((r) => [r.caseId, r.expected]));
  return {
    variants: comparison.variants.map((v) => variantMetrics(v, labels)),
    pairs: comparison.variants
      .slice(1)
      .map((v) => pairMetrics(comparison.variants[0], v, labels)),
  };
}
