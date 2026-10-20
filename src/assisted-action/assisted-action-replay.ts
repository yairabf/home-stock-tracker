import { createHash } from 'node:crypto';
import { ConflictException } from '@nestjs/common';
import { assistedActionRequestSchema } from './assisted-action-request';

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value)
      .filter(([, item]) => item !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function assistedActionRequestHash(raw: unknown): string {
  const request = assistedActionRequestSchema.parse(raw);
  const payload = { operation: request.operation, items: request.items };
  return createHash('sha256').update(canonicalJson(payload)).digest('hex');
}

export function assertAssistedReplayMatches(
  storedHash: string,
  requestHash: string,
): void {
  if (storedHash !== requestHash)
    throw new ConflictException({
      code: 'ASSISTED_ACTION_REQUEST_CONFLICT',
      message: 'This requestId was already used for different action content',
    });
}
