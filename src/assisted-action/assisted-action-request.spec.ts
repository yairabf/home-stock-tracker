import { assistedActionResponseSchema } from './assisted-action-response.schema';
import { ConflictException } from '@nestjs/common';
import {
  assistedActionRequestSchema,
  parseAssistedActionRequest,
} from './assisted-action-request';
import {
  assertAssistedReplayMatches,
  assistedActionRequestHash,
} from './assisted-action-replay';
import { assistedIdentityResultSchema } from './assisted-action-result';

const requestId = '7ac2eb19-ddae-44b3-ad45-324ae4dba321';
const productId = '4aa264e5-c7ec-4ebf-8f40-5f7b48dd0107';
const request = (operation = 'grocery_add', item: object = {}) => ({
  requestId,
  operation,
  items: [{ productName: 'milk', ...item }],
});

describe('assisted action contracts', () => {
  it('preserves raw meaning, explicit false and unknown metadata', () => {
    const result = parseAssistedActionRequest(
      request('grocery_add', {
        productName: '  Nestle חלב 3%  ',
        metadata: { isPerishable: false, category: null },
      }),
    );
    expect(result.items[0]).toEqual({
      productName: 'Nestle חלב 3%',
      metadata: { isPerishable: false, category: null },
      ifPendingExists: 'return_existing',
    });
  });

  it.each([
    { ...request(), items: [] },
    {
      ...request(),
      items: Array.from({ length: 101 }, () => ({ productName: 'milk' })),
    },
    request('grocery_add', { productName: ' ' }),
    request('grocery_add', { productName: 'x'.repeat(301) }),
    request('grocery_add', { productId }),
    { ...request(), items: [{}] },
    request('stock_set'),
    request('purchase'),
    request('decrement', { quantity: 1 }),
    request('grocery_add', { quantity: 0 }),
    request('stock_set', { quantity: -1 }),
    request('purchase', { quantity: Infinity }),
    request('purchase', { quantity: NaN }),
    request('purchase', { quantity: '2' }),
    request('stock_set', { quantity: 1, ifPendingExists: 'return_existing' }),
    request('grocery_add', { purchasedAt: '2026-10-01T00:00:00Z' }),
    request('grocery_add', { operation: 'purchase' }),
    request('grocery_add', { metadata: { isPerishable: 'false' } }),
    request('grocery_add', { metadata: { predictionEnabled: true } }),
    { ...request(), source: 'mcp' },
    { ...request(), requestId: 'invalid' },
  ])('rejects invalid input %#', (raw) => {
    expect(assistedActionRequestSchema.safeParse(raw).success).toBe(false);
  });

  it.each(['stock_set', 'purchase'])(
    'accepts positive %s quantities',
    (operation) => {
      expect(
        parseAssistedActionRequest(request(operation, { quantity: 2 }))
          .operation,
      ).toBe(operation);
    },
  );

  it('accepts 100 items and an ID-only reference', () => {
    expect(
      parseAssistedActionRequest({
        ...request(),
        items: Array.from({ length: 100 }, () => ({ productId })),
      }).items,
    ).toHaveLength(100);
  });

  it('checks purchase time against the arrival clock', () => {
    const receivedAt = new Date('2026-10-20T12:00:00Z');
    expect(() =>
      parseAssistedActionRequest(
        request('purchase', {
          quantity: 1,
          purchasedAt: '2026-10-20T12:00:01Z',
        }),
        receivedAt,
      ),
    ).toThrow('future');
    expect(
      parseAssistedActionRequest(
        request('purchase', {
          quantity: 1,
          purchasedAt: '2026-10-20T14:00:00+02:00',
        }),
        receivedAt,
      ).operation,
    ).toBe('purchase');
    expect(() =>
      parseAssistedActionRequest(
        request('purchase', {
          quantity: 1,
          purchasedAt: 'yesterday',
        }),
        receivedAt,
      ),
    ).toThrow();
  });

  it('hashes validated payload independent of key order, UUID case and defaults', () => {
    const first = request('grocery_add', {
      metadata: { isPerishable: false, category: 'dairy' },
    });
    const second = {
      items: [
        {
          metadata: { category: 'dairy', isPerishable: false },
          productName: ' milk ',
          ifPendingExists: 'return_existing',
        },
      ],
      operation: 'grocery_add',
      requestId: requestId.toUpperCase(),
    };
    expect(assistedActionRequestHash(first)).toMatch(/^[a-f0-9]{64}$/);
    expect(assistedActionRequestHash(first)).toBe(
      assistedActionRequestHash(second),
    );
  });

  it.each([
    request('grocery_add', { quantity: 2 }),
    request('grocery_add', { metadata: { isPerishable: false } }),
    request('grocery_add', { productName: 'oat milk' }),
    request('grocery_add', { ifPendingExists: 'create_separate' }),
    request('stock_set', { quantity: 1 }),
  ])('rejects replay with changed action content %#', (changed) => {
    expect(() =>
      assertAssistedReplayMatches(
        assistedActionRequestHash(request()),
        assistedActionRequestHash(changed),
      ),
    ).toThrow(ConflictException);
  });

  it('preserves order, null/false and omitted quantity in the fingerprint', () => {
    const hash = assistedActionRequestHash;
    expect(hash(request())).not.toBe(
      hash(request('grocery_add', { quantity: 1 })),
    );
    expect(
      hash(request('grocery_add', { metadata: { isPerishable: false } })),
    ).not.toBe(
      hash(request('grocery_add', { metadata: { isPerishable: null } })),
    );
    const items = [{ productName: 'milk' }, { productName: 'bread' }];
    expect(hash({ ...request(), items })).not.toBe(
      hash({ ...request(), items: [...items].reverse() }),
    );
    expect(() =>
      assertAssistedReplayMatches(hash(request()), hash(request())),
    ).not.toThrow();
  });

  it('rejects invented provider fields and malformed decisions', () => {
    expect(assistedIdentityResultSchema.parse({ outcome: 'unknown' })).toEqual({
      outcome: 'unknown',
    });
    expect(
      assistedIdentityResultSchema.parse({
        outcome: 'new',
        canonicalName: ' milk ',
        confidence: 0.95,
      }).canonicalName,
    ).toBe('milk');
    for (const value of [
      { outcome: 'new', canonicalName: '', confidence: 0.95 },
      { outcome: 'existing', productId: 'invented', confidence: 0.95 },
      { outcome: 'existing', productId, confidence: 1.1 },
      { outcome: 'unknown', aliases: ['milk'] },
    ])
      expect(assistedIdentityResultSchema.safeParse(value).success).toBe(false);
  });
});

describe('assisted response contracts', () => {
  it('validates failure outcomes without permitting success receipts', () => {
    expect(
      assistedActionResponseSchema.safeParse({
        outcome: 'needs_input',
        requestId,
        issues: [{ inputIndex: 0, code: 'missing_unit' }],
      }).success,
    ).toBe(true);
    expect(
      assistedActionResponseSchema.safeParse({
        outcome: 'unavailable',
        requestId,
        retryable: true,
        code: 'provider_deadline',
      }).success,
    ).toBe(true);
    for (const value of [
      { outcome: 'needs_input', requestId, issues: [] },
      {
        outcome: 'needs_input',
        requestId,
        issues: [{ inputIndex: -1, code: 'missing_unit' }],
      },
      {
        outcome: 'unavailable',
        requestId,
        retryable: true,
        code: 'provider_deadline',
        receipts: [],
      },
      { outcome: 'applied', requestId, operation: 'purchase', receipts: [] },
    ])
      expect(assistedActionResponseSchema.safeParse(value).success).toBe(false);
  });

  it('requires the receipt shape belonging to the action', () => {
    const receipt = {
      inputIndex: 0,
      suppliedName: 'milk',
      productId,
      canonicalName: 'milk',
      catalogAction: 'existing',
      unresolvedMetadata: [],
      itemAction: 'returned_existing',
      groceryItem: {
        id: requestId,
        productId,
        productName: 'milk',
        category: null,
        requestedQuantity: 1,
        unit: null,
        dateAdded: '2026-10-20T00:00:00Z',
        status: 'pending',
        note: null,
        source: 'mcp',
        relatedInventoryEventId: null,
      },
    };
    const result = {
      outcome: 'applied',
      requestId,
      operation: 'grocery_add',
      receipts: [receipt],
    };
    expect(assistedActionResponseSchema.safeParse(result).success).toBe(true);
    expect(
      assistedActionResponseSchema.safeParse({
        ...result,
        operation: 'purchase',
      }).success,
    ).toBe(false);
  });
});
