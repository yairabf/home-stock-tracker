import { z } from 'zod';
import {
  datasetSchema as historySchema,
  hash,
  inputEvents,
  idSchema,
  type StockCase,
} from './dataset';
import { shelfLifeInferenceResultSchema } from '../../inventory/types/shelf-life-inference';

export const WORKFLOW_REPLAY_VERSION = 'stock-workflow-replay-v1';
const date = z.iso.datetime({ offset: true });
export const snapshotSchema = z
  .object({
    caseId: idSchema,
    knownAt: date,
    unit: z.string().trim().min(1).max(64),
    recordedEventId: idSchema,
    recordedAt: date,
    previousEvaluatedAt: date,
    recordedQuantity: z.number().finite().nonnegative().nullable(),
    estimatedQuantity: z.number().finite().nonnegative().nullable(),
    revision: z.number().int().nonnegative(),
    confidenceThreshold: z.number().min(0).max(1),
    pendingGrocery: z.boolean(),
    policy: shelfLifeInferenceResultSchema.nullable(),
  })
  .strict();
export const workflowDatasetSchema = z
  .object({
    schemaVersion: z.literal(1),
    version: idSchema,
    workflowVersion: z.literal(WORKFLOW_REPLAY_VERSION),
    frozenAt: date,
    history: historySchema,
    snapshots: z.array(snapshotSchema).min(1).max(200),
  })
  .strict()
  .superRefine((d, ctx) => {
    const error = (message: string) =>
      ctx.addIssue({ code: 'custom', message });
    if (
      new Set(d.snapshots.map((s) => s.caseId)).size !== d.snapshots.length ||
      d.snapshots.length !== d.history.cases.length
    )
      error('One snapshot per case required');
    for (const c of d.history.cases) {
      const s = d.snapshots.find((s) => s.caseId === c.id);
      if (!s) {
        error('Missing snapshot');
        continue;
      }
      const cutoff = Date.parse(c.asOf);
      if (
        Date.parse(s.knownAt) > cutoff ||
        Date.parse(s.recordedAt) > Date.parse(s.previousEvaluatedAt) ||
        Date.parse(s.previousEvaluatedAt) > cutoff
      )
        error('Snapshot facts must precede cutoff');
      const event = inputEvents(c).find((e) => e.id === s.recordedEventId);
      if (!event || Date.parse(event.occurredAt) !== Date.parse(s.recordedAt))
        error('Recorded event must be cutoff-known');
      if (
        c.review.reviewedAt &&
        Date.parse(c.review.reviewedAt) > Date.parse(d.frozenAt)
      )
        error('Review must precede freeze');
    }
  });
export type WorkflowDataset = z.infer<typeof workflowDatasetSchema>;
export type WorkflowSnapshot = z.infer<typeof snapshotSchema>;
export function parseWorkflowDataset(value: unknown): WorkflowDataset {
  return workflowDatasetSchema.parse(value);
}
export function workflowInputHash(
  dataset: WorkflowDataset,
  split: 'held_out' | 'tuning',
) {
  return hash(
    dataset.history.cases
      .filter((c) => c.split === split)
      .map((c) => ({
        caseId: c.id,
        asOf: c.asOf,
        product: c.product,
        household: c.household,
        events: inputEvents(c),
        snapshot: dataset.snapshots.find((s) => s.caseId === c.id),
      })),
  );
}
export function selectWorkflowCases(
  d: WorkflowDataset,
  split: 'held_out' | 'tuning',
): StockCase[] {
  return d.history.cases.filter((c) => c.split === split);
}
