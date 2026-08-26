import 'dotenv/config';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

// Runs against the dev Postgres container (same DATABASE_URL as `npm run
// start:dev`) since the project has no dedicated test database yet. The
// fixture product and every event it accumulates are cleaned up in afterAll.
describe('InventoryController (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let productId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();

    prisma = app.get(PrismaService);

    const productResponse = await request(app.getHttpServer())
      .post('/api/v1/products')
      .send({ canonicalName: `e2e inventory product ${Date.now()}` })
      .expect(201);
    productId = productResponse.body.id;
  });

  afterAll(async () => {
    await prisma.groceryListItem.deleteMany({ where: { productId } });
    await prisma.inventoryEvent.deleteMany({ where: { productId } });
    await prisma.product.delete({ where: { id: productId } });
    await app.close();
  });

  it('records a purchase and returns it (POST /api/v1/inventory/purchases)', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/inventory/purchases')
      .send({
        productId,
        eventType: 'PURCHASED',
        quantity: 2,
        unit: 'liter',
        source: 'hermes_whatsapp',
      })
      .expect(201);

    expect(response.body).toMatchObject({
      productId,
      eventType: 'PURCHASED',
      quantity: 2,
      unit: 'liter',
      source: 'hermes_whatsapp',
    });
    expect(response.body.id).toBeDefined();
    expect(response.body.timestamp).toBeDefined();
  });

  it('records a restock with zero quantity', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/inventory/purchases')
      .send({
        productId,
        eventType: 'RESTOCKED',
        quantity: 0,
        source: 'api',
      })
      .expect(201);

    expect(response.body).toMatchObject({
      productId,
      eventType: 'RESTOCKED',
      quantity: 0,
      source: 'api',
    });
  });

  it('rejects unsupported purchase event types', () => {
    return request(app.getHttpServer())
      .post('/api/v1/inventory/purchases')
      .send({ productId, eventType: 'STOCK_LOW', source: 'api' })
      .expect(400);
  });

  it('returns 404 for an unknown purchase productId', () => {
    return request(app.getHttpServer())
      .post('/api/v1/inventory/purchases')
      .send({
        productId: '00000000-0000-4000-8000-000000000000',
        eventType: 'PURCHASED',
        source: 'api',
      })
      .expect(404);
  });

  it('records an event and returns it (POST /api/v1/inventory/events)', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/inventory/events')
      .send({
        productId,
        eventType: 'STOCK_LOW',
        quantity: 1,
        unit: 'liter',
        source: 'hermes_whatsapp',
        confidence: 0.8,
        metadata: { note: 'e2e' },
      })
      .expect(201);

    expect(response.body).toMatchObject({
      productId,
      eventType: 'STOCK_LOW',
      quantity: 1,
      unit: 'liter',
      source: 'hermes_whatsapp',
      confidence: 0.8,
      metadata: { note: 'e2e' },
    });
    expect(response.body.id).toBeDefined();
    expect(response.body.timestamp).toBeDefined();
  });

  it('returns 404 for an unknown productId', () => {
    return request(app.getHttpServer())
      .post('/api/v1/inventory/events')
      .send({
        productId: '00000000-0000-4000-8000-000000000000',
        eventType: 'STOCK_LOW',
        source: 'api',
      })
      .expect(404);
  });

  it('returns 400 for an invalid eventType', () => {
    return request(app.getHttpServer())
      .post('/api/v1/inventory/events')
      .send({ productId, eventType: 'NOT_REAL', source: 'api' })
      .expect(400);
  });

  it('round-trips: records then queries the event back by productId and eventType', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/inventory/events')
      .send({ productId, eventType: 'RESTOCKED', source: 'api' })
      .expect(201);

    const response = await request(app.getHttpServer())
      .get('/api/v1/inventory/events')
      .query({ productId, eventType: 'RESTOCKED' })
      .expect(200);

    expect(response.body.total).toBeGreaterThanOrEqual(1);
    expect(response.body.limit).toBe(20);
    expect(response.body.offset).toBe(0);
    expect(
      response.body.items.every(
        (item: { productId: string; eventType: string }) =>
          item.productId === productId && item.eventType === 'RESTOCKED',
      ),
    ).toBe(true);
  });

  it('paginates results with limit and offset', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/inventory/events')
      .send({ productId, eventType: 'PURCHASED', source: 'api' })
      .expect(201);
    await request(app.getHttpServer())
      .post('/api/v1/inventory/events')
      .send({ productId, eventType: 'PURCHASED', source: 'api' })
      .expect(201);

    const response = await request(app.getHttpServer())
      .get('/api/v1/inventory/events')
      .query({ productId, eventType: 'PURCHASED', limit: 1, offset: 0 })
      .expect(200);

    expect(response.body.items).toHaveLength(1);
    expect(response.body.total).toBeGreaterThanOrEqual(2);
  });

  it('returns an empty array when no events match', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/inventory/events')
      .query({ productId: '00000000-0000-4000-8000-000000000000' })
      .expect(200);

    expect(response.body).toEqual({
      items: [],
      total: 0,
      limit: 20,
      offset: 0,
    });
  });

  describe('POST /api/v1/inventory/purchases/complete', () => {
    let groceryItemId1: string;
    let groceryItemId2: string;

    beforeEach(async () => {
      // Clean up any existing grocery items for this product
      await prisma.groceryListItem.deleteMany({ where: { productId } });

      // Create fixture grocery items
      const item1 = await prisma.groceryListItem.create({
        data: {
          productId,
          requestedQuantity: 2,
          unit: 'liter',
          source: 'hermes_whatsapp',
        },
      });
      const item2 = await prisma.groceryListItem.create({
        data: {
          productId,
          requestedQuantity: 4,
          unit: 'liter',
          source: 'api',
        },
      });
      groceryItemId1 = item1.id;
      groceryItemId2 = item2.id;
    });

    afterEach(async () => {
      await prisma.groceryListItem.deleteMany({ where: { productId } });
    });

    it('completes grocery items and returns event + updated items', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/inventory/purchases/complete')
        .send({
          productId,
          quantity: 6,
          unit: 'liter',
          source: 'hermes_whatsapp',
          confidence: 1,
          groceryItemIds: [groceryItemId1, groceryItemId2],
        })
        .expect(201);

      expect(response.body.event).toMatchObject({
        productId,
        eventType: 'PURCHASED',
        quantity: 6,
        unit: 'liter',
        source: 'hermes_whatsapp',
        confidence: 1,
      });
      expect(response.body.event.id).toBeDefined();
      expect(response.body.event.timestamp).toBeDefined();

      expect(response.body.groceryItems).toHaveLength(2);
      expect(response.body.groceryItems[0]).toMatchObject({
        productId,
        status: 'purchased',
        relatedInventoryEventId: response.body.event.id,
      });
      expect(response.body.groceryItems[1]).toMatchObject({
        productId,
        status: 'purchased',
        relatedInventoryEventId: response.body.event.id,
      });
    });

    it('returns 400 for invalid groceryItemIds', async () => {
      return request(app.getHttpServer())
        .post('/api/v1/inventory/purchases/complete')
        .send({
          productId,
          source: 'api',
          groceryItemIds: ['not-a-uuid'],
        })
        .expect(400);
    });

    it('returns 400 for empty groceryItemIds', async () => {
      return request(app.getHttpServer())
        .post('/api/v1/inventory/purchases/complete')
        .send({
          productId,
          source: 'api',
          groceryItemIds: [],
        })
        .expect(400);
    });

    it('returns 400 when grocery item not found', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/inventory/purchases/complete')
        .send({
          productId,
          source: 'api',
          groceryItemIds: ['00000000-0000-4000-8000-000000000000'],
        })
        .expect(400);

      expect(response.body.message).toContain('invalid');
    });

    it('returns 400 when grocery item belongs to different product', async () => {
      // Create a different product
      const otherProductResponse = await request(app.getHttpServer())
        .post('/api/v1/products')
        .send({ canonicalName: `other product ${Date.now()}` })
        .expect(201);
      const otherProductId = otherProductResponse.body.id;

      // Create a grocery item for the other product
      const otherItem = await prisma.groceryListItem.create({
        data: {
          productId: otherProductId,
          source: 'api',
        },
      });

      const response = await request(app.getHttpServer())
        .post('/api/v1/inventory/purchases/complete')
        .send({
          productId,
          source: 'api',
          groceryItemIds: [otherItem.id],
        })
        .expect(400);

      expect(response.body.message).toContain('invalid');

      // Cleanup
      await prisma.groceryListItem.delete({ where: { id: otherItem.id } });
      await prisma.product.delete({ where: { id: otherProductId } });
    });

    it('returns 404 for unknown productId', async () => {
      return request(app.getHttpServer())
        .post('/api/v1/inventory/purchases/complete')
        .send({
          productId: '00000000-0000-4000-8000-000000000000',
          source: 'api',
          groceryItemIds: [groceryItemId1],
        })
        .expect(404);
    });

    it('returns 400 when grocery item already has relatedInventoryEventId', async () => {
      // Create an inventory event first
      const event = await prisma.inventoryEvent.create({
        data: {
          productId,
          eventType: 'PURCHASED',
          source: 'api',
        },
      });

      // Link a grocery item to it
      const linkedItem = await prisma.groceryListItem.create({
        data: {
          productId,
          source: 'api',
          status: 'pending',
          relatedInventoryEventId: event.id,
        },
      });

      const response = await request(app.getHttpServer())
        .post('/api/v1/inventory/purchases/complete')
        .send({
          productId,
          source: 'api',
          groceryItemIds: [linkedItem.id],
        })
        .expect(400);

      expect(response.body.message).toContain('invalid');

      // Cleanup
      await prisma.groceryListItem.delete({ where: { id: linkedItem.id } });
      await prisma.inventoryEvent.delete({ where: { id: event.id } });
    });

    it('returns 400 when grocery item status is not pending', async () => {
      // Create a grocery item with purchased status
      const purchasedItem = await prisma.groceryListItem.create({
        data: {
          productId,
          source: 'api',
          status: 'purchased',
        },
      });

      const response = await request(app.getHttpServer())
        .post('/api/v1/inventory/purchases/complete')
        .send({
          productId,
          source: 'api',
          groceryItemIds: [purchasedItem.id],
        })
        .expect(400);

      expect(response.body.message).toContain('invalid');

      // Cleanup
      await prisma.groceryListItem.delete({ where: { id: purchasedItem.id } });
    });
  });
});
