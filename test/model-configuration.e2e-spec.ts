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

describe('Resolved model configuration (e2e)', () => {
  const config = loadApplicationConfig({
    DATABASE_URL: 'postgresql://test:test@localhost:5432/unused',
    API_AUTH_TOKEN: 'e2e-service-token',
    OPENAI_API_KEY: 'fixture-openai-key',
    TYPESAFE_API_KEY: 'fixture-typesafe-key',
    JEV_MODEL: 'jev-1.13.0',
  });
  const listItems = jest.fn().mockResolvedValue([]);
  let app: INestApplication<App>;
  let fetchSpy: jest.SpiedFunction<typeof fetch>;

  beforeAll(async () => {
    fetchSpy = jest
      .spyOn(globalThis, 'fetch')
      .mockRejectedValue(
        new Error('Unexpected provider request during HTTP compatibility test'),
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

  it('shares the bootstrap configuration across nested LLM modules', () => {
    expect(app.get(MODEL_CONFIG)).toBe(config);
    expect(app.get<LlmProvider>(LLM_PROVIDER).name).toBe('openai');
    expect(app.get(JevDecisionClient).configured).toBe(true);
    expect(app.get(JevDecisionClient).model).toBe('jev-1.13.0');
    expect(fetchSpy).not.toHaveBeenCalled();
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
    await request(app.getHttpServer()).get('/api/v1/grocery/items').expect(401);
    expect(listItems).not.toHaveBeenCalled();
    await request(app.getHttpServer())
      .get('/api/v1/grocery/items')
      .set('Authorization', 'Bearer e2e-service-token')
      .expect(200, []);
    expect(listItems).toHaveBeenCalledTimes(1);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
