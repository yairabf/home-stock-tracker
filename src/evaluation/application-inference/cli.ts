import { parseEvaluationOptions } from './cli-options';
import { closeSync, openSync, writeFileSync } from 'node:fs';
import { parseDataset, taskSchema } from './dataset';
import { parseRecording, selectCases } from './recording';
import { createReport, parseReport, replayRows } from './report';
import { readBoundedJson, sourceState } from './cli-io';
import { worstCaseRequests, liveConfiguration, runLive } from './live-runner';
import { RequestBudget } from './request-budget';

export function parseArguments(args: string[]) {
  return parseEvaluationOptions(args, (value) => taskSchema.parse(value));
}
export async function runCli(
  args: string[],
  environment: NodeJS.ProcessEnv = process.env,
  runtime: {
    fetcher?: typeof fetch;
    signal?: AbortSignal;
    print?: (text: string) => void;
  } = {},
) {
  const options = parseArguments(args);
  const dataset = parseDataset(readBoundedJson(options.datasetPath));
  const cases = selectCases(dataset, options.task, options.split);
  if (!cases.length) throw new Error('Selected cases are empty');
  const recorded = options.live
    ? undefined
    : parseRecording(
        readBoundedJson(options.recordedPath!),
        dataset,
        options.task,
        options.split,
      );
  const config = options.live
    ? liveConfiguration(environment, cases)
    : undefined;
  const worst = worstCaseRequests(cases);
  if (options.live && worst > options.maxRequests)
    throw new Error(
      'Selected worst-case request count exceeds authorized ceiling',
    );
  const before = sourceState();
  const output = openSync(options.outputPath, 'wx', 0o600);
  const controller = new AbortController();
  const interrupt = () => controller.abort();
  if (runtime.signal?.aborted) interrupt();
  runtime.signal?.addEventListener('abort', interrupt, { once: true });
  process.on('SIGINT', interrupt);
  process.on('SIGTERM', interrupt);
  const startedAt = new Date().toISOString();
  const budget = options.live
    ? new RequestBudget(
        options.maxRequests,
        options.maxDurationMs,
        controller.signal,
      )
    : undefined;
  try {
    const rows = recorded
      ? await replayRows(recorded, dataset)
      : await runLive(cases, config!, budget!, runtime.fetcher);
    const after = sourceState();
    const report = createReport(
      dataset,
      options.task,
      options.split,
      recorded?.configuredModel ?? config!.jevModel,
      rows,
      {
        evidenceMode: options.live ? 'live' : 'offline',
        startedAt,
        finishedAt: new Date().toISOString(),
        ...before,
        codeDirty:
          before.codeDirty ||
          after.codeDirty ||
          before.codeRevision !== after.codeRevision,
        dirtyPaths: [...new Set([...before.dirtyPaths, ...after.dirtyPaths])],
        complete:
          rows.length === cases.length &&
          !controller.signal.aborted &&
          !budget?.controller.signal.aborted,
        physicalRequests: budget?.requests ?? null,
      },
    );
    await parseReport(report, dataset);
    writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
    (runtime.print ?? console.log)(
      `${report.run.evidenceMode} ${options.task}: ${rows.length}/${cases.length} cases; worst-case requests ${worst}; safety violations ${report.metrics.safetyViolations}; launch ${report.launchEvidence}`,
    );
    return controller.signal.aborted
      ? 130
      : budget?.controller.signal.aborted
        ? 2
        : report.launchEvidence === 'failed'
          ? 2
          : 0;
  } finally {
    budget?.dispose();
    closeSync(output);
    process.off('SIGINT', interrupt);
    process.off('SIGTERM', interrupt);
    runtime.signal?.removeEventListener('abort', interrupt);
  }
}
