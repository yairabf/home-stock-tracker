import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { RequestMethod, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { AppModule } from '../src/app.module';
import { TEST_MODEL_CONFIG } from './app-module-fixture';
import { JevDecisionClient } from '../src/llm/typesafe/jev-decision.client';
import { LLM_PROVIDER } from '../src/llm/llm-provider';
import { EstimationService } from '../src/estimation/estimation.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { createProductFixture } from './product-fixture';
import { DailyStockWorkflowService } from '../src/inventory/daily-stock-workflow.service';

describe.each(['openai', 'typesafe'] as const)(
  'Stock advisor %s provenance (PostgreSQL/Nest)',
  (selector) => {
    const config = {
      ...TEST_MODEL_CONFIG,
      stockPredictionProvider: selector,
      typesafeApiKey: 'private-fixture-key',
      jevModel: 'jev-1.13.0',
    };
    let app: INestApplication<App>;
    let client: Client;
    let prisma: PrismaService;
    let engine: EstimationService;
    let fetcher: jest.MockedFunction<typeof fetch>;
    let provider: { name: string; generateStructured: jest.Mock };
    let productId: string;
    let confidence: number;
    let choice: string;
    const priorMcp = process.env.MCP_ENABLED;

    beforeAll(async () => {
      process.env.MCP_ENABLED = 'true';
      fetcher = jest.fn();
      provider = { name: 'openai', generateStructured: jest.fn() };
      const module = await Test.createTestingModule({
        imports: [AppModule.register(config)],
      })
        .overrideProvider(JevDecisionClient)
        .useValue(new JevDecisionClient(config, fetcher))
        .overrideProvider(LLM_PROVIDER)
        .useValue(provider)
        .compile();
      app = module.createNestApplication();
      app.setGlobalPrefix('api/v1', {
        exclude: [{ path: 'mcp', method: RequestMethod.ALL }],
      });
      await app.listen(0, '127.0.0.1');
      prisma = app.get(PrismaService);
      engine = app.get(EstimationService);
      client = new Client({ name: 'jev-stock-e2e', version: '1.0.0' });
      await client.connect(
        new StreamableHTTPClientTransport(new URL('/mcp', await app.getUrl()), {
          requestInit: {
            headers: { authorization: 'Bearer e2e-service-token' },
          },
        }),
      );
    });

    beforeEach(async () => {
      productId = (
        await createProductFixture(prisma, {
          canonicalName: `jev-stock-${randomUUID()}`,
          productType: null,
        })
      ).id;
      confidence = 0.95;
      choice = 'probably_low';
      fetcher.mockReset();
      provider.generateStructured.mockReset();
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
      provider.generateStructured.mockImplementation(() =>
        Promise.resolve({
          status: 'success',
          provider: 'openai',
          model: 'resolved-openai-model',
          value: {
            predictedState: choice,
            confidence,
            reason: 'OpenAI fixture explanation',
            recommendedAction: null,
          },
        }),
      );
    });

    afterEach(async () => {
      if (!productId) return;
      await prisma.stockProjection.deleteMany({ where: { productId } });
      await prisma.productShelfLifePolicy.deleteMany({ where: { productId } });
      await prisma.llmInferenceLog.deleteMany({
        where: { prediction: { productId } },
      });
      await prisma.prediction.deleteMany({ where: { productId } });
      await prisma.productStatistics.deleteMany({ where: { productId } });
      await prisma.inventoryEvent.deleteMany({ where: { productId } });
      await prisma.product.deleteMany({ where: { id: productId } });
    });
    afterAll(async () => {
      await client?.close();
      await app?.close();
      if (priorMcp === undefined) delete process.env.MCP_ENABLED;
      else process.env.MCP_ENABLED = priorMcp;
    });

    async function history(coldStart = false) {
      const now = Date.now();
      await prisma.inventoryEvent.createMany({
        data: (coldStart ? [1] : [10, 20]).map((days) => ({
          productId,
          eventType: 'PURCHASED' as const,
          timestamp: new Date(now - days * 86_400_000),
          quantity: 4,
          unit: 'unit',
          source: 'e2e',
        })),
      });
      if (!coldStart)
        await prisma.productStatistics.create({
          data: { productId, avgPurchaseIntervalDays: 10, observationCount: 2 },
        });
    }

    it.each([0.64, 0.89, 0.95])(
      'round-trips accepted/rejected attempts at confidence %s',
      async (score) => {
        confidence = score;
        await history();
        const before = await prisma.inventoryEvent.findMany({
          where: { productId },
        });
        const result = await engine.predictProduct(productId);
        const accepted = score >= (selector === 'typesafe' ? 0.9 : 0.65);
        expect(result.llmAttempt).toMatchObject({
          accepted,
          taskVersion:
            selector === 'typesafe'
              ? 'jev-stock-prediction-v1'
              : 'prediction-reasoning-v1',
        });
        expect(result.llmContributed).toBe(accepted);
        const saved = await prisma.prediction.findUniqueOrThrow({
          where: { id: result.predictionId! },
          include: { llmInferenceLogs: true },
        });
        expect(saved.modelProviderVersion).toBe(
          accepted
            ? `${selector}/${selector === 'typesafe' ? 'jev-1.14.0' : 'resolved-openai-model'}`
            : null,
        );
        expect(saved.llmInferenceLogs).toHaveLength(1);
        const log = saved.llmInferenceLogs[0];
        expect(log).toMatchObject({
          modelProvider: selector,
          modelVersion:
            selector === 'typesafe' ? 'jev-1.14.0' : 'resolved-openai-model',
          promptVersion:
            selector === 'typesafe'
              ? 'jev-stock-prediction-v1'
              : 'prediction-reasoning-v1',
          confidence: score,
        });
        expect(log.structuredResponse).toEqual(
          selector === 'typesafe'
            ? { status: 'validated', accepted, value: result.llmAttempt!.value }
            : result.llmAttempt!.value,
        );
        expect(
          await prisma.inventoryEvent.findMany({ where: { productId } }),
        ).toEqual(before);
        expect(
          await prisma.groceryListItem.count({ where: { productId } }),
        ).toBe(0);
        expect(
          selector === 'typesafe' ? fetcher : provider.generateStructured,
        ).toHaveBeenCalledTimes(1);
        expect(
          selector === 'typesafe' ? provider.generateStructured : fetcher,
        ).not.toHaveBeenCalled();
      },
    );

    it('makes zero model calls and persists uncertainty with stale statistics but no history', async () => {
      await prisma.productStatistics.create({
        data: { productId, avgPurchaseIntervalDays: 5, observationCount: 10 },
      });
      const result = await engine.predictProduct(productId);
      expect(result).toMatchObject({
        predictedState: 'uncertain',
        confidenceScore: 0,
        recommendedAction: null,
        llmAttempt: null,
      });
      expect(
        await prisma.llmInferenceLog.count({
          where: { predictionId: result.predictionId },
        }),
      ).toBe(0);
      expect(fetcher).not.toHaveBeenCalled();
      expect(provider.generateStructured).not.toHaveBeenCalled();
    });

    async function projection() {
      const recordedAt = new Date(Date.now() - 2 * 86_400_000);
      const event = await prisma.inventoryEvent.create({
        data: {
          productId,
          eventType: 'STOCK_SET',
          quantity: 4,
          unit: 'unit',
          timestamp: recordedAt,
          source: 'e2e',
        },
      });
      return prisma.stockProjection.create({
        data: {
          productId,
          unit: 'unit',
          recordedQuantity: 4,
          recordedAt,
          recordedSource: 'e2e',
          recordedEventId: event.id,
          estimatedQuantity: 4,
          estimatedState: 'likely_available',
          confidence: 1,
          reason: 'stock_set',
          evaluatedAt: recordedAt,
        },
      });
    }

    it('keeps recorded and materialized stock intact; REST/MCP reads never call either advisor', async () => {
      await history();
      const before = await projection();
      const result = await engine.predictProduct(productId);
      expect(result.llmContributed).toBe(true);
      expect(
        await prisma.stockProjection.findUnique({ where: { productId } }),
      ).toEqual(before);
      fetcher.mockClear();
      provider.generateStructured.mockClear();
      const rest = await request(app.getHttpServer())
        .get(`/api/v1/inventory/estimate/${productId}`)
        .set('Authorization', 'Bearer e2e-service-token')
        .expect(200);
      const mcp = await client.callTool({
        name: 'get_inventory',
        arguments: { id: productId },
      });
      expect(mcp.isError).not.toBe(true);
      for (const response of [
        rest.body as Record<string, unknown>,
        mcp.structuredContent,
      ]) {
        expect(response).toMatchObject({
          productId,
          recordedQuantity: 4,
          estimatedQuantity: 4,
          predictedState: 'likely_available',
        });
        expect(response).not.toHaveProperty('llmAttempt');
        expect(JSON.stringify(response)).not.toMatch(
          /jev-1.14.0|resolved-openai-model/,
        );
      }
      expect(fetcher).not.toHaveBeenCalled();
      expect(provider.generateStructured).not.toHaveBeenCalled();
      expect(await prisma.groceryListItem.count({ where: { productId } })).toBe(
        0,
      );
    });

    it('keeps daily materialization deterministic and shelf-life generation on OpenAI', async () => {
      const before = await projection();
      provider.generateStructured.mockResolvedValue({
        status: 'success',
        provider: 'openai',
        model: 'resolved-openai-model',
        value: {
          kind: 'finite',
          shelfLifeDays: 5,
          confidence: 0.95,
          rationale: 'Shelf-life fixture',
        },
      });
      const summary = await app
        .get(DailyStockWorkflowService)
        .run(new Date(), [productId]);
      expect(summary.evaluation).toEqual({
        processed: 1,
        succeeded: 1,
        skipped: 0,
        failed: 0,
      });
      expect(summary.shelfLife.succeeded).toBe(1);
      expect(provider.generateStructured).toHaveBeenCalledTimes(1);
      expect(provider.generateStructured).toHaveBeenCalledWith(
        expect.objectContaining({ task: 'product-shelf-life-inference' }),
      );
      expect(fetcher).not.toHaveBeenCalled();
      expect(await prisma.prediction.count({ where: { productId } })).toBe(1);
      expect(
        await prisma.productShelfLifePolicy.findUnique({
          where: { productId },
        }),
      ).toMatchObject({
        modelProvider: 'openai',
        modelVersion: 'resolved-openai-model',
      });
      expect(
        await prisma.stockProjection.findUnique({ where: { productId } }),
      ).toMatchObject({
        recordedQuantity: before.recordedQuantity,
        recordedAt: before.recordedAt,
        recordedEventId: before.recordedEventId,
      });
      expect(await prisma.inventoryEvent.count({ where: { productId } })).toBe(
        1,
      );
    });

    if (selector === 'typesafe') {
      it.each(['uncertain', 'cold-start'])(
        'logs validated rejected %s advice',
        async (scenario) => {
          await history(scenario === 'cold-start');
          if (scenario === 'uncertain') choice = 'uncertain';
          const result = await engine.predictProduct(productId);
          expect(result).toMatchObject({
            predictedState: 'uncertain',
            llmContributed: false,
            llmAttempt: { accepted: false },
          });
          const log = await prisma.llmInferenceLog.findFirstOrThrow({
            where: { predictionId: result.predictionId },
          });
          expect(log.structuredResponse).toMatchObject({
            status: 'validated',
            accepted: false,
          });
        },
      );
    }
  },
);
