import { z } from 'zod';
import { caseSchema, groundTruth, type StockCase } from './dataset';
import {
  countSchema,
  failureSchema,
  observationSchema,
  probabilitySchema,
  type StockObservation,
} from './observations';
import { reconstructCase, selectedInputHash } from './reconstruction';

export const ratioSchema = z
  .object({
    numerator: countSchema,
    denominator: countSchema,
    value: probabilitySchema.nullable(),
  })
  .strict()
  .refine(
    (r) =>
      r.numerator <= r.denominator &&
      (r.denominator === 0
        ? r.value === null
        : r.value !== null &&
          Math.abs(r.value - r.numerator / r.denominator) < 1e-12),
    'Ratio must match its counts',
  );
const intervalSchema = z
  .object({ lower: probabilitySchema, upper: probabilitySchema })
  .strict()
  .refine((i) => i.lower <= i.upper)
  .nullable();
const predictionMetricsSchema = z
  .object({
    lowOutPrecision: ratioSchema,
    exactLowOutPrecision: ratioSchema,
    falsePromptProxy: ratioSchema,
    needRecall: ratioSchema,
    uncertainty: ratioSchema,
    precisionInterval95: intervalSchema,
    confusion: z.record(
      z.enum(['available', 'low', 'out']),
      z
        .object({
          likely_available: countSchema,
          probably_low: countSchema,
          probably_out: countSchema,
          uncertain: countSchema,
        })
        .strict(),
    ),
  })
  .strict();
export const metricsSchema = z
  .object({
    selectedCaseCount: countSchema.max(200),
    completedCaseCount: countSchema.max(200),
    scoredCaseCount: countSchema.max(200),
    eligibleCaseCount: countSchema.max(200),
    acceptedCount: countSchema.max(200),
    acceptedCoverage: ratioSchema,
    eligibleAcceptance: ratioSchema,
    scoredCoverage: ratioSchema,
    final: predictionMetricsSchema,
    baseline: predictionMetricsSchema,
    acceptedLowOutPrecision: ratioSchema,
    acceptedExactLowOutPrecision: ratioSchema,
    acceptedFalsePromptProxy: ratioSchema,
    acceptedPrecisionInterval95: intervalSchema,
    rawLowOutPrecision: ratioSchema,
    rawDisagreementCount: countSchema,
    stateChangeCount: countSchema,
    unscoredReasons: z.partialRecord(
      z.enum([
        'missing_confirmation',
        'late_confirmation',
        'conflicting_confirmation',
        'intervening_mutation',
        'incomplete_episode',
      ]),
      countSchema,
    ),
    confirmationLagHours: z
      .object({
        p50: z.number().finite().nonnegative().nullable(),
        p95: z.number().finite().nonnegative().nullable(),
      })
      .strict(),
    provider: z
      .object({
        calls: countSchema,
        successes: countSchema,
        failures: countSchema,
        bypasses: countSchema,
        validatedRejections: countSchema,
        failureRate: ratioSchema,
        failureReasons: z.partialRecord(failureSchema, countSchema),
        rejectionReasons: z.partialRecord(
          z.enum(['low_confidence', 'uncertain', 'insufficient_cold_start']),
          countSchema,
        ),
        bypassReasons: z.partialRecord(
          z.enum([
            'disabled',
            'zero_history',
            'authoritative',
            'high_confidence',
          ]),
          countSchema,
        ),
        latencyMs: z
          .object({
            p50: z.number().finite().nonnegative().nullable(),
            p95: z.number().finite().nonnegative().nullable(),
          })
          .strict(),
        tokens: z
          .object({
            input: countSchema,
            output: countSchema,
            missingUsageCount: countSchema,
          })
          .strict(),
      })
      .strict(),
  })
  .strict()
  .refine(
    (m) =>
      m.completedCaseCount <= m.selectedCaseCount &&
      m.scoredCaseCount <= m.completedCaseCount &&
      m.eligibleCaseCount <= m.selectedCaseCount &&
      m.acceptedCount <= m.provider.successes &&
      m.provider.calls + m.provider.bypasses === m.completedCaseCount &&
      m.provider.successes + m.provider.failures === m.provider.calls &&
      m.acceptedCount + m.provider.validatedRejections === m.provider.successes,
    'Metric counts must agree',
  );
export type StockMetrics = z.output<typeof metricsSchema>;
export function ratio(numerator: number, denominator: number) {
  return {
    numerator,
    denominator,
    value: denominator === 0 ? null : numerator / denominator,
  };
}
export function wilsonInterval(correct: number, total: number) {
  if (total === 0) return null;
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
function percentile(values: number[], p: number) {
  return values.length === 0
    ? null
    : [...values].sort((a, b) => a - b)[Math.ceil(values.length * p) - 1];
}
function countReasons<T extends string>(
  values: T[],
): Partial<Record<T, number>> {
  const counts: Partial<Record<T, number>> = {};
  for (const value of values) counts[value] = (counts[value] ?? 0) + 1;
  return counts;
}
function isNeed(state: string) {
  return state === 'probably_low' || state === 'probably_out';
}
type ScoredRow = {
  row: StockObservation;
  truth: ReturnType<typeof groundTruth>;
};
function predictionMetrics(rows: ScoredRow[], key: 'final' | 'baseline') {
  const scored = rows.filter((r) => r.truth.state !== null);
  const needPredictions = scored.filter((r) =>
    isNeed(r.row[key].predictedState),
  );
  const correct = needPredictions.filter(
    (r) => r.truth.state === 'low' || r.truth.state === 'out',
  ).length;
  const actualNeed = scored.filter(
    (r) => r.truth.state === 'low' || r.truth.state === 'out',
  );
  const exact = needPredictions.filter(
    (r) =>
      r.row[key].predictedState ===
      (r.truth.state === 'low'
        ? 'probably_low'
        : r.truth.state === 'out'
          ? 'probably_out'
          : 'likely_available'),
  ).length;
  const confusion = Object.fromEntries(
    ['available', 'low', 'out'].map((truth) => [
      truth,
      Object.fromEntries(
        ['likely_available', 'probably_low', 'probably_out', 'uncertain'].map(
          (state) => [
            state,
            scored.filter(
              (r) =>
                r.truth.state === truth && r.row[key].predictedState === state,
            ).length,
          ],
        ),
      ),
    ]),
  );
  return {
    lowOutPrecision: ratio(correct, needPredictions.length),
    exactLowOutPrecision: ratio(exact, needPredictions.length),
    falsePromptProxy: ratio(
      needPredictions.length - correct,
      needPredictions.length,
    ),
    needRecall: ratio(
      actualNeed.filter((r) => isNeed(r.row[key].predictedState)).length,
      actualNeed.length,
    ),
    uncertainty: ratio(
      rows.filter((r) => r.row[key].predictedState === 'uncertain').length,
      rows.length,
    ),
    precisionInterval95: wilsonInterval(correct, needPredictions.length),
    confusion,
  };
}
function providerMetrics(rows: StockObservation[]): StockMetrics['provider'] {
  const calls = rows.filter((r) => r.callStatus !== 'skipped');
  const failures = rows.filter((r) => r.callStatus === 'unavailable');
  const success = rows.filter((r) => r.callStatus === 'success');
  return {
    calls: calls.length,
    successes: success.length,
    failures: failures.length,
    bypasses: rows.length - calls.length,
    validatedRejections: success.filter((r) => !r.accepted).length,
    failureRate: ratio(failures.length, calls.length),
    failureReasons: countReasons(failures.map((r) => r.failureReason!)),
    rejectionReasons: countReasons(
      rows.flatMap((r) => (r.rejectionReason ? [r.rejectionReason] : [])),
    ),
    bypassReasons: countReasons(
      rows.flatMap((r) => (r.bypassReason ? [r.bypassReason] : [])),
    ),
    latencyMs: {
      p50: percentile(
        calls.map((r) => r.elapsedMs),
        0.5,
      ),
      p95: percentile(
        calls.map((r) => r.elapsedMs),
        0.95,
      ),
    },
    tokens: {
      input: success.reduce((sum, r) => sum + r.usage!.input_tokens, 0),
      output: success.reduce((sum, r) => sum + r.usage!.output_tokens, 0),
      missingUsageCount: failures.length,
    },
  };
}
function validateRows(cases: StockCase[], rows: StockObservation[]) {
  const selected = cases.map((c) => caseSchema.parse(c));
  const byId = new Map(selected.map((c) => [c.id, c]));
  if (
    byId.size !== selected.length ||
    new Set(selected.map((c) => c.episodeId)).size !== selected.length ||
    new Set(rows.map((r) => r.caseId)).size !== rows.length ||
    rows.some((r) => !byId.has(r.caseId))
  )
    throw new Error('Scoring requires unique selected cases and observations');
  return rows.map((value) => {
    const row = observationSchema.parse(value);
    const item = byId.get(row.caseId)!;
    const { candidate, bypassReason } = reconstructCase(item);
    const expectedState =
      !item.product.predictionEnabled || candidate.signals.eventCount === 0
        ? 'uncertain'
        : candidate.predictedState;
    const expectedConfidence =
      !item.product.predictionEnabled || candidate.signals.eventCount === 0
        ? 0
        : candidate.confidenceScore;
    if (
      row.baseline.predictedState !== expectedState ||
      row.baseline.confidenceScore !== expectedConfidence
    )
      throw new Error('Baseline does not match deterministic evidence');
    if (
      row.inputHash !== selectedInputHash([item]) ||
      row.bypassReason !== bypassReason ||
      row.coldStart !== candidate.signals.coldStart ||
      row.hasLearnedStatistics !== candidate.signals.hasLearnedStatistics
    )
      throw new Error('Observation does not match reconstructed evidence');
    return { row, truth: groundTruth(item) };
  });
}
export function scoreCases(
  cases: StockCase[],
  rows: StockObservation[],
): StockMetrics {
  const joined = validateRows(cases, rows);
  const accepted = joined.filter((r) => r.row.accepted);
  const acceptedMetrics = predictionMetrics(accepted, 'final');
  const rawNeed = joined.filter(
    (r) =>
      r.truth.state !== null &&
      r.row.rawDecision &&
      isNeed(r.row.rawDecision.choice),
  );
  const eligible = cases.filter(
    (c) => reconstructCase(c).bypassReason === null,
  ).length;
  return metricsSchema.parse({
    selectedCaseCount: cases.length,
    completedCaseCount: rows.length,
    scoredCaseCount: joined.filter((r) => r.truth.state !== null).length,
    eligibleCaseCount: eligible,
    acceptedCount: accepted.length,
    acceptedCoverage: ratio(accepted.length, cases.length),
    eligibleAcceptance: ratio(accepted.length, eligible),
    scoredCoverage: ratio(
      joined.filter((r) => r.truth.state !== null).length,
      cases.length,
    ),
    final: predictionMetrics(joined, 'final'),
    baseline: predictionMetrics(joined, 'baseline'),
    acceptedLowOutPrecision: acceptedMetrics.lowOutPrecision,
    acceptedExactLowOutPrecision: acceptedMetrics.exactLowOutPrecision,
    acceptedFalsePromptProxy: acceptedMetrics.falsePromptProxy,
    acceptedPrecisionInterval95: acceptedMetrics.precisionInterval95,
    rawLowOutPrecision: ratio(
      rawNeed.filter((r) => r.truth.state === 'low' || r.truth.state === 'out')
        .length,
      rawNeed.length,
    ),
    rawDisagreementCount: rows.filter(
      (r) =>
        r.rawDecision && r.rawDecision.choice !== r.baseline.predictedState,
    ).length,
    stateChangeCount: rows.filter(
      (r) => r.final.predictedState !== r.baseline.predictedState,
    ).length,
    unscoredReasons: countReasons(
      joined.flatMap((r) => (r.truth.reason ? [r.truth.reason] : [])),
    ),
    confirmationLagHours: {
      p50: percentile(
        joined.flatMap((r) =>
          r.truth.state !== null ? [r.truth.lagHours!] : [],
        ),
        0.5,
      ),
      p95: percentile(
        joined.flatMap((r) =>
          r.truth.state !== null ? [r.truth.lagHours!] : [],
        ),
        0.95,
      ),
    },
    provider: providerMetrics(rows),
  });
}
export interface StockSlice {
  dimension:
    'split' | 'cold_start' | 'learned_history' | 'tag' | 'product_type';
  value: string;
  metrics: StockMetrics;
}
export function sliceMetrics(
  cases: StockCase[],
  rows: StockObservation[],
): StockSlice[] {
  validateRows(cases, rows);
  const groups = new Map<
    string,
    { dimension: StockSlice['dimension']; value: string; cases: StockCase[] }
  >();
  for (const item of cases) {
    const signals = reconstructCase(item).candidate.signals;
    const dimensions: [StockSlice['dimension'], string][] = [
      ['split', item.split],
      ['cold_start', signals.coldStart ? 'cold_start' : 'established'],
      ['learned_history', signals.hasLearnedStatistics ? 'present' : 'absent'],
      ['product_type', item.product.productType ?? 'unknown'],
      ...[...new Set(item.tags)].map(
        (tag) => ['tag', tag] as [StockSlice['dimension'], string],
      ),
    ];
    for (const [dimension, value] of dimensions) {
      const key = `${dimension}:${value}`;
      const group = groups.get(key) ?? { dimension, value, cases: [] };
      group.cases.push(item);
      groups.set(key, group);
    }
  }
  return [...groups.values()].map((group) => {
    const ids = new Set(group.cases.map((c) => c.id));
    return {
      dimension: group.dimension,
      value: group.value,
      metrics: scoreCases(
        group.cases,
        rows.filter((r) => ids.has(r.caseId)),
      ),
    };
  });
}
