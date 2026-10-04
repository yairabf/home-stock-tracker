import { createHash } from 'node:crypto';
import { z } from 'zod';
import { InventoryEventType, ProductType } from '../../generated/prisma/enums';

export const REPLAY_VERSION = 'stock-history-replay-v1';
export const idSchema = z.string().regex(/^[a-z][a-z0-9_-]{0,63}$/);
export const splitSchema = z.enum(['tuning', 'held_out']);
const date = z.iso.datetime({ offset: true });
const count = z.number().int().nonnegative().max(100);
const reviewSchema = z
  .object({
    author: idSchema,
    status: z.enum(['pending', 'reviewed']),
    reviewer: idSchema.nullable(),
    reviewedAt: date.nullable(),
    evidenceReference: idSchema.nullable(),
    episodeComplete: z.boolean(),
  })
  .strict()
  .refine(
    (r) =>
      r.status === 'pending'
        ? r.reviewer === null && r.reviewedAt === null
        : r.reviewer !== null &&
          r.reviewer !== r.author &&
          r.reviewedAt !== null,
    'Independent review provenance required',
  );
export const eventSchema = z
  .object({
    id: idSchema,
    eventType: z.enum(InventoryEventType),
    occurredAt: date,
    knownAt: date,
    quantity: z.number().finite().nonnegative().nullable(),
    unit: z.string().trim().min(1).max(64).nullable(),
  })
  .strict()
  .refine(
    (e) => Date.parse(e.knownAt) >= Date.parse(e.occurredAt),
    'Event cannot be known before occurrence',
  );
export const confirmationSchema = z
  .object({
    evidenceReference: idSchema,
    confirmedAt: date,
    state: z.enum(['available', 'low', 'out']),
    sourceType: z.enum([
      'STOCK_CONFIRMED',
      'STOCK_LOW',
      'STOCK_OUT',
      'STOCK_CORRECTED',
    ]),
  })
  .strict()
  .refine(
    (c) =>
      c.sourceType === 'STOCK_CORRECTED' ||
      c.state ===
        { STOCK_CONFIRMED: 'available', STOCK_LOW: 'low', STOCK_OUT: 'out' }[
          c.sourceType
        ],
    'Confirmation state must match direct observation',
  );
export const caseSchema = z
  .object({
    id: idSchema,
    productGroupId: idSchema,
    episodeId: idSchema,
    split: splitSchema,
    source: z.enum(['authored', 'historical']),
    tags: z.array(idSchema).min(1).max(20),
    asOf: date,
    product: z
      .object({
        knownAt: date,
        predictionEnabled: z.boolean(),
        productType: z.enum(ProductType).nullable(),
        isPerishable: z.boolean(),
        predictionStrategy: idSchema.nullable(),
      })
      .strict(),
    household: z
      .object({ knownAt: date, adultsCount: count, childrenCount: count })
      .strict(),
    events: z.array(eventSchema).max(1000),
    confirmations: z.array(confirmationSchema).max(20),
    review: reviewSchema,
  })
  .strict()
  .superRefine((c, ctx) => {
    const invalid = (message: string) =>
      ctx.addIssue({ code: 'custom', message });
    if (
      Date.parse(c.product.knownAt) > Date.parse(c.asOf) ||
      Date.parse(c.household.knownAt) > Date.parse(c.asOf)
    )
      invalid('Snapshot is from the future');
    if (new Set(c.events.map((e) => e.id)).size !== c.events.length)
      invalid('Duplicate event');
    if (
      c.confirmations.some(
        (x) => Date.parse(x.confirmedAt) <= Date.parse(c.asOf),
      )
    )
      invalid('Outcome must follow cutoff');
    if (
      c.source === 'historical' &&
      c.review.status === 'reviewed' &&
      (!c.review.evidenceReference || !c.review.episodeComplete)
    )
      invalid('Historical attestation missing');
  });
export const datasetSchema = z
  .object({
    schemaVersion: z.literal(1),
    version: idSchema,
    replayVersion: z.literal(REPLAY_VERSION),
    cases: z.array(caseSchema).min(1).max(200),
  })
  .strict()
  .superRefine((d, ctx) => {
    const invalid = (message: string) =>
      ctx.addIssue({ code: 'custom', message });
    for (const key of ['id', 'episodeId'] as const)
      if (new Set(d.cases.map((c) => c[key])).size !== d.cases.length)
        invalid(`Duplicate ${key}`);
    const groups = new Map<string, string>();
    const references = new Set<string>();
    for (const c of d.cases) {
      if (
        groups.has(c.productGroupId) &&
        groups.get(c.productGroupId) !== c.split
      )
        invalid('Product group crosses splits');
      groups.set(c.productGroupId, c.split);
      for (const x of c.confirmations) {
        if (references.has(x.evidenceReference))
          invalid('Duplicate confirmation reference');
        references.add(x.evidenceReference);
      }
    }
  });
export type StockCase = z.output<typeof caseSchema>;
export type StockDataset = z.output<typeof datasetSchema>;
export type StockSplit = z.output<typeof splitSchema>;
export function parseDataset(value: unknown): StockDataset {
  const result = datasetSchema.safeParse(value);
  if (!result.success) throw new Error('Invalid stock evaluation dataset');
  return result.data;
}
export function hash(value: unknown): string {
  const serialized = JSON.stringify(value, (_key: string, item: unknown) =>
    item !== null && typeof item === 'object' && !Array.isArray(item)
      ? Object.fromEntries(
          Object.entries(item).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
        )
      : item,
  );
  return createHash('sha256').update(serialized).digest('hex');
}
export function inputEvents(c: StockCase) {
  const cutoff = Date.parse(c.asOf);
  return c.events
    .filter(
      (e) =>
        Date.parse(e.occurredAt) <= cutoff && Date.parse(e.knownAt) <= cutoff,
    )
    .sort(
      (a, b) =>
        Date.parse(b.occurredAt) - Date.parse(a.occurredAt) ||
        (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
    );
}
const MUTATIONS: InventoryEventType[] = [
  'PURCHASED',
  'RESTOCKED',
  'STOCK_SET',
  'STOCK_CONSUMED',
  'STOCK_CORRECTED',
];
export function groundTruth(c: StockCase): {
  state: 'available' | 'low' | 'out' | null;
  reason: string | null;
  lagHours: number | null;
} {
  const confirmations = [...c.confirmations].sort(
    (a, b) => Date.parse(a.confirmedAt) - Date.parse(b.confirmedAt),
  );
  const first = confirmations[0];
  if (!first)
    return { state: null, reason: 'missing_confirmation', lagHours: null };
  const lagHours =
    (Date.parse(first.confirmedAt) - Date.parse(c.asOf)) / 3_600_000;
  const excluded = (reason: string) => ({ state: null, reason, lagHours });
  if (lagHours > 24) return excluded('late_confirmation');
  if (
    confirmations.some(
      (x) =>
        Date.parse(x.confirmedAt) === Date.parse(first.confirmedAt) &&
        x.state !== first.state,
    )
  )
    return excluded('conflicting_confirmation');
  if (
    c.events.some(
      (e) =>
        MUTATIONS.includes(e.eventType) &&
        Date.parse(e.occurredAt) > Date.parse(c.asOf) &&
        Date.parse(e.occurredAt) <= Date.parse(first.confirmedAt),
    )
  )
    return excluded('intervening_mutation');
  if (c.source === 'historical' && !c.review.episodeComplete)
    return excluded('incomplete_episode');
  return { state: first.state, reason: null, lagHours };
}
