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
    await prisma.prediction.deleteMany({});
    await prisma.inventoryEvent.deleteMany({});
    await prisma.groceryListItem.deleteMany({});
    await prisma.product.deleteMany({});
  });

  afterAll(async () => {
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
      await prisma.prediction.deleteMany({ where: { productId } });
      await prisma.inventoryEvent.deleteMany({ where: { productId } });
      await prisma.product.delete({ where: { id: productId } });
    });

    it('should return uncertain for cold-start (no events)', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/inventory/estimate/${productId}`)
        .expect(200);

      expect(response.body).toMatchObject({
        productId,
        predictedState: PredictedState.uncertain,
      });
      expect(response.body.deterministicSignals.coldStart).toBe(true);
    });

    it('should persist the prediction to the database', async () => {
      // Call the endpoint
      const response = await request(app.getHttpServer())
        .get(`/api/v1/inventory/estimate/${productId}`)
        .expect(200);

      // Verify prediction was persisted
      const predictions = await prisma.prediction.findMany({
        where: { productId },
      });

      expect(predictions.length).toBeGreaterThan(0);
      expect(predictions[0]).toMatchObject({
        id: response.body.predictionId,
        productId,
        predictedState: PredictedState.uncertain,
      });
    });

    it('should return 404 for unknown product', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/inventory/estimate/nonexistent-id')
        .expect(404);
    });

    it('should return probably_out when most recent event is STOCK_OUT', async () => {
      const now = new Date();
      const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);

      await prisma.inventoryEvent.create({
        data: {
          productId,
          eventType: InventoryEventType.PURCHASED,
          timestamp: fiveDaysAgo,
          source: 'test',
        },
      });

      await prisma.inventoryEvent.create({
        data: {
          productId,
          eventType: InventoryEventType.STOCK_OUT,
          timestamp: now,
          source: 'test',
        },
      });

      const response = await request(app.getHttpServer())
        .get(`/api/v1/inventory/estimate/${productId}`)
        .expect(200);

      expect(response.body.predictedState).toBe(PredictedState.probably_out);

      // Verify persistence
      const prediction = await prisma.prediction.findFirst({
        where: { productId },
        orderBy: { predictedAt: 'desc' },
      });
      expect(prediction?.predictedState).toBe(PredictedState.probably_out);
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
