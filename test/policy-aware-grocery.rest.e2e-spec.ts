import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { ProductType } from '../src/generated/prisma/enums';
import { LLM_PROVIDER, type LlmProvider } from '../src/llm/llm-provider';
import { PrismaService } from '../src/prisma/prisma.service';
import { normalizeProductName } from '../src/product/product-name.util';
import { createProductFixture } from './product-fixture';

describe('Policy-aware grocery REST contract (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let provider: jest.Mocked<LlmProvider>;
  const prefix = `rest-policy-${randomUUID()}`;
  const authorization = 'Bearer e2e-service-token';

  beforeAll(async () => {
    provider = { name: 'fake', generateStructured: jest.fn() };
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(LLM_PROVIDER)
      .useValue(provider)
      .compile();
    app = moduleFixture.createNestApplication();
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

  afterEach(async () => {
    const products = await prisma.product.findMany({
      where: {
        names: {
          some: {
            normalizedName: { startsWith: normalizeProductName(prefix) },
          },
        },
      },
      select: { id: true },
    });
    const productIds = products.map(({ id }) => id);
    await prisma.groceryListItem.deleteMany({
      where: { productId: { in: productIds } },
    });
    await prisma.product.deleteMany({ where: { id: { in: productIds } } });
    provider.generateStructured.mockReset();
  });

  afterAll(async () => {
    await app.close();
  });

  it('defaults REST to explicit deterministic creation', async () => {
    const canonicalName = `${prefix} default`;

    const response = await post({
      product: productInput(canonicalName),
      groceryItem: {},
    }).expect(201);

    expect(response.body).toMatchObject({
      outcome: 'created',
      createdItem: {
        productName: canonicalName,
        requestedQuantity: 1,
        source: 'api',
      },
      requestedAddition: {
        productName: canonicalName,
        requestedQuantity: null,
        ifPendingExists: 'return_existing',
      },
    });
    expect(provider.generateStructured.mock.calls).toHaveLength(0);
  });

  it('returns proposal mode as a successful non-mutating outcome', async () => {
    const productName = `${prefix} unresolved`;
    provider.generateStructured.mockResolvedValue({ status: 'unavailable' });
    const before = await domainCounts();

    const response = await post({
      unknownProductPolicy: 'propose_if_missing',
      productName,
      groceryItem: {},
    }).expect(201);

    expect(response.body).toMatchObject({
      outcome: 'product_resolution_required',
      candidates: [],
      proposal: null,
      allowedActions: ['create_product', 'cancel'],
    });
    await expect(domainCounts()).resolves.toEqual(before);
  });

  it.each([
    [
      'mixed policy inputs',
      {
        unknownProductPolicy: 'propose_if_missing',
        productName: `${prefix} mixed`,
        product: productInput(`${prefix} mixed`),
        groceryItem: {},
      },
    ],
    ['legacy flat input', { productName: `${prefix} legacy` }],
    [
      'caller-controlled source',
      {
        product: productInput(`${prefix} source`),
        groceryItem: {},
        source: 'mcp',
      },
    ],
  ])('rejects %s', async (_label, body) => {
    await post(body).expect(400);
  });

  it('serializes namespace conflicts with the stable product code', async () => {
    const sharedAlias = `${prefix} shared alias`;
    await createProductFixture(prisma, {
      canonicalName: `${prefix} existing`,
      aliases: [sharedAlias],
    });

    const response = await post({
      product: {
        ...productInput(`${prefix} new`),
        aliases: [sharedAlias],
      },
      groceryItem: {},
    }).expect(409);

    expect(response.body).toMatchObject({ code: 'PRODUCT_NAME_CONFLICT' });
  });

  it('requires service authentication', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/grocery/items')
      .send({
        product: productInput(`${prefix} unauthenticated`),
        groceryItem: {},
      })
      .expect(401);
  });

  function post(body: unknown) {
    return request(app.getHttpServer())
      .post('/api/v1/grocery/items')
      .set('Authorization', authorization)
      .send(body);
  }

  function productInput(canonicalName: string) {
    return {
      canonicalName,
      aliases: [],
      category: 'test',
      typicalUnit: null,
      productType: ProductType.fast_consumable,
      isPerishable: false,
    };
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
