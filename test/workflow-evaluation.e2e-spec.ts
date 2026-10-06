import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { workflowSafetyDataset } from '../src/evaluation/stock-prediction/workflow-fixture';
import { runWorkflowEvaluation } from '../src/evaluation/stock-prediction/workflow-runner';
import { workflowBinding } from '../src/evaluation/stock-prediction/workflow-recording';
import {
  createWorkflowReport,
  replayWorkflowReport,
} from '../src/evaluation/stock-prediction/workflow-report';
import { assertWorkflowDatabase } from '../src/evaluation/stock-prediction/workflow-seed';
import { RequestBudget } from '../src/evaluation/application-inference/request-budget';

jest.setTimeout(120000);
async function freshDatabase() {
  const source = process.env.EVALUATION_DATABASE_URL;
  if (!source)
    throw new Error(
      'Workflow E2E needs explicitly isolated EVALUATION_DATABASE_URL',
    );
  assertWorkflowDatabase(source);
  const url = new URL(source);
  const name = `home_stock_eval_e2e_${randomUUID().replace(/-/g, '')}_test`;
  const adminUrl = new URL(url);
  adminUrl.pathname = '/postgres';
  const admin = new Client({ connectionString: adminUrl.toString() });
  await admin.connect();
  try {
    await admin.query(`CREATE DATABASE "${name}"`);
  } finally {
    await admin.end();
  }
  url.pathname = `/${name}`;
  execFileSync('npm', ['run', 'db:migrate:deploy'], {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: url.toString() },
    stdio: 'pipe',
    timeout: 60000,
  });
  return url.toString();
}
function response(choice: string, init?: RequestInit) {
  const body = JSON.parse(init!.body as string) as {
    questions: Record<string, { criteria: Record<string, unknown> }>;
  };
  const [key, q] = Object.entries(body.questions)[0];
  return new Response(
    JSON.stringify({
      model: 'jev-1.13.0',
      answers: {
        [key]: {
          type: 'choice',
          choice,
          confidence: 0.95,
          probabilities: Object.fromEntries(
            Object.keys(q.criteria).map((k) => [k, k === choice ? 1 : 0]),
          ),
        },
      },
      usage: { input_tokens: 20, output_tokens: 3 },
    }),
    { status: 200 },
  );
}
describe('Workflow evaluation using isolated Nest/PostgreSQL runtime', () => {
  it('measures real final recommendations, replays in a fresh database and refuses nonempty targets', async () => {
    const d = workflowSafetyDataset(),
      url = await freshDatabase();
    const requests: string[] = [];
    let index = 0;
    const fetcher: typeof fetch = async (_input, init) => {
      requests.push(init!.body as string);
      const current = index++;
      return current === 4
        ? new Response('{}', { status: 200 })
        : response(current === 3 ? 'uncertain' : 'probably_low', init);
    };
    const budget = new RequestBudget(16, 30000);
    let rows: Awaited<ReturnType<typeof runWorkflowEvaluation>>;
    try {
      rows = await runWorkflowEvaluation(d, {
        databaseUrl: url,
        split: 'held_out',
        model: 'jev-1.13.0',
        typesafeApiKey: 'fixture-only',
        budget,
        fetcher,
      });
    } finally {
      budget.dispose();
    }
    const byId = new Map(rows.map((r) => [r.caseId, r]));
    expect(byId.get('workflow-accepted_low')).toMatchObject({
      accepted: true,
      application: 'applied',
      final: { state: 'probably_low', recommended: true },
    });
    for (const key of ['pending_grocery', 'high_threshold'])
      expect(byId.get(`workflow-${key}`)).toMatchObject({
        accepted: true,
        application: 'applied',
        final: { recommended: false },
      });
    for (const key of ['uncertain_advice', 'provider_failure', 'zero_history'])
      expect(byId.get(`workflow-${key}`)).toMatchObject({
        accepted: false,
        final: { recommended: false },
      });
    for (const key of ['explicit_out', 'expired'])
      expect(byId.get(`workflow-${key}`)).toMatchObject({
        calls: [],
        final: { state: 'probably_out', recommended: true },
      });
    expect(requests).toHaveLength(5);
    expect(requests.join(' ')).not.toContain('2026-01-12');
    expect(rows.every((r) => !r.repeatInference)).toBe(true);
    const report = createWorkflowReport(d, 'held_out', 'jev-1.13.0', rows, {
      evidenceMode: 'offline',
      startedAt: '2026-10-06T10:00:00Z',
      finishedAt: '2026-10-06T10:01:00Z',
      codeRevision: null,
      codeDirty: true,
      dirtyPaths: [],
      complete: true,
      physicalRequests: null,
    });
    expect(report.metrics.final.precision).toEqual({
      numerator: 3,
      denominator: 3,
      value: 1,
    });
    expect(report.metrics.baseline.precision.denominator).toBe(2);
    expect(report.metrics.safetyViolations).toBe(0);
    expect(report.metrics.modelCallCoverage).toEqual({
      numerator: 5,
      denominator: 8,
      value: 0.625,
    });
    expect(report.metrics.provider).toMatchObject({
      logicalCalls: 5,
      inputTokens: 80,
      outputTokens: 12,
      missingUsageCount: 1,
    });
    expect(report.launchEvidence).toBe('inconclusive');
    expect(
      await replayWorkflowReport(report, d, await freshDatabase()),
    ).toEqual(report);
    await expect(
      runWorkflowEvaluation(d, {
        databaseUrl: url,
        split: 'held_out',
        model: 'jev-1.13.0',
        recording: {
          ...workflowBinding(d, 'held_out', 'jev-1.13.0'),
          rows: rows.map((r) => ({ caseId: r.caseId, calls: r.calls })),
        },
      }),
    ).rejects.toThrow('nonempty');
    const prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: url }),
    });
    try {
      expect(await prisma.inventoryEvent.count()).toBe(17);
      expect(await prisma.stockAdviceAttempt.count()).toBe(5);
    } finally {
      await prisma.$disconnect();
    }
  });
  it('marks newer explicit correction stale and preserves it without treating that correction as model publication', async () => {
    const d = workflowSafetyDataset();
    d.history.cases = d.history.cases.slice(0, 1);
    d.snapshots = d.snapshots.slice(0, 1);
    const budget = new RequestBudget(2, 30000);
    try {
      const rows = await runWorkflowEvaluation(d, {
        databaseUrl: await freshDatabase(),
        split: 'held_out',
        model: 'jev-1.13.0',
        typesafeApiKey: 'fixture-only',
        budget,
        fetcher: async (_url, init) => response('probably_low', init),
        beforeReply: async (prisma, productId) => {
          await prisma.stockProjection.update({
            where: { productId },
            data: {
              revision: { increment: 1 },
              recordedQuantity: 5,
              estimatedQuantity: 5,
              estimatedState: 'likely_available',
              confidence: 1,
              reason: 'explicit-correction-fixture',
              predictionId: null,
            },
          });
        },
      });
      expect(rows[0]).toMatchObject({
        accepted: true,
        application: 'stale',
        final: {
          state: 'likely_available',
          quantity: 5,
          recordedQuantity: 5,
          recommended: false,
        },
        repeatInference: false,
      });
      const report = createWorkflowReport(d, 'held_out', 'jev-1.13.0', rows, {
        evidenceMode: 'offline',
        startedAt: '2026-10-06T10:00:00Z',
        finishedAt: '2026-10-06T10:01:00Z',
        codeRevision: null,
        codeDirty: true,
        dirtyPaths: [],
        complete: true,
        physicalRequests: null,
      });
      expect(report.metrics.safetyViolations).toBe(0);
    } finally {
      budget.dispose();
    }
  });
});
