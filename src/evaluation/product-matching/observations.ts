import { z } from 'zod';
import {
  JEV_PRODUCT_RESOLUTION_MIN_CONFIDENCE,
  JEV_PRODUCT_RESOLUTION_VERSION,
} from '../../product/jev-product-resolution-advisor.service';
import { validateJevChoiceResponse } from '../../llm/typesafe/jev-decision.validation';
import type { JevChoiceRequest } from '../../llm/typesafe/jev-decision.types';
import {
  evaluationHash,
  evaluationIdSchema,
  evaluationSplitSchema,
  selectedInputHash,
  type EvaluationDataset,
  type EvaluationSplit,
} from './dataset';

export const jevModelSchema = z.string().regex(/^jev-\d+\.\d+\.\d+$/);
export const hashSchema = z.string().regex(/^[a-f0-9]{64}$/);
export const countSchema = z
  .number()
  .int()
  .nonnegative()
  .max(Number.MAX_SAFE_INTEGER);
export const probabilitySchema = z.number().finite().min(0).max(1);
export const usageSchema = z
  .object({ input_tokens: countSchema, output_tokens: countSchema })
  .strict();
export const unavailableReasonSchema = z.enum([
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
  task: z.literal('product_resolution'),
  taskVersion: z.literal(JEV_PRODUCT_RESOLUTION_VERSION),
};
export const recordedDecisionSchema = z.discriminatedUnion('status', [
  z
    .object({
      ...provenance,
      status: z.literal('success'),
      model: jevModelSchema,
      choice: z.string().min(1).max(200),
      confidence: probabilitySchema,
      probabilities: z.record(z.string(), probabilitySchema),
      usage: usageSchema,
    })
    .strict(),
  z
    .object({
      ...provenance,
      status: z.literal('unavailable'),
      model: jevModelSchema.optional(),
      reason: unavailableReasonSchema,
    })
    .strict(),
]);
export const recordedRunSchema = z
  .object({
    schemaVersion: z.literal(1),
    evidenceMode: z.literal('offline'),
    datasetHash: hashSchema,
    inputHash: hashSchema,
    split: evaluationSplitSchema,
    configuredModel: jevModelSchema,
    rows: z
      .array(
        z
          .object({
            caseId: evaluationIdSchema,
            elapsedMs: z.number().finite().nonnegative(),
            transport: recordedDecisionSchema.nullable(),
          })
          .strict(),
      )
      .max(200),
  })
  .strict();

const acceptedConfidence = probabilitySchema.min(
  JEV_PRODUCT_RESOLUTION_MIN_CONFIDENCE,
);
export const proposalProjectionSchema = z.discriminatedUnion('recommendation', [
  z
    .object({
      recommendation: z.literal('add_alias'),
      targetProductId: evaluationIdSchema,
      confidence: acceptedConfidence,
    })
    .strict(),
  z
    .object({
      recommendation: z.literal('ask_user_to_choose'),
      candidateProductIds: z
        .array(evaluationIdSchema)
        .min(2)
        .max(20)
        .refine((ids) => new Set(ids).size === ids.length),
      confidence: acceptedConfidence,
    })
    .strict(),
]);
const observationBase = {
  caseId: evaluationIdSchema,
  elapsedMs: z.number().finite().nonnegative(),
  configuredModel: jevModelSchema,
  taskVersion: z.literal(JEV_PRODUCT_RESOLUTION_VERSION),
};
export const observationSchema = z
  .discriminatedUnion('callStatus', [
    z
      .object({
        ...observationBase,
        callStatus: z.literal('success'),
        resolvedModel: jevModelSchema,
        decision: z
          .object({
            choice: z.string().min(1).max(200),
            confidence: probabilitySchema,
          })
          .strict(),
        usage: usageSchema,
        proposal: proposalProjectionSchema.nullable(),
        unavailableReason: z.null(),
      })
      .strict(),
    z
      .object({
        ...observationBase,
        callStatus: z.literal('unavailable'),
        resolvedModel: z.null(),
        decision: z.null(),
        usage: z.null(),
        proposal: z.null(),
        unavailableReason: unavailableReasonSchema,
      })
      .strict(),
    z
      .object({
        ...observationBase,
        callStatus: z.literal('skipped'),
        resolvedModel: z.null(),
        decision: z.null(),
        usage: z.null(),
        proposal: z.null(),
        unavailableReason: z.null(),
      })
      .strict(),
  ])
  .refine((observation) => {
    if (observation.callStatus !== 'success' || observation.proposal === null)
      return true;
    const { decision, proposal } = observation;
    return (
      decision.confidence === proposal.confidence &&
      (proposal.recommendation === 'ask_user_to_choose'
        ? decision.choice === 'ambiguous'
        : /^candidate_\d+$/.test(decision.choice))
    );
  }, 'Proposal must agree with the validated decision');
export type EvaluationObservation = z.output<typeof observationSchema>;
export type RecordedRun = z.output<typeof recordedRunSchema>;

export function parseRecordedRun(
  value: unknown,
  dataset: EvaluationDataset,
  split: EvaluationSplit,
): RecordedRun {
  const parsed = recordedRunSchema.safeParse(value);
  if (!parsed.success) throw new Error('Invalid recorded evaluation');
  const run = parsed.data;
  const cases = dataset.cases.filter((item) => item.split === split);
  if (
    cases.length === 0 ||
    run.split !== split ||
    run.datasetHash !== evaluationHash(dataset) ||
    run.inputHash !== selectedInputHash(cases) ||
    run.rows.length !== cases.length ||
    new Set(run.rows.map((row) => row.caseId)).size !== run.rows.length
  )
    throw new Error('Recorded evaluation does not match selected dataset');
  const byId = new Map(cases.map((item) => [item.id, item]));
  for (const row of run.rows) {
    const item = byId.get(row.caseId);
    if (!item) throw new Error('Recorded evaluation contains foreign case');
    if ((item.context.candidates.length === 0) !== (row.transport === null))
      throw new Error('Recorded evaluation has invalid skipped call');
    if (row.transport?.status === 'success')
      validateRecordedChoice(row.transport, item.context.candidates.length);
  }
  return run;
}

function validateRecordedChoice(
  result: z.output<typeof recordedDecisionSchema> & { status: 'success' },
  candidateCount: number,
): void {
  const options = Array.from(
    { length: candidateCount },
    (_, i) => `candidate_${i}`,
  );
  const request: JevChoiceRequest = {
    task: 'product_resolution',
    taskVersion: JEV_PRODUCT_RESOLUTION_VERSION,
    questionKey: 'product_match',
    state: {},
    instructions: 'Validate replay choices',
    criteria: Object.fromEntries(
      [...options, 'ambiguous', 'no_match'].map((key) => [key, null]),
    ),
  };
  const response = {
    model: result.model,
    usage: result.usage,
    answers: {
      product_match: {
        type: 'choice',
        choice: result.choice,
        confidence: result.confidence,
        probabilities: result.probabilities,
      },
    },
  };
  if (validateJevChoiceResponse(response, request).status !== 'valid')
    throw new Error('Recorded evaluation contains invalid decision');
}
