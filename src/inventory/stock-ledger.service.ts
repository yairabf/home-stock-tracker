import { Injectable } from '@nestjs/common';
import { PredictedState } from '../generated/prisma/enums';
import {
  StockLedgerException,
  StockStateConflictException,
} from './stock-ledger.exception';
import {
  StockDecrementInput,
  StockFactInput,
  StockLedgerTransaction,
  StockMarkOutInput,
  StockObservationInput,
  StockSetInput,
  StockUnitInput,
} from './types/stock-ledger';

const EXPLICIT_SIGNAL_CONFIDENCE = 1;
const DEFAULT_STOCK_UNIT = 'item';

@Injectable()
export class StockLedgerService {
  resolveCanonicalUnit(input: StockUnitInput): string {
    const existingUnit = this.normalizeUnit(input.existingUnit, 'existing');
    const explicitUnit = this.normalizeUnit(input.explicitUnit, 'explicit');
    const groceryUnit = this.normalizeUnit(input.groceryUnit, 'grocery');
    const suppliedUnit = explicitUnit ?? groceryUnit;

    if (existingUnit) {
      if (suppliedUnit && suppliedUnit !== existingUnit) {
        throw new StockLedgerException(
          `Stock unit must remain ${existingUnit}; received ${suppliedUnit}`,
        );
      }
      return existingUnit;
    }

    return (
      suppliedUnit ??
      this.normalizeUnit(input.typicalUnit, 'typical') ??
      DEFAULT_STOCK_UNIT
    );
  }

  async resetWithinTransaction(
    tx: StockLedgerTransaction,
    input: StockFactInput,
  ) {
    this.assertPositiveQuantity(input.quantity);
    const existing = await tx.stockProjection.findUnique({
      where: { productId: input.productId },
    });
    if (existing && existing.recordedAt > input.occurredAt) {
      return existing;
    }
    const unit = this.resolveCanonicalUnit({
      ...input,
      existingUnit: existing?.unit,
    });
    const materialization = input.materialization;
    const data = {
      unit,
      recordedQuantity: input.quantity,
      recordedAt: input.occurredAt,
      recordedSource: input.source,
      recordedEventId: input.eventId,
      estimatedQuantity: materialization?.estimatedQuantity ?? input.quantity,
      estimatedState:
        materialization?.estimatedState ?? PredictedState.likely_available,
      confidence: materialization?.confidence ?? EXPLICIT_SIGNAL_CONFIDENCE,
      reason: materialization?.reason ?? input.reason,
      predictionId: null,
      evaluatedAt: materialization?.evaluatedAt ?? input.occurredAt,
    };

    return tx.stockProjection.upsert({
      where: { productId: input.productId },
      create: { productId: input.productId, ...data },
      update: data,
    });
  }

  async setWithinTransaction(tx: StockLedgerTransaction, input: StockSetInput) {
    this.assertPositiveQuantity(input.quantity);
    const existing = await tx.stockProjection.findUnique({
      where: { productId: input.productId },
    });
    if (existing !== null && this.isStale(existing, input.occurredAt)) {
      return existing;
    }

    const unit = this.resolveSetUnit({
      ...input,
      existingUnit: existing?.unit,
    });
    const data = this.absoluteFactData(
      input,
      unit,
      PredictedState.likely_available,
    );
    return tx.stockProjection.upsert({
      where: { productId: input.productId },
      create: { productId: input.productId, ...data },
      update: data,
    });
  }

  async decrementWithinTransaction(
    tx: StockLedgerTransaction,
    input: StockDecrementInput,
  ) {
    this.assertPositiveQuantity(input.quantity);
    const existing = await tx.stockProjection.findUnique({
      where: { productId: input.productId },
    });
    if (
      existing === null ||
      typeof existing.estimatedQuantity !== 'number' ||
      !Number.isFinite(existing.estimatedQuantity)
    ) {
      throw new StockStateConflictException(
        'Stock must have a numeric estimate before it can be decremented',
      );
    }
    if (existing !== null && this.isStale(existing, input.occurredAt)) {
      return existing;
    }

    const currentEstimate = existing.estimatedQuantity;
    this.resolveCanonicalUnit({
      ...input,
      existingUnit: existing.unit,
    });
    const estimatedQuantity = Math.max(0, currentEstimate - input.quantity);
    return tx.stockProjection.update({
      where: { productId: input.productId },
      data: {
        estimatedQuantity,
        estimatedState:
          estimatedQuantity === 0
            ? PredictedState.probably_out
            : existing.estimatedState,
        reason: input.reason,
        predictionId: null,
        evaluatedAt: input.occurredAt,
      },
    });
  }

  async markOutWithinTransaction(
    tx: StockLedgerTransaction,
    input: StockMarkOutInput,
  ) {
    const existing = await tx.stockProjection.findUnique({
      where: { productId: input.productId },
    });
    if (existing !== null && this.isStale(existing, input.occurredAt)) {
      return existing;
    }

    const unit = this.resolveCanonicalUnit({
      existingUnit: existing?.unit,
      typicalUnit: input.typicalUnit,
    });
    const data = this.absoluteFactData(
      { ...input, quantity: 0 },
      unit,
      PredictedState.probably_out,
    );
    return tx.stockProjection.upsert({
      where: { productId: input.productId },
      create: { productId: input.productId, ...data },
      update: data,
    });
  }

  async applyObservationWithinTransaction(
    tx: StockLedgerTransaction,
    input: StockObservationInput,
  ) {
    const existing = await tx.stockProjection.findUnique({
      where: { productId: input.productId },
    });
    if (existing && existing.evaluatedAt > input.occurredAt) {
      return existing;
    }
    const unit = this.resolveCanonicalUnit({
      ...input,
      existingUnit: existing?.unit,
    });

    if (input.state === PredictedState.probably_out) {
      return this.upsertOutObservation(tx, input, unit);
    }

    const estimate = {
      unit,
      estimatedState: PredictedState.probably_low,
      confidence: EXPLICIT_SIGNAL_CONFIDENCE,
      reason: input.reason,
      predictionId: null,
      evaluatedAt: input.occurredAt,
    };
    return tx.stockProjection.upsert({
      where: { productId: input.productId },
      create: {
        productId: input.productId,
        recordedQuantity: null,
        recordedAt: input.occurredAt,
        recordedSource: input.source,
        recordedEventId: input.eventId,
        estimatedQuantity: null,
        ...estimate,
      },
      update: estimate,
    });
  }

  private upsertOutObservation(
    tx: StockLedgerTransaction,
    input: StockObservationInput,
    unit: string,
  ) {
    const data = {
      unit,
      recordedQuantity: 0,
      recordedAt: input.occurredAt,
      recordedSource: input.source,
      recordedEventId: input.eventId,
      estimatedQuantity: 0,
      estimatedState: PredictedState.probably_out,
      confidence: EXPLICIT_SIGNAL_CONFIDENCE,
      reason: input.reason,
      predictionId: null,
      evaluatedAt: input.occurredAt,
    };
    return tx.stockProjection.upsert({
      where: { productId: input.productId },
      create: { productId: input.productId, ...data },
      update: data,
    });
  }

  private assertPositiveQuantity(quantity: number): void {
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new StockLedgerException(
        'Stock quantity must be a finite positive number',
      );
    }
  }

  private resolveSetUnit(input: StockUnitInput): string {
    const explicitUnit = this.normalizeUnit(input.explicitUnit, 'explicit');
    if (explicitUnit) return explicitUnit;
    return this.resolveCanonicalUnit(input);
  }

  private absoluteFactData(
    input: StockFactInput,
    unit: string,
    estimatedState: PredictedState,
  ) {
    return {
      unit,
      recordedQuantity: input.quantity,
      recordedAt: input.occurredAt,
      recordedSource: input.source,
      recordedEventId: input.eventId,
      estimatedQuantity: input.quantity,
      estimatedState,
      confidence: EXPLICIT_SIGNAL_CONFIDENCE,
      reason: input.reason,
      predictionId: null,
      evaluatedAt: input.occurredAt,
    };
  }

  private isStale(
    projection: { evaluatedAt: Date } | null,
    occurredAt: Date,
  ): boolean {
    return projection !== null && projection.evaluatedAt > occurredAt;
  }

  private normalizeUnit(
    value: string | null | undefined,
    source: string,
  ): string | undefined {
    if (value === undefined || value === null) {
      return undefined;
    }
    const normalized = value.trim();
    if (!normalized) {
      throw new StockLedgerException(`${source} stock unit must not be blank`);
    }
    return normalized;
  }
}
