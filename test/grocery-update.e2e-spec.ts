import 'dotenv/config';
import {
  INestApplication,
  RequestMethod,
  ValidationPipe,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
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

describe('Pending grocery quantity updates (e2e)', () => {
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
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.listen(0, '127.0.0.1');

    prisma = app.get(PrismaService);
    const product = await prisma.product.create({
      data: { canonicalName: `e2e grocery update ${Date.now()}` },
    });
    productId = product.id;

    const address = app.getHttpServer().address();
    if (!address || typeof address === 'string') {
      throw new Error('Test server did not bind to a TCP port');
    }
    client = new Client({ name: 'grocery-update-e2e', version: '1.0.0' });
    await client.connect(
      new StreamableHTTPClientTransport(
        new URL(`http://127.0.0.1:${address.port}/mcp`),
      ),
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

  it('increments a pending item through REST', async () => {
    const item = await createItem();

    await request(app.getHttpServer())
      .patch(`/api/v1/grocery/items/${item.id}`)
      .send(updateInput())
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          id: item.id,
          requestedQuantity: 3,
          unit: 'liter',
        });
      });
    await expect(storedQuantity(item.id)).resolves.toBe(3);
  });

  it('returns current state for a stale REST update', async () => {
    const item = await createItem();

    await request(app.getHttpServer())
      .patch(`/api/v1/grocery/items/${item.id}`)
      .send({ ...updateInput(), expectedRequestedQuantity: 1 })
      .expect(409)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          code: 'GROCERY_ITEM_CHANGED',
          currentItem: { id: item.id, requestedQuantity: 2 },
        });
      });
    await expect(storedQuantity(item.id)).resolves.toBe(2);
  });

  it('increments a pending item through MCP', async () => {
    const item = await createItem();

    await expect(
      client.callTool({
        name: 'grocery_update',
        arguments: { id: item.id, ...updateInput() },
      }),
    ).resolves.toMatchObject({
      structuredContent: { id: item.id, requestedQuantity: 3 },
    });
    await expect(storedQuantity(item.id)).resolves.toBe(3);
  });

  it('returns current state for a stale MCP update', async () => {
    const item = await createItem();

    const result = await client.callTool({
      name: 'grocery_update',
      arguments: {
        id: item.id,
        ...updateInput(),
        expectedRequestedQuantity: 1,
      },
    });

    expect(result.isError).toBe(true);
    expect(JSON.parse(result.content[0].text as string)).toMatchObject({
      code: 'GROCERY_ITEM_CHANGED',
      currentItem: { id: item.id, requestedQuantity: 2, unit: 'liter' },
    });
    await expect(storedQuantity(item.id)).resolves.toBe(2);
  });

  it('returns a stable MCP error for an unspecified quantity', async () => {
    const item = await createItem(null);

    await expect(
      client.callTool({
        name: 'grocery_update',
        arguments: {
          id: item.id,
          ...updateInput(),
          expectedRequestedQuantity: null,
        },
      }),
    ).resolves.toEqual({
      content: [
        {
          type: 'text',
          text: 'QUANTITY_UNSPECIFIED: Cannot increment an unspecified quantity',
        },
      ],
      isError: true,
    });
    await expect(storedQuantity(item.id)).resolves.toBeNull();
  });

  function createItem(requestedQuantity: number | null = 2) {
    return prisma.groceryListItem.create({
      data: {
        productId,
        requestedQuantity,
        unit: 'liter',
        status: GroceryItemStatus.pending,
        source: GroceryItemSource.api,
      },
    });
  }

  function updateInput() {
    return {
      quantityMode: 'increment',
      quantity: 1,
      unit: 'liter',
      expectedRequestedQuantity: 2,
      expectedUnit: 'liter',
    };
  }

  async function storedQuantity(id: string): Promise<number | null> {
    const item = await prisma.groceryListItem.findUnique({ where: { id } });
    return item?.requestedQuantity ?? null;
  }
});
