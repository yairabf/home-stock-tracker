import { Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { HouseholdService } from '../household/household.service';
import { StockEvidenceService } from '../estimation/stock-evidence.service';
import {
  dailyAdviceCandidate,
  dailyAdviceBypass,
  stockAdviceFingerprint,
  type DailyAdviceBaseline,
} from './stock-advice-policy';
import { JEV_STOCK_PREDICTION_VERSION } from '../estimation/jev-stock-prediction-advisor.service';

@Injectable()
export class StockAdviceSnapshot {
  constructor(
    private readonly prisma: PrismaService,
    private readonly evidence: StockEvidenceService,
    private readonly household: HouseholdService,
  ) {}

  async read(
    baseline: DailyAdviceBaseline,
    configuredModel: string,
    tx?: Prisma.TransactionClient,
  ) {
    const db = tx ?? this.prisma;
    const product = await db.product.findUnique({
      where: { id: baseline.productId },
      select: {
        id: true,
        productType: true,
        isPerishable: true,
        predictionStrategy: true,
        predictionEnabled: true,
        typicalUnit: true,
        category: true,
        config: true,
      },
    });
    const projection = await db.stockProjection.findUnique({
      where: { productId: baseline.productId },
    });
    const policy = await db.productShelfLifePolicy.findUnique({
      where: { productId: baseline.productId },
      select: { kind: true, shelfLifeDays: true, confidence: true },
    });
    const household = await (tx
      ? db.household.findFirst()
      : this.household.getOrCreate());
    if (
      !product ||
      !projection ||
      !household ||
      projection.revision !== baseline.revision ||
      projection.predictionId !== baseline.predictionId
    )
      return null;
    const context = {
      adultsCount: household.adultsCount,
      childrenCount: household.childrenCount,
      childAgeGroups: [],
      predictionPreferences: null,
    };
    const {
      candidate: history,
      history: events,
      statistics,
    } = await this.evidence.build(product, baseline.evaluatedAt, db, context);
    const candidate = dailyAdviceCandidate(baseline, history);
    if (dailyAdviceBypass(candidate, product.predictionEnabled)) return null;
    const fingerprint = stockAdviceFingerprint(
      baseline,
      {
        product,
        events: events.events,
        statistics,
        household: context,
        recorded: {
          eventId: projection.recordedEventId,
          quantity: projection.recordedQuantity,
          unit: projection.unit,
          recordedAt: projection.recordedAt,
        },
        policy,
      },
      configuredModel,
      JEV_STOCK_PREDICTION_VERSION,
    );
    return { candidate, fingerprint };
  }
}
