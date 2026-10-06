import { mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { hash, parseDataset } from './dataset';
import { comparisonBinding } from './perishability-comparison-contract';
import { orderedRequestHash } from './perishability-request-capture';
import {
  productionPerishabilityRequest,
  replayPerishability,
} from './perishability-replay';
import {
  parseComparisonPlan,
  validatePlannedComparison,
} from './perishability-comparison-plan';
import { comparisonMetrics } from './perishability-comparison-metrics';
import { captureComparison } from './perishability-comparison-runner';
import { runPerishabilityComparisonCli } from './perishability-comparison-cli';
import { RequestBudget } from './request-budget';
import { parseComparisonReport } from './perishability-comparison-report';
import { JEV_UNDERSTANDING_VERSION } from '../../product/jev-product-understanding.service';
import { PERISHABILITY_QUESTION_VERSION } from '../../product/perishability-question';
import { sourceState } from './cli-io';

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

async function fixture() {
  const source = JSON.parse(
    readFileSync(
      join(
        process.cwd(),
        'evaluation/application-inference/perishability-diagnostic-cases.v1.json',
      ),
      'utf8',
    ),
  );
  source.cases = source.cases.slice(0, 3);
  source.cases.forEach((c, i) => {
    c.expected.isPerishable =
      i === 2 ? { kind: 'abstain' } : { kind: 'values', values: [true] };
  });
  const dataset = parseDataset(source);
  const requests = await Promise.all(
    dataset.cases.map(async (item) => {
      if (item.task !== 'product_understanding')
        throw new Error('Fixture task');
      const request = await productionPerishabilityRequest(
        item.input,
        'jev-1.13.0',
      );
      return {
        caseId: item.caseId,
        inputHash: hash(item.input),
        request,
        orderedChoiceIds: Object.keys(request.criteria),
        orderedRequestHash: orderedRequestHash(request),
      };
    }),
  );
  const definition = {
    variantId: 'production',
    codeRevision: sourceState().codeRevision!,
    configuredModel: 'jev-1.13.0',
    adapterVersion: JEV_UNDERSTANDING_VERSION,
    questionVersion: PERISHABILITY_QUESTION_VERSION,
    captureMode: 'captured' as const,
  };
  const plan = await parseComparisonPlan(
    {
      schemaVersion: 'perishability-request-plan-v1',
      binding: comparisonBinding(dataset, 'tuning'),
      variants: [{ definition, requests }],
    },
    dataset,
  );
  const choices = ['perishable', 'nonperishable', 'unknown'];
  const rows = await Promise.all(
    requests.map(async (request, i) => {
      const choice = choices[i];
      const transport = {
        status: 'success' as const,
        model: 'jev-1.13.0',
        choice,
        confidence: i === 1 ? 0.5 : 0.95,
        probabilities: {
          unknown: 0,
          perishable: 0,
          nonperishable: 0,
          [choice]: 1,
        },
        usage: { input_tokens: 1, output_tokens: 1 },
      };
      const item = dataset.cases[i];
      if (item.task !== 'product_understanding')
        throw new Error('Fixture task');
      return {
        ...request,
        call: {
          provider: 'typesafe' as const,
          requestHash: hash(request.request),
          elapsedMs: 1,
          transport,
        },
        outcome: await replayPerishability(item.input, transport),
      };
    }),
  );
  const comparison = {
    ...plan.binding,
    variants: [
      { definition, evidenceMode: 'offline' as const, complete: true, rows },
    ],
  };
  return { dataset, plan, comparison };
}
const response = () =>
  new Response(
    JSON.stringify({
      model: 'jev-1.13.0',
      answers: {
        isPerishable: {
          type: 'choice',
          choice: 'unknown',
          confidence: 1,
          probabilities: { unknown: 1, perishable: 0, nonperishable: 0 },
        },
      },
      usage: { input_tokens: 1, output_tokens: 1 },
    }),
  );

describe('perishability comparison replay, scoring and bounds', () => {
  it('separates raw wrong choices from rejected low-confidence decisions and unknowns', async () => {
    const { dataset, plan, comparison } = await fixture();
    await expect(
      validatePlannedComparison(comparison, dataset, plan),
    ).resolves.toEqual(comparison);
    const metrics = comparisonMetrics(comparison).variants[0];
    expect(metrics.counts).toMatchObject({
      rawCorrect: 1,
      rawWrong: 1,
      rawUnknown: 1,
      acceptedCorrect: 1,
      acceptedWrong: 0,
      lowConfidence: 1,
      abstainResolved: 1,
    });
    expect(metrics).toMatchObject({
      rawSubstantiveAccuracy: 0.5,
      acceptedPrecision: 1,
      acceptedCoverage: 0.5,
      ambiguousAbstention: 1,
    });
  });
  it('keeps zero denominators null and failures separate from unknown', async () => {
    const { dataset, plan, comparison } = await fixture();
    for (const row of comparison.variants[0].rows) {
      Object.assign(row.call, {
        transport: { status: 'unavailable', reason: 'invalid_response' },
      });
      Object.assign(row, { outcome: { status: 'unavailable' } });
    }
    await validatePlannedComparison(comparison, dataset, plan);
    expect(comparisonMetrics(comparison).variants[0]).toMatchObject({
      rawSubstantiveAccuracy: null,
      acceptedPrecision: null,
      counts: { failures: 3, rawUnknown: 0 },
      failureReasons: { invalid_response: 3 },
    });
  });
  it('rejects fabricated acceptance and rehashed request tampering against the external plan', async () => {
    for (const outcome of [true, false]) {
      const { dataset, plan, comparison } = await fixture();
      if (outcome)
        Object.assign(comparison.variants[0].rows[1], {
          outcome: {
            status: 'resolved',
            source: 'jev',
            value: false,
            confidence: 0.5,
          },
        });
      else {
        const row = comparison.variants[0].rows[0];
        row.request = clone(row.request);
        row.request.instructions = 'changed';
        row.call.requestHash = hash(row.request);
        row.orderedRequestHash = orderedRequestHash(row.request);
      }
      await expect(
        validatePlannedComparison(comparison, dataset, plan),
      ).rejects.toThrow();
    }
  });
  it('rejects unequal planned pairs, duplicate variants, input/model mismatch and changed v2 evidence', async () => {
    const original = await fixture();
    for (const change of [
      (p: typeof original.plan) => p.variants[0].requests.pop(),
      (p: typeof original.plan) => p.variants.push(p.variants[0]),
      (p: typeof original.plan) => {
        p.variants[0].requests[0].inputHash = '0'.repeat(64);
      },
      (p: typeof original.plan) => {
        p.variants.push({
          ...clone(p.variants[0]),
          definition: {
            ...p.variants[0].definition,
            variantId: 'other',
            configuredModel: 'jev-1.12.0',
          },
        });
      },
      (p: typeof original.plan) => {
        const r = p.variants[0].requests[0];
        r.request.state = {};
        r.orderedRequestHash = orderedRequestHash(r.request);
      },
    ]) {
      const plan = clone(original.plan);
      change(plan);
      await expect(
        parseComparisonPlan(plan, original.dataset),
      ).rejects.toThrow();
    }
  });
  it('accepts a frozen option rotation, rejects an unplanned rotation and exposes unpaired cases', async () => {
    const { dataset, plan, comparison } = await fixture();
    const rotated = clone(plan.variants[0]);
    rotated.definition.variantId = 'rotated';
    for (const r of rotated.requests) {
      r.request.criteria = Object.fromEntries(
        Object.entries(r.request.criteria).reverse(),
      );
      r.orderedChoiceIds = Object.keys(
        r.request.criteria,
      ) as typeof r.orderedChoiceIds;
      r.orderedRequestHash = orderedRequestHash(r.request);
    }
    plan.variants.push(rotated);
    await expect(parseComparisonPlan(plan, dataset)).resolves.toEqual(plan);
    comparison.variants.push({
      definition: rotated.definition,
      evidenceMode: 'offline',
      complete: false,
      rows: [],
    });
    await validatePlannedComparison(comparison, dataset, plan);
    expect(comparisonMetrics(comparison).pairs[0]).toMatchObject({
      paired: 0,
      unpaired: 3,
    });
    const row = comparison.variants[0].rows[0];
    row.request = clone(row.request);
    row.request.criteria = Object.fromEntries(
      Object.entries(row.request.criteria).reverse(),
    );
    row.orderedChoiceIds = Object.keys(
      row.request.criteria,
    ) as typeof row.orderedChoiceIds;
    row.orderedRequestHash = orderedRequestHash(row.request);
    await expect(
      validatePlannedComparison(comparison, dataset, plan),
    ).rejects.toThrow('frozen plan');
  });
  it('enforces a shared physical request ceiling and retains a partial inconclusive comparison', async () => {
    const { dataset, plan } = await fixture();
    const fetcher = jest.fn(async () => response());
    const budget = new RequestBudget(1, 5000);
    try {
      const comparison = await captureComparison(
        dataset,
        plan,
        budget,
        { typesafeApiKey: 'mock-only' },
        fetcher,
      );
      expect(fetcher).toHaveBeenCalledTimes(1);
      expect(budget.requests).toEqual({ typesafe: 1, openai: 0 });
      expect(comparison.variants[0]).toMatchObject({
        complete: false,
        rows: [expect.anything()],
      });
      expect(comparison.launchEvidence).toBe('inconclusive');
    } finally {
      budget.dispose();
    }
  });
  it('stops on a deadline and cancellation without dispatching more requests', async () => {
    const { dataset, plan } = await fixture();
    const controller = new AbortController();
    controller.abort();
    const fetcher = jest.fn();
    const budget = new RequestBudget(10, 1, controller.signal);
    try {
      const comparison = await captureComparison(
        dataset,
        plan,
        budget,
        { typesafeApiKey: 'mock-only' },
        fetcher,
      );
      expect(comparison.variants[0].rows).toEqual([]);
      expect(fetcher).not.toHaveBeenCalled();
    } finally {
      budget.dispose();
    }
    const expired = new RequestBudget(10, 1);
    try {
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(
        (
          await captureComparison(
            dataset,
            plan,
            expired,
            { typesafeApiKey: 'mock-only' },
            fetcher,
          )
        ).variants[0].rows,
      ).toEqual([]);
      expect(fetcher).not.toHaveBeenCalled();
    } finally {
      expired.dispose();
    }
  });
  it('counts paired gains/losses and excludes missing pairs explicitly', async () => {
    const { dataset, plan, comparison } = await fixture();
    const revised = clone(comparison.variants[0]);
    revised.definition.variantId = 'revised';
    const revisedPlan = clone(plan.variants[0]);
    revisedPlan.definition = revised.definition;
    plan.variants.push(revisedPlan);
    const row = revised.rows[1];
    row.call.transport.choice = 'perishable';
    row.call.transport.confidence = 0.95;
    row.call.transport.probabilities = {
      unknown: 0,
      perishable: 1,
      nonperishable: 0,
    };
    const item = dataset.cases[1];
    if (item.task !== 'product_understanding') throw new Error('Fixture task');
    row.outcome = await replayPerishability(item.input, row.call.transport);
    comparison.variants.push(revised);
    await validatePlannedComparison(comparison, dataset, plan);
    expect(comparisonMetrics(comparison).pairs[0]).toMatchObject({
      paired: 3,
      bothSuccessful: 3,
      rawDisagreements: 1,
      acceptanceDisagreements: 1,
      rawCorrectGains: 1,
      rawCorrectLosses: 0,
      acceptedCorrectGains: 1,
      acceptedCorrectLosses: 0,
    });
  });
  it('counts retries in the physical budget and captures malformed/provider failures separately', async () => {
    const { dataset, plan } = await fixture();
    const fetcher = jest
      .fn()
      .mockResolvedValueOnce(
        new Response('', { status: 503, headers: { 'Retry-After': '0' } }),
      )
      .mockResolvedValueOnce(new Response('invalid JSON'))
      .mockResolvedValueOnce(new Response('', { status: 401 }));
    const budget = new RequestBudget(3, 5000);
    try {
      const comparison = await captureComparison(
        dataset,
        plan,
        budget,
        { typesafeApiKey: 'mock-only' },
        fetcher,
      );
      expect(fetcher).toHaveBeenCalledTimes(3);
      expect(budget.requests.typesafe).toBe(3);
      expect(comparisonMetrics(comparison).variants[0]).toMatchObject({
        counts: { failures: 2, rawUnknown: 0, missing: 1 },
        failureReasons: { invalid_response: 1, authentication_error: 1 },
      });
    } finally {
      budget.dispose();
    }
  });
  it('aborts an in-flight provider call at the global deadline and keeps its failure row', async () => {
    const { dataset, plan } = await fixture();
    const fetcher = jest.fn(
      (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener(
            'abort',
            () => reject(new Error('Aborted')),
            { once: true },
          );
        }),
    );
    jest.useFakeTimers();
    const budget = new RequestBudget(10, 100);
    try {
      const pending = captureComparison(
        dataset,
        plan,
        budget,
        { typesafeApiKey: 'mock-only' },
        fetcher,
      );
      await jest.advanceTimersByTimeAsync(100);
      const comparison = await pending;
      expect(fetcher).toHaveBeenCalledTimes(1);
      expect(comparison.variants[0].complete).toBe(false);
      expect(comparison.variants[0].rows[0].call.transport.status).toBe(
        'unavailable',
      );
      expect(budget.stopped).toBe(true);
    } finally {
      budget.dispose();
      jest.useRealTimers();
    }
  });
  it('reuses complete baseline variants without changing versions or making requests', async () => {
    const { dataset, plan, comparison } = await fixture();
    const original = clone(comparison);
    const fetcher = jest.fn();
    const budget = new RequestBudget(1, 5000);
    try {
      expect(
        await captureComparison(
          dataset,
          plan,
          budget,
          { typesafeApiKey: 'mock-only' },
          fetcher,
          comparison,
        ),
      ).toEqual(original);
      expect(fetcher).not.toHaveBeenCalled();
    } finally {
      budget.dispose();
    }
  });
  it('writes exclusive mode-0600 private offline output without exposing product text or networking', async () => {
    const { dataset, plan, comparison } = await fixture();
    const dir = mkdtempSync(join(tmpdir(), 'perishability-comparison-'));
    const paths = {
      dataset: join(dir, 'dataset.json'),
      plan: join(dir, 'plan.json'),
      recorded: join(dir, 'comparison.json'),
      output: join(dir, 'report.json'),
    };
    for (const [key, value] of Object.entries({
      dataset,
      plan,
      recorded: comparison,
    }))
      writeFileSync(paths[key], JSON.stringify(value), { mode: 0o600 });
    const args = [
      '--dataset',
      paths.dataset,
      '--plan',
      paths.plan,
      '--recorded',
      paths.recorded,
      '--split',
      'tuning',
      '--output',
      paths.output,
    ];
    const fetcher = jest.fn();
    const print = jest.fn();
    expect(
      await runPerishabilityComparisonCli(args, {}, { fetcher, print }),
    ).toBe(0);
    expect(fetcher).not.toHaveBeenCalled();
    expect(statSync(paths.output).mode & 0o777).toBe(0o600);
    const report = JSON.parse(readFileSync(paths.output, 'utf8'));
    await expect(
      parseComparisonReport(report, dataset, plan),
    ).resolves.toMatchObject({ launchEvidence: 'inconclusive' });
    const tampered = clone(report);
    tampered.metrics.variants[0].acceptedPrecision = 0;
    await expect(
      parseComparisonReport(tampered, dataset, plan),
    ).rejects.toThrow('metrics');
    expect(report).toMatchObject({
      launchEvidence: 'inconclusive',
      planHash: hash(plan),
      run: { evidenceMode: 'offline', physicalRequests: null, complete: true },
    });
    expect(print).toHaveBeenCalledWith(
      'offline perishability comparison: 1 variants; 3 cases; complete true; launch inconclusive',
    );
    await expect(
      runPerishabilityComparisonCli(args, {}, { fetcher }),
    ).rejects.toThrow();
  });
  it('rejects live bounds/configuration before fetch and preserves a cancelled partial output', async () => {
    const { dataset, plan } = await fixture();
    const dir = mkdtempSync(join(tmpdir(), 'perishability-bounds-'));
    const datasetPath = join(dir, 'dataset.json'),
      planPath = join(dir, 'plan.json');
    writeFileSync(datasetPath, JSON.stringify(dataset));
    writeFileSync(planPath, JSON.stringify(plan));
    const args = [
      '--dataset',
      datasetPath,
      '--plan',
      planPath,
      '--split',
      'tuning',
      '--live',
      '--max-requests',
      '5',
      '--max-duration-ms',
      '5000',
      '--output',
      join(dir, 'short.json'),
    ];
    const fetcher = jest.fn();
    const env = { TYPESAFE_API_KEY: 'mock-only', JEV_MODEL: 'jev-1.13.0' };
    await expect(
      runPerishabilityComparisonCli(args, env, { fetcher }),
    ).rejects.toThrow('ceiling');
    expect(fetcher).not.toHaveBeenCalled();
    const controller = new AbortController();
    controller.abort();
    args[args.indexOf('--max-requests') + 1] = '6';
    expect(
      await runPerishabilityComparisonCli(args, env, {
        fetcher,
        signal: controller.signal,
        print: jest.fn(),
      }),
    ).toBe(130);
    const report = JSON.parse(readFileSync(join(dir, 'short.json'), 'utf8'));
    expect(report.run.complete).toBe(false);
    expect(report.comparison.variants[0].rows).toEqual([]);
  });
});
