import { MS_PER_DAY } from '../common/constants';
import { PredictedState, ShelfLifePolicyKind } from '../generated/prisma/enums';
import type {
  ForwardStockMaterializationInput,
  ForwardStockMaterializationReason,
  ForwardStockMaterializationResult,
  ShelfLifeEvidence,
} from './types/stock-materialization';

const MISSING_EVIDENCE_PENALTY = 0.2;

export class StockMaterializationException extends Error {
  constructor(message: string) {
    super(message);
    this.name = StockMaterializationException.name;
  }
}

export function materializeStockForward(
  input: ForwardStockMaterializationInput,
): ForwardStockMaterializationResult {
  assertValidInput(input);
  const elapsedDays =
    (input.evaluatedAt.getTime() - input.purchasedAt.getTime()) / MS_PER_DAY;

  if (elapsedDays === 0) {
    return result(input.quantity, 1, 'purchase_recorded', input.evaluatedAt);
  }

  if (isExpired(input.shelfLifePolicy, elapsedDays)) {
    return result(
      0,
      input.shelfLifePolicy!.confidence,
      'stock_expired',
      input.evaluatedAt,
    );
  }

  const consumptionInterval = validConsumptionInterval(
    input.estimatedConsumptionIntervalDays,
  );
  const consumedQuantity = consumptionInterval
    ? elapsedDays / consumptionInterval
    : 0;
  const estimatedQuantity = Math.max(0, input.quantity - consumedQuantity);
  const confidence = evidenceConfidence(
    input.shelfLifePolicy,
    consumptionInterval,
  );

  return result(
    estimatedQuantity,
    confidence,
    fallbackReason(input.shelfLifePolicy, consumptionInterval),
    input.evaluatedAt,
  );
}

function assertValidInput(input: ForwardStockMaterializationInput): void {
  if (!Number.isFinite(input.quantity) || input.quantity <= 0) {
    throw new StockMaterializationException(
      'Purchase quantity must be a finite positive number',
    );
  }
  if (
    Number.isNaN(input.purchasedAt.getTime()) ||
    Number.isNaN(input.evaluatedAt.getTime()) ||
    input.evaluatedAt < input.purchasedAt
  ) {
    throw new StockMaterializationException(
      'Stock evaluation must not precede the purchase timestamp',
    );
  }
  assertValidShelfLifePolicy(input.shelfLifePolicy);
}

function assertValidShelfLifePolicy(policy: ShelfLifeEvidence | null): void {
  if (policy === null) return;
  if (
    !Number.isFinite(policy.confidence) ||
    policy.confidence < 0 ||
    policy.confidence > 1
  ) {
    throw new StockMaterializationException(
      'Shelf-life confidence must be between zero and one',
    );
  }
  const validFiniteDays =
    policy.kind === ShelfLifePolicyKind.finite &&
    policy.shelfLifeDays !== null &&
    Number.isFinite(policy.shelfLifeDays) &&
    policy.shelfLifeDays > 0;
  const validNonperishable =
    policy.kind === ShelfLifePolicyKind.nonperishable &&
    policy.shelfLifeDays === null;
  if (!validFiniteDays && !validNonperishable) {
    throw new StockMaterializationException('Invalid shelf-life policy shape');
  }
}

function isExpired(
  policy: ShelfLifeEvidence | null,
  elapsedDays: number,
): boolean {
  return (
    policy?.kind === ShelfLifePolicyKind.finite &&
    elapsedDays >= policy.shelfLifeDays!
  );
}

function validConsumptionInterval(value: number | null): number | null {
  return value !== null && Number.isFinite(value) && value > 0 ? value : null;
}

function evidenceConfidence(
  policy: ShelfLifeEvidence | null,
  consumptionInterval: number | null,
): number {
  let confidence = policy?.confidence ?? 1;
  if (policy === null) confidence -= MISSING_EVIDENCE_PENALTY;
  if (consumptionInterval === null) confidence -= MISSING_EVIDENCE_PENALTY;
  return Math.round(Math.max(0, confidence) * 100) / 100;
}

function fallbackReason(
  policy: ShelfLifeEvidence | null,
  consumptionInterval: number | null,
): ForwardStockMaterializationReason {
  if (policy === null && consumptionInterval === null) {
    return 'purchase_forward_estimated_missing_shelf_life_and_consumption';
  }
  if (policy === null) {
    return 'purchase_forward_estimated_missing_shelf_life';
  }
  if (consumptionInterval === null) {
    return 'purchase_forward_estimated_missing_consumption';
  }
  return 'purchase_forward_estimated';
}

function result(
  estimatedQuantity: number,
  confidence: number,
  reason: ForwardStockMaterializationReason,
  evaluatedAt: Date,
): ForwardStockMaterializationResult {
  return {
    estimatedQuantity,
    estimatedState:
      estimatedQuantity === 0
        ? PredictedState.probably_out
        : PredictedState.likely_available,
    confidence,
    reason,
    evaluatedAt: new Date(evaluatedAt),
  };
}
