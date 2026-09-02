import { Injectable } from '@nestjs/common';
import { PredictedState } from '../generated/prisma/enums';
import { StockLedgerException } from './stock-ledger.exception';
import {
  StockFactInput,
  StockLedgerTransaction,
  StockObservationInput,
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
    if (existing && existing.evaluatedAt > input.occurredAt) {
      return existing;
    }
    const unit = this.resolveCanonicalUnit({
      ...input,
      existingUnit: existing?.unit,
    });
    const data = {
      unit,
      recordedQuantity: input.quantity,
      recordedAt: input.occurredAt,
      recordedSource: input.source,
      recordedEventId: input.eventId,
      estimatedQuantity: input.quantity,
      estimatedState: PredictedState.likely_available,
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
