import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import { ValidationPipe, type INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { loadApplicationConfig } from '../src/config/application-config';
import { PrismaService } from '../src/prisma/prisma.service';
import { LLM_PROVIDER } from '../src/llm/llm-provider';
import { JevDecisionClient } from '../src/llm/typesafe/jev-decision.client';
import type {
  JevChoiceRequest,
  JevDecisionResult,
} from '../src/llm/typesafe/jev-decision.types';
import { type UnderstandingField } from '../src/product/product-understanding';

const token = 'e2e-service-token';
const facts = {
  category: 'dairy',
  typicalUnit: 'liter',
  productType: 'fast_consumable',
  isPerishable: true,
};
describe.each(['openai', 'typesafe'] as const)(
  'product enrichment REST with %s',
  (selector) => {
    const prefix = `enrichment REST ${randomUUID()}`;
    let app: INestApplication<App>;
    let prisma: PrismaService;
    const ids: string[] = [];
    let unknown = false;
    const choose = jest.fn<
      Promise<JevDecisionResult>,
      [JevChoiceRequest, number?]
    >();
    const generateStructured = jest.fn();
    beforeAll(async () => {
      if (
        !process.env.DATABASE_URL ||
        !new URL(process.env.DATABASE_URL).pathname.endsWith('_test')
      )
        throw new Error('Requires an isolated database ending in _test');
      const config = loadApplicationConfig({
        DATABASE_URL: process.env.DATABASE_URL,
        API_AUTH_TOKEN: token,
        OPENAI_API_KEY: 'fixture-only-openai',
        TYPESAFE_API_KEY: 'fixture-only-typesafe',
        JEV_MODEL: 'jev-1.13.0',
        PRODUCT_UNDERSTANDING_PROVIDER: selector,
      });
      const module = await Test.createTestingModule({
        imports: [AppModule.register(config)],
      })
        .overrideProvider(LLM_PROVIDER)
        .useValue({ name: 'openai', generateStructured })
        .overrideProvider(JevDecisionClient)
        .useValue({ choose, model: 'jev-1.13.0', configured: true })
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
    beforeEach(() => {
      unknown = false;
      choose.mockReset();
      generateStructured.mockReset();
      choose.mockImplementation((input) => {
        const choice = unknown
          ? 'unknown'
          : input.questionKey === 'productType'
            ? 'fast_consumable'
            : 'perishable';
        return Promise.resolve({
          status: 'success',
          provider: 'typesafe',
          model: 'jev-1.13.0',
          task: input.task,
          taskVersion: input.taskVersion,
          choice,
          confidence: 0.95,
          probabilities: { [choice]: 1 },
          usage: { input_tokens: 10, output_tokens: 1 },
        });
      });
      generateStructured.mockImplementation(
        (input: { input: { requestedFields: UnderstandingField[] } }) =>
          Promise.resolve({
            status: 'success',
            provider: 'openai',
            model: 'fixture-model',
            value: Object.fromEntries(
              input.input.requestedFields.map((field) => [
                field,
                { value: unknown ? null : facts[field], confidence: 0.95 },
              ]),
            ),
          }),
      );
    });
    afterAll(async () => {
      await prisma.product.deleteMany({ where: { id: { in: ids } } });
      await app.close();
    });
    async function create(label: string) {
      const response = await request(app.getHttpServer())
        .post('/api/v1/products')
        .auth(token, { type: 'bearer' })
        .send({
          canonicalName: `${prefix} ${label}`,
          aliases: [`${prefix} alias ${label}`],
          category: 'dairy',
          typicalUnit: 'liter',
        })
        .expect(201);
      const body = response.body as {
        id: string;
        canonicalName: string;
        aliases: string[];
        isPerishable: boolean | null;
      };
      ids.push(body.id);
      return body;
    }
    it('explicit create then enrich preserves identity, and complete enrich/read paths make zero further calls', async () => {
      const product = await create('חלב Milk');
      expect(product.isPerishable).toBeNull();
      expect(choose).not.toHaveBeenCalled();
      expect(generateStructured).not.toHaveBeenCalled();
      const response = await request(app.getHttpServer())
        .post(`/api/v1/products/${product.id}/enrich`)
        .auth(token, { type: 'bearer' })
        .send({})
        .expect(200);
      expect(response.body).toMatchObject({
        ...facts,
        canonicalName: product.canonicalName,
        aliases: product.aliases,
      });
      expect(choose).toHaveBeenCalledTimes(selector === 'typesafe' ? 2 : 0);
      expect(generateStructured).toHaveBeenCalledTimes(
        selector === 'openai' ? 1 : 0,
      );
      choose.mockClear();
      generateStructured.mockClear();
      await request(app.getHttpServer())
        .post(`/api/v1/products/${product.id}/enrich`)
        .auth(token, { type: 'bearer' })
        .expect(200);
      await request(app.getHttpServer())
        .get(`/api/v1/products/${product.id}`)
        .auth(token, { type: 'bearer' })
        .expect(200);
      await request(app.getHttpServer())
        .get('/api/v1/products')
        .auth(token, { type: 'bearer' })
        .expect(200);
      await request(app.getHttpServer())
        .get('/api/v1/products/search')
        .query({ query: product.canonicalName })
        .auth(token, { type: 'bearer' })
        .expect(200);
      expect(choose).not.toHaveBeenCalled();
      expect(generateStructured).not.toHaveBeenCalled();
    });
    it('returns unknown as nullable metadata without automatic fallback', async () => {
      const product = await create('Unknown');
      unknown = true;
      const response = await request(app.getHttpServer())
        .post(`/api/v1/products/${product.id}/enrich`)
        .auth(token, { type: 'bearer' })
        .send({})
        .expect(200);
      expect(response.body).toMatchObject({
        isPerishable: null,
        productType: null,
        canonicalName: product.canonicalName,
        aliases: product.aliases,
      });
      if (selector === 'typesafe')
        expect(generateStructured).not.toHaveBeenCalled();
    });
    it('returns the product safely when the selected provider is unavailable', async () => {
      const product = await create('Unavailable');
      choose.mockRejectedValue(new Error('private provider error'));
      generateStructured.mockResolvedValue({ status: 'unavailable' });
      const response = await request(app.getHttpServer())
        .post(`/api/v1/products/${product.id}/enrich`)
        .auth(token, { type: 'bearer' })
        .expect(200);
      expect(response.body).toMatchObject({
        isPerishable: null,
        productType: null,
        canonicalName: product.canonicalName,
      });
      if (selector === 'typesafe')
        expect(generateStructured).not.toHaveBeenCalled();
    });
    it('rejects unauthenticated, nonempty and array bodies before inference, and returns not found for unknown IDs', async () => {
      const product = await create('Validation');
      await request(app.getHttpServer())
        .post(`/api/v1/products/${product.id}/enrich`)
        .send({})
        .expect(401);
      for (const body of [{ force: true }, { isPerishable: false }, []])
        await request(app.getHttpServer())
          .post(`/api/v1/products/${product.id}/enrich`)
          .auth(token, { type: 'bearer' })
          .send(body)
          .expect(400);
      await request(app.getHttpServer())
        .post(`/api/v1/products/${randomUUID()}/enrich`)
        .auth(token, { type: 'bearer' })
        .expect(404);
      expect(choose).not.toHaveBeenCalled();
      expect(generateStructured).not.toHaveBeenCalled();
    });
  },
);
