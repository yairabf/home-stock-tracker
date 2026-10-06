import { Test } from '@nestjs/testing';
import { RequestMethod, type INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import {
  loadApplicationConfig,
  STOCK_WORKFLOW_CONFIG,
} from '../src/config/application-config';
import { PrismaService } from '../src/prisma/prisma.service';
import { LLM_PROVIDER, type LlmProvider } from '../src/llm/llm-provider';
import { OpenAiLlmProvider } from '../src/llm/openai/openai-llm.provider';
import { JevDecisionClient } from '../src/llm/typesafe/jev-decision.client';
import { PRODUCT_UNDERSTANDING } from '../src/product/product-understanding';
import { JevProductUnderstanding } from '../src/product/jev-product-understanding.service';
import { OpenAiProductUnderstanding } from '../src/product/openai-product-understanding.service';
import { PRODUCT_RESOLUTION_ADVISOR } from '../src/product/product-resolution-advisor';
import { JevProductResolutionAdvisor } from '../src/product/jev-product-resolution-advisor.service';
import { OpenAiProductResolutionAdvisor } from '../src/product/openai-product-resolution-advisor.service';
import { STOCK_PREDICTION_ADVISOR } from '../src/estimation/stock-prediction-advisor';
import { JevStockPredictionAdvisor } from '../src/estimation/jev-stock-prediction-advisor.service';
import { PredictionReasoner } from '../src/estimation/prediction-reasoner.service';
import { SHELF_LIFE_POLICY } from '../src/inventory/shelf-life-policy';
import { JevShelfLifePolicy } from '../src/inventory/jev-shelf-life-policy.service';
import { OpenAiShelfLifePolicy } from '../src/inventory/openai-shelf-life-policy.service';
import { StockAdviceExecutor } from '../src/inventory/stock-advice-executor.service';

const selections = [
  ['openai', 'openai', 'openai', 'openai', false],
  ['typesafe', 'openai', 'openai', 'openai', false],
  ['openai', 'typesafe', 'openai', 'openai', false],
  ['openai', 'openai', 'typesafe', 'openai', false],
  ['openai', 'openai', 'openai', 'typesafe', false],
  ['typesafe', 'typesafe', 'typesafe', 'typesafe', false],
  ['typesafe', 'typesafe', 'typesafe', 'typesafe', true],
  ['typesafe', 'typesafe', 'typesafe', 'openai', true],
] as const;
describe.each(selections)(
  'Independent rollout matching=%s metadata=%s policy=%s stock=%s advice=%s',
  (matching, understanding, policy, stock, advice) => {
    let app: INestApplication;
    let fetcher: jest.MockedFunction<typeof fetch>;
    const generation = jest
      .fn()
      .mockResolvedValue({ status: 'unavailable' as const });
    const config = loadApplicationConfig({
      DATABASE_URL: 'postgresql://fixture:fixture@localhost/unused_test',
      API_AUTH_TOKEN: 'e2e-service-token',
      OPENAI_API_KEY: 'fixture-openai-key',
      TYPESAFE_API_KEY: 'fixture-typesafe-key',
      JEV_MODEL: 'jev-1.13.0',
      PRODUCT_RESOLUTION_PROVIDER: matching,
      PRODUCT_UNDERSTANDING_PROVIDER: understanding,
      SHELF_LIFE_POLICY_PROVIDER: policy,
      STOCK_PREDICTION_PROVIDER: stock,
      STOCK_WORKFLOW_ADVICE_ENABLED: String(advice),
      STOCK_WORKFLOW_ENABLED: 'false',
    });
    beforeAll(async () => {
      fetcher = jest
        .fn()
        .mockRejectedValue(
          new Error('Unexpected model request on startup/readiness'),
        );
      const module = await Test.createTestingModule({
        imports: [AppModule.register(config)],
      })
        .overrideProvider(PrismaService)
        .useValue({ $queryRaw: jest.fn().mockResolvedValue([{ value: 1 }]) })
        .overrideProvider(STOCK_WORKFLOW_CONFIG)
        .useValue(config.stockWorkflow)
        .overrideProvider(JevDecisionClient)
        .useValue(new JevDecisionClient(config, fetcher))
        .compile();
      const provider = module.get<LlmProvider>(LLM_PROVIDER);
      provider.generateStructured = generation;
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
    });
    it('selects each independent port and retains OpenAI generation', () => {
      expect(app.get(PRODUCT_RESOLUTION_ADVISOR)).toBeInstanceOf(
        matching === 'typesafe'
          ? JevProductResolutionAdvisor
          : OpenAiProductResolutionAdvisor,
      );
      expect(app.get(PRODUCT_UNDERSTANDING)).toBeInstanceOf(
        understanding === 'typesafe'
          ? JevProductUnderstanding
          : OpenAiProductUnderstanding,
      );
      expect(app.get(SHELF_LIFE_POLICY)).toBeInstanceOf(
        policy === 'typesafe' ? JevShelfLifePolicy : OpenAiShelfLifePolicy,
      );
      expect(app.get(STOCK_PREDICTION_ADVISOR)).toBeInstanceOf(
        stock === 'typesafe' ? JevStockPredictionAdvisor : PredictionReasoner,
      );
      expect(app.get<LlmProvider>(LLM_PROVIDER).name).toBe('openai');
      expect(app.get(LLM_PROVIDER)).toBeInstanceOf(OpenAiLlmProvider);
      expect(app.get(StockAdviceExecutor).enabled).toBe(
        advice && stock === 'typesafe',
      );
    });
    it('keeps startup and authenticated readiness free of inference', async () => {
      await request(app.getHttpServer()).get('/health').expect(200);
      await request(app.getHttpServer()).get('/ready').expect(200);
      expect(fetcher).not.toHaveBeenCalled();
      expect(generation).not.toHaveBeenCalled();
    });
  },
);
