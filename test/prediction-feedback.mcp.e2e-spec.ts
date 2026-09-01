import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import {
  type INestApplication,
  RequestMethod,
  ValidationPipe,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import {
  FeedbackStatus,
  InventoryEventType,
  PredictedState,
} from '../src/generated/prisma/enums';
import { PrismaService } from '../src/prisma/prisma.service';
import { createProductFixture } from './product-fixture';

const AUTHORIZATION = 'Bearer e2e-service-token';
const UNKNOWN_PREDICTION_ID = '00000000-0000-4000-8000-000000000000';

describe('Prediction feedback MCP API (e2e)', () => {
  let app: INestApplication<App>;
  let client: Client;
  let prisma: PrismaService;
  let productId: string;
  let predictionId: string;
  const originalMcpEnabled = process.env.MCP_ENABLED;

  beforeAll(async () => {
    process.env.MCP_ENABLED = 'true';
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = module.createNestApplication();
    app.setGlobalPrefix('api/v1', {
      exclude: [{ path: 'mcp', method: RequestMethod.ALL }],
    });
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.listen(0, '127.0.0.1');
    prisma = app.get(PrismaService);

    client = new Client({ name: 'prediction-feedback-e2e', version: '1.0.0' });
    await client.connect(
      new StreamableHTTPClientTransport(new URL('/mcp', await app.getUrl()), {
        requestInit: { headers: { authorization: AUTHORIZATION } },
      }),
    );
  });

  beforeEach(async () => {
    const product = await createProductFixture(prisma, {
      canonicalName: `mcp-feedback-${randomUUID()}`,
    });
    productId = product.id;
    const prediction = await prisma.prediction.create({
      data: {
        productId,
        predictedState: PredictedState.probably_low,
        confidenceScore: 0.8,
        deterministicSignals: {},
        reason: 'MCP feedback test prediction',
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

  afterAll(async () => {
    await client.close();
    await app.close();
    if (originalMcpEnabled === undefined) {
      delete process.env.MCP_ENABLED;
    } else {
      process.env.MCP_ENABLED = originalMcpEnabled;
    }
  });

  it.each([
    [
      'accepted',
      FeedbackStatus.accepted,
      InventoryEventType.PREDICTION_ACCEPTED,
      1,
    ],
    [
      'rejected',
      FeedbackStatus.rejected,
      InventoryEventType.PREDICTION_REJECTED,
      0,
    ],
  ] as const)(
    'persists %s feedback through the real MCP transport',
    async (outcome, feedbackStatus, eventType, predictionAccuracy) => {
      const result = await callFeedback({ predictionId, outcome });

      expect(result.structuredContent).toMatchObject({
        predictionId,
        productId,
        feedbackStatus,
        outcome,
        correctedState: null,
        predictionAccuracy,
      });
      const [prediction, event, statistics] = await Promise.all([
        prisma.prediction.findUniqueOrThrow({ where: { id: predictionId } }),
        prisma.inventoryEvent.findFirstOrThrow({ where: { productId } }),
        prisma.productStatistics.findUniqueOrThrow({ where: { productId } }),
      ]);
      expect(prediction.feedbackStatus).toBe(feedbackStatus);
      expect(event).toMatchObject({
        eventType,
        source: 'mcp',
        metadata: { predictionId, outcome },
      });
      expect(statistics.predictionAccuracy).toBe(predictionAccuracy);
    },
  );

  it('persists corrected feedback and one linked stock observation atomically', async () => {
    await prisma.productStatistics.create({
      data: { productId, observationCount: 7, avgPurchaseIntervalDays: 4 },
    });

    const result = await callFeedback({
      predictionId,
      outcome: 'corrected',
      correctedState: PredictedState.likely_available,
    });

    expect(result.structuredContent).toMatchObject({
      predictionId,
      productId,
      feedbackStatus: FeedbackStatus.rejected,
      outcome: 'corrected',
      correctedState: PredictedState.likely_available,
      predictionAccuracy: 0,
    });
    const [prediction, events, statistics] = await Promise.all([
      prisma.prediction.findUniqueOrThrow({ where: { id: predictionId } }),
      prisma.inventoryEvent.findMany({ where: { productId } }),
      prisma.productStatistics.findUniqueOrThrow({ where: { productId } }),
    ]);
    expect(prediction.feedbackStatus).toBe(FeedbackStatus.rejected);
    expect(events).toEqual([
      expect.objectContaining({
        eventType: InventoryEventType.STOCK_CORRECTED,
        source: 'mcp',
        metadata: {
          predictionId,
          predictedState: PredictedState.probably_low,
          outcome: 'corrected',
          correctedState: PredictedState.likely_available,
        },
      }),
    ]);
    expect(statistics).toMatchObject({
      observationCount: 7,
      avgPurchaseIntervalDays: 4,
      predictionAccuracy: 0,
    });
  });

  it('returns a safe not-found result for an unknown prediction', async () => {
    const result = await callFeedback({
      predictionId: UNKNOWN_PREDICTION_ID,
      outcome: 'accepted',
    });

    expect(result).toEqual({
      content: [{ type: 'text', text: 'Prediction not found' }],
      isError: true,
    });
    await expect(unchangedPendingPrediction()).resolves.toBe(true);
  });

  it.each([
    {},
    { predictionId: 'not-a-uuid', outcome: 'accepted' },
    { predictionId: UNKNOWN_PREDICTION_ID, outcome: 'unknown' },
    { predictionId: UNKNOWN_PREDICTION_ID, outcome: 'corrected' },
    {
      predictionId: UNKNOWN_PREDICTION_ID,
      outcome: 'accepted',
      correctedState: PredictedState.probably_out,
    },
    {
      predictionId: UNKNOWN_PREDICTION_ID,
      outcome: 'corrected',
      correctedState: PredictedState.uncertain,
    },
    {
      predictionId: UNKNOWN_PREDICTION_ID,
      outcome: 'accepted',
      source: 'api',
    },
  ])('rejects malformed feedback without mutation', async (arguments_) => {
    const result = await client.callTool({
      name: 'record_prediction_feedback',
      arguments: arguments_,
    });

    expect(result.isError).toBe(true);
    await expect(unchangedPendingPrediction()).resolves.toBe(true);
  });

  it('rejects a correction equal to the stored prediction without mutation', async () => {
    const result = await callFeedback({
      predictionId,
      outcome: 'corrected',
      correctedState: PredictedState.probably_low,
    });

    expect(result).toEqual({
      content: [
        {
          type: 'text',
          text: 'correctedState must differ from the original predicted state',
        },
      ],
      isError: true,
    });
    await expect(unchangedPendingPrediction()).resolves.toBe(true);
  });

  it('conflicts on repeated feedback without creating another event', async () => {
    await callFeedback({ predictionId, outcome: 'rejected' });

    const repeated = await callFeedback({ predictionId, outcome: 'accepted' });

    expect(repeated).toEqual({
      content: [
        { type: 'text', text: 'Prediction feedback was already recorded' },
      ],
      isError: true,
    });
    await expect(
      prisma.inventoryEvent.count({ where: { productId } }),
    ).resolves.toBe(1);
    await expect(storedFeedbackStatus()).resolves.toBe(FeedbackStatus.rejected);
  });

  it('allows exactly one concurrent feedback submission to win', async () => {
    const results = await Promise.all([
      callFeedback({ predictionId, outcome: 'accepted' }),
      callFeedback({ predictionId, outcome: 'rejected' }),
    ]);

    expect(results.filter((result) => result.isError !== true)).toHaveLength(1);
    expect(results.find((result) => result.isError === true)).toEqual({
      content: [
        { type: 'text', text: 'Prediction feedback was already recorded' },
      ],
      isError: true,
    });
    await expect(
      prisma.inventoryEvent.count({ where: { productId } }),
    ).resolves.toBe(1);
    await expect(storedFeedbackStatus()).resolves.toMatch(
      /^(accepted|rejected)$/,
    );
  });

  function callFeedback(arguments_: Record<string, unknown>) {
    return client.callTool({
      name: 'record_prediction_feedback',
      arguments: arguments_,
    });
  }

  async function unchangedPendingPrediction(): Promise<boolean> {
    const [status, events, statistics] = await Promise.all([
      storedFeedbackStatus(),
      prisma.inventoryEvent.count({ where: { productId } }),
      prisma.productStatistics.findUnique({ where: { productId } }),
    ]);
    return (
      status === FeedbackStatus.pending && events === 0 && statistics === null
    );
  }

  async function storedFeedbackStatus(): Promise<FeedbackStatus> {
    const prediction = await prisma.prediction.findUniqueOrThrow({
      where: { id: predictionId },
    });
    return prediction.feedbackStatus;
  }
});
