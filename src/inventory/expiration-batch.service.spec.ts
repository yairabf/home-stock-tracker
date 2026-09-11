import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { InventoryEventType } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { ExpirationBatchService } from './expiration-batch.service';

describe('ExpirationBatchService', () => {
  const purchaseEvent = {
    id: 'purchase-event-1',
    productId: 'product-1',
    eventType: InventoryEventType.PURCHASED,
    timestamp: new Date('2026-09-11T09:00:00.000Z'),
  };
  let service: ExpirationBatchService;
  let tx: {
    inventoryEvent: { findUnique: jest.Mock };
    expirationBatch: { create: jest.Mock };
  };

  beforeEach(async () => {
    tx = {
      inventoryEvent: {
        findUnique: jest.fn().mockResolvedValue(purchaseEvent),
      },
      expirationBatch: {
        create: jest.fn().mockResolvedValue({
          id: 'expiration-batch-1',
          productId: purchaseEvent.productId,
          purchaseEventId: purchaseEvent.id,
          expiresAt: new Date('2026-09-15T09:00:00.000Z'),
          recordedAt: new Date('2026-09-11T10:00:00.000Z'),
          source: 'api',
        }),
      },
    };
    const module = await Test.createTestingModule({
      providers: [
        ExpirationBatchService,
        {
          provide: PrismaService,
          useValue: {
            $transaction: jest.fn((callback: (client: typeof tx) => unknown) =>
              callback(tx),
            ),
          },
        },
      ],
    }).compile();
    service = module.get(ExpirationBatchService);
  });

  it('records immutable explicit expiry data against the purchase event product', async () => {
    const result = await service.record({
      purchaseEventId: purchaseEvent.id,
      expiresAt: '2026-09-15T09:00:00.000Z',
      source: 'api',
    });

    expect(tx.expirationBatch.create).toHaveBeenCalledWith({
      data: {
        productId: purchaseEvent.productId,
        purchaseEventId: purchaseEvent.id,
        expiresAt: new Date('2026-09-15T09:00:00.000Z'),
        source: 'api',
      },
    });
    expect(result).toMatchObject({ productId: purchaseEvent.productId });
  });

  it('rejects an unknown purchase event without writing an expiration batch', async () => {
    tx.inventoryEvent.findUnique.mockResolvedValue(null);

    await expect(
      service.record({
        purchaseEventId: 'missing-event',
        expiresAt: '2026-09-15T09:00:00.000Z',
        source: 'api',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(tx.expirationBatch.create).not.toHaveBeenCalled();
  });

  it('rejects ineligible event types without writing an expiration batch', async () => {
    tx.inventoryEvent.findUnique.mockResolvedValue({
      ...purchaseEvent,
      eventType: InventoryEventType.STOCK_LOW,
    });

    await expect(
      service.record({
        purchaseEventId: purchaseEvent.id,
        expiresAt: '2026-09-15T09:00:00.000Z',
        source: 'api',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.expirationBatch.create).not.toHaveBeenCalled();
  });

  it.each(['2026-09-15T09:00:00', 'invalid'])(
    'rejects an ambiguous or invalid expiry timestamp: %s',
    async (expiresAt) => {
      await expect(
        service.record({
          purchaseEventId: purchaseEvent.id,
          expiresAt,
          source: 'api',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(tx.expirationBatch.create).not.toHaveBeenCalled();
    },
  );

  it('rejects an expiry timestamp before the purchase event', async () => {
    await expect(
      service.record({
        purchaseEventId: purchaseEvent.id,
        expiresAt: '2026-09-11T08:59:59.999Z',
        source: 'api',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.expirationBatch.create).not.toHaveBeenCalled();
  });

  it('maps the unique purchase-event constraint to a stable conflict', async () => {
    tx.expirationBatch.create.mockRejectedValue({ code: 'P2002' });

    await expect(
      service.record({
        purchaseEventId: purchaseEvent.id,
        expiresAt: '2026-09-15T09:00:00.000Z',
        source: 'api',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
