import { z } from 'zod';
import { hash, hashSchema, type ApplicationDataset } from './dataset';
import { comparisonMetrics } from './perishability-comparison-metrics';
import { comparisonSchema } from './perishability-comparison-contract';
import {
  validatePlannedComparison,
  type ComparisonPlan,
} from './perishability-comparison-plan';

const reportSchema = z
  .object({
    schemaVersion: z.literal('perishability-comparison-report-v1'),
    comparison: comparisonSchema,
    planHash: hashSchema,
    metrics: z.unknown(),
    launchEvidence: z.literal('inconclusive'),
    run: z
      .object({
        codeRevision: z
          .string()
          .regex(/^[a-f0-9]{40}$/)
          .nullable(),
        codeDirty: z.boolean(),
        dirtyPaths: z.array(z.string()),
        sourceHash: hashSchema,
        sourceHashAfter: hashSchema,
        startedAt: z.iso.datetime(),
        finishedAt: z.iso.datetime(),
        complete: z.boolean(),
        physicalRequests: z
          .object({
            typesafe: z.number().int().nonnegative(),
            openai: z.literal(0),
          })
          .strict()
          .nullable(),
        evidenceMode: z.enum(['live', 'offline']),
      })
      .strict(),
  })
  .strict();

export async function parseComparisonReport(
  value: unknown,
  dataset: ApplicationDataset,
  plan: ComparisonPlan,
) {
  const report = reportSchema.parse(value);
  const comparison = await validatePlannedComparison(
    report.comparison,
    dataset,
    plan,
  );
  const metrics = comparisonMetrics(comparison);
  if (report.planHash !== hash(plan) || hash(report.metrics) !== hash(metrics))
    throw new Error('Comparison report metrics or plan mismatch');
  if (
    Date.parse(report.run.finishedAt) < Date.parse(report.run.startedAt) ||
    (report.run.evidenceMode === 'offline') !==
      (report.run.physicalRequests === null) ||
    (report.run.complete &&
      (!comparison.variants.every((v) => v.complete) ||
        report.run.sourceHash !== report.run.sourceHashAfter))
  )
    throw new Error('Comparison report run mismatch');
  return { ...report, metrics };
}
