import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { ServiceAuthGuard } from '../src/auth/service-auth.guard';
import { PrismaService } from '../src/prisma/prisma.service';
import { AUTH_TEST_BYPASS } from './auth-test-bypass';
import { createProductFixture } from './product-fixture';
import { InventoryService } from '../src/inventory/inventory.service';
import { StockLedgerService } from '../src/inventory/stock-ledger.service';

describe('Stock ledger foundation (e2e)', () => {
  interface InventoryEventBody {
    id: string;
    quantity: number;
  }

  let app: INestApplication<App>;
  let prisma: PrismaService;
  let inventoryService: InventoryService;
  let stockLedgerService: StockLedgerService;
  const productIds: string[] = [];

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ServiceAuthGuard)
      .useValue(AUTH_TEST_BYPASS)
      .compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
    prisma = app.get(PrismaService);
    inventoryService = app.get(InventoryService);
    stockLedgerService = app.get(StockLedgerService);
  });

  afterEach(async () => {
    await prisma.stockProjection.deleteMany({
      where: { productId: { in: productIds } },
    });
    await prisma.productShelfLifePolicy.deleteMany({
      where: { productId: { in: productIds } },
    });
    await prisma.groceryListItem.deleteMany({
      where: { productId: { in: productIds } },
    });
    await prisma.inventoryEvent.deleteMany({
      where: { productId: { in: productIds } },
    });
    await prisma.product.deleteMany({ where: { id: { in: productIds } } });
    productIds.length = 0;
  });

  afterAll(async () => {
    await app.close();
  });

  it('does not backfill a projection from existing event history', async () => {
    const product = await createProduct('untracked-history', 'item');
    await prisma.inventoryEvent.create({
      data: {
        productId: product.id,
        eventType: 'PURCHASED',
        quantity: 3,
        unit: 'item',
        source: 'api',
      },
    });

    await expect(
      prisma.stockProjection.findUnique({ where: { productId: product.id } }),
    ).resolves.toBeNull();
  });

  it('enforces finite and nonperishable shelf-life policy shapes', async () => {
    const product = await createProduct('shelf-life-constraints', 'item');
    const basePolicy = {
      productId: product.id,
      confidence: 0.8,
      rationale: 'test policy',
      evaluatedAt: new Date(),
    };

    await expect(
      prisma.productShelfLifePolicy.create({
        data: { ...basePolicy, kind: 'finite', shelfLifeDays: null },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.productShelfLifePolicy.create({
        data: { ...basePolicy, kind: 'nonperishable', shelfLifeDays: 30 },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.productShelfLifePolicy.create({
        data: {
          ...basePolicy,
          kind: 'finite',
          shelfLifeDays: 30,
          confidence: 1.1,
        },
      }),
    ).rejects.toThrow();

    await expect(
      prisma.productShelfLifePolicy.create({
        data: { ...basePolicy, kind: 'finite', shelfLifeDays: 30 },
      }),
    ).resolves.toMatchObject({ kind: 'finite', shelfLifeDays: 30 });
  });

  it('defaults a purchase to one and later purchases reset the projection', async () => {
    const product = await createProduct('purchase-reset', 'carton');

    const first = await purchase(product.id, {});
    const firstBody = inventoryEventBody(first);
    expect(firstBody.quantity).toBe(1);
    await expect(projection(product.id)).resolves.toMatchObject({
      unit: 'carton',
      recordedQuantity: 1,
      estimatedQuantity: 1,
      recordedEventId: firstBody.id,
    });

    const second = await purchase(product.id, {
      quantity: 4,
      unit: 'carton',
    });
    const secondBody = inventoryEventBody(second);
    await expect(projection(product.id)).resolves.toMatchObject({
      recordedQuantity: 4,
      estimatedQuantity: 4,
      recordedEventId: secondBody.id,
    });
  });

  it('rolls back an incompatible-unit event and preserves the prior fact', async () => {
    const product = await createProduct('unit-conflict', 'liter');
    const first = await purchase(product.id, { quantity: 2, unit: 'liter' });
    const firstBody = inventoryEventBody(first);
    const countBefore = await prisma.inventoryEvent.count({
      where: { productId: product.id },
    });

    await request(app.getHttpServer())
      .post('/api/v1/inventory/purchases')
      .send({
        productId: product.id,
        eventType: 'PURCHASED',
        quantity: 3,
        unit: 'carton',
      })
      .expect(400);

    await expect(
      prisma.inventoryEvent.count({ where: { productId: product.id } }),
    ).resolves.toBe(countBefore);
    await expect(projection(product.id)).resolves.toMatchObject({
      unit: 'liter',
      recordedQuantity: 2,
      recordedEventId: firstBody.id,
    });
  });

  it('preserves quantity on low and records zero on out', async () => {
    const product = await createProduct('qualitative-signals', 'item');
    const purchaseResult = await purchase(product.id, { quantity: 5 });
    const purchaseBody = inventoryEventBody(purchaseResult);

    await signal(product.id, 'STOCK_LOW');
    await expect(projection(product.id)).resolves.toMatchObject({
      recordedQuantity: 5,
      estimatedQuantity: 5,
      estimatedState: 'probably_low',
      recordedEventId: purchaseBody.id,
    });

    const out = await signal(product.id, 'STOCK_OUT');
    const outBody = inventoryEventBody(out);
    await expect(projection(product.id)).resolves.toMatchObject({
      recordedQuantity: 0,
      estimatedQuantity: 0,
      estimatedState: 'probably_out',
      recordedEventId: outBody.id,
    });
  });

  it('keeps concurrent reset provenance internally consistent', async () => {
    const product = await createProduct('concurrent-reset', 'item');

    const responses = await Promise.all([
      purchase(product.id, { quantity: 2 }),
      purchase(product.id, { quantity: 7 }),
    ]);
    const stored = await projection(product.id);
    const recordedEvent = await prisma.inventoryEvent.findUniqueOrThrow({
      where: { id: stored.recordedEventId },
    });
    const concurrentEvents = await prisma.inventoryEvent.findMany({
      where: { productId: product.id },
    });
    const newestTimestamp = Math.max(
      ...concurrentEvents.map((event) => event.timestamp.getTime()),
    );

    expect(responses.map((response) => response.status)).toEqual([201, 201]);
    expect(stored.recordedAt.getTime()).toBe(newestTimestamp);
    expect(stored.recordedQuantity).toBe(recordedEvent.quantity);
    expect(stored.estimatedQuantity).toBe(recordedEvent.quantity);
  });

  it('records an ordered multi-product batch with timestamp precedence and forward estimates', async () => {
    const milk = await createProduct('batch-milk', 'liter');
    const rice = await createProduct('batch-rice', 'packet');
    const requestPurchasedAt = new Date(Date.now() - 2 * 86_400_000);
    const itemPurchasedAt = new Date(Date.now() - 86_400_000);
    await prisma.productShelfLifePolicy.create({
      data: {
        productId: milk.id,
        kind: 'nonperishable',
        shelfLifeDays: null,
        confidence: 0.9,
        rationale: 'batch materialization fixture',
        evaluatedAt: new Date(),
      },
    });
    await prisma.productStatistics.create({
      data: {
        productId: milk.id,
        estimatedConsumptionIntervalDays: 10,
      },
    });

    const result = await inventoryService.recordPurchases({
      purchasedAt: requestPurchasedAt.toISOString(),
      items: [
        { productId: milk.id, quantity: 2 },
        {
          productId: rice.id,
          unit: 'bag',
          purchasedAt: itemPurchasedAt.toISOString(),
        },
      ],
      source: 'mcp',
    });

    expect(result.items.map((item) => item.event.productId)).toEqual([
      milk.id,
      rice.id,
    ]);
    expect(result.items[0]).toMatchObject({
      event: {
        quantity: 2,
        source: 'mcp',
        timestamp: requestPurchasedAt,
      },
      stock: {
        unit: 'liter',
        recordedQuantity: 2,
        recordedAt: requestPurchasedAt,
        estimatedState: 'likely_available',
        reason: 'purchase_forward_estimated',
      },
    });
    expect(result.items[0].stock.estimatedQuantity).toBeGreaterThan(1.79);
    expect(result.items[0].stock.estimatedQuantity).toBeLessThan(1.81);
    expect(result.items[1]).toMatchObject({
      event: { quantity: 1, timestamp: itemPurchasedAt },
      stock: { unit: 'bag', recordedQuantity: 1 },
    });
  });

  it('rolls back every batch write after an incompatible unit', async () => {
    const milk = await createProduct('batch-unit-first', 'liter');
    const rice = await createProduct('batch-unit-second', 'packet');
    await inventoryService.recordPurchase({
      productId: rice.id,
      eventType: 'PURCHASED',
      quantity: 2,
      unit: 'packet',
      source: 'api',
    });
    const eventCountBefore = await prisma.inventoryEvent.count({
      where: { productId: { in: [milk.id, rice.id] } },
    });

    await expect(
      inventoryService.recordPurchases({
        items: [
          { productId: milk.id, quantity: 3 },
          { productId: rice.id, quantity: 4, unit: 'carton' },
        ],
        source: 'api',
      }),
    ).rejects.toMatchObject({ status: 400 });

    await expect(
      prisma.inventoryEvent.count({
        where: { productId: { in: [milk.id, rice.id] } },
      }),
    ).resolves.toBe(eventCountBefore);
    await expect(
      prisma.stockProjection.findUnique({ where: { productId: milk.id } }),
    ).resolves.toBeNull();
    await expect(projection(rice.id)).resolves.toMatchObject({
      unit: 'packet',
      recordedQuantity: 2,
    });
  });

  it('rolls back earlier writes when a later projection persistence call fails', async () => {
    const milk = await createProduct('batch-persistence-first', 'liter');
    const rice = await createProduct('batch-persistence-second', 'packet');
    const reset =
      stockLedgerService.resetWithinTransaction.bind(stockLedgerService);
    const resetSpy = jest
      .spyOn(stockLedgerService, 'resetWithinTransaction')
      .mockImplementationOnce(reset)
      .mockRejectedValueOnce(new Error('simulated persistence failure'));

    try {
      await expect(
        inventoryService.recordPurchases({
          items: [{ productId: milk.id }, { productId: rice.id }],
          source: 'api',
        }),
      ).rejects.toThrow('simulated persistence failure');
    } finally {
      resetSpy.mockRestore();
    }

    await expect(
      prisma.inventoryEvent.count({
        where: { productId: { in: [milk.id, rice.id] } },
      }),
    ).resolves.toBe(0);
    await expect(
      prisma.stockProjection.count({
        where: { productId: { in: [milk.id, rice.id] } },
      }),
    ).resolves.toBe(0);
  });

  it('keeps concurrent batch event and projection provenance consistent', async () => {
    const product = await createProduct('concurrent-batch', 'item');

    await Promise.all([
      inventoryService.recordPurchases({
        items: [{ productId: product.id, quantity: 2 }],
        source: 'api',
      }),
      inventoryService.recordPurchases({
        items: [{ productId: product.id, quantity: 7 }],
        source: 'mcp',
      }),
    ]);
    const stored = await projection(product.id);
    const recordedEvent = await prisma.inventoryEvent.findUniqueOrThrow({
      where: { id: stored.recordedEventId },
    });

    expect(stored.recordedQuantity).toBe(recordedEvent.quantity);
    expect(stored.recordedAt).toEqual(recordedEvent.timestamp);
    expect(stored.recordedSource).toBe(recordedEvent.source);
  });

  async function createProduct(label: string, typicalUnit: string) {
    const product = await createProductFixture(prisma, {
      canonicalName: `stock-ledger-${label}-${randomUUID()}`,
      typicalUnit,
    });
    productIds.push(product.id);
    return product;
  }

  function purchase(
    productId: string,
    measurement: { quantity?: number; unit?: string },
  ) {
    return request(app.getHttpServer())
      .post('/api/v1/inventory/purchases')
      .send({ productId, eventType: 'PURCHASED', ...measurement })
      .expect(201);
  }

  function signal(productId: string, eventType: 'STOCK_LOW' | 'STOCK_OUT') {
    return request(app.getHttpServer())
      .post('/api/v1/inventory/events')
      .send({ productId, eventType })
      .expect(201);
  }

  function projection(productId: string) {
    return prisma.stockProjection.findUniqueOrThrow({ where: { productId } });
  }

  function inventoryEventBody(response: { body: unknown }): InventoryEventBody {
    return response.body as InventoryEventBody;
  }
});
