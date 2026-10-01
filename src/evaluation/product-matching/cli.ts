import { closeSync, openSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { evaluationSplitSchema, parseEvaluationDataset } from './dataset';
import { executeEvaluation, liveConfiguration } from './runner';
import { parseRecordedRun } from './observations';
import { summarizeReport } from './scoring';

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
  if (!values['--output']) throw new Error('A new --output path is required');
  if (flags.has('--live') === Boolean(values['--recorded']))
    throw new Error('Choose exactly one of --live or --recorded');
  if (
    flags.has('--smoke') &&
    (!flags.has('--live') || values['--dataset'] || values['--split'])
  )
    throw new Error(
      '--smoke requires --live and uses its separate fixed dataset',
    );
  const smoke = flags.has('--smoke');
  const split = evaluationSplitSchema.parse(values['--split'] ?? 'held_out');
  return {
    mode: flags.has('--live') ? ('live' as const) : ('offline' as const),
    smoke,
    split,
    datasetPath: resolve(
      values['--dataset'] ??
        `evaluation/product-matching/${smoke ? 'connectivity-smoke' : 'cases'}.v1.json`,
    ),
    recordedPath: values['--recorded']
      ? resolve(values['--recorded'])
      : undefined,
    outputPath: resolve(values['--output']),
  };
}

function readJson(path: string): unknown {
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as unknown;
  } catch {
    throw new Error('Cannot read valid evaluation JSON');
  }
}

function sourceState(): { codeRevision: string | null; codeDirty: boolean } {
  try {
    const codeRevision = execFileSync('git', ['rev-parse', 'HEAD'], {
      encoding: 'utf8',
    }).trim();
    const changes = execFileSync(
      'git',
      [
        'status',
        '--porcelain',
        '--',
        'src/evaluation',
        'src/product',
        'src/llm/typesafe',
        'scripts/evaluate-product-matching.ts',
      ],
      { encoding: 'utf8' },
    );
    return { codeRevision, codeDirty: changes.trim().length > 0 };
  } catch {
    return { codeRevision: null, codeDirty: true };
  }
}

export async function runCli(
  args: string[],
  environment: NodeJS.ProcessEnv = process.env,
): Promise<number> {
  const parsed = parseArguments(args);
  const dataset = parseEvaluationDataset(readJson(parsed.datasetPath));
  const recorded =
    parsed.mode === 'offline' ? readJson(parsed.recordedPath!) : undefined;
  if (parsed.mode === 'offline')
    parseRecordedRun(recorded, dataset, parsed.split);
  else liveConfiguration(environment);
  const output = openSync(parsed.outputPath, 'wx', 0o600);
  const controller = new AbortController();
  const interrupt = () => controller.abort();
  process.on('SIGINT', interrupt);
  process.on('SIGTERM', interrupt);
  try {
    const report = await executeEvaluation(
      dataset,
      parsed.split,
      parsed.mode === 'offline'
        ? { mode: 'offline', recorded }
        : { mode: 'live', environment },
      {
        signal: controller.signal,
        purpose: parsed.smoke ? 'smoke' : 'evaluation',
        ...sourceState(),
      },
    );
    writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
    console.log(summarizeReport(report));
    return controller.signal.aborted
      ? 130
      : report.launchEvidence === 'failed'
        ? 2
        : 0;
  } finally {
    closeSync(output);
    process.off('SIGINT', interrupt);
    process.off('SIGTERM', interrupt);
  }
}
