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
    await prisma.inventoryEvent.deleteMany({ where: { productId } });
    await prisma.product.delete({ where: { id: productId } });
    await app.close();
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
});
