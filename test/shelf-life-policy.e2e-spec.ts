import 'dotenv/config';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import type { App } from 'supertest/types';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { TEST_MODEL_CONFIG } from './app-module-fixture';
import { PrismaService } from '../src/prisma/prisma.service';
import { LLM_PROVIDER } from '../src/llm/llm-provider';
import { JevDecisionClient } from '../src/llm/typesafe/jev-decision.client';
import { ShelfLifeInferenceService } from '../src/inventory/shelf-life-inference.service';
import { DailyStockWorkflowService } from '../src/inventory/daily-stock-workflow.service';
import { ShelfLifePolicyLog } from '../src/inventory/shelf-life-policy-log.service';
import { createProductFixture } from './product-fixture';

const context = {
  version: 1,
  storage: 'refrigerated',
  maxTemperatureC: 4,
  preparation: 'raw',
  form: 'shell',
};
const jevResponse = {
  status: 'success',
  provider: 'typesafe',
  task: 'shelf_life_policy',
  taskVersion: 'jev-shelf-life-policy-v1',
  model: 'jev-1.0.0',
  choice: 'policy_0',
  confidence: 0.95,
  probabilities: { policy_0: 0.95, unknown: 0.05 },
  usage: { input_tokens: 10, output_tokens: 1 },
};
const openaiResponse = {
  status: 'success',
  provider: 'openai',
  model: 'fixture-model',
  value: {
    kind: 'finite',
    shelfLifeDays: 7,
    confidence: 0.95,
    rationale: 'Disposable test policy',
  },
};

describe.each(['openai', 'typesafe'] as const)(
  'shelf-life workflow with %s (isolated PostgreSQL)',
  (selector) => {
    let app: INestApplication<App>;
    let prisma: PrismaService;
    let inference: ShelfLifeInferenceService;
    let workflow: DailyStockWorkflowService;
    const ids: string[] = [];
    const choose = jest.fn(),
      generateStructured = jest.fn();
    const activeMock = selector === 'typesafe' ? choose : generateStructured;
    const activeResponse =
      selector === 'typesafe' ? jevResponse : openaiResponse;

    beforeAll(async () => {
      const url = new URL(process.env.DATABASE_URL ?? 'http://invalid');
      if (
        !['127.0.0.1', 'localhost'].includes(url.hostname) ||
        url.pathname !== '/home_stock_38c_test'
      )
        throw new Error(
          'Requires the dedicated local home_stock_38c_test database',
        );
      const module = await Test.createTestingModule({
        imports: [
          AppModule.register({
            ...TEST_MODEL_CONFIG,
            shelfLifePolicyProvider: selector,
            jevModel: 'jev-1.0.0',
            typesafeApiKey: 'unused-fixture-key',
          }),
        ],
      })
        .overrideProvider(LLM_PROVIDER)
        .useValue({ name: 'openai', generateStructured })
        .overrideProvider(JevDecisionClient)
        .useValue({ model: 'jev-1.0.0', configured: true, choose })
        .compile();
      app = module.createNestApplication<INestApplication<App>>();
      app.setGlobalPrefix('api/v1');
      await app.init();
      prisma = app.get(PrismaService);
      inference = app.get(ShelfLifeInferenceService);
      workflow = app.get(DailyStockWorkflowService);
    });
    beforeEach(() => {
      choose.mockReset();
      generateStructured.mockReset();
      choose.mockResolvedValue(jevResponse);
      generateStructured.mockResolvedValue(openaiResponse);
    });
    afterEach(async () => {
      const where = { productId: { in: ids } };
      await prisma.expirationBatch.deleteMany({ where });
      await prisma.stockProjection.deleteMany({ where });
      await prisma.prediction.deleteMany({ where });
      await prisma.inventoryEvent.deleteMany({ where });
      await prisma.product.deleteMany({ where: { id: { in: ids } } });
      ids.length = 0;
    });
    afterAll(async () => app?.close());

    async function product(name = 'eggs') {
      const item = await createProductFixture(prisma, {
        canonicalName: name,
        isPerishable: true,
        config: { shelfLifeContext: context },
      });
      ids.push(item.id);
      return item;
    }
    async function stock(productId: string) {
      const at = new Date('2026-10-04T00:00:00Z');
      const event = await prisma.inventoryEvent.create({
        data: {
          productId,
          eventType: 'PURCHASED',
          timestamp: at,
          source: 'api',
          quantity: 3,
          unit: 'unit',
        },
      });
      await prisma.stockProjection.create({
        data: {
          productId,
          unit: 'unit',
          recordedQuantity: 3,
          recordedAt: at,
          recordedEventId: event.id,
          recordedSource: 'api',
          estimatedQuantity: 3,
          estimatedState: 'likely_available',
          confidence: 1,
          reason: 'fixture',
          evaluatedAt: at,
        },
      });
      return event;
    }

    it('persists the selected policy through real daily wiring and reuses it on repeats', async () => {
      const item = await product();
      await stock(item.id);
      const first = await workflow.run(new Date('2026-10-05T00:00:00Z'), [
        item.id,
      ]);
      expect(first.shelfLife).toEqual({
        processed: 1,
        succeeded: 1,
        skipped: 0,
        failed: 0,
      });
      expect(first.evaluation.succeeded).toBe(1);
      const policy = await prisma.productShelfLifePolicy.findUniqueOrThrow({
        where: { productId: item.id },
      });
      expect(policy).toMatchObject({
        modelProvider: selector,
        shelfLifeDays: selector === 'typesafe' ? 21 : 7,
        promptVersion:
          selector === 'typesafe'
            ? 'jev-shelf-life-policy-v1'
            : 'shelf-life-inference-v1',
      });
      await workflow.run(new Date('2026-10-06T00:00:00Z'), [item.id]);
      expect(activeMock).toHaveBeenCalledTimes(1);
      expect(
        selector === 'typesafe' ? generateStructured : choose,
      ).not.toHaveBeenCalled();
      const logs = await prisma.llmInferenceLog.findMany({
        where: { promptVersion: policy.promptVersion! },
      });
      expect(
        logs.some(
          (log) =>
            (log.structuredResponse as { applied?: boolean }).applied === true,
        ),
      ).toBe(true);
    });
    it('leaves policy missing after provider failure and still materializes stock', async () => {
      const item = await product();
      await stock(item.id);
      activeMock.mockResolvedValue(
        selector === 'typesafe'
          ? {
              status: 'unavailable',
              provider: 'typesafe',
              task: 'shelf_life_policy',
              taskVersion: 'jev-shelf-life-policy-v1',
              reason: 'network_error',
            }
          : { status: 'unavailable' },
      );
      const run = await workflow.run(new Date('2026-10-05T00:00:00Z'), [
        item.id,
      ]);
      expect(run.shelfLife).toMatchObject({
        succeeded: 0,
        skipped: 1,
        failed: 0,
      });
      expect(run.evaluation.succeeded).toBe(1);
      expect(
        await prisma.productShelfLifePolicy.findUnique({
          where: { productId: item.id },
        }),
      ).toBeNull();
      expect(
        selector === 'typesafe' ? generateStructured : choose,
      ).not.toHaveBeenCalled();
    });
    it.each(['metadata', 'identity', 'context'] as const)(
      'discards inference after a concurrent %s correction',
      async (change) => {
        const item = await product();
        activeMock.mockImplementationOnce(async () => {
          if (change === 'metadata')
            await prisma.product.update({
              where: { id: item.id },
              data: { isPerishable: false },
            });
          else if (change === 'context')
            await prisma.product.update({
              where: { id: item.id },
              data: {
                config: { shelfLifeContext: { ...context, storage: 'frozen' } },
              },
            });
          else
            await prisma.productName.updateMany({
              where: { productId: item.id, kind: 'canonical' },
              data: {
                displayName: 'Renamed eggs',
                normalizedName: 'renamed eggs',
              },
            });
          return activeResponse;
        });
        expect(
          await inference.inferMissingPolicies(new Date(), [item.id]),
        ).toEqual({ processed: 1, succeeded: 0, skipped: 1, failed: 0 });
        expect(
          await prisma.productShelfLifePolicy.findUnique({
            where: { productId: item.id },
          }),
        ).toBeNull();
      },
    );
    it('reuses a policy inserted while inference is running', async () => {
      const item = await product();
      activeMock.mockImplementationOnce(async () => {
        await prisma.productShelfLifePolicy.create({
          data: {
            productId: item.id,
            kind: 'finite',
            shelfLifeDays: 3,
            confidence: 1,
            rationale: 'Concurrent explicit fixture',
            evaluatedAt: new Date(),
          },
        });
        return activeResponse;
      });
      expect(
        await inference.inferMissingPolicies(new Date(), [item.id]),
      ).toMatchObject({ succeeded: 0, skipped: 1, failed: 0 });
      expect(
        await prisma.productShelfLifePolicy.findUnique({
          where: { productId: item.id },
        }),
      ).toMatchObject({ shelfLifeDays: 3 });
    });
    it('serializes two competing policy creations without overwriting either', async () => {
      const item = await product();
      const runs = await Promise.all([
        inference.inferMissingPolicies(new Date(), [item.id]),
        inference.inferMissingPolicies(new Date(), [item.id]),
      ]);
      expect(runs.reduce((total, run) => total + run.succeeded, 0)).toBe(1);
      expect(runs.reduce((total, run) => total + run.failed, 0)).toBe(0);
      expect(
        await prisma.productShelfLifePolicy.count({
          where: { productId: item.id },
        }),
      ).toBe(1);
    });
    it('preserves explicit batch dates and makes no inference on REST reads', async () => {
      const item = await product();
      const event = await stock(item.id);
      const explicit = new Date('2026-10-07T00:00:00Z');
      await prisma.expirationBatch.create({
        data: {
          productId: item.id,
          purchaseEventId: event.id,
          expiresAt: explicit,
          source: 'api',
        },
      });
      const response = await request(app.getHttpServer())
        .get('/api/v1/inventory/expiration')
        .set('Authorization', 'Bearer e2e-service-token')
        .expect(200);
      expect(JSON.stringify(response.body)).toContain(explicit.toISOString());
      expect(JSON.stringify(response.body)).toContain('explicit');
      await request(app.getHttpServer())
        .get('/api/v1/inventory')
        .set('Authorization', 'Bearer e2e-service-token')
        .expect(200);
      expect(choose).not.toHaveBeenCalled();
      expect(generateStructured).not.toHaveBeenCalled();
      expect(
        await prisma.productShelfLifePolicy.count({
          where: { productId: item.id },
        }),
      ).toBe(0);
    });
    it('persists an accepted policy even if logging fails', async () => {
      const item = await product();
      const spy = jest
        .spyOn(app.get(ShelfLifePolicyLog), 'record')
        .mockRejectedValue(new Error('fixture logger failure'));
      try {
        expect(
          await inference.inferMissingPolicies(new Date(), [item.id]),
        ).toMatchObject({ succeeded: 1, failed: 0 });
      } finally {
        spy.mockRestore();
      }
    });
    if (selector === 'typesafe') {
      it('uses a bounded required fallback for a supported identity outside the registry', async () => {
        const item = await product('salmon');
        await prisma.product.update({
          where: { id: item.id },
          data: {
            config: {
              shelfLifeContext: { ...context, form: 'whole_or_pieces' },
            },
          },
        });
        expect(
          await inference.inferMissingPolicies(new Date(), [item.id]),
        ).toMatchObject({ succeeded: 1 });
        expect(choose).not.toHaveBeenCalled();
        expect(generateStructured).toHaveBeenCalledTimes(1);
        expect(
          await prisma.productShelfLifePolicy.findUnique({
            where: { productId: item.id },
          }),
        ).toMatchObject({
          modelProvider: 'openai',
          promptVersion: 'shelf-life-policy-generation-v2',
        });
      });
      it('keeps unknown context missing without spending on either provider', async () => {
        const item = await product();
        await prisma.product.update({
          where: { id: item.id },
          data: { config: {} },
        });
        expect(
          await inference.inferMissingPolicies(new Date(), [item.id]),
        ).toMatchObject({ skipped: 1, succeeded: 0 });
        expect(choose).not.toHaveBeenCalled();
        expect(generateStructured).not.toHaveBeenCalled();
      });
    }
  },
);
