import { z } from 'zod';
import {
  hash,
  parseDataset,
  type ApplicationDataset,
  type ApplicationTask,
  type Split,
} from './dataset';
import {
  binding,
  recordingSchema,
  selectCases,
  parseRecording,
  type Recording,
} from './recording';
import { observationSchema, type Observation } from './observations';
import { ChoiceRecorder } from './choice-recorder';
import { GenerationRecorder } from './generation-recorder';
import { observeUnderstanding } from './understanding-runner';
import { observePolicy } from './policy-runner';
import { scoreCases } from './scoring';
import { assessLaunch, type RunMetadata } from './launch-policy';

export const runSchema = z
  .object({
    evidenceMode: z.enum(['offline', 'live']),
    startedAt: z.iso.datetime({ offset: true }),
    finishedAt: z.iso.datetime({ offset: true }),
    codeRevision: z
      .string()
      .regex(/^[a-f0-9]{40}$/)
      .nullable(),
    codeDirty: z.boolean(),
    dirtyPaths: z.array(z.string()),
    complete: z.boolean(),
    physicalRequests: z
      .object({
        typesafe: z.number().int().nonnegative(),
        openai: z.number().int().nonnegative(),
      })
      .strict()
      .nullable(),
  })
  .strict()
  .refine(
    (r) =>
      Date.parse(r.finishedAt) >= Date.parse(r.startedAt) &&
      (r.codeDirty || r.dirtyPaths.length === 0),
  );
export async function replayRows(
  recording: Recording,
  dataset: ApplicationDataset,
): Promise<Observation[]> {
  const byId = new Map(
    selectCases(dataset, recording.task, recording.split).map((c) => [
      c.caseId,
      c,
    ]),
  );
  const rows: Observation[] = [];
  for (const row of recording.rows) {
    const c = byId.get(row.caseId);
    if (!c) throw new Error('Unexpected recorded case');
    const client = new ChoiceRecorder(
      recording.configuredModel,
      row.calls.filter((c) => c.provider === 'typesafe'),
    );
    const output =
      c.task === 'product_understanding'
        ? await observeUnderstanding(c, client)
        : await observePolicy(
            c,
            client,
            new GenerationRecorder(
              row.calls.filter((c) => c.provider === 'openai'),
            ),
          );
    if (
      c.task === 'product_understanding' &&
      row.calls.some((c) => c.provider === 'openai')
    )
      throw new Error('Forbidden understanding generation');
    rows.push(observationSchema.parse({ task: c.task, ...output }));
  }
  return rows;
}
function slices(cases: ReturnType<typeof selectCases>, rows: Observation[]) {
  const keys = new Set(
    cases.flatMap((c) => [
      `language:${c.language}`,
      ...c.tags.map((t) => `tag:${t}`),
    ]),
  );
  return [...keys].sort().map((key) => {
    const subset = cases.filter(
      (c) =>
        key === `language:${c.language}` ||
        c.tags.some((t) => key === `tag:${t}`),
    );
    const ids = new Set(subset.map((c) => c.caseId));
    return {
      key,
      metrics: scoreCases(
        subset,
        rows.filter((r) => ids.has(r.caseId)),
      ),
    };
  });
}
export function createReport(
  dataset: ApplicationDataset,
  task: ApplicationTask,
  split: Split,
  model: string,
  observations: Observation[],
  metadata: RunMetadata,
) {
  const run = runSchema.parse(metadata);
  const rows = observations.map((r) => observationSchema.parse(r));
  const cases = selectCases(dataset, task, split);
  if (!cases.length || (run.complete && rows.length !== cases.length))
    throw new Error('Invalid completion count');
  const metrics = scoreCases(cases, rows);
  const resolvedModels = [
    ...new Set(
      rows.flatMap((r) =>
        r.calls.flatMap((c) =>
          c.provider === 'typesafe' && c.transport.status === 'success'
            ? [c.transport.model]
            : [],
        ),
      ),
    ),
  ].sort();
  const record = recordingSchema.parse({
    ...binding(dataset, task, split, model),
    rows: rows.map((r) => ({ caseId: r.caseId, calls: r.calls })),
  });
  return {
    ...record,
    run,
    observations: rows,
    metrics,
    slices: slices(cases, rows),
    resolvedModels,
    ...assessLaunch(
      dataset,
      cases,
      task,
      split,
      model,
      resolvedModels,
      metrics,
      run,
    ),
  };
}
export type ApplicationReport = ReturnType<typeof createReport>;
export async function parseReport(
  input: unknown,
  value: unknown,
): Promise<ApplicationReport> {
  const dataset = parseDataset(value);
  const envelope = z
    .object({
      task: z.enum(['product_understanding', 'shelf_life_policy']),
      split: z.enum(['tuning', 'held_out']),
      run: runSchema,
    })
    .parse(input);
  if (!input || typeof input !== 'object') throw new Error('Invalid report');
  const raw = input as Record<string, unknown>;
  const keys = [
    'schemaVersion',
    'datasetHash',
    'inputHash',
    'task',
    'split',
    'configuredModel',
    'versions',
    'rows',
  ];
  const recording = parseRecording(
    Object.fromEntries(keys.map((k) => [k, raw[k]])),
    dataset,
    envelope.task,
    envelope.split,
  );
  const rows = await replayRows(recording, dataset);
  const expected = createReport(
    dataset,
    recording.task,
    recording.split,
    recording.configuredModel,
    rows,
    envelope.run,
  );
  if (hash(expected) !== hash(input))
    throw new Error('Report differs from runtime replay or recomputed metrics');
  return expected;
}
