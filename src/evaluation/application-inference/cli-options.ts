import { resolve } from 'node:path';
import { z } from 'zod';
import { splitSchema } from './dataset';

export function parseEvaluationOptions<T extends string>(
  args: string[],
  parseTask: (value: unknown) => T,
) {
  const values: Record<string, string> = {};
  let live = false;
  const known = [
    '--task',
    '--dataset',
    '--split',
    '--recorded',
    '--output',
    '--max-requests',
    '--max-duration-ms',
  ];
  for (let i = 0; i < args.length; i++) {
    const key = args[i];
    if (key === '--live') {
      if (live) throw new Error('Duplicate live flag');
      live = true;
      continue;
    }
    if (!known.includes(key) || Object.hasOwn(values, key))
      throw new Error('Unknown or duplicate argument');
    const value = args[++i];
    if (!value || value.startsWith('--')) throw new Error('Missing argument');
    values[key] = value;
  }
  if (
    !values['--dataset'] ||
    !values['--output'] ||
    live === Boolean(values['--recorded'])
  )
    throw new Error('Dataset, new output and exclusive mode required');
  const positive = (key: string, max: number) => {
    if (!values[key] || !/^\d+$/.test(values[key]))
      throw new Error('Live bounds required');
    return z.number().int().positive().max(max).parse(Number(values[key]));
  };
  if (!live && (values['--max-requests'] || values['--max-duration-ms']))
    throw new Error('Offline mode has no network budgets');
  return {
    task: parseTask(values['--task']),
    split: splitSchema.parse(values['--split'] ?? 'held_out'),
    live,
    datasetPath: resolve(values['--dataset']),
    outputPath: resolve(values['--output']),
    recordedPath: values['--recorded']
      ? resolve(values['--recorded'])
      : undefined,
    maxRequests: live ? positive('--max-requests', 1000) : 0,
    maxDurationMs: live ? positive('--max-duration-ms', 1800000) : 0,
  };
}
