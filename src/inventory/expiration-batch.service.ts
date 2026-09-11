import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InventoryEventType } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import {
  parseExpirationTimestamp,
  type RecordExpirationBatchInput,
} from './types/expiration-batch';

const EXPIRATION_ELIGIBLE_EVENT_TYPES = new Set<InventoryEventType>([
  InventoryEventType.PURCHASED,
  InventoryEventType.RESTOCKED,
]);

@Injectable()
export class ExpirationBatchService {
  constructor(private readonly prisma: PrismaService) {}

  async record(input: RecordExpirationBatchInput) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const event = await tx.inventoryEvent.findUnique({
          where: { id: input.purchaseEventId },
          select: {
            id: true,
            productId: true,
            eventType: true,
            timestamp: true,
          },
        });
        if (!event) {
          throw new NotFoundException('Purchase event not found');
        }
        if (!EXPIRATION_ELIGIBLE_EVENT_TYPES.has(event.eventType)) {
          throw new BadRequestException(
            'Expiration can only be recorded for a purchase or restock event',
          );
        }

        const expiresAt = parseExpirationTimestamp(input.expiresAt);
        if (!expiresAt) {
          throw new BadRequestException(
            'expiresAt must be an ISO 8601 timestamp with an explicit timezone',
          );
        }
        if (expiresAt < event.timestamp) {
          throw new BadRequestException(
            'expiresAt must not be earlier than the purchase event timestamp',
          );
        }

        return tx.expirationBatch.create({
          data: {
            productId: event.productId,
            purchaseEventId: event.id,
            expiresAt,
            source: input.source,
          },
        });
      });
    } catch (error) {
      if (this.isDuplicatePurchaseEvent(error)) {
        throw new ConflictException(
          'Expiration was already recorded for this purchase event',
        );
      }
      throw error;
    }
  }

  private isDuplicatePurchaseEvent(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'P2002'
    );
  }
}
