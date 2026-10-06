import { closeSync, openSync, writeFileSync } from 'node:fs';
import { z } from 'zod';
import { parseEvaluationOptions } from '../application-inference/cli-options';
import { readBoundedJson, sourceState } from '../application-inference/cli-io';
import { liveConfiguration } from '../application-inference/live-runner';
import { RequestBudget } from '../application-inference/request-budget';
import { parseWorkflowDataset, selectWorkflowCases } from './workflow-dataset';
import { parseWorkflowRecording } from './workflow-recording';
import { assertWorkflowDatabase } from './workflow-seed';
import { runWorkflowEvaluation } from './workflow-runner';
import {
  createWorkflowReport,
  validateWorkflowReport,
} from './workflow-report';
import { parseEvaluationReport } from './report';

export async function runWorkflowCli(
  args: string[],
  environment: NodeJS.ProcessEnv = process.env,
  runtime: {
    fetcher?: typeof fetch;
    signal?: AbortSignal;
    print?: (text: string) => void;
  } = {},
) {
  const options = parseEvaluationOptions(args, (value) =>
    z.literal('stock_workflow').parse(value),
  );
  const url = environment.EVALUATION_DATABASE_URL;
  if (!url) throw new Error('Explicit EVALUATION_DATABASE_URL required');
  assertWorkflowDatabase(url);
  const dataset = parseWorkflowDataset(readBoundedJson(options.datasetPath));
  const cases = selectWorkflowCases(dataset, options.split);
  if (!cases.length) throw new Error('Empty workflow selection');
  const recording = options.live
    ? undefined
    : parseWorkflowRecording(
        readBoundedJson(options.recordedPath!),
        dataset,
        options.split,
      );
  const config = options.live ? liveConfiguration(environment, []) : undefined;
  const advisor = environment.EVALUATION_ADVISOR_REPORT
    ? parseEvaluationReport(
        readBoundedJson(environment.EVALUATION_ADVISOR_REPORT),
        dataset.history,
      )
    : undefined;
  const worstCase = cases.length * 2;
  if (options.live && worstCase > options.maxRequests)
    throw new Error('Workflow worst-case requests exceed authorized ceiling');
  const before = sourceState(),
    output = openSync(options.outputPath, 'wx', 0o600);
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
    const rows = controller.signal.aborted
      ? []
      : await runWorkflowEvaluation(dataset, {
          databaseUrl: url,
          signal: controller.signal,
          split: options.split,
          model: recording?.configuredModel ?? config!.jevModel,
          recording,
          typesafeApiKey: config?.typesafeApiKey,
          budget,
          fetcher: runtime.fetcher,
        });
    const after = sourceState();
    const report = createWorkflowReport(
      dataset,
      options.split,
      recording?.configuredModel ?? config!.jevModel,
      rows,
      {
        ...before,
        evidenceMode: options.live ? 'live' : 'offline',
        startedAt,
        finishedAt: new Date().toISOString(),
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
      advisor,
    );
    validateWorkflowReport(report, dataset);
    writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
    (runtime.print ?? console.log)(
      `${report.run.evidenceMode} stock workflow: ${rows.length}/${cases.length} cases; surfaced precision ${report.metrics.final.precision.numerator}/${report.metrics.final.precision.denominator}; launch ${report.launchEvidence}`,
    );
    return controller.signal.aborted
      ? 130
      : budget?.controller.signal.aborted || report.launchEvidence === 'failed'
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
