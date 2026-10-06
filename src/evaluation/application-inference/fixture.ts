import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseDataset } from './dataset';

export function safetyDataset() {
  return parseDataset(
    JSON.parse(
      readFileSync(
        join(
          process.cwd(),
          'evaluation/application-inference/safety-cases.v1.json',
        ),
        'utf8',
      ),
    ),
  );
}
