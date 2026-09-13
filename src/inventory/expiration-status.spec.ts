import { ShelfLifePolicyKind } from '../generated/prisma/enums';
import {
  evaluateExpirationStatus,
  EXPIRING_SOON_WINDOW_DAYS,
} from './expiration-status';

const asOf = new Date('2026-09-10T12:00:00.000Z');
const purchasedAt = new Date('2026-09-01T12:00:00.000Z');

describe('evaluateExpirationStatus', () => {
  it('uses an explicit expiry timestamp instead of a shelf-life policy', () => {
    expect(
      evaluateExpirationStatus({
        purchasedAt,
        explicitExpiresAt: new Date('2026-09-20T12:00:00.000Z'),
        shelfLifePolicy: {
          kind: ShelfLifePolicyKind.finite,
          shelfLifeDays: 2,
        },
        asOf,
      }),
    ).toMatchObject({
      expiresAt: new Date('2026-09-20T12:00:00.000Z'),
      status: 'fresh',
      expirySource: 'explicit',
      shelfLifeDays: null,
    });
  });

  it.each([
    ['expired', '2026-09-10T12:00:00.000Z'],
    [
      'expiring_soon',
      new Date(
        asOf.getTime() + EXPIRING_SOON_WINDOW_DAYS * 24 * 60 * 60 * 1000,
      ).toISOString(),
    ],
    ['fresh', '2026-09-17T12:00:00.001Z'],
  ])('classifies %s at the status boundary', (status, explicitExpiresAt) => {
    expect(
      evaluateExpirationStatus({
        purchasedAt,
        explicitExpiresAt: new Date(explicitExpiresAt),
        shelfLifePolicy: null,
        asOf,
      }),
    ).toMatchObject({ status, expirySource: 'explicit' });
  });

  it('derives a finite-policy expiry in elapsed UTC time', () => {
    expect(
      evaluateExpirationStatus({
        purchasedAt,
        explicitExpiresAt: null,
        shelfLifePolicy: {
          kind: ShelfLifePolicyKind.finite,
          shelfLifeDays: 10,
        },
        asOf,
      }),
    ).toMatchObject({
      expiresAt: new Date('2026-09-11T12:00:00.000Z'),
      status: 'expiring_soon',
      expirySource: 'shelf_life_policy',
      shelfLifeDays: 10,
    });
  });

  it('marks a valid nonperishable policy without inventing an expiry date', () => {
    expect(
      evaluateExpirationStatus({
        purchasedAt,
        explicitExpiresAt: null,
        shelfLifePolicy: {
          kind: ShelfLifePolicyKind.nonperishable,
          shelfLifeDays: null,
        },
        asOf,
      }),
    ).toEqual({
      expiresAt: null,
      status: 'nonperishable',
      expirySource: 'shelf_life_policy',
      shelfLifeDays: null,
    });
  });

  it.each([
    null,
    { kind: ShelfLifePolicyKind.finite, shelfLifeDays: null },
    { kind: ShelfLifePolicyKind.finite, shelfLifeDays: 0 },
    { kind: ShelfLifePolicyKind.nonperishable, shelfLifeDays: 3 },
  ])(
    'returns unknown for absent or malformed shelf-life evidence',
    (shelfLifePolicy) => {
      expect(
        evaluateExpirationStatus({
          purchasedAt,
          explicitExpiresAt: null,
          shelfLifePolicy,
          asOf,
        }),
      ).toEqual({
        expiresAt: null,
        status: 'unknown',
        expirySource: 'none',
        shelfLifeDays: null,
      });
    },
  );
});
