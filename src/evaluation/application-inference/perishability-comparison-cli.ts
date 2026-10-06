import {
  closeSync,
  openSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { parseEvaluationOptions } from './cli-options';
import { readBoundedJson, sourceState } from './cli-io';
import { hash, parseDataset } from './dataset';
import {
  parseComparisonPlan,
  validatePlannedComparison,
} from './perishability-comparison-plan';
import { comparisonMetrics } from './perishability-comparison-metrics';
import {
  captureComparison,
  remainingComparisonRequests,
} from './perishability-comparison-runner';
import { RequestBudget } from './request-budget';
import { parseComparisonReport } from './perishability-comparison-report';
import { JEV_UNDERSTANDING_VERSION } from '../../product/jev-product-understanding.service';

function sourceDigest() {
  const paths: string[] = [];
  const visit = (directory: string) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) visit(path);
      else if (
        entry.isFile() &&
        path.endsWith('.ts') &&
        !path.endsWith('.spec.ts')
      )
        paths.push(path);
    }
  };
  visit('src');
  paths.push(
    'scripts/evaluate-perishability-comparison.ts',
    'package.json',
    'package-lock.json',
    'tsconfig.json',
    'tsconfig.build.json',
  );
  return hash(
    paths.sort().map((path) => ({ path, content: readFileSync(path, 'utf8') })),
  );
}

export async function runPerishabilityComparisonCli(
  args: string[],
  environment: NodeJS.ProcessEnv = process.env,
  runtime: {
    fetcher?: typeof fetch;
    signal?: AbortSignal;
    print?: (text: string) => void;
  } = {},
) {
  const expanded = [...args];
  const extract = (flag: string) => {
    const index = expanded.indexOf(flag);
    if (index < 0) return undefined;
    if (
      expanded.lastIndexOf(flag) !== index ||
      !expanded[index + 1] ||
      expanded[index + 1].startsWith('--')
    )
      throw new Error('Invalid comparison argument');
    return expanded.splice(index, 2)[1];
  };
  const planPath = extract('--plan');
  const baselinePath = extract('--baseline');
  if (!planPath) throw new Error('Frozen request plan required');
  const options = parseEvaluationOptions(
    ['--task', 'perishability', ...expanded],
    (task) => {
      if (task !== 'perishability') throw new Error('Invalid comparison task');
      return task;
    },
  );
  const dataset = parseDataset(readBoundedJson(options.datasetPath));
  const plan = await parseComparisonPlan(readBoundedJson(planPath), dataset);
  if (options.split !== plan.binding.split)
    throw new Error('Split differs from plan');
  if (baselinePath && !options.live)
    throw new Error('Baseline is only allowed with live capture');
  const baseline = baselinePath
    ? await validatePlannedComparison(
        readBoundedJson(baselinePath),
        dataset,
        plan,
      )
    : undefined;
  const recorded = options.recordedPath
    ? await validatePlannedComparison(
        readBoundedJson(options.recordedPath),
        dataset,
        plan,
      )
    : undefined;
  const worst = 2 * remainingComparisonRequests(plan, baseline);
  const before = sourceState();
  const sourceHash = sourceDigest();
  if (options.live) {
    if (
      !environment.TYPESAFE_API_KEY?.trim() ||
      environment.JEV_MODEL !== plan.variants[0].definition.configuredModel ||
      worst > options.maxRequests
    )
      throw new Error('Invalid live configuration or global retry ceiling');
    if (baseline?.variants.some((v) => !v.complete && v.rows.length > 0))
      throw new Error('Partial baseline cannot be resumed as live evidence');
    if (
      plan.variants.some(
        (v, i) =>
          !baseline?.variants[i].complete &&
          (v.definition.adapterVersion !== JEV_UNDERSTANDING_VERSION ||
            v.definition.captureMode !== 'captured'),
      )
    )
      throw new Error('Live capture requires the current adapter');
    if (
      plan.variants.some(
        (v, i) =>
          !baseline?.variants[i].complete &&
          v.definition.codeRevision !== before.codeRevision,
      )
    )
      throw new Error('Live definition source revision mismatch');
  }
  const output = openSync(options.outputPath, 'wx', 0o600);
  const controller = new AbortController();
  const cancel = () => controller.abort();
  if (runtime.signal?.aborted) cancel();
  runtime.signal?.addEventListener('abort', cancel, { once: true });
  process.on('SIGINT', cancel);
  process.on('SIGTERM', cancel);
  const budget = options.live
    ? new RequestBudget(
        options.maxRequests,
        options.maxDurationMs,
        controller.signal,
      )
    : undefined;
  const startedAt = new Date().toISOString();
  try {
    const comparison =
      recorded ??
      (await captureComparison(
        dataset,
        plan,
        budget!,
        { typesafeApiKey: environment.TYPESAFE_API_KEY! },
        runtime.fetcher,
        baseline,
      ));
    const afterHash = sourceDigest();
    const complete =
      comparison.variants.every((v) => v.complete) &&
      !controller.signal.aborted &&
      !budget?.controller.signal.aborted &&
      (!budget || budget.remainingMs() > 0) &&
      sourceHash === afterHash;
    const report = {
      schemaVersion: 'perishability-comparison-report-v1',
      comparison,
      planHash: hash(plan),
      metrics: comparisonMetrics(comparison),
      launchEvidence: 'inconclusive',
      run: {
        ...before,
        sourceHash,
        sourceHashAfter: afterHash,
        startedAt,
        finishedAt: new Date().toISOString(),
        complete,
        physicalRequests: budget?.requests ?? null,
        evidenceMode: options.live ? 'live' : 'offline',
      },
    };
    await parseComparisonReport(report, dataset, plan);
    writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
    (runtime.print ?? console.log)(
      `${report.run.evidenceMode} perishability comparison: ${comparison.variants.length} variants; ${comparison.labels.length} cases; complete ${complete}; launch inconclusive`,
    );
    return controller.signal.aborted ? 130 : complete ? 0 : 2;
  } finally {
    budget?.dispose();
    closeSync(output);
    process.off('SIGINT', cancel);
    process.off('SIGTERM', cancel);
    runtime.signal?.removeEventListener('abort', cancel);
  }
}
