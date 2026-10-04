import { z } from 'zod';
import { PredictedState } from '../../generated/prisma/enums';
import {
  JEV_STOCK_PREDICTION_VERSION,
  JEV_STOCK_PREDICTION_MIN_CONFIDENCE,
} from '../../estimation/jev-stock-prediction-advisor.service';
import { validateJevChoiceResponse } from '../../llm/typesafe/jev-decision.validation';
import type { JevChoiceRequest } from '../../llm/typesafe/jev-decision.types';
import {
  hash,
  idSchema,
  REPLAY_VERSION,
  splitSchema,
  type StockDataset,
  type StockSplit,
} from './dataset';
import { reconstructCase, selectedInputHash } from './reconstruction';

export const modelSchema = z.string().regex(/^jev-\d+\.\d+\.\d+$/);
export const hashSchema = z.string().regex(/^[a-f0-9]{64}$/);
export const probabilitySchema = z.number().finite().min(0).max(1);
export const countSchema = z
  .number()
  .int()
  .nonnegative()
  .max(Number.MAX_SAFE_INTEGER);
export const usageSchema = z
  .object({ input_tokens: countSchema, output_tokens: countSchema })
  .strict();
export const failureSchema = z.enum([
  'not_configured',
  'invalid_request',
  'deadline_exceeded',
  'authentication_error',
  'request_rejected',
  'rate_limited',
  'provider_error',
  'network_error',
  'invalid_response',
]);
const provenance = {
  provider: z.literal('typesafe'),
  task: z.literal('stock_prediction'),
  taskVersion: z.literal(JEV_STOCK_PREDICTION_VERSION),
};
export const transportSchema = z
  .discriminatedUnion('status', [
    z
      .object({
        ...provenance,
        status: z.literal('success'),
        model: modelSchema,
        choice: z.enum(PredictedState),
        confidence: probabilitySchema,
        probabilities: z.record(z.string(), probabilitySchema),
        usage: usageSchema,
      })
      .strict(),
    z
      .object({
        ...provenance,
        status: z.literal('unavailable'),
        model: modelSchema.optional(),
        reason: failureSchema,
      })
      .strict(),
  ])
  .refine((result) => {
    if (result.status !== 'success') return true;
    const request: JevChoiceRequest = {
      task: 'stock_prediction',
      taskVersion: JEV_STOCK_PREDICTION_VERSION,
      questionKey: 'stock_state',
      state: {},
      instructions: 'Validate recorded stock choices',
      criteria: Object.fromEntries(
        Object.values(PredictedState).map((state) => [state, null]),
      ),
    };
    return (
      validateJevChoiceResponse(
        {
          model: result.model,
          usage: result.usage,
          answers: {
            stock_state: {
              type: 'choice',
              choice: result.choice,
              confidence: result.confidence,
              probabilities: result.probabilities,
            },
          },
        },
        request,
      ).status === 'valid'
    );
  }, 'Invalid recorded probabilities');
export const recordedRowSchema = z
  .object({
    caseId: idSchema,
    elapsedMs: z.number().finite().nonnegative(),
    transport: transportSchema.nullable(),
  })
  .strict();
export const recordedRunSchema = z
  .object({
    schemaVersion: z.literal(1),
    evidenceMode: z.literal('offline'),
    datasetHash: hashSchema,
    inputHash: hashSchema,
    split: splitSchema,
    configuredModel: modelSchema,
    taskVersion: z.literal(JEV_STOCK_PREDICTION_VERSION),
    replayVersion: z.literal(REPLAY_VERSION),
    rows: z.array(recordedRowSchema).min(1).max(200),
  })
  .strict();
export type RecordedRun = z.output<typeof recordedRunSchema>;

export function parseRecordedRun(
  value: unknown,
  dataset: StockDataset,
  split: StockSplit,
): RecordedRun {
  const parsed = recordedRunSchema.safeParse(value);
  if (!parsed.success) throw new Error('Invalid recorded stock evaluation');
  const run = parsed.data;
  const cases = dataset.cases.filter((c) => c.split === split);
  if (
    run.datasetHash !== hash(dataset) ||
    run.inputHash !== selectedInputHash(cases) ||
    run.split !== split ||
    run.rows.length !== cases.length ||
    new Set(run.rows.map((r) => r.caseId)).size !== run.rows.length
  )
    throw new Error('Recorded stock evaluation does not match dataset');
  const byId = new Map(cases.map((c) => [c.id, c]));
  for (const row of run.rows) {
    const item = byId.get(row.caseId);
    if (
      !item ||
      Boolean(reconstructCase(item).bypassReason) !== (row.transport === null)
    )
      throw new Error('Recorded stock evaluation has invalid case or bypass');
  }
  return run;
}

export const predictionProjectionSchema = z
  .object({
    predictedState: z.enum(PredictedState),
    confidenceScore: probabilitySchema,
    llmContributed: z.boolean(),
  })
  .strict();
export const observationSchema = z
  .object({
    caseId: idSchema,
    inputHash: hashSchema,
    bypassReason: z
      .enum(['disabled', 'zero_history', 'authoritative', 'high_confidence'])
      .nullable(),
    callStatus: z.enum(['success', 'unavailable', 'skipped']),
    failureReason: failureSchema.nullable(),
    resolvedModel: modelSchema.nullable(),
    elapsedMs: z.number().finite().nonnegative(),
    usage: usageSchema.nullable(),
    rawDecision: z
      .object({ choice: z.enum(PredictedState), confidence: probabilitySchema })
      .strict()
      .nullable(),
    accepted: z.boolean(),
    rejectionReason: z
      .enum(['low_confidence', 'uncertain', 'insufficient_cold_start'])
      .nullable(),
    baseline: predictionProjectionSchema,
    final: predictionProjectionSchema,
    coldStart: z.boolean(),
    hasLearnedStatistics: z.boolean(),
  })
  .strict()
  .refine((row) => {
    if (
      row.baseline.llmContributed ||
      row.accepted !== row.final.llmContributed
    )
      return false;
    if (row.callStatus === 'skipped')
      return (
        row.bypassReason !== null &&
        row.failureReason === null &&
        row.rawDecision === null &&
        row.resolvedModel === null &&
        row.usage === null &&
        !row.accepted &&
        row.rejectionReason === null
      );
    if (row.bypassReason !== null) return false;
    if (row.callStatus === 'unavailable')
      return (
        row.failureReason !== null &&
        row.rawDecision === null &&
        row.resolvedModel === null &&
        row.usage === null &&
        !row.accepted &&
        row.rejectionReason === null
      );
    return (
      row.failureReason === null &&
      row.rawDecision !== null &&
      row.resolvedModel !== null &&
      row.usage !== null &&
      (row.accepted
        ? row.rejectionReason === null
        : row.rejectionReason !== null)
    );
  }, 'Observation statuses must agree')
  .refine((row) => {
    if (!row.accepted)
      return (
        row.final.predictedState === row.baseline.predictedState &&
        row.final.confidenceScore === row.baseline.confidenceScore
      );
    const advice = row.rawDecision;
    return (
      advice !== null &&
      advice.confidence >= JEV_STOCK_PREDICTION_MIN_CONFIDENCE &&
      advice.choice !== 'uncertain' &&
      row.final.confidenceScore ===
        Math.min(row.baseline.confidenceScore, advice.confidence) &&
      row.final.predictedState ===
        (row.baseline.predictedState === 'uncertain'
          ? advice.choice
          : row.baseline.predictedState)
    );
  }, 'Final prediction must preserve shared composition rules');
export type StockObservation = z.output<typeof observationSchema>;
