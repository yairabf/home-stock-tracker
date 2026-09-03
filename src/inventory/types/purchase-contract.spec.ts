import {
  PurchaseTimestampException,
  resolveBatchPurchaseTimestamps,
  resolvePurchaseTimestamp,
} from './purchase-contract';

describe('purchase timestamp contract', () => {
  const receivedAt = new Date('2026-09-03T08:00:00.000Z');

  it('uses a copy of the receipt time when purchasedAt is omitted', () => {
    const resolved = resolvePurchaseTimestamp(undefined, receivedAt);
    expect(resolved).toEqual(receivedAt);
    expect(resolved).not.toBe(receivedAt);
  });

  it('accepts a historical timestamp', () => {
    expect(
      resolvePurchaseTimestamp('2026-09-02T08:00:00.000Z', receivedAt),
    ).toEqual(new Date('2026-09-02T08:00:00.000Z'));
  });

  it.each(['not-a-date', '2026-09-03T08:00:00.001Z'])(
    'rejects invalid or future timestamp %s',
    (purchasedAt) => {
      expect(() => resolvePurchaseTimestamp(purchasedAt, receivedAt)).toThrow(
        PurchaseTimestampException,
      );
    },
  );

  it('applies item, request, then receipt-time precedence', () => {
    expect(
      resolveBatchPurchaseTimestamps(
        {
          purchasedAt: '2026-09-02T08:00:00.000Z',
          items: [{ purchasedAt: '2026-09-01T08:00:00.000Z' }, {}],
        },
        receivedAt,
      ),
    ).toEqual([
      new Date('2026-09-01T08:00:00.000Z'),
      new Date('2026-09-02T08:00:00.000Z'),
    ]);

    expect(resolveBatchPurchaseTimestamps({ items: [{}] }, receivedAt)).toEqual(
      [receivedAt],
    );
  });
});
