import { createHash } from 'node:crypto';
import { z } from 'zod';
import {
  PRODUCT_RESOLUTION_MAX_CONTEXT_BYTES,
  productResolutionContextSchema,
} from '../../product/types/product-resolution';

export const EVALUATION_MAX_CASES = 200;
export const REQUIRED_SCENARIO_TAGS = [
  'typo_alias',
  'brand_size_variant',
  'ambiguous',
  'related_distinct',
  'missing_candidate',
] as const;
export const evaluationIdSchema = z.string().trim().min(1).max(200);
export const evaluationSplitSchema = z.enum(['tuning', 'held_out']);
const uniqueIds = z
  .array(evaluationIdSchema)
  .refine((ids) => new Set(ids).size === ids.length, 'Duplicate IDs');
const labelSchema = z
  .object({
    source: z.enum(['authored', 'confirmed']),
    rationale: z.string().trim().min(1).max(1000),
    author: evaluationIdSchema,
    reviewStatus: z.enum(['pending', 'reviewed']),
    reviewer: evaluationIdSchema.optional(),
    reviewedAt: z.iso.datetime({ offset: true }).optional(),
    sourceReference: z.string().trim().min(1).max(500).optional(),
  })
  .strict()
  .refine(
    (label) =>
      label.reviewStatus === 'reviewed'
        ? Boolean(
            label.reviewer &&
            label.reviewer !== label.author &&
            label.reviewedAt,
          )
        : !label.reviewer && !label.reviewedAt,
    'Review requires a distinct reviewer and date; pending labels have neither',
  )
  .refine(
    (label) => label.source !== 'confirmed' || Boolean(label.sourceReference),
    'Confirmed labels require a source reference',
  );

export const evaluationCaseSchema = z
  .object({
    id: evaluationIdSchema,
    split: evaluationSplitSchema,
    productGroupIds: uniqueIds.nonempty(),
    language: z.enum(['hebrew', 'mixed', 'other']),
    tags: z
      .array(z.string().regex(/^[a-z][a-z0-9_]{0,63}$/))
      .min(1)
      .max(20)
      .refine((tags) => new Set(tags).size === tags.length, 'Duplicate tags'),
    context: productResolutionContextSchema,
    expected: z.discriminatedUnion('kind', [
      z
        .object({ kind: z.literal('match'), productId: evaluationIdSchema })
        .strict(),
      z
        .object({
          kind: z.literal('ambiguous'),
          plausibleProductIds: uniqueIds.min(2).max(20),
        })
        .strict(),
      z.object({ kind: z.literal('no_match') }).strict(),
    ]),
    label: labelSchema,
  })
  .strict()
  .superRefine((item, ctx) => {
    const ids = item.context.candidates.map((candidate) => candidate.id);
    const references =
      item.expected.kind === 'match'
        ? [item.expected.productId]
        : item.expected.kind === 'ambiguous'
          ? item.expected.plausibleProductIds
          : [];
    if (new Set(ids).size !== ids.length)
      ctx.addIssue({ code: 'custom', message: 'Duplicate candidate IDs' });
    if (references.some((id) => !ids.includes(id)))
      ctx.addIssue({
        code: 'custom',
        message: 'Label references absent candidate',
      });
    if (
      Buffer.byteLength(JSON.stringify(item.context), 'utf8') >
      PRODUCT_RESOLUTION_MAX_CONTEXT_BYTES
    )
      ctx.addIssue({ code: 'custom', message: 'Context exceeds byte limit' });
  });

export const evaluationDatasetSchema = z
  .object({
    schemaVersion: z.literal(1),
    datasetVersion: evaluationIdSchema,
    cases: z.array(evaluationCaseSchema).min(1).max(EVALUATION_MAX_CASES),
  })
  .strict()
  .superRefine(({ cases }, ctx) => {
    if (new Set(cases.map((item) => item.id)).size !== cases.length)
      ctx.addIssue({ code: 'custom', message: 'Duplicate case IDs' });
    const groups = new Map<string, EvaluationSplit>();
    const products = new Map<string, EvaluationSplit>();
    for (const item of cases) {
      for (const group of item.productGroupIds)
        checkSplit(groups, group, item.split, ctx);
      for (const candidate of item.context.candidates)
        checkSplit(products, candidate.id, item.split, ctx);
    }
  });

export type EvaluationCase = z.output<typeof evaluationCaseSchema>;
export type EvaluationDataset = z.output<typeof evaluationDatasetSchema>;
export type EvaluationSplit = z.output<typeof evaluationSplitSchema>;

function checkSplit(
  seen: Map<string, EvaluationSplit>,
  id: string,
  split: EvaluationSplit,
  ctx: z.RefinementCtx,
): void {
  if (seen.has(id) && seen.get(id) !== split)
    ctx.addIssue({
      code: 'custom',
      message: 'Product identity crosses splits',
    });
  seen.set(id, split);
}

export function evaluationHash(value: unknown): string {
  const canonical: unknown = JSON.parse(
    JSON.stringify(value),
    (_key, item: unknown) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return item;
      const record = item as Record<string, unknown>;
      return Object.fromEntries(
        Object.keys(record)
          .sort()
          .map((key) => [key, record[key]]),
      );
    },
  );
  return createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
}

export function selectedInputHash(cases: EvaluationCase[]): string {
  return evaluationHash(cases.map(({ id, context }) => ({ id, context })));
}

export function inspectDataset(dataset: EvaluationDataset) {
  const splitCounts = { tuning: 0, held_out: 0 };
  const tagCounts: Record<string, number> = {};
  const tagsBySplit = {
    tuning: new Set<string>(),
    held_out: new Set<string>(),
  };
  let hebrewMixedCount = 0;
  let reviewedCount = 0;
  let confirmedCount = 0;
  for (const item of dataset.cases) {
    splitCounts[item.split]++;
    if (item.language !== 'other') hebrewMixedCount++;
    if (item.label.reviewStatus === 'reviewed') reviewedCount++;
    if (item.label.source === 'confirmed') confirmedCount++;
    for (const tag of item.tags) {
      tagCounts[tag] = (tagCounts[tag] ?? 0) + 1;
      tagsBySplit[item.split].add(tag);
    }
  }
  const missingScenarios = (['tuning', 'held_out'] as const).flatMap((split) =>
    REQUIRED_SCENARIO_TAGS.filter((tag) => !tagsBySplit[split].has(tag)).map(
      (tag) => `${split}:${tag}`,
    ),
  );
  return {
    caseCount: dataset.cases.length,
    splitCounts,
    hebrewMixedCount,
    reviewedCount,
    confirmedCount,
    tagCounts,
    missingScenarios,
    corpusEligible:
      dataset.cases.length >= 100 &&
      splitCounts.held_out >= 60 &&
      hebrewMixedCount >= 30 &&
      missingScenarios.length === 0,
    labelsReviewed: reviewedCount === dataset.cases.length,
    datasetHash: evaluationHash(dataset),
  };
}

export function parseEvaluationDataset(value: unknown): EvaluationDataset {
  const parsed = evaluationDatasetSchema.safeParse(value);
  if (!parsed.success) throw new Error('Invalid product-matching dataset');
  return parsed.data;
}
