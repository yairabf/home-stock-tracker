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

describe('Stock ledger foundation (e2e)', () => {
  interface InventoryEventBody {
    id: string;
    quantity: number;
  }

  let app: INestApplication<App>;
  let prisma: PrismaService;
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
