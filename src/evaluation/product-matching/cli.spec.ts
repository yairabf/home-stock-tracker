import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { parseArguments, runCli } from './cli';
import type { RecordedRun } from './observations';

const root = resolve(__dirname, '../../..');
const replay = resolve(
  root,
  'evaluation/product-matching/recorded-smoke.v1.json',
);
describe('evaluation CLI', () => {
  it.each(
    [
      [],
      ['--live'],
      ['--live', '--recorded', 'x', '--output', 'x'],
      ['--output', 'x'],
      ['--recorded', 'x', '--output', 'x', '--secret', 'x'],
      ['--recorded', 'x', '--output', 'x', '--output', 'y'],
      ['--live', '--smoke', '--dataset', 'x', '--output', 'x'],
      ['--live', '--split', 'bad', '--output', 'x'],
    ].map((args) => ({ args })),
  )('rejects invalid arguments before any provider call: $args', ({ args }) => {
    expect(() => parseArguments(args)).toThrow();
  });
  it('runs the real launcher offline without DB or provider credentials', () => {
    const directory = mkdtempSync(resolve(tmpdir(), 'hst-eval-cli-'));
    const output = resolve(directory, 'report.json');
    const result = spawnSync(
      process.execPath,
      [
        '-r',
        'ts-node/register',
        resolve(root, 'scripts/evaluate-product-matching.ts'),
        '--recorded',
        replay,
        '--output',
        output,
      ],
      {
        cwd: root,
        encoding: 'utf8',
        env: {
          PATH: process.env.PATH,
          TS_NODE_PROJECT: resolve(root, 'tsconfig.json'),
        },
        timeout: 20000,
      },
    );
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('60/60');
    const report = JSON.parse(readFileSync(output, 'utf8')) as {
      evidenceMode: string;
      launchEvidence: string;
    };
    expect(report).toMatchObject({
      evidenceMode: 'offline',
      launchEvidence: 'inconclusive',
    });
  }, 25000);
  it('emits failing evidence for a deliberately unsafe decision and refuses overwrite', async () => {
    const directory = mkdtempSync(resolve(tmpdir(), 'hst-eval-failure-'));
    const data = JSON.parse(readFileSync(replay, 'utf8')) as RecordedRun;
    const row = data.rows.find((row) => row.caseId.endsWith('-related'))!;
    if (row.transport?.status !== 'success')
      throw new Error('Missing synthetic success');
    row.transport.choice = 'candidate_0';
    for (const key of Object.keys(row.transport.probabilities))
      row.transport.probabilities[key] = key === 'candidate_0' ? 1 : 0;
    const recorded = resolve(directory, 'wrong.json');
    const output = resolve(directory, 'report.json');
    writeFileSync(recorded, JSON.stringify(data));
    const log = jest.spyOn(console, 'log').mockImplementation(() => {});
    try {
      expect(
        await runCli(['--recorded', recorded, '--output', output], {}),
      ).toBe(2);
      expect(
        (JSON.parse(readFileSync(output, 'utf8')) as { launchEvidence: string })
          .launchEvidence,
      ).toBe('failed');
      const before = readFileSync(output, 'utf8');
      await expect(
        runCli(['--recorded', recorded, '--output', output], {}),
      ).rejects.toThrow();
      expect(readFileSync(output, 'utf8')).toBe(before);
    } finally {
      log.mockRestore();
    }
  });
  it('rejects bad replay provenance before calling fetch or creating output', async () => {
    const fetcher = jest
      .spyOn(globalThis, 'fetch')
      .mockRejectedValue(new Error('Forbidden'));
    const directory = mkdtempSync(resolve(tmpdir(), 'hst-eval-invalid-'));
    const data = JSON.parse(readFileSync(replay, 'utf8')) as RecordedRun;
    data.datasetHash = '0'.repeat(64);
    const recorded = resolve(directory, 'wrong.json');
    writeFileSync(recorded, JSON.stringify(data));
    try {
      await expect(
        runCli(
          [
            '--recorded',
            recorded,
            '--output',
            resolve(directory, 'report.json'),
          ],
          {},
        ),
      ).rejects.toThrow();
      expect(fetcher).not.toHaveBeenCalled();
    } finally {
      fetcher.mockRestore();
    }
  });
});
