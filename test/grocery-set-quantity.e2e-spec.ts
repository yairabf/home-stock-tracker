import 'dotenv/config';
import {
  INestApplication,
  RequestMethod,
  ValidationPipe,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { ServiceAuthGuard } from '../src/auth/service-auth.guard';
import {
  GroceryItemSource,
  GroceryItemStatus,
} from '../src/generated/prisma/enums';
import { PrismaService } from '../src/prisma/prisma.service';
import { AUTH_TEST_BYPASS } from './auth-test-bypass';
import { createProductFixture } from './product-fixture';

describe('Absolute grocery quantity setting (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let client: Client;
  let productId: string;
  const originalMcpEnabled = process.env.MCP_ENABLED;

  beforeAll(async () => {
    process.env.MCP_ENABLED = 'true';
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(ServiceAuthGuard)
      .useValue(AUTH_TEST_BYPASS)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1', {
      exclude: [{ path: 'mcp', method: RequestMethod.ALL }],
    });
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.listen(0, '127.0.0.1');

    prisma = app.get(PrismaService);
    const product = await createProductFixture(prisma, {
      canonicalName: `e2e quantity ${Date.now()}`,
    });
    productId = product.id;

    client = new Client({ name: 'grocery-quantity-e2e', version: '1.0.0' });
    await client.connect(
      new StreamableHTTPClientTransport(new URL('/mcp', await app.getUrl())),
    );
  });

  afterEach(async () => {
    await prisma.groceryListItem.deleteMany({ where: { productId } });
  });

  afterAll(async () => {
    await client.close();
    await prisma.groceryListItem.deleteMany({ where: { productId } });
    await prisma.product.delete({ where: { id: productId } });
    await app.close();
    if (originalMcpEnabled === undefined) {
      delete process.env.MCP_ENABLED;
    } else {
      process.env.MCP_ENABLED = originalMcpEnabled;
    }
  });

  it('discovers the strict MCP quantity tool', async () => {
    const tools = await client.listTools();
    const tool = tools.tools.find(
      ({ name }) => name === 'grocery_set_quantity',
    );

    expect(tool?.inputSchema).toMatchObject({
      additionalProperties: false,
      required: ['itemId', 'requestedQuantity', 'expectedRequestedQuantity'],
      properties: {
        itemId: { type: 'string', format: 'uuid' },
        requestedQuantity: { type: 'number', exclusiveMinimum: 0 },
        expectedRequestedQuantity: {
          type: 'number',
          exclusiveMinimum: 0,
        },
      },
    });
  });

  it('sets the absolute quantity through the real MCP protocol', async () => {
    const item = await createItem();

    await expect(
      client.callTool({
        name: 'grocery_set_quantity',
        arguments: {
          itemId: item.id,
          requestedQuantity: 4,
          expectedRequestedQuantity: 2,
        },
      }),
    ).resolves.toMatchObject({
      structuredContent: {
        id: item.id,
        requestedQuantity: 4,
        unit: 'liter',
        note: 'usual brand',
      },
    });
    await expect(storedItem(item.id)).resolves.toMatchObject({
      requestedQuantity: 4,
      unit: 'liter',
      note: 'usual brand',
    });
  });

  it('returns the latest item through MCP without retrying a stale decision', async () => {
    const item = await createItem();

    const result = await client.callTool({
      name: 'grocery_set_quantity',
      arguments: {
        itemId: item.id,
        requestedQuantity: 4,
        expectedRequestedQuantity: 1,
      },
    });

    expect(result.isError).toBe(true);
    expect(JSON.parse(textContent(result))).toMatchObject({
      code: 'GROCERY_ITEM_CHANGED',
      currentItem: { id: item.id, requestedQuantity: 2 },
    });
    await expect(storedItem(item.id)).resolves.toMatchObject({
      requestedQuantity: 2,
    });
  });

  it.each([
    ['missing field', { itemId: '00000000-0000-4000-8000-000000000000' }],
    [
      'extra field',
      {
        itemId: '00000000-0000-4000-8000-000000000000',
        requestedQuantity: 4,
        expectedRequestedQuantity: 2,
        increment: 1,
      },
    ],
    [
      'non-positive quantity',
      {
        itemId: '00000000-0000-4000-8000-000000000000',
        requestedQuantity: 0,
        expectedRequestedQuantity: 2,
      },
    ],
    [
      'JSON-serialized non-finite quantity',
      {
        itemId: '00000000-0000-4000-8000-000000000000',
        requestedQuantity: Number.POSITIVE_INFINITY,
        expectedRequestedQuantity: 2,
      },
    ],
  ])('rejects MCP %s', async (_, arguments_) => {
    const result = await client.callTool({
      name: 'grocery_set_quantity',
      arguments: arguments_,
    });

    expect(result.isError).toBe(true);
  });

  it.each([4, 0.5])(
    'sets the absolute quantity to %s and preserves unrelated fields',
    async (requestedQuantity) => {
      const item = await createItem();

      await patch(item.id, requestedQuantity, 2)
        .expect(200)
        .expect(({ body }) => {
          expect(body).toMatchObject({
            id: item.id,
            requestedQuantity,
            unit: 'liter',
            note: 'usual brand',
            source: GroceryItemSource.api,
            status: GroceryItemStatus.pending,
            relatedInventoryEventId: null,
          });
        });
      await expect(storedItem(item.id)).resolves.toMatchObject({
        requestedQuantity,
        unit: 'liter',
        note: 'usual brand',
        source: GroceryItemSource.api,
        status: GroceryItemStatus.pending,
        relatedInventoryEventId: null,
      });
    },
  );

  it('returns 404 without a fabricated current item for an unknown id', async () => {
    await patch('00000000-0000-4000-8000-000000000000', 4, 2)
      .expect(404)
      .expect(({ body }) => {
        expect(body).toMatchObject({ code: 'GROCERY_ITEM_NOT_FOUND' });
        expect(body).not.toHaveProperty('currentItem');
      });
  });

  it('returns the latest item for a non-pending line', async () => {
    const item = await createItem(GroceryItemStatus.purchased);

    await patch(item.id, 4, 2)
      .expect(409)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          code: 'GROCERY_ITEM_NOT_PENDING',
          currentItem: {
            id: item.id,
            requestedQuantity: 2,
            status: GroceryItemStatus.purchased,
          },
        });
      });
  });

  it('returns the latest item for a stale expected quantity', async () => {
    const item = await createItem();

    await patch(item.id, 4, 1)
      .expect(409)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          code: 'GROCERY_ITEM_CHANGED',
          currentItem: { id: item.id, requestedQuantity: 2 },
        });
      });
    await expect(storedItem(item.id)).resolves.toMatchObject({
      requestedQuantity: 2,
    });
  });

  it.each([
    ['missing final quantity', { expectedRequestedQuantity: 2 }],
    ['missing expected quantity', { requestedQuantity: 4 }],
    [
      'an extra field',
      {
        requestedQuantity: 4,
        expectedRequestedQuantity: 2,
        increment: 1,
      },
    ],
    [
      'zero final quantity',
      { requestedQuantity: 0, expectedRequestedQuantity: 2 },
    ],
    [
      'negative final quantity',
      { requestedQuantity: -1, expectedRequestedQuantity: 2 },
    ],
    [
      'zero expected quantity',
      { requestedQuantity: 4, expectedRequestedQuantity: 0 },
    ],
    [
      'negative expected quantity',
      { requestedQuantity: 4, expectedRequestedQuantity: -1 },
    ],
  ])('rejects %s without mutation', async (_, body) => {
    const item = await createItem();

    await request(app.getHttpServer())
      .patch(`/api/v1/grocery/items/${item.id}/quantity`)
      .send(body)
      .expect(400);
    await expect(storedItem(item.id)).resolves.toMatchObject({
      requestedQuantity: 2,
    });
  });

  it('allows one winner when two updates share the same expectation', async () => {
    const item = await createItem();

    const responses = await Promise.all([
      patch(item.id, 4, 2),
      patch(item.id, 5, 2),
    ]);
    const winner = responses.find(({ status }) => status === 200);
    const loser = responses.find(({ status }) => status === 409);

    expect(winner).toBeDefined();
    expect(loser).toBeDefined();
    expect(loser?.body).toMatchObject({
      code: 'GROCERY_ITEM_CHANGED',
      currentItem: {
        id: item.id,
        requestedQuantity: winner?.body.requestedQuantity,
      },
    });
    await expect(storedItem(item.id)).resolves.toMatchObject({
      requestedQuantity: winner?.body.requestedQuantity,
      unit: 'liter',
      note: 'usual brand',
      source: GroceryItemSource.api,
      status: GroceryItemStatus.pending,
      relatedInventoryEventId: null,
    });
  });

  function patch(
    id: string,
    requestedQuantity: number,
    expectedRequestedQuantity: number,
  ) {
    return request(app.getHttpServer())
      .patch(`/api/v1/grocery/items/${id}/quantity`)
      .send({ requestedQuantity, expectedRequestedQuantity });
  }

  function createItem(status: GroceryItemStatus = GroceryItemStatus.pending) {
    return prisma.groceryListItem.create({
      data: {
        productId,
        requestedQuantity: 2,
        unit: 'liter',
        note: 'usual brand',
        status,
        source: GroceryItemSource.api,
      },
    });
  }

  function storedItem(id: string) {
    return prisma.groceryListItem.findUniqueOrThrow({ where: { id } });
  }

  function textContent(result: CallToolResult): string {
    const content = result.content[0];
    if (!content || content.type !== 'text') {
      throw new Error('Expected text tool content');
    }
    return content.text;
  }
});
