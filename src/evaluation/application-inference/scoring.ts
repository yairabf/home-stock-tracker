import {
  UNDERSTANDING_FIELDS,
  type UnderstandingField,
} from '../../product/product-understanding';
import { ratio, wilsonInterval } from '../product-matching/scoring';
import type { ApplicationCase } from './dataset';
import type { Observation } from './observations';

export interface Tallies {
  accepted: number;
  scored: number;
  correct: number;
  targets: number;
  abstain: number;
  abstainCorrect: number;
  supplied: number;
  preserved: number;
  unsafe: number;
  reasons: Record<string, number>;
}
const blank = (): Tallies => ({
  accepted: 0,
  scored: 0,
  correct: 0,
  targets: 0,
  abstain: 0,
  abstainCorrect: 0,
  supplied: 0,
  preserved: 0,
  unsafe: 0,
  reasons: {},
});
function summaries(t: Tallies, total: number) {
  return {
    accepted: t.accepted,
    precision: ratio(t.correct, t.scored),
    precisionInterval95: wilsonInterval(t.correct, t.scored),
    recall: ratio(t.correct, t.targets),
    coverage: ratio(t.accepted, total),
    abstentionCorrectness: ratio(t.abstainCorrect, t.abstain),
    suppliedPreservation: ratio(t.preserved, t.supplied),
    safetyViolations: t.unsafe,
    reasons: t.reasons,
  };
}
function understandingScore(
  c: Extract<ApplicationCase, { task: 'product_understanding' }>,
  row: Observation | undefined,
  field: UnderstandingField,
  t: Tallies,
) {
  const value =
    row?.task === 'product_understanding' ? row.fields[field] : undefined;
  const supplied = c.input.metadata[field];
  if (supplied !== null) {
    t.supplied++;
    if (
      value?.status === 'resolved' &&
      'value' in value &&
      value.value === supplied &&
      value.source === 'supplied'
    )
      t.preserved++;
    else if (row) t.unsafe++;
    return;
  }
  const expected = c.expected[field];
  const accepted = value?.status === 'resolved' && 'value' in value;
  if (accepted) t.accepted++;
  if (expected.kind === 'values') t.targets++;
  if (expected.kind === 'abstain') {
    t.abstain++;
    if (row && !accepted) t.abstainCorrect++;
    if (accepted) t.unsafe++;
  }
  if (accepted && expected.kind !== 'unscored') {
    t.scored++;
    if (expected.kind === 'values' && expected.values.includes(value.value))
      t.correct++;
  }
  const reason = !value
    ? 'not_run'
    : value.status === 'resolved'
      ? 'accepted'
      : value.status === 'uncertain'
        ? value.reason
        : value.status;
  t.reasons[reason] = (t.reasons[reason] ?? 0) + 1;
}
function policyScore(
  c: Extract<ApplicationCase, { task: 'shelf_life_policy' }>,
  row: Observation | undefined,
  selections: Tallies,
  generations: Tallies,
) {
  const value = row?.task === 'shelf_life_policy' ? row.policy : undefined;
  const expected = c.expected;
  const t =
    expected.kind === 'generation' ||
    (value?.status === 'resolved' && value.provider === 'openai')
      ? generations
      : selections;
  const accepted = value?.status === 'resolved';
  if (accepted) t.accepted++;
  if (expected.kind === 'policies' || expected.kind === 'generation')
    t.targets++;
  if (expected.kind === 'abstain') {
    t.abstain++;
    if (row && !accepted) t.abstainCorrect++;
    if (accepted) t.unsafe++;
  }
  if (accepted && expected.kind !== 'unscored') {
    t.scored++;
    const correct =
      expected.kind === 'policies'
        ? value.provider === 'typesafe' &&
          !!value.policyId &&
          expected.policyIds.includes(value.policyId)
        : expected.kind === 'generation' &&
          value.provider === 'openai' &&
          value.value.kind === 'finite' &&
          value.value.shelfLifeDays !== null &&
          value.value.shelfLifeDays >= expected.minDays &&
          value.value.shelfLifeDays <= expected.maxDays;
    if (correct) t.correct++;
    else if (expected.kind !== 'abstain') t.unsafe++;
  }
  if (
    row?.calls.some((call) => call.provider === 'openai') &&
    expected.kind !== 'generation' &&
    expected.kind !== 'unscored'
  )
    t.unsafe++;
  const reason = !value
    ? 'not_run'
    : value.status === 'resolved'
      ? 'accepted'
      : value.outcome.status === 'uncertain'
        ? value.outcome.reason
        : value.outcome.status;
  t.reasons[reason] = (t.reasons[reason] ?? 0) + 1;
}
export function scoreCases(cases: ApplicationCase[], rows: Observation[]) {
  const byId = new Map(rows.map((r) => [r.caseId, r]));
  if (
    byId.size !== rows.length ||
    rows.some(
      (r) => !cases.some((c) => c.caseId === r.caseId && c.task === r.task),
    )
  )
    throw new Error('Invalid scoring observations');
  const fields = Object.fromEntries(
    UNDERSTANDING_FIELDS.map((f) => [f, blank()]),
  ) as Record<UnderstandingField, Tallies>;
  const selections = blank(),
    generations = blank();
  for (const c of cases) {
    const row = byId.get(c.caseId);
    if (c.task === 'product_understanding')
      for (const f of UNDERSTANDING_FIELDS)
        understandingScore(c, row, f, fields[f]);
    else policyScore(c, row, selections, generations);
  }
  const calls = rows.flatMap((r) => r.calls);
  const providerMetrics = (provider: 'typesafe' | 'openai') => {
    const selected = calls.filter((c) => c.provider === provider);
    const times = selected.map((c) => c.elapsedMs).sort((a, b) => a - b);
    const observed = selected.filter(
      (c) => c.provider === 'typesafe' && c.transport.status === 'success',
    );
    return {
      logicalCalls: selected.length,
      failures: selected.filter((c) => c.transport.status !== 'success').length,
      inputTokens: observed.reduce(
        (sum, c) =>
          sum +
          (c.provider === 'typesafe' && c.transport.status === 'success'
            ? c.transport.usage.input_tokens
            : 0),
        0,
      ),
      outputTokens: observed.reduce(
        (sum, c) =>
          sum +
          (c.provider === 'typesafe' && c.transport.status === 'success'
            ? c.transport.usage.output_tokens
            : 0),
        0,
      ),
      missingUsageCount: selected.length - observed.length,
      latencyMs: {
        p50: times.length ? times[Math.ceil(times.length * 0.5) - 1] : null,
        p95: times.length ? times[Math.ceil(times.length * 0.95) - 1] : null,
      },
    };
  };
  return {
    selected: cases.length,
    completed: rows.length,
    notRun: cases.length - rows.length,
    modelCallCoverage: ratio(
      rows.filter((r) => r.calls.length > 0).length,
      cases.length,
    ),
    fields: Object.fromEntries(
      UNDERSTANDING_FIELDS.map((f) => [
        f,
        summaries(
          fields[f],
          cases.filter(
            (c) =>
              c.task === 'product_understanding' &&
              c.input.metadata[f] === null,
          ).length,
        ),
      ]),
    ) as Record<UnderstandingField, ReturnType<typeof summaries>>,
    policies: summaries(
      selections,
      cases.filter(
        (c) =>
          c.task === 'shelf_life_policy' && c.expected.kind !== 'generation',
      ).length,
    ),
    generation: summaries(
      generations,
      cases.filter(
        (c) =>
          c.task === 'shelf_life_policy' && c.expected.kind === 'generation',
      ).length,
    ),
    safetyViolations:
      Object.values(fields).reduce((sum, t) => sum + t.unsafe, 0) +
      selections.unsafe +
      generations.unsafe,
    providers: {
      typesafe: providerMetrics('typesafe'),
      openai: providerMetrics('openai'),
    },
  };
}
export type Metrics = ReturnType<typeof scoreCases>;
