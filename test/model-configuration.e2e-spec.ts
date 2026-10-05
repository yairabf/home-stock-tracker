import { PRODUCT_UNDERSTANDING } from '../src/product/product-understanding';
import { JevProductUnderstanding } from '../src/product/jev-product-understanding.service';
import { OpenAiProductUnderstanding } from '../src/product/openai-product-understanding.service';
import {
  PRODUCT_RESOLUTION_ADVISOR,
  type ProductResolutionAdvisor,
} from '../src/product/product-resolution-advisor';
import { OpenAiProductResolutionAdvisor } from '../src/product/openai-product-resolution-advisor.service';
import { JevProductResolutionAdvisor } from '../src/product/jev-product-resolution-advisor.service';
import { ProductSearchService } from '../src/product/product-search.service';
import { ProductResolutionService } from '../src/product/product-resolution.service';
import { RequestMethod, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { loadApplicationConfig } from '../src/config/application-config';
import { MODEL_CONFIG } from '../src/config/model-config.module';
import { GroceryService } from '../src/grocery/grocery.service';
import { LLM_PROVIDER, type LlmProvider } from '../src/llm/llm-provider';
import { JevDecisionClient } from '../src/llm/typesafe/jev-decision.client';
import { PrismaService } from '../src/prisma/prisma.service';
import { STOCK_PREDICTION_ADVISOR } from '../src/estimation/stock-prediction-advisor';
import { PredictionReasoner } from '../src/estimation/prediction-reasoner.service';
import { JevStockPredictionAdvisor } from '../src/estimation/jev-stock-prediction-advisor.service';

describe.each([
  ['openai', 'openai'],
  ['openai', 'typesafe'],
  ['typesafe', 'openai'],
  ['typesafe', 'typesafe'],
])(
  'Resolved matching=%s stock=%s model configuration (e2e)',
  (selector, stockSelector) => {
    const config = loadApplicationConfig({
      DATABASE_URL: 'postgresql://test:test@localhost:5432/unused',
      API_AUTH_TOKEN: 'e2e-service-token',
      OPENAI_API_KEY: 'fixture-openai-key',
      TYPESAFE_API_KEY: 'fixture-typesafe-key',
      JEV_MODEL: 'jev-1.13.0',
      PRODUCT_RESOLUTION_PROVIDER: selector,
      PRODUCT_UNDERSTANDING_PROVIDER: selector,
      STOCK_PREDICTION_PROVIDER: stockSelector,
    });
    const listItems = jest.fn().mockResolvedValue([]);
    let app: INestApplication<App>;
    let fetchSpy: jest.SpiedFunction<typeof fetch>;

    beforeAll(async () => {
      fetchSpy = jest
        .spyOn(globalThis, 'fetch')
        .mockRejectedValue(
          new Error(
            'Unexpected provider request during HTTP compatibility test',
          ),
        );
      const module = await Test.createTestingModule({
        imports: [AppModule.register(config)],
      })
        .overrideProvider(PrismaService)
        .useValue({
          $connect: jest.fn().mockResolvedValue(undefined),
          $disconnect: jest.fn().mockResolvedValue(undefined),
          $queryRaw: jest.fn().mockResolvedValue([{ value: 1 }]),
        })
        .overrideProvider(GroceryService)
        .useValue({ listItems })
        .compile();

      app = module.createNestApplication();
      app.setGlobalPrefix('api/v1', {
        exclude: [
          { path: 'health', method: RequestMethod.GET },
          { path: 'ready', method: RequestMethod.GET },
        ],
      });
      await app.init();
    });

    afterAll(async () => {
      await app?.close();
      fetchSpy.mockRestore();
    });

    it('resolves the task-specific metadata port from the independent selector', () => {
      expect(app.get(PRODUCT_UNDERSTANDING)).toBeInstanceOf(
        selector === 'typesafe'
          ? JevProductUnderstanding
          : OpenAiProductUnderstanding,
      );
    });

    it('shares the bootstrap configuration across nested LLM modules', () => {
      expect(app.get(MODEL_CONFIG)).toBe(config);
      expect(app.get<LlmProvider>(LLM_PROVIDER).name).toBe('openai');
      expect(app.get(JevDecisionClient).configured).toBe(true);
      expect(app.get(JevDecisionClient).model).toBe('jev-1.13.0');
      expect(app.get(PRODUCT_RESOLUTION_ADVISOR)).toBeInstanceOf(
        selector === 'typesafe'
          ? JevProductResolutionAdvisor
          : OpenAiProductResolutionAdvisor,
      );
      expect(app.get(STOCK_PREDICTION_ADVISOR)).toBeInstanceOf(
        stockSelector === 'typesafe'
          ? JevStockPredictionAdvisor
          : PredictionReasoner,
      );
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('bypasses both advisors for an exact canonical or alias lookup', async () => {
      const exactMatch = { id: 'product-id', canonicalName: 'Milk' };
      const search = jest
        .spyOn(app.get(ProductSearchService), 'search')
        .mockResolvedValue({ exactMatch, candidates: [] } as never);
      const advice = jest.spyOn(
        app.get<ProductResolutionAdvisor>(PRODUCT_RESOLUTION_ADVISOR),
        'advise',
      );
      try {
        await expect(
          app.get(ProductResolutionService).resolve('milk'),
        ).resolves.toEqual({ exactMatch, candidates: [], proposal: null });
        expect(advice).not.toHaveBeenCalled();
        expect(fetchSpy).not.toHaveBeenCalled();
      } finally {
        search.mockRestore();
        advice.mockRestore();
      }
    });

    it('serves liveness and readiness without provider requests', async () => {
      await request(app.getHttpServer())
        .get('/health')
        .expect(200, { status: 'ok' });
      await request(app.getHttpServer())
        .get('/ready')
        .expect(200, {
          status: 'ok',
          checks: { database: 'up' },
        });
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('preserves authenticated grocery reads without provider requests', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/grocery/items')
        .expect(401);
      expect(listItems).not.toHaveBeenCalled();
      await request(app.getHttpServer())
        .get('/api/v1/grocery/items')
        .set('Authorization', 'Bearer e2e-service-token')
        .expect(200, []);
      expect(listItems).toHaveBeenCalledTimes(1);
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  },
);
