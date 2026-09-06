import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('release update script', () => {
  const digest = `ghcr.io/yairabf/home-stock-tracker@sha256:${'a'.repeat(64)}`;
  let directory: string;

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'stock-release-test-'));
    writeFileSync(
      join(directory, 'docker'),
      `#!/usr/bin/env node
const fs = require('node:fs');
const args = process.argv.slice(2);
fs.appendFileSync(process.env.CALL_LOG, JSON.stringify({args, image: process.env.IMAGE_REF}) + '\\n');
const command = args.join(' ');
if (process.env.FAIL_AT && command.includes(process.env.FAIL_AT)) process.exit(17);
if (command.endsWith('config --images')) console.log('postgres:16-alpine\\nghcr.io/yairabf/home-stock-tracker:latest');
if (args[0] === 'image' && !process.env.NO_DIGEST) console.log(${JSON.stringify(digest)});
`,
      { mode: 0o755 },
    );
  });

  afterEach(() => rmSync(directory, { recursive: true, force: true }));

  function run(overrides: Record<string, string> = {}) {
    const log = join(directory, 'calls.jsonl');
    const result = spawnSync('sh', ['scripts/update-release.sh'], {
      cwd: process.cwd(),
      encoding: 'utf8',
      env: {
        ...process.env,
        PATH: `${directory}:${process.env.PATH}`,
        CALL_LOG: log,
        IMAGE_REF: '',
        FAIL_AT: '',
        NO_DIGEST: '',
        ...overrides,
      },
    });
    const calls = readFileSync(log, 'utf8')
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line) as { args: string[]; image: string });
    return { result, calls };
  }

  it('uses one digest for migration and app replacement, in that order', () => {
    const { result, calls } = run();
    expect(result.status).toBe(0);
    const migration = calls.findIndex((call) => call.args.includes('run'));
    const replacement = calls.findIndex((call) =>
      call.args.includes('--force-recreate'),
    );
    expect(migration).toBeGreaterThan(-1);
    expect(replacement).toBeGreaterThan(migration);
    expect(calls[migration].image).toBe(digest);
    expect(calls[replacement].image).toBe(digest);
    expect(calls[replacement].args).toContain('--wait');
  });

  it.each(['pull app migrate', 'run --rm --no-deps migrate'])(
    'does not replace the app when %s fails',
    (failure) => {
      const { result, calls } = run({ FAIL_AT: failure });
      expect(result.status).toBe(17);
      expect(calls.some((call) => call.args.includes('--force-recreate'))).toBe(
        false,
      );
    },
  );

  it('refuses to migrate or replace when the pulled digest is missing', () => {
    const { result, calls } = run({ NO_DIGEST: '1' });
    expect(result.status).toBe(1);
    expect(calls.some((call) => call.args.includes('run'))).toBe(false);
    expect(calls.some((call) => call.args.includes('--force-recreate'))).toBe(
      false,
    );
  });

  it('reports a readiness failure without claiming success', () => {
    const { result } = run({ FAIL_AT: '--force-recreate' });
    expect(result.status).toBe(17);
    expect(result.stdout).not.toContain('Running ');
  });
});
