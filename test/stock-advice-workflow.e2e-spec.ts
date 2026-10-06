import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { RequestMethod, type INestApplication } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { AppModule } from '../src/app.module';
import { TEST_MODEL_CONFIG } from './app-module-fixture';
import { STOCK_WORKFLOW_CONFIG } from '../src/config/application-config';
import { JevDecisionClient } from '../src/llm/typesafe/jev-decision.client';
import { LLM_PROVIDER } from '../src/llm/llm-provider';
import { PrismaService } from '../src/prisma/prisma.service';
import { DailyStockWorkflowService } from '../src/inventory/daily-stock-workflow.service';
import { STOCK_WORKFLOW_JOB } from '../src/inventory/stock-workflow-scheduler.service';
import { createProductFixture } from './product-fixture';

const config = {
  ...TEST_MODEL_CONFIG,
  stockPredictionProvider: 'typesafe' as const,
  typesafeApiKey: 'fixture-key',
  jevModel: 'jev-1.13.0',
};
const settings = {
  enabled: true,
  cron: '0 0 1 1 *',
  timezone: 'UTC',
  adviceEnabled: true,
  adviceMaxProducts: 20,
};

describe('Stock advice application workflow (Nest/PostgreSQL)', () => {
  let app: INestApplication<App>;
  let client: Client;
  let prisma: PrismaService;
  let workflow: DailyStockWorkflowService;
  let ids: string[] = [];
  let cutoff: Date;
  let choice: string;
  let confidence: number;
  const fetcher: jest.MockedFunction<typeof fetch> = jest.fn();
  const generation = jest.fn().mockResolvedValue({ status: 'unavailable' });
  const priorMcp = process.env.MCP_ENABLED;
  let householdId: string;
  let originalThreshold: number;
  beforeAll(async () => {
    process.env.MCP_ENABLED = 'true';
    const module = await Test.createTestingModule({
      imports: [AppModule.register(config)],
    })
      .overrideProvider(STOCK_WORKFLOW_CONFIG)
      .useValue(settings)
      .overrideProvider(JevDecisionClient)
      .useValue(new JevDecisionClient(config, fetcher))
      .overrideProvider(LLM_PROVIDER)
      .useValue({ name: 'openai', generateStructured: generation })
      .compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api/v1', {
      exclude: [{ path: 'mcp', method: RequestMethod.ALL }],
    });
    await app.listen(0, '127.0.0.1');
    prisma = app.get(PrismaService);
    workflow = app.get(DailyStockWorkflowService);
    client = new Client({
      name: 'stock-advice-workflow-tests',
      version: '1.0.0',
    });
    await client.connect(
      new StreamableHTTPClientTransport(new URL('/mcp', await app.getUrl()), {
        requestInit: { headers: { authorization: 'Bearer e2e-service-token' } },
      }),
    );
    const household =
      (await prisma.household.findFirst()) ??
      (await prisma.household.create({ data: {} }));
    householdId = household.id;
    originalThreshold = household.suggestionConfidenceThreshold;
  });
  beforeEach(async () => {
    ids = [];
    cutoff = new Date();
    choice = 'probably_low';
    confidence = 0.95;
    settings.adviceEnabled = true;
    settings.adviceMaxProducts = 20;
    fetcher.mockReset();
    generation.mockClear();
    fetcher.mockImplementation((_url, init) => {
      const body = JSON.parse(init?.body as string) as {
        questions: { stock_state: { criteria: Record<string, unknown> } };
      };
      return Promise.resolve(
        new Response(
          JSON.stringify({
            model: 'jev-1.14.0',
            answers: {
              stock_state: {
                type: 'choice',
                choice,
                confidence,
                probabilities: Object.fromEntries(
                  Object.keys(body.questions.stock_state.criteria).map(
                    (key) => [key, key === choice ? 1 : 0],
                  ),
                ),
              },
            },
            usage: { input_tokens: 20, output_tokens: 3 },
          }),
          { status: 200 },
        ),
      );
    });
    await prisma.household.update({
      where: { id: householdId },
      data: { suggestionConfidenceThreshold: 0.5 },
    });
  });
  afterEach(async () => {
    const where = { productId: { in: ids } };
    await prisma.groceryListItem.deleteMany({ where });
    await prisma.llmInferenceLog.deleteMany({ where: { prediction: where } });
    await prisma.stockAdviceAttempt.deleteMany({ where });
    await prisma.stockProjection.deleteMany({ where });
    await prisma.productShelfLifePolicy.deleteMany({ where });
    await prisma.prediction.deleteMany({ where });
    await prisma.productStatistics.deleteMany({ where });
    await prisma.inventoryEvent.deleteMany({ where });
    await prisma.product.deleteMany({ where: { id: { in: ids } } });
    await prisma.household.update({
      where: { id: householdId },
      data: { suggestionConfidenceThreshold: originalThreshold },
    });
  });
  afterAll(async () => {
    await client?.close();
    await app?.close();
    if (priorMcp === undefined) delete process.env.MCP_ENABLED;
    else process.env.MCP_ENABLED = priorMcp;
  });
  async function tracked(history = true) {
    const productId = (
      await createProductFixture(prisma, {
        canonicalName: `workflow-advice-${randomUUID()}`,
        productType: null,
      })
    ).id;
    ids.push(productId);
    const events = await Promise.all(
      [20, 10].map((days) =>
        prisma.inventoryEvent.create({
          data: {
            productId,
            eventType: history ? 'PURCHASED' : 'GROCERY_ADDED',
            timestamp: new Date(cutoff.getTime() - days * 86400000),
            source: 'e2e',
          },
        }),
      ),
    );
    await prisma.productStatistics.create({
      data: { productId, avgPurchaseIntervalDays: 10, observationCount: 2 },
    });
    await prisma.productShelfLifePolicy.create({
      data: {
        productId,
        kind: 'nonperishable',
        confidence: 1,
        rationale: 'Fixture',
        evaluatedAt: cutoff,
      },
    });
    await prisma.stockProjection.create({
      data: {
        productId,
        unit: 'unit',
        recordedQuantity: null,
        recordedAt: events[1].timestamp,
        recordedSource: 'e2e',
        recordedEventId: events[1].id,
        estimatedQuantity: null,
        estimatedState: 'uncertain',
        confidence: 0.6,
        reason: 'fixture',
        evaluatedAt: cutoff,
      },
    });
    return productId;
  }
  it('uses actual JEV routing, publishes accepted advice and reuses unchanged evidence', async () => {
    const id = await tracked();
    expect((await workflow.run(cutoff, [id])).evaluation).toEqual({
      processed: 1,
      succeeded: 1,
      skipped: 0,
      failed: 0,
    });
    const projection = await prisma.stockProjection.findUniqueOrThrow({
      where: { productId: id },
    });
    expect(projection).toMatchObject({
      estimatedState: 'probably_low',
      confidence: 0.6,
      estimatedQuantity: null,
      recordedQuantity: null,
    });
    expect(
      await prisma.prediction.findUnique({
        where: { id: projection.predictionId! },
      }),
    ).toMatchObject({ modelProviderVersion: 'typesafe/jev-1.14.0' });
    await workflow.run(cutoff, [id]);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(generation).not.toHaveBeenCalled();
  });
  it('runs the same phase through the registered scheduled callback', async () => {
    const id = await tracked();
    await app
      .get(SchedulerRegistry)
      .getCronJob(STOCK_WORKFLOW_JOB)
      .fireOnTick();
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(
      await prisma.stockProjection.findUnique({ where: { productId: id } }),
    ).toMatchObject({ estimatedState: 'probably_low' });
  });
  it('caps advice while deterministically evaluating every selected product', async () => {
    settings.adviceMaxProducts = 1;
    await tracked();
    await tracked();
    expect((await workflow.run(cutoff, ids)).evaluation.succeeded).toBe(2);
    expect(fetcher).toHaveBeenCalledTimes(1);
    const attempts = await prisma.stockAdviceAttempt.findMany({
      where: { productId: { in: ids } },
    });
    expect(attempts).toHaveLength(1);
    expect(attempts[0].productId).toBe([...ids].sort()[0]);
  });
  async function recommendations() {
    return request(app.getHttpServer())
      .get('/api/v1/inventory/predictions/low-stock')
      .set('Authorization', 'Bearer e2e-service-token')
      .expect(200);
  }
  it.each(['probably_low', 'probably_out'])(
    'exposes accepted %s advice through REST/MCP without read-time inference',
    async (state) => {
      const id = await tracked();
      choice = state;
      const events = await prisma.inventoryEvent.count({
        where: { productId: id },
      });
      await workflow.run(cutoff, [id]);
      const rest = await recommendations();
      const mcp = await client.callTool({
        name: 'get_low_stock_predictions',
        arguments: {},
      });
      const expected = {
        recommendations: [
          expect.objectContaining({
            productId: id,
            predictedState: state,
            confidenceScore: 0.6,
          }),
        ],
      };
      expect(rest.body as unknown).toMatchObject(expected);
      expect(mcp.structuredContent).toMatchObject(expected);
      fetcher.mockClear();
      generation.mockClear();
      await request(app.getHttpServer())
        .get(`/api/v1/inventory/estimate/${id}`)
        .set('Authorization', 'Bearer e2e-service-token')
        .expect(200);
      const stock = await client.callTool({
        name: 'get_inventory',
        arguments: { id },
      });
      expect(stock.isError).not.toBe(true);
      expect(stock.structuredContent).toMatchObject({
        predictedState: state,
        estimatedQuantity: null,
        recordedQuantity: null,
      });
      await recommendations();
      await client.callTool({
        name: 'get_low_stock_predictions',
        arguments: {},
      });
      expect(fetcher).not.toHaveBeenCalled();
      expect(generation).not.toHaveBeenCalled();
      expect(
        await prisma.inventoryEvent.count({ where: { productId: id } }),
      ).toBe(events);
      expect(
        await prisma.groceryListItem.count({ where: { productId: id } }),
      ).toBe(0);
    },
  );
  it('preserves threshold and pending grocery suppression', async () => {
    const id = await tracked();
    await workflow.run(cutoff, [id]);
    await prisma.household.update({
      where: { id: householdId },
      data: { suggestionConfidenceThreshold: 0.7 },
    });
    expect((await recommendations()).body as unknown).toEqual({
      recommendations: [],
    });
    await prisma.household.update({
      where: { id: householdId },
      data: { suggestionConfidenceThreshold: 0.5 },
    });
    await prisma.groceryListItem.create({
      data: { productId: id, requestedQuantity: 1, source: 'api' },
    });
    expect((await recommendations()).body as unknown).toEqual({
      recommendations: [],
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it.each(['uncertain', 'low_confidence'])(
    'suppresses %s advice and persists rejection',
    async (scenario) => {
      const id = await tracked();
      if (scenario === 'uncertain') choice = 'uncertain';
      else confidence = 0.899;
      await workflow.run(cutoff, [id]);
      await workflow.run(cutoff, [id]);
      expect((await recommendations()).body as unknown).toEqual({
        recommendations: [],
      });
      expect(fetcher).toHaveBeenCalledTimes(1);
      expect(generation).not.toHaveBeenCalled();
      expect(
        await prisma.stockAdviceAttempt.findFirst({ where: { productId: id } }),
      ).toMatchObject({
        status: 'completed',
        applicationStatus: 'not_applied',
        response: { accepted: false },
      });
      const projection = await prisma.stockProjection.findUniqueOrThrow({
        where: { productId: id },
      });
      expect(
        await prisma.prediction.findUnique({
          where: { id: projection.predictionId! },
        }),
      ).toMatchObject({ llmResult: null, modelProviderVersion: null });
    },
  );
  it('does not spend on zero valid history or expired deterministic stock', async () => {
    const empty = await tracked(false);
    const expired = await tracked();
    await prisma.productShelfLifePolicy.update({
      where: { productId: expired },
      data: { kind: 'finite', shelfLifeDays: 1 },
    });
    await workflow.run(cutoff, ids);
    expect(fetcher).not.toHaveBeenCalled();
    expect(generation).not.toHaveBeenCalled();
    expect(
      await prisma.stockProjection.findUnique({ where: { productId: empty } }),
    ).toMatchObject({ estimatedState: 'uncertain' });
    expect(
      await prisma.stockProjection.findUnique({
        where: { productId: expired },
      }),
    ).toMatchObject({
      estimatedState: 'probably_out',
      estimatedQuantity: 0,
      recordedQuantity: null,
    });
    const expiration = await request(app.getHttpServer())
      .get('/api/v1/inventory/expiration/recommendations')
      .set('Authorization', 'Bearer e2e-service-token')
      .expect(200);
    expect(expiration.body as unknown).toMatchObject({
      expiringSoon: [],
      possiblyExpired: [],
    });
  });
  it('leaves unavailable advice deterministic and avoids a repeat or OpenAI fallback', async () => {
    const id = await tracked();
    fetcher.mockResolvedValue(new Response('{}', { status: 200 }));
    await workflow.run(cutoff, [id]);
    await workflow.run(cutoff, [id]);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(generation).not.toHaveBeenCalled();
    expect(
      await prisma.stockAdviceAttempt.findFirst({ where: { productId: id } }),
    ).toMatchObject({
      status: 'unavailable',
      applicationStatus: 'not_applied',
    });
    const log = await prisma.llmInferenceLog.findFirst({
      where: { prediction: { productId: id } },
    });
    expect(log).toMatchObject({
      structuredResponse: {
        status: 'unavailable',
        resolvedModel: null,
        configuredModel: 'jev-1.13.0',
      },
    });
  });
  it('continues to the next product after invalid provider output', async () => {
    await tracked();
    await tracked();
    fetcher.mockResolvedValueOnce(new Response('{}', { status: 200 }));
    expect((await workflow.run(cutoff, ids)).evaluation).toEqual({
      processed: 2,
      succeeded: 2,
      skipped: 0,
      failed: 0,
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(generation).not.toHaveBeenCalled();
    expect(
      await prisma.stockAdviceAttempt.count({
        where: { productId: { in: ids }, applicationStatus: 'applied' },
      }),
    ).toBe(1);
  });
  it('invalidates a delayed JEV answer after an authenticated stock correction', async () => {
    const id = await tracked();
    let signal!: () => void;
    let release!: () => void;
    const entered = new Promise<void>((resolve) => {
      signal = resolve;
    });
    const waiting = new Promise<void>((resolve) => {
      release = resolve;
    });
    const respond = fetcher.getMockImplementation()!;
    fetcher.mockImplementationOnce(async (url, init) => {
      signal();
      await waiting;
      return respond(url, init);
    });
    const pending = workflow.run(cutoff, [id]);
    await entered;
    try {
      await request(app.getHttpServer())
        .post(`/api/v1/inventory/stock/${id}`)
        .set('Authorization', 'Bearer e2e-service-token')
        .send({ operation: 'set', quantity: 5, unit: 'unit' })
        .expect(201);
    } finally {
      release();
    }
    await pending;
    expect(
      await prisma.stockProjection.findUnique({ where: { productId: id } }),
    ).toMatchObject({
      recordedQuantity: 5,
      estimatedQuantity: 5,
      estimatedState: 'likely_available',
      predictionId: null,
    });
    expect(
      await prisma.stockAdviceAttempt.findFirst({ where: { productId: id } }),
    ).toMatchObject({
      response: { accepted: true },
      applicationStatus: 'stale',
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(generation).not.toHaveBeenCalled();
  });
  it('rolls saved advice back through disabled deterministic reevaluation', async () => {
    const id = await tracked();
    await workflow.run(cutoff, [id]);
    settings.adviceEnabled = false;
    await workflow.run(cutoff, [id]);
    expect(
      await prisma.stockProjection.findUnique({ where: { productId: id } }),
    ).toMatchObject({ estimatedState: 'uncertain' });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(
      await prisma.stockAdviceAttempt.count({ where: { productId: id } }),
    ).toBe(1);
  });
  it('suppresses simultaneous duplicate inference and later reapplies the cached accepted result', async () => {
    const id = await tracked();
    let signal!: () => void;
    let release!: () => void;
    const entered = new Promise<void>((resolve) => {
      signal = resolve;
    });
    const waiting = new Promise<void>((resolve) => {
      release = resolve;
    });
    const respond = fetcher.getMockImplementation()!;
    fetcher.mockImplementationOnce(async (url, init) => {
      signal();
      await waiting;
      return respond(url, init);
    });
    const first = workflow.run(cutoff, [id]);
    await entered;
    try {
      await workflow.run(cutoff, [id]);
    } finally {
      release();
    }
    await first;
    await workflow.run(cutoff, [id]);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(
      await prisma.stockProjection.findUnique({ where: { productId: id } }),
    ).toMatchObject({ estimatedState: 'probably_low' });
    expect(
      await prisma.stockAdviceAttempt.count({ where: { productId: id } }),
    ).toBe(1);
  });
  it('permits a new advice attempt when the evaluation day changes', async () => {
    const id = await tracked();
    await workflow.run(cutoff, [id]);
    await workflow.run(new Date(cutoff.getTime() + 86400000), [id]);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(
      await prisma.stockAdviceAttempt.count({ where: { productId: id } }),
    ).toBe(2);
  });
});
