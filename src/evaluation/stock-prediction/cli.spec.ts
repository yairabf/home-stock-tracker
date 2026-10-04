import {
  mkdtempSync,
  readFileSync,
  writeFileSync,
  statSync,
  symlinkSync,
  truncateSync,
  rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import childProcess from 'node:child_process';
import { parseArguments, runCli } from './cli';
import { MAX_INPUT_BYTES, readBoundedJson, sourceState } from './cli-io';
import { parseDataset } from './dataset';
import { parseEvaluationReport } from './report';

const corpus = resolve('evaluation/stock-prediction/safety-cases.v1.json');
const replay = resolve('evaluation/stock-prediction/recorded-safety.v1.json');
const environment = {
  TYPESAFE_API_KEY: 'private-test-key',
  JEV_MODEL: 'jev-1.13.0',
};
function validResponse() {
  return new Response(
    JSON.stringify({
      model: 'jev-1.13.0',
      usage: { input_tokens: 12, output_tokens: 4 },
      answers: {
        stock_state: {
          type: 'choice',
          choice: 'probably_low',
          confidence: 0.95,
          probabilities: {
            likely_available: 0.01,
            probably_low: 0.97,
            probably_out: 0.01,
            uncertain: 0.01,
          },
        },
      },
    }),
  );
}

describe('bounded stock evaluation CLI', () => {
  let directory: string;
  let output: string;
  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'stock-cli-'));
    output = join(directory, 'report.json');
  });
  afterEach(() => {
    jest.restoreAllMocks();
    rmSync(directory, { recursive: true, force: true });
  });
  const offline = (output: string) => [
    '--recorded',
    replay,
    '--output',
    output,
  ];
  const live = (output: string) => ['--live', '--output', output];

  it.each([
    [],
    ['--output', 'new.json'],
    ['--live', '--recorded', 'replay.json', '--output', 'new.json'],
    ['--live', '--live', '--output', 'new.json'],
    ['--live', '--output'],
    ['--live', '--split', 'unknown', '--output', 'new.json'],
    ['--live', '--output', 'a', '--output', 'b'],
    ['--unknown'],
    ['--recorded', 'r', '--smoke', '--output', 'new.json'],
    ['--live', '--smoke', '--dataset', 'custom', '--output', 'new.json'],
    ['--live', '--smoke', '--split', 'held_out', '--output', 'new.json'],
  ])('rejects invalid arguments %j', (...args) => {
    expect(() => parseArguments(args)).toThrow();
  });

  it('runs the authored corpus offline without requests and creates a private report', async () => {
    const fetcher = jest
      .spyOn(globalThis, 'fetch')
      .mockRejectedValue(new Error('No network'));
    const print = jest.fn();
    expect(await runCli(offline(output), {}, { print })).toBe(0);
    const dataset = parseDataset(readBoundedJson(corpus));
    const report = parseEvaluationReport(readBoundedJson(output), dataset);
    expect(fetcher).not.toHaveBeenCalled();
    expect(statSync(output).mode & 0o777).toBe(0o600);
    expect(report.launchEvidence).toBe('inconclusive');
    expect(report.metrics).toMatchObject({
      selectedCaseCount: 13,
      completedCaseCount: 13,
      acceptedCount: 5,
      acceptedLowOutPrecision: { numerator: 2, denominator: 3, value: 2 / 3 },
      unscoredReasons: { missing_confirmation: 1, intervening_mutation: 1 },
      provider: { calls: 9, bypasses: 4, failures: 1, validatedRejections: 3 },
    });
    expect(print.mock.calls[0][0]).not.toMatch(
      /fixture-author|private-test-key|purchase-new|accepted-low-label/,
    );
  });
  it('refuses existing files and symlinks before any live request', async () => {
    const fetcher = jest
      .fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>()
      .mockResolvedValue(validResponse());
    writeFileSync(output, 'untouched');
    await expect(
      runCli(live(output), environment, { fetcher }),
    ).rejects.toThrow();
    expect(readFileSync(output, 'utf8')).toBe('untouched');
    const linked = join(directory, 'linked.json');
    symlinkSync(output, linked);
    await expect(
      runCli(live(linked), environment, { fetcher }),
    ).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('bounds both inputs and rejects nonregular/symlink JSON', async () => {
    const tooLarge = join(directory, 'large.json');
    writeFileSync(tooLarge, '{}');
    truncateSync(tooLarge, MAX_INPUT_BYTES + 1);
    const fetcher = jest.fn<
      ReturnType<typeof fetch>,
      Parameters<typeof fetch>
    >();
    await expect(
      runCli([...live(output), '--dataset', tooLarge], environment, {
        fetcher,
      }),
    ).rejects.toThrow();
    await expect(
      runCli(['--recorded', tooLarge, '--output', output], {}, { fetcher }),
    ).rejects.toThrow();
    expect(() => readBoundedJson(directory)).toThrow();
    const linked = join(directory, 'linked.json');
    symlinkSync(corpus, linked);
    expect(() => readBoundedJson(linked)).toThrow();
    expect(fetcher).not.toHaveBeenCalled();
    expect(() => statSync(output)).toThrow();
  });
  it('rejects missing credentials, incompatible replay and empty split before requests', async () => {
    const fetcher = jest.fn<
      ReturnType<typeof fetch>,
      Parameters<typeof fetch>
    >();
    await expect(runCli(live(output), {}, { fetcher })).rejects.toThrow();
    await expect(
      runCli([...offline(output), '--split', 'tuning'], {}, { fetcher }),
    ).rejects.toThrow();
    const invalid = join(directory, 'recorded.json');
    const recording = readBoundedJson(replay) as Record<string, unknown>;
    recording.datasetHash = 'a'.repeat(64);
    writeFileSync(invalid, JSON.stringify(recording));
    await expect(
      runCli(['--recorded', invalid, '--output', output], {}, { fetcher }),
    ).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
    expect(() => statSync(output)).toThrow();
  });
  it('keeps connectivity smoke separate and unscored', async () => {
    const fetcher = jest
      .fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>()
      .mockResolvedValue(validResponse());
    expect(
      await runCli(['--live', '--smoke', '--output', output], environment, {
        fetcher,
        print: jest.fn(),
      }),
    ).toBe(0);
    const report = readBoundedJson(output) as {
      purpose: string;
      launchReasons: string[];
      launchEvidence: string;
      metrics: { scoredCaseCount: number };
    };
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(report.purpose).toBe('smoke');
    expect(report.launchEvidence).toBe('inconclusive');
    expect(report.launchReasons).toContain('smoke_only');
    expect(report.metrics.scoredCaseCount).toBe(0);
  });
  it('preserves completed observations and cleans up listeners when interrupted', async () => {
    const controller = new AbortController();
    const fetcher = jest
      .fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>()
      .mockImplementation(async () => {
        controller.abort();
        return validResponse();
      });
    const before = process.listenerCount('SIGINT');
    expect(
      await runCli(live(output), environment, {
        fetcher,
        signal: controller.signal,
        print: jest.fn(),
      }),
    ).toBe(130);
    const report = parseEvaluationReport(
      readBoundedJson(output),
      readBoundedJson(corpus),
    );
    expect(report.complete).toBe(false);
    expect(report.observations).toHaveLength(5);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(process.listenerCount('SIGINT')).toBe(before);
  });
  it('retains only sanitized failure reasons from a provider response', async () => {
    const fetcher = jest
      .fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>()
      .mockResolvedValue(
        new Response('private-test-key raw-provider-error', { status: 401 }),
      );
    const print = jest.fn();
    await runCli(['--live', '--smoke', '--output', output], environment, {
      fetcher,
      print,
    });
    expect(readFileSync(output, 'utf8')).not.toMatch(
      /private-test-key|raw-provider-error/,
    );
    expect(print.mock.calls[0][0]).not.toMatch(
      /private-test-key|raw-provider-error/,
    );
  });
  it('the actual entrypoint reports sanitized errors and a nonzero exit', () => {
    try {
      execFileSync(
        process.execPath,
        [
          '-r',
          'ts-node/register',
          'scripts/evaluate-stock-prediction.ts',
          '--private-test-key',
        ],
        { encoding: 'utf8', stdio: 'pipe', timeout: 20000 },
      );
      throw new Error('Expected CLI failure');
    } catch (error) {
      expect(error).toMatchObject({ status: 1 });
      const stderr = (error as { stderr: string }).stderr;
      expect(stderr).toContain('Stock evaluation failed');
      expect(stderr).not.toContain('--private-test-key');
    }
  });
  it('captures relevant source/config changes and fails closed when git is unavailable', () => {
    const git = jest
      .spyOn(childProcess, 'execFileSync')
      .mockReturnValueOnce('a'.repeat(40))
      .mockReturnValueOnce(' M package.json');
    expect(sourceState()).toEqual({
      codeRevision: 'a'.repeat(40),
      codeDirty: true,
    });
    expect(git.mock.calls[1][1]).toEqual(
      expect.arrayContaining([
        'package-lock.json',
        'src/estimation',
        'src/statistics',
        'src/llm',
        'src/config',
        'scripts/evaluate-stock-prediction.ts',
      ]),
    );
    git.mockImplementation(() => {
      throw new Error('private git error');
    });
    expect(sourceState()).toEqual({ codeRevision: null, codeDirty: true });
  });
});
