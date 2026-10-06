import { z } from 'zod';
import { hash, splitSchema } from './dataset';
import { JEV_STOCK_PREDICTION_VERSION } from '../../estimation/jev-stock-prediction-advisor.service';
import {
  WORKFLOW_REPLAY_VERSION,
  workflowInputHash,
  selectWorkflowCases,
  type WorkflowDataset,
} from './workflow-dataset';
import { modelSchema, hashSchema } from '../application-inference/dataset';
import { rowSchema } from '../application-inference/recording';

export function workflowBinding(
  d: WorkflowDataset,
  split: 'held_out' | 'tuning',
  model: string,
) {
  return {
    schemaVersion: 1 as const,
    datasetHash: hash(d),
    inputHash: workflowInputHash(d, split),
    workflowVersion: WORKFLOW_REPLAY_VERSION,
    taskVersion: JEV_STOCK_PREDICTION_VERSION,
    configuredModel: model,
    split,
  };
}
export const workflowRecordingSchema = z
  .object({
    schemaVersion: z.literal(1),
    datasetHash: hashSchema,
    inputHash: hashSchema,
    workflowVersion: z.literal(WORKFLOW_REPLAY_VERSION),
    taskVersion: z.literal(JEV_STOCK_PREDICTION_VERSION),
    configuredModel: modelSchema,
    split: splitSchema,
    rows: z.array(rowSchema).max(200),
  })
  .strict()
  .refine(
    (r) =>
      new Set(r.rows.map((row) => row.caseId)).size === r.rows.length &&
      r.rows.every(
        (row) =>
          row.calls.length <= 1 &&
          row.calls.every((c) => c.provider === 'typesafe'),
      ),
  );
export type WorkflowRecording = z.infer<typeof workflowRecordingSchema>;
export function parseWorkflowRecording(
  value: unknown,
  d: WorkflowDataset,
  split: 'held_out' | 'tuning',
): WorkflowRecording {
  const recording = workflowRecordingSchema.parse(value);
  const { rows, ...actual } = recording;
  if (
    hash(workflowBinding(d, split, recording.configuredModel)) !== hash(actual)
  )
    throw new Error('Workflow recording binding mismatch');
  const ids = new Set(selectWorkflowCases(d, split).map((c) => c.id));
  if (rows.some((r) => !ids.has(r.caseId)))
    throw new Error('Unknown workflow recorded case');
  return recording;
}
