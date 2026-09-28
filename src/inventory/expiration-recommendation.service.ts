import { Injectable } from '@nestjs/common';
import { InventoryEventType, ProductNameKind } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import {
  selectExpirationRecommendations,
  type ExpirationRecommendations,
} from './expiration-recommendation';

@Injectable()
export class ExpirationRecommendationService {
  constructor(private readonly prisma: PrismaService) {}

  async getRecommendations(): Promise<ExpirationRecommendations> {
    const events = await this.prisma.inventoryEvent.findMany({
      where: {
        eventType: {
          in: [InventoryEventType.PURCHASED, InventoryEventType.RESTOCKED],
        },
      },
      select: {
        id: true,
        productId: true,
        timestamp: true,
        expirationBatch: { select: { expiresAt: true } },
        product: {
          select: {
            category: true,
            names: {
              where: { kind: ProductNameKind.canonical },
              select: { displayName: true },
            },
            shelfLifePolicy: {
              select: { kind: true, shelfLifeDays: true, confidence: true },
            },
            stockProjection: {
              select: {
                estimatedQuantity: true,
                estimatedState: true,
                confidence: true,
                evaluatedAt: true,
              },
            },
          },
        },
      },
    });

    return selectExpirationRecommendations(
      events.map((event) => ({
        purchaseEventId: event.id,
        productId: event.productId,
        productName: event.product.names[0]?.displayName ?? '',
        category: event.product.category,
        purchasedAt: event.timestamp,
        explicitExpiresAt: event.expirationBatch?.expiresAt ?? null,
        shelfLifePolicy: event.product.shelfLifePolicy,
        stockProjection: event.product.stockProjection,
      })),
      new Date(),
    );
  }
}
