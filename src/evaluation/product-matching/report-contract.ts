import { z } from 'zod';
import {
  JEV_PRODUCT_RESOLUTION_MIN_CONFIDENCE,
  JEV_PRODUCT_RESOLUTION_VERSION,
} from '../../product/jev-product-resolution-advisor.service';
import { evaluationIdSchema, evaluationSplitSchema } from './dataset';
import {
  countSchema,
  hashSchema,
  jevModelSchema,
  observationSchema,
  probabilitySchema,
  unavailableReasonSchema,
} from './observations';

export const ratioSchema = z
  .object({
    numerator: countSchema,
    denominator: countSchema,
    value: probabilitySchema.nullable(),
  })
  .strict()
  .refine(
    ({ numerator, denominator, value }) =>
      numerator <= denominator &&
      (denominator === 0
        ? value === null
        : value !== null && Math.abs(value - numerator / denominator) < 1e-12),
    'Ratio must match counts',
  );
export const metricsSchema = z
  .object({
    caseCount: countSchema,
    precision: ratioSchema,
    coverage: ratioSchema,
    matchRecall: ratioSchema,
    ambiguityClarification: ratioSchema,
    noMatchNull: ratioSchema,
    unsafeAmbiguousMatches: countSchema,
    unsafeNoMatchMatches: countSchema,
    successCount: countSchema,
    unavailableCount: countSchema,
    skippedCount: countSchema,
    failureRate: ratioSchema,
    failureReasons: z.partialRecord(unavailableReasonSchema, countSchema),
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
    precisionInterval95: z
      .object({ lower: probabilitySchema, upper: probabilitySchema })
      .strict()
      .refine(({ lower, upper }) => lower <= upper)
      .nullable(),
  })
  .strict();
export const datasetSummarySchema = z
  .object({
    caseCount: countSchema,
    splitCounts: z
      .object({ tuning: countSchema, held_out: countSchema })
      .strict(),
    hebrewMixedCount: countSchema,
    reviewedCount: countSchema,
    confirmedCount: countSchema,
    tagCounts: z.record(
      z.string().regex(/^[a-z][a-z0-9_]{0,63}$/),
      countSchema,
    ),
    missingScenarios: z.array(evaluationIdSchema),
    corpusEligible: z.boolean(),
    labelsReviewed: z.boolean(),
    datasetHash: hashSchema,
  })
  .strict();
export const evaluationReportSchema = z
  .object({
    schemaVersion: z.literal(1),
    evidenceMode: z.enum(['offline', 'live']),
    purpose: z.enum(['evaluation', 'smoke']),
    startedAt: z.iso.datetime({ offset: true }),
    finishedAt: z.iso.datetime({ offset: true }),
    codeRevision: z
      .string()
      .regex(/^[a-f0-9]{40}$/)
      .nullable(),
    codeDirty: z.boolean(),
    datasetVersion: evaluationIdSchema,
    datasetHash: hashSchema,
    inputHash: hashSchema,
    split: evaluationSplitSchema,
    confidenceGate: z.literal(JEV_PRODUCT_RESOLUTION_MIN_CONFIDENCE),
    configuredModel: jevModelSchema,
    resolvedModels: z.array(jevModelSchema),
    taskVersion: z.literal(JEV_PRODUCT_RESOLUTION_VERSION),
    complete: z.boolean(),
    selectedCaseCount: countSchema.max(200),
    datasetSummary: datasetSummarySchema,
    observations: z.array(observationSchema).max(200),
    metrics: metricsSchema,
    slices: z.array(
      z
        .object({
          dimension: z.enum(['split', 'language', 'tag']),
          value: evaluationIdSchema,
          metrics: metricsSchema,
        })
        .strict(),
    ),
    launchEvidence: z.enum(['eligible', 'failed', 'inconclusive']),
    launchReasons: z.array(evaluationIdSchema),
    warnings: z.array(evaluationIdSchema),
  })
  .strict()
  .refine(
    (report) =>
      report.datasetHash === report.datasetSummary.datasetHash &&
      report.observations.length === report.metrics.caseCount &&
      new Set(report.observations.map((row) => row.caseId)).size ===
        report.observations.length &&
      report.observations.length <= report.selectedCaseCount &&
      (!report.complete ||
        report.observations.length === report.selectedCaseCount),
    'Report counts and dataset provenance must agree',
  )
  .refine(
    (report) =>
      report.launchEvidence !== 'eligible' ||
      (report.evidenceMode === 'live' &&
        report.purpose === 'evaluation' &&
        report.complete &&
        report.split === 'held_out' &&
        report.codeRevision !== null &&
        !report.codeDirty &&
        report.datasetSummary.corpusEligible &&
        report.datasetSummary.labelsReviewed &&
        report.resolvedModels.length === 1 &&
        report.resolvedModels[0] === report.configuredModel &&
        report.metrics.unavailableCount === 0 &&
        report.metrics.unsafeAmbiguousMatches === 0 &&
        report.metrics.unsafeNoMatchMatches === 0 &&
        report.metrics.precision.denominator >= 50 &&
        report.metrics.precision.value !== null &&
        report.metrics.precision.value >= 0.98),
    'Eligible reports require complete reviewed live held-out evidence',
  );
export type EvaluationMetrics = z.output<typeof metricsSchema>;
export type EvaluationReport = z.output<typeof evaluationReportSchema>;
