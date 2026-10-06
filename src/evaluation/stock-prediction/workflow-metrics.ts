import { z } from 'zod';
import { PredictedState } from '../../generated/prisma/enums';
import { groundTruth, type StockCase, idSchema } from './dataset';
import { ratio, wilsonInterval } from '../product-matching/scoring';
import { callSchema } from '../application-inference/recording';

const projection = z
  .object({
    state: z.enum(PredictedState),
    confidence: z.number().min(0).max(1),
    quantity: z.number().finite().nonnegative().nullable(),
    recordedQuantity: z.number().finite().nonnegative().nullable(),
    recommended: z.boolean(),
    reason: z.string().min(1),
  })
  .strict();
export const workflowObservationSchema = z
  .object({
    caseId: idSchema,
    baseline: projection,
    final: projection,
    accepted: z.boolean(),
    application: z.enum([
      'none',
      'not_applied',
      'applied',
      'stale',
      'persistence_failed',
    ]),
    repeatInference: z.boolean(),
    calls: z.array(callSchema).max(1),
  })
  .strict()
  .refine(
    (r) => r.calls.every((c) => c.provider === 'typesafe'),
    'Stock cannot generate',
  );
export type WorkflowObservation = z.infer<typeof workflowObservationSchema>;
export function workflowMetrics(
  cases: StockCase[],
  rows: WorkflowObservation[],
) {
  const byId = new Map(rows.map((r) => [r.caseId, r]));
  if (
    byId.size !== rows.length ||
    rows.some((r) => !cases.some((c) => c.id === r.caseId))
  )
    throw new Error('Invalid workflow observations');
  const scored = cases.map((c) => ({
    c,
    row: byId.get(c.id),
    truth: groundTruth(c),
  }));
  const metricsFor = (which: 'baseline' | 'final') => {
    const observed = scored.filter((s) => s.row && s.truth.state !== null);
    const prompted = observed.filter((s) => s.row![which].recommended);
    const correct = prompted.filter(
      (s) => s.truth.state === 'low' || s.truth.state === 'out',
    ).length;
    const needs = observed.filter(
      (s) => s.truth.state === 'low' || s.truth.state === 'out',
    ).length;
    const confusion = {
      trueNeed: correct,
      falsePrompt: prompted.length - correct,
      missedNeed: needs - correct,
      silentAvailable: observed.filter(
        (s) => s.truth.state === 'available' && !s.row![which].recommended,
      ).length,
    };
    return {
      precision: ratio(correct, prompted.length),
      precisionInterval95: wilsonInterval(correct, prompted.length),
      needRecall: ratio(correct, needs),
      coverage: ratio(
        rows.filter((r) => r[which].recommended).length,
        cases.length,
      ),
      confusion,
    };
  };
  const reasons: Record<string, number> = {};
  for (const s of scored) {
    const reason = !s.row ? 'not_run' : s.truth.reason;
    if (reason) reasons[reason] = (reasons[reason] ?? 0) + 1;
  }
  const baseline = metricsFor('baseline'),
    final = metricsFor('final');
  const calls = rows.flatMap((r) => r.calls);
  const times = calls.map((c) => c.elapsedMs).sort((a, b) => a - b);
  const usage = calls.flatMap((c) =>
    c.provider === 'typesafe' && c.transport.status === 'success'
      ? [c.transport.usage]
      : [],
  );
  return {
    selected: cases.length,
    completed: rows.length,
    scored: scored.filter((s) => s.row && s.truth.state !== null).length,
    unscoredReasons: reasons,
    baseline,
    final,
    modelCallCoverage: ratio(
      rows.filter((r) => r.calls.length > 0).length,
      cases.length,
    ),
    provider: {
      logicalCalls: calls.length,
      inputTokens: usage.reduce((sum, u) => sum + u.input_tokens, 0),
      outputTokens: usage.reduce((sum, u) => sum + u.output_tokens, 0),
      missingUsageCount: calls.length - usage.length,
      latencyMs: {
        p50: times.length ? times[Math.ceil(times.length * 0.5) - 1] : null,
        p95: times.length ? times[Math.ceil(times.length * 0.95) - 1] : null,
      },
    },
    accepted: rows.filter((r) => r.accepted).length,
    applied: rows.filter((r) => r.application === 'applied').length,
    stale: rows.filter((r) => r.application === 'stale').length,
    failures: rows.filter(
      (r) =>
        r.application === 'persistence_failed' ||
        r.calls.some((c) => c.transport.status === 'unavailable'),
    ).length,
    safetyViolations: rows.filter(
      (r) =>
        r.repeatInference ||
        (r.application === 'applied' &&
          r.final.recordedQuantity !== r.baseline.recordedQuantity) ||
        (r.application === 'applied' &&
          r.final.quantity !== r.baseline.quantity) ||
        (r.application === 'applied' &&
          r.final.confidence > r.baseline.confidence) ||
        ((r.baseline.reason.startsWith('daily_explicit') ||
          ['daily_stock_expired', 'daily_stock_depleted'].includes(
            r.baseline.reason,
          )) &&
          r.final.state !== r.baseline.state),
    ).length,
    precisionRegressed:
      baseline.precision.value !== null &&
      final.precision.value !== null &&
      final.precision.value < baseline.precision.value,
  };
}
