import 'dotenv/config';
import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import {
  FeedbackStatus,
  InventoryEventType,
  PredictedState,
} from '../src/generated/prisma/enums';
import { PrismaService } from '../src/prisma/prisma.service';
import { ServiceAuthGuard } from '../src/auth/service-auth.guard';
import { AUTH_TEST_BYPASS } from './auth-test-bypass';
import { createProductFixture } from './product-fixture';

describe('Prediction feedback (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let productId: string;
  let predictionId: string;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    })
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

  beforeEach(async () => {
    const product = await createProductFixture(prisma, {
      canonicalName: `feedback-${Date.now()}`,
    });
    productId = product.id;
    const prediction = await prisma.prediction.create({
      data: {
        productId,
        predictedState: PredictedState.probably_low,
        confidenceScore: 0.8,
        deterministicSignals: {},
        reason: 'Test prediction',
      },
    });
    predictionId = prediction.id;
  });

  afterEach(async () => {
    await prisma.inventoryEvent.deleteMany({ where: { productId } });
    await prisma.productStatistics.deleteMany({ where: { productId } });
    await prisma.prediction.deleteMany({ where: { productId } });
    await prisma.product.delete({ where: { id: productId } });
  });

  afterAll(async () => app.close());

  it('records accepted feedback and updates product accuracy', async () => {
    const response = await request(app.getHttpServer())
      .post(`/api/v1/inventory/predictions/${predictionId}/feedback`)
      .send({ outcome: 'accepted' })
      .expect(201);

    expect(response.body).toMatchObject({
      predictionId,
      productId,
      feedbackStatus: FeedbackStatus.accepted,
      outcome: 'accepted',
      correctedState: null,
      predictionAccuracy: 1,
    });
    const [prediction, event, statistics] = await Promise.all([
      prisma.prediction.findUniqueOrThrow({ where: { id: predictionId } }),
      prisma.inventoryEvent.findFirstOrThrow({ where: { productId } }),
      prisma.productStatistics.findUniqueOrThrow({ where: { productId } }),
    ]);
    expect(prediction.feedbackStatus).toBe(FeedbackStatus.accepted);
    expect(event).toMatchObject({
      id: response.body.feedbackEventId,
      eventType: InventoryEventType.PREDICTION_ACCEPTED,
      source: 'api',
    });
    expect(statistics.predictionAccuracy).toBe(1);
  });

  it('rejects caller-controlled feedback source attribution', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/inventory/predictions/${predictionId}/feedback`)
      .send({ outcome: 'accepted', source: 'mcp' })
      .expect(400);
  });

  it('records a correction as rejected and preserves other statistics fields', async () => {
    await prisma.productStatistics.create({
      data: { productId, observationCount: 7, avgPurchaseIntervalDays: 4 },
    });
    await request(app.getHttpServer())
      .post(`/api/v1/inventory/predictions/${predictionId}/feedback`)
      .send({
        outcome: 'corrected',
        correctedState: PredictedState.probably_out,
      })
      .expect(201)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          feedbackStatus: FeedbackStatus.rejected,
          correctedState: PredictedState.probably_out,
          predictionAccuracy: 0,
        });
      });

    const event = await prisma.inventoryEvent.findFirstOrThrow({
      where: { productId },
    });
    const statistics = await prisma.productStatistics.findUniqueOrThrow({
      where: { productId },
    });
    expect(event.eventType).toBe(InventoryEventType.STOCK_CORRECTED);
    expect(event.metadata).toMatchObject({
      correctedState: PredictedState.probably_out,
    });
    expect(statistics).toMatchObject({
      observationCount: 7,
      avgPurchaseIntervalDays: 4,
      predictionAccuracy: 0,
    });
  });

  it('rejects repeated feedback without another event', async () => {
    const endpoint = `/api/v1/inventory/predictions/${predictionId}/feedback`;
    await request(app.getHttpServer())
      .post(endpoint)
      .send({ outcome: 'rejected' })
      .expect(201);
    await request(app.getHttpServer())
      .post(endpoint)
      .send({ outcome: 'accepted' })
      .expect(409);
    await expect(
      prisma.inventoryEvent.count({ where: { productId } }),
    ).resolves.toBe(1);
  });

  it('returns 404 for an unknown prediction', async () => {
    await request(app.getHttpServer())
      .post(
        '/api/v1/inventory/predictions/00000000-0000-4000-8000-000000000000/feedback',
      )
      .send({ outcome: 'accepted' })
      .expect(404);
  });

  it.each([
    ['not-a-uuid', { outcome: 'accepted' }],
    [null, { outcome: 'corrected' }],
    [null, { outcome: 'accepted', correctedState: 'probably_out' }],
    [null, { outcome: 'corrected', correctedState: 'uncertain' }],
  ])('rejects malformed feedback', async (id, body) => {
    await request(app.getHttpServer())
      .post(`/api/v1/inventory/predictions/${id ?? predictionId}/feedback`)
      .send(body)
      .expect(400);
  });
});
