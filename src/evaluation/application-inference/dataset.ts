import { z } from 'zod';
import {
  understandingInputSchema,
  UNDERSTANDING_FIELDS,
} from '../../product/product-understanding';
import { shelfLifePolicyInputSchema } from '../../inventory/shelf-life-policy';
import { shelfLifeInferenceResultSchema } from '../../inventory/types/shelf-life-inference';
import { SHELF_LIFE_REGISTRY } from '../../inventory/shelf-life-policy-registry';
export { evaluationHash as hash } from '../product-matching/dataset';

export const POLICY_VERSION = 'application-launch-v1';
export const taskSchema = z.enum([
  'product_understanding',
  'shelf_life_policy',
]);
export const splitSchema = z.enum(['tuning', 'held_out']);
export const idSchema = z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,199}$/);
export const hashSchema = z.string().regex(/^[a-f0-9]{64}$/);
export const modelSchema = z.string().regex(/^jev-\d+\.\d+\.\d+$/);
export const countSchema = z.number().int().nonnegative();
const reviewSchema = z
  .object({
    author: idSchema,
    reviewer: idSchema.nullable(),
    reviewedAt: z.iso.datetime({ offset: true }).nullable(),
    evidenceReference: idSchema.nullable(),
  })
  .strict()
  .refine(
    (r) =>
      r.reviewer === null
        ? r.reviewedAt === null && r.evidenceReference === null
        : r.reviewer !== r.author &&
          r.reviewedAt !== null &&
          r.evidenceReference !== null,
    'Review needs a distinct reviewer, time and evidence reference',
  );

const common = {
  caseId: idSchema,
  semanticGroupId: idSchema,
  split: splitSchema,
  source: z.enum(['authored', 'observed']),
  language: z.enum(['he', 'en', 'mixed']),
  tags: z
    .array(idSchema)
    .min(1)
    .max(20)
    .refine((a) => new Set(a).size === a.length),
  review: reviewSchema,
};
const fieldLabel = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.literal('values'),
      values: z
        .array(z.union([z.string().min(1), z.boolean()]))
        .min(1)
        .max(20),
    })
    .strict(),
  z.object({ kind: z.literal('abstain') }).strict(),
  z.object({ kind: z.literal('unscored') }).strict(),
]);
const understandingCase = z
  .object({
    ...common,
    task: z.literal('product_understanding'),
    input: understandingInputSchema,
    expected: z
      .object(
        Object.fromEntries(
          UNDERSTANDING_FIELDS.map((field) => [field, fieldLabel]),
        ) as Record<(typeof UNDERSTANDING_FIELDS)[number], typeof fieldLabel>,
      )
      .strict(),
  })
  .strict()
  .superRefine((c, ctx) => {
    for (const field of UNDERSTANDING_FIELDS) {
      const label = c.expected[field];
      if (label.kind !== 'values') continue;
      const valid = label.values.every((value) =>
        field === 'isPerishable'
          ? typeof value === 'boolean'
          : typeof value === 'string' &&
            (field !== 'productType' ||
              [
                'fast_consumable',
                'pantry_staple',
                'household_consumable',
                'discrete_consumable',
              ].includes(value)),
      );
      if (!valid)
        ctx.addIssue({ code: 'custom', message: 'Invalid field label' });
      const supplied = c.input.metadata[field];
      if (supplied !== null && !label.values.includes(supplied))
        ctx.addIssue({
          code: 'custom',
          message: 'Label contradicts supplied field',
        });
    }
  });
const policyExpected = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.literal('policies'),
      policyIds: z
        .array(
          z.enum(SHELF_LIFE_REGISTRY.map((p) => p.id) as [string, ...string[]]),
        )
        .min(1),
      durationEvidence: idSchema,
    })
    .strict(),
  z
    .object({
      kind: z.literal('generation'),
      minDays: z.number().positive(),
      maxDays: z.number().positive(),
      durationEvidence: idSchema,
    })
    .strict()
    .refine((p) => p.minDays <= p.maxDays),
  z.object({ kind: z.literal('abstain') }).strict(),
  z.object({ kind: z.literal('unscored') }).strict(),
]);
const policyCase = z
  .object({
    ...common,
    task: z.literal('shelf_life_policy'),
    input: shelfLifePolicyInputSchema,
    expected: policyExpected,
  })
  .strict();
export const caseSchema = z.union([understandingCase, policyCase]);
export const datasetSchema = z
  .object({
    schemaVersion: z.literal(1),
    datasetVersion: idSchema,
    frozenAt: z.iso.datetime({ offset: true }),
    cases: z.array(caseSchema).min(1).max(200),
  })
  .strict()
  .superRefine((d, ctx) => {
    const ids = new Set<string>();
    const groups = new Map<string, string>();
    for (const c of d.cases) {
      if (ids.has(c.caseId))
        ctx.addIssue({ code: 'custom', message: 'Duplicate case' });
      ids.add(c.caseId);
      if (
        groups.has(c.semanticGroupId) &&
        groups.get(c.semanticGroupId) !== c.split
      )
        ctx.addIssue({
          code: 'custom',
          message: 'Semantic group crosses splits',
        });
      groups.set(c.semanticGroupId, c.split);
      if (
        c.review.reviewedAt &&
        Date.parse(c.review.reviewedAt) > Date.parse(d.frozenAt)
      )
        ctx.addIssue({ code: 'custom', message: 'Review must precede freeze' });
      if (Buffer.byteLength(JSON.stringify(c.input)) > 16384)
        ctx.addIssue({
          code: 'custom',
          message: 'Input exceeds context bound',
        });
    }
  });
export type ApplicationCase = z.infer<typeof caseSchema>;
export type ApplicationDataset = z.infer<typeof datasetSchema>;
export type ApplicationTask = z.infer<typeof taskSchema>;
export type Split = z.infer<typeof splitSchema>;
export function parseDataset(input: unknown): ApplicationDataset {
  return datasetSchema.parse(input);
}

export const generationTransportSchema = z.discriminatedUnion('status', [
  z
    .object({
      status: z.literal('success'),
      provider: z.literal('openai'),
      model: z.string().min(1),
      value: shelfLifeInferenceResultSchema,
    })
    .strict(),
  z
    .object({
      status: z.literal('refusal'),
      provider: z.literal('openai'),
      model: z.string().min(1),
    })
    .strict(),
  z.object({ status: z.literal('unavailable') }).strict(),
]);
