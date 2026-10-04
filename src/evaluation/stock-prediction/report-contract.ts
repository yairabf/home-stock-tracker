import { z } from 'zod';
import {
  JEV_STOCK_PREDICTION_MIN_CONFIDENCE,
  JEV_STOCK_PREDICTION_VERSION,
} from '../../estimation/jev-stock-prediction-advisor.service';
import {
  caseSchema,
  hash,
  idSchema,
  REPLAY_VERSION,
  splitSchema,
} from './dataset';
import {
  countSchema,
  hashSchema,
  modelSchema,
  observationSchema,
  recordedRowSchema,
  recordedRunSchema,
} from './observations';
import { metricsSchema } from './metrics';
import { assessLaunch } from './launch-policy';

export const executionSchema = z
  .object({
    schemaVersion: z.literal(1),
    evidenceMode: z.enum(['offline', 'live']),
    purpose: z.enum(['smoke', 'evaluation']),
    datasetVersion: idSchema,
    datasetHash: hashSchema,
    inputHash: hashSchema,
    split: splitSchema,
    configuredModel: modelSchema,
    taskVersion: z.literal(JEV_STOCK_PREDICTION_VERSION),
    replayVersion: z.literal(REPLAY_VERSION),
    codeRevision: z
      .string()
      .regex(/^[a-f0-9]{40}$/)
      .nullable(),
    codeDirty: z.boolean(),
    startedAt: z.iso.datetime({ offset: true }),
    finishedAt: z.iso.datetime({ offset: true }),
    selectedCaseCount: countSchema.min(1).max(200),
    complete: z.boolean(),
    observations: z.array(observationSchema).max(200),
    recording: recordedRunSchema.safeExtend({
      rows: z.array(recordedRowSchema).max(200),
    }),
  })
  .strict()
  .refine((e) => {
    if (
      Date.parse(e.finishedAt) < Date.parse(e.startedAt) ||
      e.observations.length > e.selectedCaseCount ||
      (e.complete && e.observations.length !== e.selectedCaseCount) ||
      new Set(e.observations.map((r) => r.caseId)).size !==
        e.observations.length ||
      e.recording.rows.length !== e.observations.length
    )
      return false;
    if (
      e.recording.datasetHash !== e.datasetHash ||
      e.recording.inputHash !== e.inputHash ||
      e.recording.split !== e.split ||
      e.recording.configuredModel !== e.configuredModel
    )
      return false;
    return e.observations.every((row, i) => {
      const recorded = e.recording.rows[i];
      const transport = recorded.transport;
      if (
        recorded.caseId !== row.caseId ||
        recorded.elapsedMs !== row.elapsedMs
      )
        return false;
      if (row.callStatus === 'skipped') return transport === null;
      if (row.callStatus === 'unavailable')
        return (
          transport?.status === 'unavailable' &&
          transport.reason === row.failureReason
        );
      return (
        transport?.status === 'success' &&
        transport.choice === row.rawDecision?.choice &&
        transport.confidence === row.rawDecision.confidence &&
        transport.model === row.resolvedModel &&
        hash(transport.usage) === hash(row.usage)
      );
    });
  }, 'Execution counts, recording and provenance must agree');
const truthSchema = z
  .object({
    state: z.enum(['available', 'low', 'out']).nullable(),
    reason: z
      .enum([
        'missing_confirmation',
        'late_confirmation',
        'conflicting_confirmation',
        'intervening_mutation',
        'incomplete_episode',
      ])
      .nullable(),
    lagHours: z.number().finite().nonnegative().nullable(),
  })
  .strict()
  .refine((t) =>
    t.state === null
      ? t.reason !== null
      : t.reason === null &&
        t.lagHours !== null &&
        t.lagHours > 0 &&
        t.lagHours <= 24,
  );
export const caseAssessmentSchema = z
  .object({
    caseId: idSchema,
    episodeId: idSchema,
    productGroupId: idSchema,
    source: z.enum(['authored', 'historical']),
    review: caseSchema.shape.review,
    truth: truthSchema,
  })
  .strict()
  .refine(
    (c) =>
      c.source !== 'historical' ||
      c.review.status !== 'reviewed' ||
      (c.review.evidenceReference !== null && c.review.episodeComplete),
    'Historical review requires evidence and a complete episode',
  );
const sliceSchema = z
  .object({
    dimension: z.enum([
      'split',
      'cold_start',
      'learned_history',
      'tag',
      'product_type',
    ]),
    value: idSchema,
    metrics: metricsSchema,
  })
  .strict();
export const reportSchema = executionSchema
  .safeExtend({
    confidenceGate: z.literal(JEV_STOCK_PREDICTION_MIN_CONFIDENCE),
    resolvedModels: z.array(modelSchema).max(200),
    caseAssessments: z.array(caseAssessmentSchema).min(1).max(200),
    datasetSummary: z
      .object({
        historicalCount: countSchema.max(200),
        reviewedCount: countSchema.max(200),
        frozenCount: countSchema.max(200),
        productGroupCount: countSchema.max(200),
      })
      .strict(),
    metrics: metricsSchema,
    slices: z.array(sliceSchema).max(5000),
    launchEvidence: z.enum(['eligible', 'failed', 'inconclusive']),
    launchReasons: z.array(idSchema).max(20),
    warnings: z.array(idSchema).max(20),
  })
  .superRefine((r, ctx) => {
    const invalid = (message: string) =>
      ctx.addIssue({ code: 'custom', message });
    const cases = r.caseAssessments;
    const byId = new Map(cases.map((c) => [c.caseId, c]));
    const summary = {
      historicalCount: cases.filter((c) => c.source === 'historical').length,
      reviewedCount: cases.filter((c) => c.review.status === 'reviewed').length,
      frozenCount: cases.filter(
        (c) =>
          c.review.status === 'reviewed' &&
          Date.parse(c.review.reviewedAt!) <= Date.parse(r.startedAt),
      ).length,
      productGroupCount: new Set(cases.map((c) => c.productGroupId)).size,
    };
    if (
      cases.length !== r.selectedCaseCount ||
      byId.size !== cases.length ||
      new Set(cases.map((c) => c.episodeId)).size !== cases.length ||
      r.observations.some((row) => !byId.has(row.caseId)) ||
      hash(summary) !== hash(r.datasetSummary)
    )
      invalid('Selected-case summary must agree');
    const resolved = [
      ...new Set(
        r.observations.flatMap((row) =>
          row.resolvedModel ? [row.resolvedModel] : [],
        ),
      ),
    ].sort();
    if (hash(resolved) !== hash(r.resolvedModels))
      invalid('Resolved models must match observations');
    const acceptedNeed = r.observations.filter(
      (row) =>
        row.accepted &&
        ['probably_low', 'probably_out'].includes(row.final.predictedState) &&
        byId.get(row.caseId)?.truth.state != null,
    );
    const correct = acceptedNeed.filter((row) =>
      ['low', 'out'].includes(byId.get(row.caseId)!.truth.state!),
    ).length;
    if (
      r.metrics.selectedCaseCount !== r.selectedCaseCount ||
      r.metrics.completedCaseCount !== r.observations.length ||
      r.metrics.acceptedLowOutPrecision.numerator !== correct ||
      r.metrics.acceptedLowOutPrecision.denominator !== acceptedNeed.length ||
      r.metrics.acceptedCount !==
        r.observations.filter((row) => row.accepted).length ||
      r.metrics.provider.failures !==
        r.observations.filter((row) => row.callStatus === 'unavailable').length
    )
      invalid('Launch metric denominators must match observations and labels');
    const gate = assessLaunch(r);
    if (
      r.launchEvidence !== gate.launchEvidence ||
      hash(r.launchReasons) !== hash(gate.launchReasons) ||
      hash(r.warnings) !== hash(gate.warnings)
    )
      invalid('Launch assessment must match evidence');
  });
export type StockReport = z.output<typeof reportSchema>;
