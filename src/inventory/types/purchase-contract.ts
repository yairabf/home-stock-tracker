export const MAX_BATCH_PURCHASE_ITEMS = 100;

export interface BatchPurchaseTimestampInput {
  purchasedAt?: string;
  items: Array<{ purchasedAt?: string }>;
}

export class PurchaseTimestampException extends Error {
  constructor(message: string) {
    super(message);
    this.name = PurchaseTimestampException.name;
  }
}

export function resolvePurchaseTimestamp(
  purchasedAt: string | undefined,
  receivedAt: Date,
): Date {
  const resolved =
    purchasedAt === undefined ? receivedAt : new Date(purchasedAt);
  if (Number.isNaN(resolved.getTime())) {
    throw new PurchaseTimestampException(
      'purchasedAt must be a valid ISO 8601 timestamp',
    );
  }
  if (resolved.getTime() > receivedAt.getTime()) {
    throw new PurchaseTimestampException(
      'purchasedAt must not be in the future',
    );
  }
  return new Date(resolved);
}

export function resolveBatchPurchaseTimestamps(
  input: BatchPurchaseTimestampInput,
  receivedAt: Date,
): Date[] {
  return input.items.map((item) =>
    resolvePurchaseTimestamp(item.purchasedAt ?? input.purchasedAt, receivedAt),
  );
}
