import 'dotenv/config';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  InventoryEventType,
  PredictedState,
  ProductType,
} from '../src/generated/prisma/enums';
import { ServiceAuthGuard } from '../src/auth/service-auth.guard';
import { AUTH_TEST_BYPASS } from './auth-test-bypass';
import { createProductFixture } from './product-fixture';

// Runs against the dev Postgres container (same DATABASE_URL as `npm run
// start:dev`) since the project has no dedicated test database yet.
describe('Estimation (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let productId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(ServiceAuthGuard)
      .useValue(AUTH_TEST_BYPASS)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();

    prisma = app.get(PrismaService);

    // Clean up any existing test data
    await prisma.stockProjection.deleteMany({});
    await prisma.prediction.deleteMany({});
    await prisma.inventoryEvent.deleteMany({});
    await prisma.groceryListItem.deleteMany({});
    await prisma.product.deleteMany({});
  });

  afterAll(async () => {
    await prisma.stockProjection.deleteMany({});
    await prisma.prediction.deleteMany({});
    await prisma.inventoryEvent.deleteMany({});
    await prisma.groceryListItem.deleteMany({});
    await prisma.product.deleteMany({});
    await app.close();
  });

  describe('GET /inventory/estimate/:productId', () => {
    beforeEach(async () => {
      // Create fresh product for each test
      const product = await createProductFixture(prisma, {
        canonicalName: 'test-milk',
        productType: ProductType.fast_consumable,
        predictionEnabled: true,
      });
      productId = product.id;
    });

    afterEach(async () => {
      await prisma.stockProjection.deleteMany({ where: { productId } });
      await prisma.prediction.deleteMany({ where: { productId } });
      await prisma.inventoryEvent.deleteMany({ where: { productId } });
      await prisma.product.delete({ where: { id: productId } });
    });

    it('returns an additive untracked response for cold-start', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/inventory/estimate/${productId}`)
        .expect(200);

      expect(response.body).toMatchObject({
        productId,
        predictedState: PredictedState.uncertain,
        trackingStatus: 'untracked',
        estimatedState: null,
        confidenceScore: 0,
      });
      expect(response.body.deterministicSignals.coldStart).toBe(true);
    });

    it('does not persist a prediction during a read', async () => {
      await request(app.getHttpServer())
        .get(`/api/v1/inventory/estimate/${productId}`)
        .expect(200);

      const predictions = await prisma.prediction.findMany({
        where: { productId },
      });

      expect(predictions).toEqual([]);
    });

    it('should return 404 for unknown product', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/inventory/estimate/nonexistent-id')
        .expect(404);
    });

    it('returns a materialized out projection without creating a prediction', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/inventory/events')
        .send({ productId, eventType: InventoryEventType.STOCK_OUT })
        .expect(201);

      const response = await request(app.getHttpServer())
        .get(`/api/v1/inventory/estimate/${productId}`)
        .expect(200);

      expect(response.body).toMatchObject({
        trackingStatus: 'tracked',
        predictedState: PredictedState.probably_out,
        estimatedState: PredictedState.probably_out,
        estimatedQuantity: 0,
      });

      const predictions = await prisma.prediction.findMany({
        where: { productId },
      });
      expect(predictions).toEqual([]);
    });

    it('should return uncertain when prediction disabled', async () => {
      // Disable prediction for this product
      await prisma.product.update({
        where: { id: productId },
        data: { predictionEnabled: false },
      });

      const response = await request(app.getHttpServer())
        .get(`/api/v1/inventory/estimate/${productId}`)
        .expect(200);

      expect(response.body).toMatchObject({
        predictedState: PredictedState.uncertain,
        confidenceScore: 0,
      });
    });
  });
});
