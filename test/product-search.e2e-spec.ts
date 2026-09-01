import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { LLM_PROVIDER, type LlmProvider } from '../src/llm/llm-provider';
import { PrismaService } from '../src/prisma/prisma.service';
import { ProductSearchService } from '../src/product/product-search.service';
import { createProductFixture } from './product-fixture';

const AUTHORIZATION = 'Bearer e2e-service-token';

interface ProductSearchResponseBody {
  exactMatch: { id: string } | null;
  candidates: Array<Record<string, unknown> & { id: string }>;
}

describe('Product search REST API (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let searchService: ProductSearchService;
  let provider: jest.Mocked<LlmProvider>;
  const prefix = `rest-search-${randomUUID()}`;
  const productIds: string[] = [];

  beforeAll(async () => {
    provider = {
      name: 'test',
      generateStructured: jest
        .fn()
        .mockRejectedValue(
          new Error('REST product search must not invoke the LLM provider'),
        ),
    };
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(LLM_PROVIDER)
      .useValue(provider)
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
    searchService = app.get(ProductSearchService);
  });

  afterEach(async () => {
    await prisma.product.deleteMany({ where: { id: { in: productIds } } });
    productIds.length = 0;
    provider.generateStructured.mockClear();
  });

  afterAll(async () => {
    await app.close();
  });

  it.each([
    ['canonical', (canonicalName: string) => canonicalName],
    ['alias', (_canonicalName: string, alias: string) => alias],
  ])(
    'returns an exact %s match with no candidates',
    async (_label, queryFor) => {
      const canonicalName = `${prefix} Exact Milk`;
      const alias = `${prefix} Exact Alias`;
      const product = await createProduct({
        canonicalName,
        aliases: [alias],
        category: 'dairy',
        typicalUnit: 'carton',
        predictionEnabled: false,
      });

      const response = await search(queryFor(canonicalName, alias)).expect(200);

      expect(response.body).toEqual({
        exactMatch: {
          id: product.id,
          canonicalName,
          aliases: [alias],
          category: 'dairy',
          typicalUnit: 'carton',
          productType: null,
          isPerishable: false,
          predictionEnabled: false,
        },
        candidates: [],
      });
      expect(provider.generateStructured.mock.calls).toHaveLength(0);
    },
  );

  it('returns stable compact candidates and an empty unknown branch', async () => {
    const query = `${prefix} candidate`;
    const first = await createProduct({ canonicalName: `${query} A` });
    const second = await createProduct({ canonicalName: `${query} Longer` });

    const response = await search(query).expect(200);
    const body = response.body as ProductSearchResponseBody;

    expect(body).toEqual({
      exactMatch: null,
      candidates: [
        expect.objectContaining({ id: first.id, canonicalName: `${query} A` }),
        expect.objectContaining({
          id: second.id,
          canonicalName: `${query} Longer`,
        }),
      ],
    });
    expect(Object.keys(body.candidates[0]).sort()).toEqual(
      [
        'aliases',
        'canonicalName',
        'category',
        'id',
        'isPerishable',
        'predictionEnabled',
        'productType',
        'typicalUnit',
      ].sort(),
    );

    await search(`${prefix} unknown`)
      .expect(200)
      .expect({ exactMatch: null, candidates: [] });
  });

  it('applies the default limit and permits the maximum limit', async () => {
    const query = `${prefix} bounded`;
    await Promise.all(
      Array.from({ length: 21 }, (_, index) =>
        createProduct({
          canonicalName: `${query} ${index.toString().padStart(2, '0')}`,
        }),
      ),
    );

    const defaultResponse = await search(query).expect(200);
    const maximumResponse = await search(query, 20).expect(200);
    const defaultBody = defaultResponse.body as ProductSearchResponseBody;
    const maximumBody = maximumResponse.body as ProductSearchResponseBody;

    expect(defaultBody.candidates).toHaveLength(10);
    expect(maximumBody.candidates).toHaveLength(20);
  });

  it.each([
    ['', undefined, 'blank query'],
    [' ', undefined, 'whitespace query'],
    ['x'.repeat(201), undefined, 'overlong query'],
    ['milk', 0, 'zero limit'],
    ['milk', 1.5, 'non-integer limit'],
    ['milk', 21, 'over-cap limit'],
  ])('rejects an invalid %s request', async (query, limit) => {
    await search(query, limit).expect(400);
  });

  it('rejects missing query and unknown query parameters', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/products/search')
      .set('Authorization', AUTHORIZATION)
      .expect(400);
    await request(app.getHttpServer())
      .get('/api/v1/products/search')
      .query({ query: 'milk', unexpected: 'value' })
      .set('Authorization', AUTHORIZATION)
      .expect(400);
  });

  it.each([undefined, 'Bearer wrong-token'])(
    'rejects credential %j before search execution',
    async (authorization) => {
      const searchSpy = jest.spyOn(searchService, 'search');
      const pendingRequest = request(app.getHttpServer())
        .get('/api/v1/products/search')
        .query({ query: 'milk' });
      if (authorization) {
        pendingRequest.set('Authorization', authorization);
      }

      await pendingRequest.expect(401);

      expect(searchSpy).not.toHaveBeenCalled();
      searchSpy.mockRestore();
    },
  );

  it('does not invoke a provider or mutate domain state', async () => {
    const product = await createProduct({
      canonicalName: `${prefix} Readonly Milk`,
      predictionEnabled: false,
    });
    const before = await domainCounts();

    const response = await search(`${prefix} readonly`).expect(200);
    const body = response.body as ProductSearchResponseBody;

    expect(body.candidates).toEqual([
      expect.objectContaining({ id: product.id, predictionEnabled: false }),
    ]);
    expect(provider.generateStructured.mock.calls).toHaveLength(0);
    await expect(domainCounts()).resolves.toEqual(before);
  });

  function search(query: string, limit?: number) {
    const pendingRequest = request(app.getHttpServer())
      .get('/api/v1/products/search')
      .query(limit === undefined ? { query } : { query, limit })
      .set('Authorization', AUTHORIZATION);
    return pendingRequest;
  }

  async function createProduct(
    input: Parameters<typeof createProductFixture>[1],
  ) {
    const product = await createProductFixture(prisma, input);
    productIds.push(product.id);
    return product;
  }

  async function domainCounts() {
    const [products, names, groceries, events, predictions, households] =
      await Promise.all([
        prisma.product.count(),
        prisma.productName.count(),
        prisma.groceryListItem.count(),
        prisma.inventoryEvent.count(),
        prisma.prediction.count(),
        prisma.household.count(),
      ]);
    return { products, names, groceries, events, predictions, households };
  }
});
