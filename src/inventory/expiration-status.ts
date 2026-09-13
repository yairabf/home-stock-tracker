import { MS_PER_DAY } from '../common/constants';
import { ShelfLifePolicyKind } from '../generated/prisma/enums';

export const EXPIRING_SOON_WINDOW_DAYS = 7;

export type ExpirationStatus =
  'expired' | 'expiring_soon' | 'fresh' | 'nonperishable' | 'unknown';

export type ExpirySource = 'explicit' | 'shelf_life_policy' | 'none';

export interface ExpirationStatusInput {
  purchasedAt: Date;
  explicitExpiresAt: Date | null;
  shelfLifePolicy: {
    kind: ShelfLifePolicyKind;
    shelfLifeDays: number | null;
  } | null;
  asOf: Date;
}

export interface ExpirationStatusResult {
  expiresAt: Date | null;
  status: ExpirationStatus;
  expirySource: ExpirySource;
  shelfLifeDays: number | null;
}

export function evaluateExpirationStatus(
  input: ExpirationStatusInput,
): ExpirationStatusResult {
  if (isValidDate(input.explicitExpiresAt)) {
    return classifiedResult(
      input.explicitExpiresAt,
      'explicit',
      null,
      input.asOf,
    );
  }

  if (
    isFiniteShelfLifePolicy(input.shelfLifePolicy) &&
    isValidDate(input.purchasedAt)
  ) {
    const expiresAt = new Date(
      input.purchasedAt.getTime() +
        input.shelfLifePolicy.shelfLifeDays * MS_PER_DAY,
    );
    return classifiedResult(
      expiresAt,
      'shelf_life_policy',
      input.shelfLifePolicy.shelfLifeDays,
      input.asOf,
    );
  }

  if (isNonperishableShelfLifePolicy(input.shelfLifePolicy)) {
    return {
      expiresAt: null,
      status: 'nonperishable',
      expirySource: 'shelf_life_policy',
      shelfLifeDays: null,
    };
  }

  return {
    expiresAt: null,
    status: 'unknown',
    expirySource: 'none',
    shelfLifeDays: null,
  };
}

function classifiedResult(
  expiresAt: Date,
  expirySource: ExpirySource,
  shelfLifeDays: number | null,
  asOf: Date,
): ExpirationStatusResult {
  const status = expirationStatusFor(expiresAt, asOf);
  return { expiresAt, status, expirySource, shelfLifeDays };
}

function expirationStatusFor(expiresAt: Date, asOf: Date): ExpirationStatus {
  if (!isValidDate(asOf)) return 'unknown';
  if (expiresAt <= asOf) return 'expired';
  if (
    expiresAt <=
    new Date(asOf.getTime() + EXPIRING_SOON_WINDOW_DAYS * MS_PER_DAY)
  ) {
    return 'expiring_soon';
  }
  return 'fresh';
}

function isFiniteShelfLifePolicy(
  policy: ExpirationStatusInput['shelfLifePolicy'],
): policy is {
  kind: Extract<ShelfLifePolicyKind, 'finite'>;
  shelfLifeDays: number;
} {
  return (
    policy?.kind === ShelfLifePolicyKind.finite &&
    policy.shelfLifeDays !== null &&
    Number.isFinite(policy.shelfLifeDays) &&
    policy.shelfLifeDays > 0
  );
}

function isNonperishableShelfLifePolicy(
  policy: ExpirationStatusInput['shelfLifePolicy'],
): boolean {
  return (
    policy?.kind === ShelfLifePolicyKind.nonperishable &&
    policy.shelfLifeDays === null
  );
}

function isValidDate(value: Date | null): value is Date {
  return value !== null && !Number.isNaN(value.getTime());
}
