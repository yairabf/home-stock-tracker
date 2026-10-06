import { execFileSync } from 'node:child_process';
export { readBoundedJson } from '../stock-prediction/cli-io';

const RELEVANT_PATHS = [
  'src',
  'prisma',
  'evaluation',
  'scripts/evaluate-application-inference.ts',
  'scripts/evaluate-stock-workflow.ts',
  'scripts/evaluate-perishability-comparison.ts',
  'package.json',
  'package-lock.json',
  'tsconfig.json',
  'tsconfig.build.json',
  'nest-cli.json',
];
export function sourceState() {
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
    const dirtyPaths = execFileSync(
      'git',
      [
        'status',
        '--porcelain',
        '--untracked-files=all',
        '--',
        ...RELEVANT_PATHS,
      ],
      options,
    )
      .trim()
      .split('\n')
      .filter(Boolean);
    return { codeRevision, codeDirty: dirtyPaths.length > 0, dirtyPaths };
  } catch {
    return { codeRevision: null, codeDirty: true, dirtyPaths: [] };
  }
}
