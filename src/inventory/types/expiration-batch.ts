import { z } from 'zod';

const expiresAtSchema = z.iso.datetime({ offset: true });

export interface RecordExpirationBatchInput {
  purchaseEventId: string;
  expiresAt: string;
  source: string;
}

export function parseExpirationTimestamp(expiresAt: string): Date | null {
  const parsed = expiresAtSchema.safeParse(expiresAt);
  if (!parsed.success) return null;

  const value = new Date(parsed.data);
  return Number.isNaN(value.getTime()) ? null : value;
}
