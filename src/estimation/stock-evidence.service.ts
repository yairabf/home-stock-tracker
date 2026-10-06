import { Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { HouseholdService } from '../household/household.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  calculateCandidate,
  STOCK_HISTORY_EVENT_TYPES,
  summarizeHistory,
  type ProductPredictionContext,
  type HouseholdPredictionContext,
} from './candidate-calculation';

@Injectable()
export class StockEvidenceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly household: HouseholdService,
  ) {}

  async build(
    product: ProductPredictionContext & { id: string },
    cutoff: Date = new Date(),
    db: Prisma.TransactionClient = this.prisma,
    household?: HouseholdPredictionContext,
  ) {
    if (!Number.isFinite(cutoff.getTime()))
      throw new Error('Invalid stock evidence cutoff');
    const events = await db.inventoryEvent.findMany({
      where: {
        productId: product.id,
        eventType: { in: STOCK_HISTORY_EVENT_TYPES },
        timestamp: { lte: cutoff },
      },
      orderBy: [{ timestamp: 'desc' }, { id: 'desc' }],
      take: 20,
    });
    const statistics = await db.productStatistics.findUnique({
      where: { productId: product.id },
      select: {
        avgPurchaseIntervalDays: true,
        avgNeedIntervalDays: true,
        estimatedConsumptionIntervalDays: true,
        observationCount: true,
      },
    });
    const context = household ?? (await this.household.getOrCreate());
    const history = summarizeHistory(
      product.id,
      events
        .filter((e) => e.timestamp <= cutoff)
        .map((e) => ({
          id: e.id,
          eventType: e.eventType,
          timestamp: e.timestamp,
          quantity: e.quantity ?? undefined,
          unit: e.unit ?? undefined,
        })),
    );
    return {
      candidate: calculateCandidate(
        history,
        statistics,
        product,
        context,
        cutoff.getTime(),
      ),
      history,
      statistics,
    };
  }
}
