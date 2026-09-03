import { MS_PER_DAY } from '../common/constants';
import { PredictedState, ShelfLifePolicyKind } from '../generated/prisma/enums';
import type {
  ForwardStockMaterializationInput,
  ForwardStockMaterializationReason,
  ForwardStockMaterializationResult,
  ShelfLifeEvidence,
  DailyStockMaterializationInput,
  DailyStockMaterializationResult,
} from './types/stock-materialization';

const MISSING_EVIDENCE_PENALTY = 0.2;

export function materializeDailyStock(
  input: DailyStockMaterializationInput,
): DailyStockMaterializationResult {
  assertDailyInput(input);
  const elapsedDays =
    (input.evaluatedAt.getTime() - input.previousEvaluatedAt.getTime()) /
    MS_PER_DAY;
  const ageDays =
    (input.evaluatedAt.getTime() - input.recordedAt.getTime()) / MS_PER_DAY;
  const consumptionInterval = validConsumptionInterval(
    input.estimatedConsumptionIntervalDays,
  );
  const expectedConsumption = consumptionInterval
    ? elapsedDays / consumptionInterval
    : 0;
  const confidence = evidenceConfidence(
    input.shelfLifePolicy,
    consumptionInterval,
  );

  if (input.explicitState === PredictedState.probably_out) {
    return dailyResult(0, PredictedState.probably_out, 1, 'daily_explicit_out');
  }
  if (isExpired(input.shelfLifePolicy, ageDays)) {
    return dailyResult(
      0,
      PredictedState.probably_out,
      confidence,
      'daily_stock_expired',
    );
  }
  if (input.estimatedQuantity === null) {
    if (input.explicitState === PredictedState.probably_low) {
      return dailyResult(
        null,
        PredictedState.probably_low,
        1,
        'daily_explicit_low',
      );
    }
    return dailyResult(
      null,
      PredictedState.uncertain,
      confidence,
      'daily_stock_uncertain',
    );
  }

  const estimatedQuantity = Math.max(
    0,
    input.estimatedQuantity - expectedConsumption,
  );
  if (estimatedQuantity === 0) {
    return dailyResult(
      0,
      PredictedState.probably_out,
      confidence,
      'daily_stock_depleted',
    );
  }
  if (input.explicitState === PredictedState.probably_low) {
    return dailyResult(
      estimatedQuantity,
      PredictedState.probably_low,
      1,
      'daily_explicit_low',
    );
  }
  const isLow =
    consumptionInterval !== null &&
    estimatedQuantity <= 1 / consumptionInterval;
  return dailyResult(
    estimatedQuantity,
    isLow ? PredictedState.probably_low : PredictedState.likely_available,
    confidence,
    isLow ? 'daily_stock_low' : 'daily_stock_available',
  );

  function dailyResult(
    quantity: number | null,
    state: PredictedState,
    resultConfidence: number,
    reason: DailyStockMaterializationResult['reason'],
  ): DailyStockMaterializationResult {
    return {
      estimatedQuantity: quantity,
      estimatedState: state,
      confidence: resultConfidence,
      reason,
      evaluatedAt: new Date(input.evaluatedAt),
      elapsedDays,
      expectedConsumption,
    };
  }
}

function assertDailyInput(input: DailyStockMaterializationInput): void {
  if (
    (input.estimatedQuantity !== null &&
      (!Number.isFinite(input.estimatedQuantity) ||
        input.estimatedQuantity < 0)) ||
    Number.isNaN(input.recordedAt.getTime()) ||
    Number.isNaN(input.previousEvaluatedAt.getTime()) ||
    Number.isNaN(input.evaluatedAt.getTime()) ||
    input.evaluatedAt < input.previousEvaluatedAt ||
    input.evaluatedAt < input.recordedAt
  ) {
    throw new StockMaterializationException(
      'Invalid daily stock projection input',
    );
  }
  assertValidShelfLifePolicy(input.shelfLifePolicy);
}

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
