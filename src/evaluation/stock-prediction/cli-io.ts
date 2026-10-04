import { execFileSync } from 'node:child_process';
import { closeSync, constants, fstatSync, openSync, readSync } from 'node:fs';

export const MAX_INPUT_BYTES = 5 * 1024 * 1024;
export function readBoundedJson(path: string): unknown {
  const input = openSync(
    path,
    constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
  );
  try {
    const stat = fstatSync(input);
    if (!stat.isFile() || stat.size > MAX_INPUT_BYTES)
      throw new Error('Invalid input file');
    const buffer = Buffer.alloc(MAX_INPUT_BYTES + 1);
    let length = 0;
    while (length < buffer.length) {
      const read = readSync(
        input,
        buffer,
        length,
        buffer.length - length,
        null,
      );
      if (!read) break;
      length += read;
    }
    if (length > MAX_INPUT_BYTES) throw new Error('Input exceeds file bound');
    return JSON.parse(buffer.subarray(0, length).toString('utf8')) as unknown;
  } finally {
    closeSync(input);
  }
}

// Include all runtime policy, transport, configuration and evaluation dependencies.
const RELEVANT_PATHS = [
  'src/evaluation/stock-prediction',
  'src/estimation',
  'src/statistics',
  'src/llm',
  'src/config',
  'src/common',
  'src/generated',
  'prisma',
  'scripts/evaluate-stock-prediction.ts',
  'evaluation/stock-prediction',
  'package.json',
  'package-lock.json',
  'tsconfig.json',
  'tsconfig.build.json',
  'nest-cli.json',
];
export function sourceState(): {
  codeRevision: string | null;
  codeDirty: boolean;
} {
  try {
    const options = {
      encoding: 'utf8' as const,
      timeout: 5000,
      maxBuffer: 1024 * 1024,
      stdio: ['ignore', 'pipe', 'ignore'] as ['ignore', 'pipe', 'ignore'],
    };
    const codeRevision = execFileSync(
      'git',
      ['rev-parse', 'HEAD'],
      options,
    ).trim();
    if (!/^[a-f0-9]{40}$/.test(codeRevision))
      throw new Error('Invalid revision');
    const changes = execFileSync(
      'git',
      [
        'status',
        '--porcelain',
        '--untracked-files=all',
        '--',
        ...RELEVANT_PATHS,
      ],
      options,
    );
    return { codeRevision, codeDirty: changes.trim().length > 0 };
  } catch {
    return { codeRevision: null, codeDirty: true };
  }
}
