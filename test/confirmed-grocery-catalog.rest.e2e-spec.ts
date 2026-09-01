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

describe('confirmed grocery catalog REST contract (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let provider: jest.Mocked<LlmProvider>;
  const prefix = `rest-confirm-${randomUUID()}`;
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

  it('confirms a new product and defaults its new line quantity', async () => {
    const canonicalName = `${prefix} new`;

    const response = await confirmNew(canonicalName).expect(201);

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

  it('returns confirmation_required on an exact product retry', async () => {
    const canonicalName = `${prefix} retry`;
    const first = await confirmNew(canonicalName, 2).expect(201);
    const retry = await confirmNew(canonicalName, 2).expect(201);

    expect(first.body).toMatchObject({ outcome: 'created' });
    expect(retry.body).toMatchObject({
      outcome: 'confirmation_required',
      existingItems: [{ requestedQuantity: 2 }],
      requestedAddition: { requestedQuantity: 2 },
    });
  });

  it('confirms an alias and preserves it when a pending line already exists', async () => {
    const canonicalName = `${prefix} alias target`;
    const alias = `${prefix} approved alias`;
    const created = await confirmNew(canonicalName, 3).expect(201);
    const createdItem = createdItemFrom(created);

    const response = await confirmAlias(createdItem.productId, alias, 2).expect(
      201,
    );

    expect(response.body).toMatchObject({
      outcome: 'confirmation_required',
      existingItems: [{ requestedQuantity: 3 }],
      requestedAddition: { productName: alias, requestedQuantity: 2 },
    });
    await expect(
      prisma.productName.count({
        where: { normalizedName: normalizeProductName(alias) },
      }),
    ).resolves.toBe(1);
  });

  it('treats a same-target alias retry as idempotent', async () => {
    const canonicalName = `${prefix} alias retry target`;
    const alias = `${prefix} alias retry`;
    const created = await confirmNew(canonicalName).expect(201);
    const createdItem = createdItemFrom(created);
    const productId = createdItem.productId;
    await prisma.groceryListItem.delete({
      where: { id: createdItem.id },
    });

    await confirmAlias(productId, alias).expect(201);
    const retry = await confirmAlias(productId, alias).expect(201);

    expect(retry.body).toMatchObject({ outcome: 'confirmation_required' });
    await expect(
      prisma.productName.count({
        where: { normalizedName: normalizeProductName(alias) },
      }),
    ).resolves.toBe(1);
  });

  it('returns stable conflicts for supplied names owned by another product', async () => {
    const sharedAlias = `${prefix} shared alias`;
    await confirmNew(sharedAlias).expect(201);

    const response = await confirmNew(`${prefix} conflicting`, undefined, [
      sharedAlias,
    ]).expect(409);

    expect(response.body).toMatchObject({ code: 'PRODUCT_NAME_CONFLICT' });
  });

  it('returns PRODUCT_NOT_FOUND for a deleted alias target', async () => {
    const created = await confirmNew(`${prefix} deleted target`).expect(201);
    const productId = createdItemFrom(created).productId;
    await prisma.groceryListItem.deleteMany({ where: { productId } });
    await prisma.product.delete({ where: { id: productId } });

    const response = await confirmAlias(
      productId,
      `${prefix} deleted alias`,
    ).expect(404);

    expect(response.body).toMatchObject({ code: 'PRODUCT_NOT_FOUND' });
  });

  it.each([
    ['proposal state', { proposalId: 'proposal-1' }],
    ['caller source', { source: 'mcp' }],
    [
      'pending override',
      { groceryItem: { ifPendingExists: 'create_separate' } },
    ],
  ])('rejects confirmed product %s', async (_label, extra) => {
    await postNew({
      product: productInput(`${prefix} invalid`),
      groceryItem: {},
      ...extra,
    }).expect(400);
  });

  it('requires service authentication', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/grocery/items/confirm-new-product')
      .send({
        product: productInput(`${prefix} unauthenticated`),
        groceryItem: {},
      })
      .expect(401);
  });

  function confirmNew(
    canonicalName: string,
    requestedQuantity?: number,
    aliases: string[] = [`${canonicalName} alias`],
  ) {
    return postNew({
      product: { ...productInput(canonicalName), aliases },
      groceryItem: { requestedQuantity },
    });
  }

  function confirmAlias(
    targetProductId: string,
    alias: string,
    requestedQuantity?: number,
  ) {
    return request(app.getHttpServer())
      .post('/api/v1/grocery/items/confirm-product-alias')
      .set('Authorization', authorization)
      .send({
        targetProductId,
        alias,
        groceryItem: { requestedQuantity },
      });
  }

  function postNew(body: unknown) {
    return request(app.getHttpServer())
      .post('/api/v1/grocery/items/confirm-new-product')
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

  function createdItemFrom(response: { body: unknown }): {
    id: string;
    productId: string;
  } {
    const body = response.body;
    if (!body || typeof body !== 'object' || !('createdItem' in body)) {
      throw new Error('Expected a created grocery result');
    }
    const item = body.createdItem;
    if (
      !item ||
      typeof item !== 'object' ||
      !('id' in item) ||
      typeof item.id !== 'string' ||
      !('productId' in item) ||
      typeof item.productId !== 'string'
    ) {
      throw new Error('Expected a created grocery item');
    }
    return { id: item.id, productId: item.productId };
  }
});
