import { PredictedState } from '../../generated/prisma/enums';
import type { DeterministicSignalsDto } from './estimation-response.dto';

export enum InventoryTrackingStatus {
  tracked = 'tracked',
  untracked = 'untracked',
}

interface InventoryReadProjection {
  unit: string;
  recordedQuantity: number | null;
  recordedAt: Date;
  recordedSource: string;
  recordedEventId: string;
  estimatedQuantity: number | null;
  estimatedState: PredictedState;
  confidence: number;
  reason: string;
  predictionId: string | null;
  evaluatedAt: Date;
  prediction?: {
    recommendedAction: string | null;
    deterministicSignals: unknown;
    llmResult: unknown;
  } | null;
}

export interface InventoryReadEntity {
  id: string;
  names: Array<{ displayName: string }>;
  stockProjection: InventoryReadProjection | null;
}

export class InventoryItemResponseDto {
  productId: string;
  productName: string;
  trackingStatus: InventoryTrackingStatus;
  unit: string | null;
  recordedQuantity: number | null;
  recordedAt: Date | null;
  recordedSource: string | null;
  recordedEventId: string | null;
  estimatedQuantity: number | null;
  estimatedState: PredictedState | null;
  confidence: number | null;
  reason: string | null;
  predictionId: string | null;
  evaluatedAt: Date | null;

  static fromEntity(entity: InventoryReadEntity): InventoryItemResponseDto {
    const dto = new InventoryItemResponseDto();
    const projection = entity.stockProjection;
    dto.productId = entity.id;
    dto.productName = entity.names[0]?.displayName ?? '';
    dto.trackingStatus = projection
      ? InventoryTrackingStatus.tracked
      : InventoryTrackingStatus.untracked;
    dto.unit = projection?.unit ?? null;
    dto.recordedQuantity = presentQuantity(
      projection?.recordedQuantity ?? null,
      projection?.unit,
    );
    dto.recordedAt = projection?.recordedAt ?? null;
    dto.recordedSource = projection?.recordedSource ?? null;
    dto.recordedEventId = projection?.recordedEventId ?? null;
    dto.estimatedQuantity = presentQuantity(
      projection?.estimatedQuantity ?? null,
      projection?.unit,
    );
    dto.estimatedState = projection?.estimatedState ?? null;
    dto.confidence = projection?.confidence ?? null;
    dto.reason = projection?.reason ?? null;
    dto.predictionId = projection?.predictionId ?? null;
    dto.evaluatedAt = projection?.evaluatedAt ?? null;
    return dto;
  }
}

export class InventoryEstimateResponseDto extends InventoryItemResponseDto {
  predictedState: PredictedState;
  confidenceScore: number;
  recommendedAction: string | null;
  llmContributed: boolean;
  deterministicSignals: DeterministicSignalsDto;

  static fromEntity(entity: InventoryReadEntity): InventoryEstimateResponseDto {
    const dto = Object.assign(
      new InventoryEstimateResponseDto(),
      InventoryItemResponseDto.fromEntity(entity),
    );
    const projection = entity.stockProjection;
    dto.predictedState = projection?.estimatedState ?? PredictedState.uncertain;
    dto.confidenceScore = projection?.confidence ?? 0;
    dto.reason = projection?.reason ?? 'Stock is not tracked';
    dto.recommendedAction = projection?.prediction?.recommendedAction ?? null;
    dto.llmContributed = projection?.prediction?.llmResult != null;
    dto.deterministicSignals =
      (projection?.prediction
        ?.deterministicSignals as unknown as DeterministicSignalsDto) ??
      emptyDeterministicSignals();
    return dto;
  }
}

export class HouseholdInventoryResponseDto {
  current: InventoryItemResponseDto[];
  uncertain: InventoryItemResponseDto[];
}

const DISCRETE_UNITS = new Set([
  'item',
  'items',
  'unit',
  'units',
  'count',
  'each',
  'piece',
  'pieces',
]);

function presentQuantity(
  quantity: number | null,
  unit: string | undefined,
): number | null {
  if (quantity === null) {
    return null;
  }
  const precision =
    unit && DISCRETE_UNITS.has(unit.trim().toLowerCase()) ? 0 : 2;
  const scale = 10 ** precision;
  return Math.round(quantity * scale) / scale;
}

function emptyDeterministicSignals(): DeterministicSignalsDto {
  return {
    lastPurchaseAt: null,
    lastLowStockSignalAt: null,
    lastStockConfirmationAt: null,
    daysSinceLastPurchase: null,
    daysSinceLastLowSignal: null,
    productType: null,
    eventCount: 0,
    coldStart: true,
    hasLearnedStatistics: false,
    avgPurchaseIntervalDays: null,
    avgNeedIntervalDays: null,
    estimatedConsumptionIntervalDays: null,
    observationCount: 0,
    isPerishable: false,
    predictionStrategy: null,
    householdContext: null,
    authoritativeDirectSignal: false,
  };
}
