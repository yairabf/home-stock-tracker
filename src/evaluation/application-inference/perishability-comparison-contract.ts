import { z } from 'zod';
import {
  hash,
  hashSchema,
  idSchema,
  splitSchema,
  type ApplicationCase,
  type ApplicationDataset,
} from './dataset';
import { selectCases } from './recording';
import {
  requestCaptureSchema,
  requestDefinitionSchema,
} from './perishability-request-capture';
import { PERISHABILITY_DEFINITION_VERSION } from '../../product/perishability-definition';

const variantSchema = z
  .object({
    definition: requestDefinitionSchema,
    evidenceMode: z.enum(['offline', 'live']),
    complete: z.boolean(),
    rows: z.array(requestCaptureSchema).max(200),
  })
  .strict();
const labelSchema = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.literal('values'),
      values: z.array(z.boolean()).min(1).max(2),
    })
    .strict(),
  z.object({ kind: z.literal('abstain') }).strict(),
  z.object({ kind: z.literal('unscored') }).strict(),
]);
export const comparisonSchema = z
  .object({
    schemaVersion: z.literal('perishability-comparison-v1'),
    definitionVersion: z.literal(PERISHABILITY_DEFINITION_VERSION),
    datasetHash: hashSchema,
    inputHash: hashSchema,
    split: splitSchema,
    labels: z
      .array(z.object({ caseId: idSchema, expected: labelSchema }).strict())
      .min(1)
      .max(200),
    reviewScope: z.literal('dataset_review_only_no_added_attestation'),
    launchEvidence: z.literal('inconclusive'),
    variants: z.array(variantSchema).min(1).max(16),
  })
  .strict();
export type PerishabilityComparison = z.infer<typeof comparisonSchema>;
export type RequestDefinition = z.infer<typeof requestDefinitionSchema>;

function understandingCases(
  dataset: ApplicationDataset,
  split: 'tuning' | 'held_out',
) {
  return selectCases(dataset, 'product_understanding', split).filter(
    (c): c is Extract<ApplicationCase, { task: 'product_understanding' }> =>
      c.task === 'product_understanding',
  );
}

export function comparisonBinding(
  dataset: ApplicationDataset,
  split: 'tuning' | 'held_out',
) {
  const cases = understandingCases(dataset, split);
  return {
    schemaVersion: 'perishability-comparison-v1' as const,
    definitionVersion: PERISHABILITY_DEFINITION_VERSION,
    datasetHash: hash(dataset),
    inputHash: hash(cases.map((c) => ({ caseId: c.caseId, input: c.input }))),
    split,
    labels: cases.map((c) => ({
      caseId: c.caseId,
      expected: c.expected.isPerishable,
    })),
    reviewScope: 'dataset_review_only_no_added_attestation' as const,
    launchEvidence: 'inconclusive' as const,
  };
}

export function parsePerishabilityComparison(
  input: unknown,
  dataset: ApplicationDataset,
  definitions: RequestDefinition[],
): PerishabilityComparison {
  const parsed = comparisonSchema.parse(input);
  const { variants, ...actual } = parsed;
  if (hash(actual) !== hash(comparisonBinding(dataset, parsed.split)))
    throw new Error('Comparison dataset, inputs or labels do not match');
  const expected = definitions.map((d) => requestDefinitionSchema.parse(d));
  if (
    new Set(expected.map((d) => d.variantId)).size !== expected.length ||
    new Set(expected.map((d) => d.configuredModel)).size !== 1 ||
    hash(variants.map((v) => v.definition)) !== hash(expected)
  )
    throw new Error('Comparison request definitions do not match');
  const cases = understandingCases(dataset, parsed.split);
  if (cases.some((c) => c.input.metadata.isPerishable !== null))
    throw new Error('Comparison must hide the target in evaluation copies');
  for (const variant of variants) validateVariant(variant, cases);
  return parsed;
}

function validateVariant(
  variant: z.infer<typeof variantSchema>,
  cases: ReturnType<typeof understandingCases>,
) {
  const ids = variant.rows.map((row) => row.caseId);
  if (
    new Set(ids).size !== ids.length ||
    (variant.complete && ids.length !== cases.length)
  )
    throw new Error('Duplicate or missing comparison rows');
  for (const row of variant.rows) {
    const item = cases.find((c) => c.caseId === row.caseId);
    if (
      !item ||
      row.inputHash !== hash(item.input) ||
      row.request.taskVersion !== variant.definition.adapterVersion
    )
      throw new Error('Case input or adapter version does not match');
    if (
      row.call.provider === 'typesafe' &&
      row.call.transport.status === 'success' &&
      row.call.transport.model !== variant.definition.configuredModel
    )
      throw new Error('Resolved model does not match the configured pin');
  }
}
