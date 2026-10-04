import { closeSync, openSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseDataset, splitSchema } from './dataset';
import { executeEvaluation, liveConfiguration } from './runner';
import { parseRecordedRun } from './observations';
import { createEvaluationReport, summarizeReport } from './report';
import { selectedInputHash } from './reconstruction';
import { readBoundedJson, sourceState } from './cli-io';

export function parseArguments(args: string[]) {
  const values: Record<string, string> = {};
  const flags = new Set<string>();
  for (let i = 0; i < args.length; i++) {
    const key = args[i];
    if (flags.has(key) || Object.hasOwn(values, key))
      throw new Error('Duplicate argument');
    if (['--live', '--smoke'].includes(key)) flags.add(key);
    else if (['--dataset', '--split', '--recorded', '--output'].includes(key)) {
      const value = args[++i];
      if (!value || value.startsWith('--'))
        throw new Error('Missing argument value');
      values[key] = value;
    } else throw new Error('Unknown argument');
  }
  if (!values['--output']) throw new Error('A new output path is required');
  if (flags.has('--live') === Boolean(values['--recorded']))
    throw new Error('Choose one execution mode');
  const smoke = flags.has('--smoke');
  if (
    smoke &&
    (!flags.has('--live') || values['--dataset'] || values['--split'])
  )
    throw new Error('Live smoke uses the fixed connectivity dataset');
  return {
    mode: flags.has('--live') ? ('live' as const) : ('offline' as const),
    smoke,
    split: splitSchema.parse(values['--split'] ?? 'held_out'),
    datasetPath: resolve(
      values['--dataset'] ??
        `evaluation/stock-prediction/${smoke ? 'connectivity-smoke' : 'safety-cases'}.v1.json`,
    ),
    recordedPath: values['--recorded']
      ? resolve(values['--recorded'])
      : undefined,
    outputPath: resolve(values['--output']),
  };
}
export interface CliRuntime {
  fetcher?: typeof fetch;
  signal?: AbortSignal;
  print?: (summary: string) => void;
}
export async function runCli(
  args: string[],
  environment: NodeJS.ProcessEnv = process.env,
  runtime: CliRuntime = {},
): Promise<number> {
  const parsed = parseArguments(args);
  const dataset = parseDataset(readBoundedJson(parsed.datasetPath));
  const selected = dataset.cases.filter((c) => c.split === parsed.split);
  if (!selected.length) throw new Error('Selected split is empty');
  selectedInputHash(selected); // Validate all derived inputs before any provider request.
  const recorded =
    parsed.mode === 'offline'
      ? readBoundedJson(parsed.recordedPath!)
      : undefined;
  if (parsed.mode === 'offline')
    parseRecordedRun(recorded, dataset, parsed.split);
  else liveConfiguration(environment);
  const before = sourceState();
  const output = openSync(parsed.outputPath, 'wx', 0o600);
  const controller = new AbortController();
  const interrupt = () => controller.abort();
  if (runtime.signal?.aborted) interrupt();
  runtime.signal?.addEventListener('abort', interrupt, { once: true });
  process.on('SIGINT', interrupt);
  process.on('SIGTERM', interrupt);
  try {
    const execution = await executeEvaluation(
      dataset,
      parsed.split,
      parsed.mode === 'offline'
        ? { mode: 'offline', recorded }
        : { mode: 'live', environment, fetcher: runtime.fetcher },
      {
        signal: controller.signal,
        purpose: parsed.smoke ? 'smoke' : 'evaluation',
        ...before,
      },
    );
    const after = sourceState();
    execution.codeDirty ||=
      after.codeDirty || after.codeRevision !== before.codeRevision;
    const report = createEvaluationReport(dataset, execution);
    writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
    (runtime.print ?? console.log)(summarizeReport(report));
    return controller.signal.aborted
      ? 130
      : report.launchEvidence === 'failed'
        ? 2
        : 0;
  } finally {
    closeSync(output);
    process.off('SIGINT', interrupt);
    process.off('SIGTERM', interrupt);
    runtime.signal?.removeEventListener('abort', interrupt);
  }
}
