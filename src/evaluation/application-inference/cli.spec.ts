import {
  mkdtempSync,
  readFileSync,
  writeFileSync,
  statSync,
  rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runCli, parseArguments } from './cli';
import { safetyDataset } from './fixture';
import { parseReport } from './report';
import { RequestBudget } from './request-budget';
import { binding } from './recording';
import * as reportModule from './report';

describe('Bounded application evaluation CLI', () => {
  let directory: string;
  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'application-evaluation-'));
  });
  afterEach(() => rmSync(directory, { recursive: true, force: true }));
  function dataset(caseIds = ['understanding-0']) {
    const d = safetyDataset();
    d.cases = d.cases.filter((c) => caseIds.includes(c.caseId));
    const path = join(directory, 'dataset.json');
    writeFileSync(path, JSON.stringify(d));
    return { d, path };
  }
  const environment = {
    TYPESAFE_API_KEY: 'fixture-only',
    JEV_MODEL: 'jev-1.13.0',
  };
  const response = (_url: unknown, init?: RequestInit) => {
    const body = JSON.parse(init!.body as string) as {
      questions: Record<string, { criteria: Record<string, unknown> }>;
    };
    const [key, q] = Object.entries(body.questions)[0];
    return Promise.resolve(
      new Response(
        JSON.stringify({
          model: 'jev-1.13.0',
          answers: {
            [key]: {
              type: 'choice',
              choice: 'unknown',
              confidence: 0.99,
              probabilities: Object.fromEntries(
                Object.keys(q.criteria).map((k) => [
                  k,
                  k === 'unknown' ? 1 : 0,
                ]),
              ),
            },
          },
          usage: { input_tokens: 12, output_tokens: 2 },
        }),
        { status: 200 },
      ),
    );
  };
  it('requires exclusive modes and explicit live budgets before networking', async () => {
    expect(() => parseArguments(['--live'])).toThrow();
    const { path } = dataset();
    const fetcher = jest.fn(response);
    const args = [
      '--live',
      '--task',
      'product_understanding',
      '--dataset',
      path,
      '--output',
      join(directory, 'out.json'),
    ];
    await expect(runCli(args, environment, { fetcher })).rejects.toThrow();
    await expect(
      runCli(
        [...args, '--max-requests', '7', '--max-duration-ms', '1000'],
        environment,
        { fetcher },
      ),
    ).rejects.toThrow('worst-case');
    expect(fetcher).not.toHaveBeenCalled();
    expect(() =>
      parseArguments([
        ...args,
        '--max-requests',
        '1001',
        '--max-duration-ms',
        '1000',
      ]),
    ).toThrow();
  });
  it('runs mocked live transport, validates private output and replays offline with zero network', async () => {
    const { d, path } = dataset();
    const output = join(directory, 'live.json');
    const fetcher = jest.fn(response);
    const print = jest.fn();
    const args = [
      '--live',
      '--task',
      'product_understanding',
      '--dataset',
      path,
      '--output',
      output,
      '--max-requests',
      '8',
      '--max-duration-ms',
      '5000',
    ];
    expect(await runCli(args, environment, { fetcher, print })).toBe(0);
    expect(fetcher).toHaveBeenCalledTimes(4);
    expect(statSync(output).mode & 0o777).toBe(0o600);
    const report = await parseReport(
      JSON.parse(readFileSync(output, 'utf8')),
      d,
    );
    expect(report.launchEvidence).toBe('inconclusive');
    expect(report.run.physicalRequests).toEqual({ typesafe: 4, openai: 0 });
    expect(print.mock.calls.flat().join(' ')).not.toContain('milk');
    const {
      run: _run,
      observations: _rows,
      metrics: _metrics,
      slices: _slices,
      resolvedModels: _models,
      launchEvidence: _launch,
      launchReasons: _reasons,
      warnings: _warnings,
      ...recording
    } = report;
    const recorded = join(directory, 'recorded.json');
    writeFileSync(recorded, JSON.stringify(recording));
    fetcher.mockClear();
    expect(
      await runCli(
        [
          '--task',
          'product_understanding',
          '--dataset',
          path,
          '--recorded',
          recorded,
          '--output',
          join(directory, 'offline.json'),
        ],
        {},
        { fetcher, print },
      ),
    ).toBe(0);
    expect(fetcher).not.toHaveBeenCalled();
    await expect(runCli(args, environment, { fetcher })).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('records partial cancellation and safe provider failures without hidden generation', async () => {
    const { d, path } = dataset(['understanding-0', 'understanding-1']);
    const controller = new AbortController();
    const fetcher = jest.fn(async () => {
      controller.abort();
      throw new Error('private raw error');
    });
    const output = join(directory, 'partial.json');
    expect(
      await runCli(
        [
          '--live',
          '--task',
          'product_understanding',
          '--dataset',
          path,
          '--output',
          output,
          '--max-requests',
          '16',
          '--max-duration-ms',
          '5000',
        ],
        environment,
        { fetcher, signal: controller.signal, print: () => {} },
      ),
    ).toBe(130);
    const report = await parseReport(
      JSON.parse(readFileSync(output, 'utf8')),
      d,
    );
    expect(report.run.complete).toBe(false);
    expect(report.metrics.notRun).toBe(1);
    expect(report.run.physicalRequests).toEqual({ typesafe: 1, openai: 0 });
    expect(report.launchReasons).toContain('incomplete');
    expect(readFileSync(output, 'utf8')).not.toContain('private raw error');
  });
  it('requires generation credentials only for cases that can require generation', async () => {
    const { path } = dataset(['policy-5']);
    const fetcher = jest.fn(response);
    await expect(
      runCli(
        [
          '--live',
          '--task',
          'shelf_life_policy',
          '--dataset',
          path,
          '--output',
          join(directory, 'out.json'),
          '--max-requests',
          '2',
          '--max-duration-ms',
          '5000',
        ],
        environment,
        { fetcher },
      ),
    ).rejects.toThrow('OpenAI');
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('bounds actual retry dispatch, shares a deadline and cancels in-flight fetches', async () => {
    const budget = new RequestBudget(1, 1000);
    const fetcher = jest.fn(response);
    const bounded = budget.fetch('typesafe', fetcher);
    try {
      await bounded('https://fixture.invalid', {
        body: JSON.stringify({
          questions: { f: { criteria: { unknown: null } } },
        }),
      });
      await expect(bounded('https://fixture.invalid')).rejects.toThrow(
        'budget',
      );
      expect(fetcher).toHaveBeenCalledTimes(1);
    } finally {
      budget.dispose();
    }
    const expired = new RequestBudget(1, 1);
    await new Promise((resolve) => setTimeout(resolve, 5));
    await expect(
      expired.fetch('openai', fetcher)('https://fixture.invalid'),
    ).rejects.toThrow();
    expired.dispose();
  });
  it('retains a private failed candidate when post-run validation rejects it', async () => {
    const { path } = dataset();
    const output = join(directory, 'failed.json');
    const validation = jest
      .spyOn(reportModule, 'parseReport')
      .mockRejectedValueOnce(new Error('private validation detail'));
    try {
      await expect(
        runCli(
          [
            '--live',
            '--task',
            'product_understanding',
            '--dataset',
            path,
            '--output',
            output,
            '--max-requests',
            '8',
            '--max-duration-ms',
            '5000',
          ],
          environment,
          { fetcher: jest.fn(response) },
        ),
      ).rejects.toThrow('private validation detail');
    } finally {
      validation.mockRestore();
    }
    const bytes = readFileSync(output, 'utf8');
    const retained = JSON.parse(bytes);
    expect(retained.validation).toBe('failed');
    expect(retained.candidateReport.observations).toHaveLength(1);
    expect(retained.candidateReport.observations[0].calls).toHaveLength(4);
    expect(retained.candidateReport.run.physicalRequests).toEqual({
      typesafe: 4,
      openai: 0,
    });
    expect(bytes).not.toContain('private validation detail');
    expect(statSync(output).mode & 0o777).toBe(0o600);
  });
  it('rejects malformed inputs and a mismatched recording before touching network', async () => {
    const { d, path } = dataset();
    const record = join(directory, 'bad.json');
    writeFileSync(
      record,
      JSON.stringify({
        ...binding(d, 'product_understanding', 'held_out', 'jev-1.13.0'),
        inputHash: '0'.repeat(64),
        rows: [],
      }),
    );
    await expect(
      runCli([
        '--task',
        'product_understanding',
        '--dataset',
        path,
        '--recorded',
        record,
        '--output',
        join(directory, 'out.json'),
      ]),
    ).rejects.toThrow();
  });
});
