import { z } from 'zod';
import { JEV_UNAVAILABLE_REASONS } from '../../llm/typesafe/jev-decision.types';
import {
  hash,
  hashSchema,
  idSchema,
  taskSchema,
  splitSchema,
  modelSchema,
  countSchema,
  generationTransportSchema,
  POLICY_VERSION,
} from './dataset';
import type {
  ApplicationCase,
  ApplicationDataset,
  ApplicationTask,
  Split,
} from './dataset';
import { JEV_UNDERSTANDING_VERSION } from '../../product/jev-product-understanding.service';
import { JEV_SHELF_LIFE_VERSION } from '../../inventory/jev-shelf-life-policy.service';
import { CHOICE_VOCABULARY_MANIFESTS } from '../../product/choice-vocabulary-manifests';
import { SHELF_LIFE_REGISTRY_VERSION } from '../../inventory/shelf-life-policy-registry';

export function versions(task: ApplicationTask) {
  return {
    policy: POLICY_VERSION,
    adapter:
      task === 'product_understanding'
        ? JEV_UNDERSTANDING_VERSION
        : JEV_SHELF_LIFE_VERSION,
    vocabulary: {
      category: CHOICE_VOCABULARY_MANIFESTS.category.version,
      unit: CHOICE_VOCABULARY_MANIFESTS.unit.version,
    },
    registry: SHELF_LIFE_REGISTRY_VERSION,
  };
}
const jevTransport = z.discriminatedUnion('status', [
  z
    .object({
      status: z.literal('success'),
      model: modelSchema,
      choice: z.string().min(1),
      confidence: z.number().min(0).max(1),
      probabilities: z.record(z.string(), z.number().min(0).max(1)),
      usage: z
        .object({ input_tokens: countSchema, output_tokens: countSchema })
        .strict(),
    })
    .strict(),
  z
    .object({
      status: z.literal('unavailable'),
      reason: z.enum(JEV_UNAVAILABLE_REASONS),
    })
    .strict(),
]);
export const callSchema = z.discriminatedUnion('provider', [
  z
    .object({
      provider: z.literal('typesafe'),
      requestHash: hashSchema,
      elapsedMs: z.number().finite().nonnegative(),
      transport: jevTransport,
    })
    .strict(),
  z
    .object({
      provider: z.literal('openai'),
      requestHash: hashSchema,
      elapsedMs: z.number().finite().nonnegative(),
      transport: generationTransportSchema,
    })
    .strict(),
]);
export const rowSchema = z
  .object({ caseId: idSchema, calls: z.array(callSchema).max(4) })
  .strict();
export const recordingSchema = z
  .object({
    schemaVersion: z.literal(1),
    datasetHash: hashSchema,
    inputHash: hashSchema,
    task: taskSchema,
    split: splitSchema,
    configuredModel: modelSchema,
    versions: z
      .object({
        policy: z.string(),
        adapter: z.string(),
        vocabulary: z
          .object({ category: z.string(), unit: z.string() })
          .strict(),
        registry: z.string(),
      })
      .strict(),
    rows: z.array(rowSchema).max(200),
  })
  .strict()
  .refine(
    (r) => new Set(r.rows.map((c) => c.caseId)).size === r.rows.length,
    'Duplicate recording rows',
  );
export type RecordedCall = z.infer<typeof callSchema>;
export type Recording = z.infer<typeof recordingSchema>;
export function selectCases(
  dataset: ApplicationDataset,
  task: ApplicationTask,
  split: Split,
): ApplicationCase[] {
  return dataset.cases.filter((c) => c.task === task && c.split === split);
}
export function binding(
  dataset: ApplicationDataset,
  task: ApplicationTask,
  split: Split,
  configuredModel: string,
) {
  const selected = selectCases(dataset, task, split);
  return {
    schemaVersion: 1 as const,
    datasetHash: hash(dataset),
    inputHash: hash(
      selected.map((c) => ({ caseId: c.caseId, input: c.input })),
    ),
    task,
    split,
    configuredModel,
    versions: versions(task),
  };
}
export function parseRecording(
  input: unknown,
  dataset: ApplicationDataset,
  task: ApplicationTask,
  split: Split,
): Recording {
  const record = recordingSchema.parse(input);
  const expected = binding(dataset, task, split, record.configuredModel);
  const { rows, ...actual } = record;
  if (hash(expected) !== hash(actual))
    throw new Error('Recording binding mismatch');
  const ids = new Set(selectCases(dataset, task, split).map((c) => c.caseId));
  if (rows.some((r) => !ids.has(r.caseId)))
    throw new Error('Unexpected recorded case');
  return record;
}
