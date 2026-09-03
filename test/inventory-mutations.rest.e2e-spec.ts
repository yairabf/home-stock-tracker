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

describe('Inventory mutations REST API (e2e)', () => {
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
    await prisma.product.deleteMany({
      where: { id: { in: productIds } },
    });
    productIds.length = 0;
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns event and stock receipts for set, decrement, and mark_out', async () => {
    const product = await createProduct('stock-operations', 'liter');

    const set = await request(app.getHttpServer())
      .post(`/api/v1/inventory/stock/${product.id}`)
      .send({ operation: 'set', quantity: 5 })
      .expect(201);
    expect(set.body).toMatchObject({
      event: {
        productId: product.id,
        eventType: 'STOCK_SET',
        quantity: 5,
        source: 'api',
      },
      stock: {
        productId: product.id,
        unit: 'liter',
        recordedQuantity: 5,
        estimatedQuantity: 5,
        recordedEventId: set.body.event.id,
      },
    });

    const decrement = await request(app.getHttpServer())
      .post(`/api/v1/inventory/stock/${product.id}`)
      .send({ operation: 'decrement', quantity: 2 })
      .expect(201);
    expect(decrement.body).toMatchObject({
      event: { eventType: 'STOCK_CONSUMED', quantity: 2, source: 'api' },
      stock: {
        recordedQuantity: 5,
        recordedEventId: set.body.event.id,
        estimatedQuantity: 3,
      },
    });

    const markOut = await request(app.getHttpServer())
      .post(`/api/v1/inventory/stock/${product.id}`)
      .send({ operation: 'mark_out' })
      .expect(201);
    expect(markOut.body).toMatchObject({
      event: { eventType: 'STOCK_OUT', quantity: 0, source: 'api' },
      stock: {
        recordedQuantity: 0,
        estimatedQuantity: 0,
        estimatedState: 'probably_out',
        recordedEventId: markOut.body.event.id,
      },
    });
  });

  it.each([
    ['set without quantity', { operation: 'set' }],
    ['mark_out with quantity', { operation: 'mark_out', quantity: 1 }],
    ['unknown operation', { operation: 'replace', quantity: 1 }],
    ['unknown field', { operation: 'set', quantity: 1, confidence: 1 }],
  ])('returns stable 400 validation for %s', async (_label, body) => {
    const product = await createProduct(`invalid-${_label}`, 'item');
    const response = await request(app.getHttpServer())
      .post(`/api/v1/inventory/stock/${product.id}`)
      .send(body)
      .expect(400);

    expect(response.body.statusCode).toBe(400);
    expect(response.body.message).toBeDefined();
  });

  it('returns 404 for an unknown product and 409 for an untracked decrement', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/inventory/stock/00000000-0000-4000-8000-000000000000')
      .send({ operation: 'set', quantity: 1 })
      .expect(404);

    const product = await createProduct('untracked-decrement', 'item');
    const response = await request(app.getHttpServer())
      .post(`/api/v1/inventory/stock/${product.id}`)
      .send({ operation: 'decrement', quantity: 1 })
      .expect(409);
    expect(response.body).toMatchObject({
      code: 'STOCK_STATE_CONFLICT',
    });
  });

  it('returns 400 without retaining an incompatible-unit decrement event', async () => {
    const product = await createProduct('stock-unit-conflict', 'liter');
    await request(app.getHttpServer())
      .post(`/api/v1/inventory/stock/${product.id}`)
      .send({ operation: 'set', quantity: 3, unit: 'liter' })
      .expect(201);
    const eventCount = await prisma.inventoryEvent.count({
      where: { productId: product.id },
    });

    const response = await request(app.getHttpServer())
      .post(`/api/v1/inventory/stock/${product.id}`)
      .send({ operation: 'decrement', quantity: 1, unit: 'carton' })
      .expect(400);

    expect(response.body.code).toBe('INVALID_STOCK_FACT');
    await expect(
      prisma.inventoryEvent.count({ where: { productId: product.id } }),
    ).resolves.toBe(eventCount);
  });

  it('rejects a malformed stock product path before dispatch', () => {
    return request(app.getHttpServer())
      .post('/api/v1/inventory/stock/not-a-uuid')
      .send({ operation: 'set', quantity: 1 })
      .expect(400);
  });

  it('keeps the legacy single-purchase response and accepts purchasedAt', async () => {
    const product = await createProduct('legacy-purchase', 'carton');
    const purchasedAt = new Date(Date.now() - 86_400_000).toISOString();
    const response = await request(app.getHttpServer())
      .post('/api/v1/inventory/purchases')
      .send({
        productId: product.id,
        eventType: 'RESTOCKED',
        quantity: 2,
        unit: 'carton',
        purchasedAt,
      })
      .expect(201);

    expect(response.body).toMatchObject({
      productId: product.id,
      eventType: 'RESTOCKED',
      quantity: 2,
      unit: 'carton',
      timestamp: purchasedAt,
      source: 'api',
    });
    expect(response.body).not.toHaveProperty('event');
    expect(response.body).not.toHaveProperty('stock');
    expect(response.body).not.toHaveProperty('items');
  });

  it('accepts an ordered batch on the same purchases route', async () => {
    const milk = await createProduct('batch-milk', 'liter');
    const rice = await createProduct('batch-rice', 'packet');
    const requestPurchasedAt = new Date(Date.now() - 2 * 86_400_000);
    const itemPurchasedAt = new Date(Date.now() - 86_400_000);
    const response = await request(app.getHttpServer())
      .post('/api/v1/inventory/purchases')
      .send({
        purchasedAt: requestPurchasedAt.toISOString(),
        items: [
          { productId: milk.id, quantity: 2 },
          {
            productId: rice.id,
            purchasedAt: itemPurchasedAt.toISOString(),
          },
        ],
      })
      .expect(201);

    expect(response.body.items).toHaveLength(2);
    expect(
      response.body.items.map(
        (item: { event: { productId: string } }) => item.event.productId,
      ),
    ).toEqual([milk.id, rice.id]);
    expect(response.body.items[0]).toMatchObject({
      event: { quantity: 2, timestamp: requestPurchasedAt.toISOString() },
      stock: { unit: 'liter', recordedQuantity: 2 },
    });
    expect(response.body.items[1]).toMatchObject({
      event: { quantity: 1, timestamp: itemPurchasedAt.toISOString() },
      stock: { unit: 'packet', recordedQuantity: 1 },
    });
  });

  it.each([
    [
      'mixed single and batch fields',
      {
        productId: '00000000-0000-4000-8000-000000000001',
        eventType: 'PURCHASED',
        items: [{ productId: '00000000-0000-4000-8000-000000000002' }],
      },
    ],
    [
      'duplicate products',
      {
        items: [
          { productId: '00000000-0000-4000-8000-000000000001' },
          { productId: '00000000-0000-4000-8000-000000000001' },
        ],
      },
    ],
    [
      'timezone-free timestamp',
      {
        purchasedAt: '2026-09-01T10:00:00',
        items: [{ productId: '00000000-0000-4000-8000-000000000001' }],
      },
    ],
    [
      'future timestamp',
      {
        purchasedAt: '2999-01-01T00:00:00.000Z',
        items: [{ productId: '00000000-0000-4000-8000-000000000001' }],
      },
    ],
  ])('rejects invalid purchase shape: %s', async (_label, body) => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/inventory/purchases')
      .send(body)
      .expect(400);
    expect(response.body.message).toBeDefined();
  });

  it('returns 404 without partial writes when a batch product is missing', async () => {
    const product = await createProduct('batch-missing-product', 'item');
    await request(app.getHttpServer())
      .post('/api/v1/inventory/purchases')
      .send({
        items: [
          { productId: product.id },
          { productId: '00000000-0000-4000-8000-000000000000' },
        ],
      })
      .expect(404);

    await expect(
      prisma.inventoryEvent.count({ where: { productId: product.id } }),
    ).resolves.toBe(0);
    await expect(
      prisma.stockProjection.findUnique({ where: { productId: product.id } }),
    ).resolves.toBeNull();
  });

  async function createProduct(label: string, typicalUnit: string) {
    const product = await createProductFixture(prisma, {
      canonicalName: `inventory-rest-${label}-${randomUUID()}`,
      typicalUnit,
    });
    productIds.push(product.id);
    return product;
  }
});
