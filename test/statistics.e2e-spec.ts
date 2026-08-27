import 'dotenv/config';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { InventoryEventType, ProductType } from '../src/generated/prisma/enums';

describe('Statistics E2E Tests', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let productId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    // Clean up test data
    await prisma.productStatistics.deleteMany();
    await prisma.inventoryEvent.deleteMany();
    await prisma.groceryListItem.deleteMany();
    await prisma.product.deleteMany();

    // Create test product
    const product = await prisma.product.create({
      data: {
        canonicalName: 'Test Milk',
        aliases: ['milk', 'dairy milk'],
        category: 'Dairy',
        typicalUnit: 'liter',
        productType: ProductType.fast_consumable,
        isPerishable: true,
        predictionEnabled: true,
      },
    });
    productId = product.id;
  });

  describe('POST /inventory/statistics/:productId/calculate', () => {
    it('should calculate statistics for product with no events', async () => {
      const response = await request(app.getHttpServer())
        .post(`/inventory/statistics/${productId}/calculate`)
        .expect(200);

      expect(response.body).toMatchObject({
        productId,
        avgPurchaseIntervalDays: null,
        avgNeedIntervalDays: null,
        typicalPurchaseQuantity: null,
        estimatedConsumptionIntervalDays: null,
        observationCount: 0,
        lastPurchaseAt: null,
        lastLowStockSignalAt: null,
        lastStockConfirmationAt: null,
      });
      expect(response.body.updatedAt).toBeDefined();
    });

    it('should calculate statistics for healthy event history', async () => {
      const now = new Date();

      // Create 5 purchase events, 7 days apart (spanning 28 days over 5 events)
      await prisma.inventoryEvent.createMany({
        data: [
          {
            productId,
            eventType: InventoryEventType.PURCHASED,
            quantity: 2,
            timestamp: new Date(now.getTime() - 0 * 24 * 60 * 60 * 1000),
            source: 'test',
          },
          {
            productId,
            eventType: InventoryEventType.PURCHASED,
            quantity: 2,
            timestamp: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
            source: 'test',
          },
          {
            productId,
            eventType: InventoryEventType.PURCHASED,
            quantity: 2,
            timestamp: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000),
            source: 'test',
          },
          {
            productId,
            eventType: InventoryEventType.PURCHASED,
            quantity: 2,
            timestamp: new Date(now.getTime() - 21 * 24 * 60 * 60 * 1000),
            source: 'test',
          },
          {
            productId,
            eventType: InventoryEventType.PURCHASED,
            quantity: 2,
            timestamp: new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000),
            source: 'test',
          },
        ],
      });

      await prisma.inventoryEvent.createMany({
        data: [
          {
            productId,
            eventType: InventoryEventType.STOCK_LOW,
            timestamp: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000),
            source: 'test',
          },
          {
            productId,
            eventType: InventoryEventType.STOCK_LOW,
            timestamp: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000),
            source: 'test',
          },
        ],
      });

      const response = await request(app.getHttpServer())
        .post(`/inventory/statistics/${productId}/calculate`)
        .expect(200);

      expect(response.body.productId).toBe(productId);
      expect(response.body.avgPurchaseIntervalDays).toBeCloseTo(7.0, 0);
      expect(response.body.avgNeedIntervalDays).toBeCloseTo(7.0, 0);
      expect(response.body.typicalPurchaseQuantity).toBe(2);
      expect(response.body.observationCount).toBe(7);
      expect(response.body.lastPurchaseAt).toBeDefined();
      expect(response.body.lastLowStockSignalAt).toBeDefined();
    });

    it('should return 404 for unknown product', async () => {
      await request(app.getHttpServer())
        .post('/inventory/statistics/unknown-id/calculate')
        .expect(404);
    });

    it('should handle insufficient purchase events', async () => {
      // Only 1 purchase event
      await prisma.inventoryEvent.create({
        data: {
          productId,
          eventType: InventoryEventType.PURCHASED,
          quantity: 1,
          timestamp: new Date(),
          source: 'test',
        },
      });

      const response = await request(app.getHttpServer())
        .post(`/inventory/statistics/${productId}/calculate`)
        .expect(200);

      expect(response.body.avgPurchaseIntervalDays).toBeNull();
      expect(response.body.observationCount).toBe(1);
    });

    it('should handle missing quantity data', async () => {
      await prisma.inventoryEvent.createMany({
        data: [
          {
            productId,
            eventType: InventoryEventType.PURCHASED,
            quantity: null,
            timestamp: new Date(),
            source: 'test',
          },
          {
            productId,
            eventType: InventoryEventType.PURCHASED,
            quantity: 0,
            timestamp: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
            source: 'test',
          },
        ],
      });

      const response = await request(app.getHttpServer())
        .post(`/inventory/statistics/${productId}/calculate`)
        .expect(200);

      expect(response.body.typicalPurchaseQuantity).toBeNull();
    });
  });

  describe('Estimation with learned statistics', () => {
    it('should improve estimation accuracy with learned intervals', async () => {
      const now = new Date();

      // Create 5 purchase events, 7 days apart
      await prisma.inventoryEvent.createMany({
        data: [
          {
            productId,
            eventType: InventoryEventType.PURCHASED,
            quantity: 2,
            timestamp: new Date(now.getTime() - 0 * 24 * 60 * 60 * 1000),
            source: 'test',
          },
          {
            productId,
            eventType: InventoryEventType.PURCHASED,
            quantity: 2,
            timestamp: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
            source: 'test',
          },
          {
            productId,
            eventType: InventoryEventType.PURCHASED,
            quantity: 2,
            timestamp: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000),
            source: 'test',
          },
          {
            productId,
            eventType: InventoryEventType.PURCHASED,
            quantity: 2,
            timestamp: new Date(now.getTime() - 21 * 24 * 60 * 60 * 1000),
            source: 'test',
          },
          {
            productId,
            eventType: InventoryEventType.PURCHASED,
            quantity: 2,
            timestamp: new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000),
            source: 'test',
          },
        ],
      });

      // Calculate statistics
      const statsResponse = await request(app.getHttpServer())
        .post(`/inventory/statistics/${productId}/calculate`)
        .expect(200);

      expect(statsResponse.body.avgPurchaseIntervalDays).toBeCloseTo(7.0, 0);

      // Get estimation - should use learned interval with ±20% buffer
      const estimationResponse = await request(app.getHttpServer())
        .get(`/inventory/estimate/${productId}`)
        .expect(200);

      expect(
        estimationResponse.body.deterministicSignals.hasLearnedStatistics,
      ).toBe(true);
      expect(
        estimationResponse.body.deterministicSignals.avgPurchaseIntervalDays,
      ).toBeCloseTo(7.0, 0);
      // Confidence should be boosted for learned statistics
      expect(estimationResponse.body.confidenceScore).toBeGreaterThan(0.5);
    });
  });
});
