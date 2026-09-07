import { Prisma } from '../generated/prisma/client';
import { randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import { StockProductConfirmationService } from './stock-product-confirmation.service';
import { PrismaService } from '../prisma/prisma.service';
import { ProductService } from '../product/product.service';
import { StockLedgerService } from './stock-ledger.service';
import { StatisticsService } from '../statistics/statistics.service';
import { OperationalLogger } from '../observability/operational-logger.service';
import { ProductType } from '../generated/prisma/enums';

describe('StockProductConfirmationService', () => {
  const input = {
    operationId: randomUUID(),
    product: {
      canonicalName: 'milk',
      aliases: [],
      category: 'dairy',
      typicalUnit: 'liter',
      productType: ProductType.fast_consumable,
      isPerishable: true,
    },
    stock: { quantity: 2, unit: 'liter' },
  };
  const productId = randomUUID();
  const eventId = randomUUID();
  const now = new Date();
  const product = { ...input.product, id: productId, names: [] };
  const event = {
    id: eventId,
    productId,
    eventType: 'STOCK_SET',
    quantity: 2,
    unit: 'liter',
    timestamp: now,
    source: 'mcp',
    confidence: null,
    metadata: null,
  };
  const stock = {
    productId,
    unit: 'liter',
    recordedQuantity: 2,
    recordedAt: now,
    recordedSource: 'mcp',
    recordedEventId: eventId,
    estimatedQuantity: 2,
    estimatedState: 'likely_available',
    confidence: 1,
    reason: 'stock_set',
    predictionId: null,
    evaluatedAt: now,
  };
  let service: StockProductConfirmationService;
  let tx: {
    stockProductConfirmation: { findUnique: jest.Mock; create: jest.Mock };
    productName: { findUnique: jest.Mock };
    stockProjection: { findUnique: jest.Mock };
    inventoryEvent: { create: jest.Mock };
  };
  let prisma: {
    $transaction: jest.Mock;
    stockProductConfirmation: { findUnique: jest.Mock };
  };
  let products: { confirmExplicitWithinTransaction: jest.Mock };
  let ledger: { setWithinTransaction: jest.Mock };
  let statistics: { calculateProductStatistics: jest.Mock };
  let logger: { inventoryAction: jest.Mock };

  beforeEach(async () => {
    tx = {
      stockProductConfirmation: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
      },
      productName: { findUnique: jest.fn().mockResolvedValue(null) },
      stockProjection: { findUnique: jest.fn().mockResolvedValue(null) },
      inventoryEvent: { create: jest.fn().mockResolvedValue(event) },
    };
    prisma = {
      $transaction: jest.fn((fn) => fn(tx)),
      stockProductConfirmation: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
    };
    products = {
      confirmExplicitWithinTransaction: jest.fn().mockResolvedValue(product),
    };
    ledger = { setWithinTransaction: jest.fn().mockResolvedValue(stock) };
    statistics = { calculateProductStatistics: jest.fn() };
    logger = { inventoryAction: jest.fn() };
    const module = await Test.createTestingModule({
      providers: [
        StockProductConfirmationService,
        { provide: PrismaService, useValue: prisma },
        { provide: ProductService, useValue: products },
        { provide: StockLedgerService, useValue: ledger },
        { provide: StatisticsService, useValue: statistics },
        { provide: OperationalLogger, useValue: logger },
      ],
    }).compile();
    service = module.get(StockProductConfirmationService);
  });

  it('stores the exact serialized result in the mutation transaction', async () => {
    const response = await service.confirm(input);
    expect(response).toMatchObject({
      productOutcome: 'created',
      productId,
      event: { timestamp: now.toISOString() },
    });
    expect(tx.stockProductConfirmation.create).toHaveBeenCalledWith({
      data: {
        operationId: input.operationId,
        requestVersion: 1,
        requestPayload: { product: input.product, stock: input.stock },
        responsePayload: response,
      },
    });
    expect(products.confirmExplicitWithinTransaction).toHaveBeenCalledWith(
      tx,
      input.product,
    );
    expect(ledger.setWithinTransaction).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        quantity: 2,
        explicitUnit: 'liter',
        source: 'mcp',
      }),
    );
  });

  it('replays before checking current product state and skips all writes/statistics', async () => {
    tx.stockProductConfirmation.findUnique.mockResolvedValue({
      requestVersion: 1,
      requestPayload: { product: input.product, stock: input.stock },
      responsePayload: { saved: 'result' },
    });
    await expect(service.confirm(input)).resolves.toEqual({ saved: 'result' });
    expect(products.confirmExplicitWithinTransaction).not.toHaveBeenCalled();
    expect(tx.inventoryEvent.create).not.toHaveBeenCalled();
    expect(statistics.calculateProductStatistics).not.toHaveBeenCalled();
  });

  it('rejects a changed payload without attempting a mutation', async () => {
    tx.stockProductConfirmation.findUnique.mockResolvedValue({
      requestVersion: 1,
      requestPayload: {
        product: input.product,
        stock: { ...input.stock, quantity: 3 },
      },
    });
    await expect(service.confirm(input)).rejects.toMatchObject({
      response: { code: 'STOCK_CONFIRMATION_ID_CONFLICT' },
    });
    expect(tx.inventoryEvent.create).not.toHaveBeenCalled();
  });

  it('checks reuse compatibility before stock writes', async () => {
    tx.productName.findUnique.mockResolvedValue({ productId });
    tx.stockProjection.findUnique.mockResolvedValue({ unit: 'carton' });
    await expect(service.confirm(input)).rejects.toMatchObject({
      response: { code: 'STOCK_CONFIRMATION_PRODUCT_CONFLICT' },
    });
    expect(tx.inventoryEvent.create).not.toHaveBeenCalled();
    tx.stockProjection.findUnique.mockResolvedValue({ unit: 'liter' });
    await expect(service.confirm(input)).resolves.toMatchObject({
      productOutcome: 'reused',
    });
  });

  it('does not persist a successful receipt when the ledger declined a stale set', async () => {
    ledger.setWithinTransaction.mockResolvedValue({
      ...stock,
      recordedEventId: 'newer',
    });
    await expect(service.confirm(input)).rejects.toMatchObject({
      response: { code: 'STOCK_STATE_CONFLICT' },
    });
    expect(tx.stockProductConfirmation.create).not.toHaveBeenCalled();
  });

  it('preserves committed success when statistics fail', async () => {
    statistics.calculateProductStatistics.mockRejectedValue(
      new Error('offline'),
    );
    await expect(service.confirm(input)).resolves.toMatchObject({ productId });
    expect(logger.inventoryAction).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'recalculate_statistics',
        outcome: 'failure',
      }),
    );
  });

  it('rejects invalid input before opening a transaction', async () => {
    await expect(
      service.confirm({ ...input, stock: { ...input.stock, quantity: 0 } }),
    ).rejects.toThrow('Invalid stock confirmation');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
  it('bounds transaction race retries and does not retry ordinary failures', async () => {
    const conflict = new Prisma.PrismaClientKnownRequestError('serialization', {
      code: 'P2034',
      clientVersion: 'test',
    });
    prisma.$transaction.mockRejectedValue(conflict);
    await expect(service.confirm(input)).rejects.toBe(conflict);
    expect(prisma.$transaction).toHaveBeenCalledTimes(3);
    prisma.$transaction.mockClear().mockRejectedValue(new Error('offline'));
    await expect(service.confirm(input)).rejects.toThrow('offline');
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('recovers a committed winner outside an aborted transaction', async () => {
    prisma.$transaction.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('unique', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );
    prisma.stockProductConfirmation.findUnique.mockResolvedValue({
      requestVersion: 1,
      requestPayload: { product: input.product, stock: input.stock },
      responsePayload: { original: true },
    });
    await expect(service.confirm(input)).resolves.toEqual({ original: true });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(statistics.calculateProductStatistics).not.toHaveBeenCalled();
  });
});
