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
import { GroceryService } from '../src/grocery/grocery.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { AUTH_TEST_BYPASS } from './auth-test-bypass';
import { createProductFixture } from './product-fixture';

describe('Guarded grocery removal (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let groceryService: GroceryService;
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
    groceryService = app.get(GroceryService);
    const product = await createProductFixture(prisma, {
      canonicalName: `e2e grocery removal ${Date.now()}`,
    });
    productId = product.id;

    const address = app.getHttpServer().address();
    if (!address || typeof address === 'string') {
      throw new Error('Test server did not bind to a TCP port');
    }
    client = new Client({ name: 'grocery-remove-e2e', version: '1.0.0' });
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

  it('removes only pending items through REST', async () => {
    const pending = await createItem();

    await request(app.getHttpServer())
      .delete(`/api/v1/grocery/items/${pending.id}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.status).toBe(GroceryItemStatus.removed);
      });
    await expect(storedStatus(pending.id)).resolves.toBe(
      GroceryItemStatus.removed,
    );
  });

  it.each([GroceryItemStatus.purchased, GroceryItemStatus.removed])(
    'returns a stable REST conflict for a %s item',
    async (status) => {
      const item = await createItem(status);

      await request(app.getHttpServer())
        .delete(`/api/v1/grocery/items/${item.id}`)
        .expect(409)
        .expect({
          message: `Grocery list item ${item.id} is not pending`,
          error: 'Conflict',
          statusCode: 409,
        });
      await expect(storedStatus(item.id)).resolves.toBe(status);
    },
  );

  it('returns a stable REST not-found error for an unknown item', () => {
    const id = '00000000-0000-4000-8000-000000000000';
    return request(app.getHttpServer())
      .delete(`/api/v1/grocery/items/${id}`)
      .expect(404)
      .expect({
        message: `Grocery list item ${id} not found`,
        error: 'Not Found',
        statusCode: 404,
      });
  });

  it('removes a pending item through MCP', async () => {
    const pending = await createItem();

    await expect(
      client.callTool({
        name: 'grocery_remove',
        arguments: { id: pending.id },
      }),
    ).resolves.toMatchObject({
      structuredContent: { id: pending.id, status: GroceryItemStatus.removed },
    });
    await expect(storedStatus(pending.id)).resolves.toBe(
      GroceryItemStatus.removed,
    );
  });

  it.each([GroceryItemStatus.purchased, GroceryItemStatus.removed])(
    'returns a stable MCP tool error for a %s item',
    async (status) => {
      const item = await createItem(status);

      await expect(
        client.callTool({
          name: 'grocery_remove',
          arguments: { id: item.id },
        }),
      ).resolves.toEqual({
        content: [
          {
            type: 'text',
            text: `Grocery list item ${item.id} is not pending`,
          },
        ],
        isError: true,
      });
      await expect(storedStatus(item.id)).resolves.toBe(status);
    },
  );

  it('allows only one concurrent terminal transition', async () => {
    const pending = await createItem();
    const [removal, purchase] = await Promise.allSettled([
      groceryService.removeItem(pending.id),
      prisma.groceryListItem.updateMany({
        where: { id: pending.id, status: GroceryItemStatus.pending },
        data: { status: GroceryItemStatus.purchased },
      }),
    ]);
    const purchaseWon =
      purchase.status === 'fulfilled' && purchase.value.count === 1;
    const removalWon = removal.status === 'fulfilled';

    expect(Number(purchaseWon) + Number(removalWon)).toBe(1);
    await expect(storedStatus(pending.id)).resolves.toBe(
      purchaseWon ? GroceryItemStatus.purchased : GroceryItemStatus.removed,
    );
  });

  function createItem(status = GroceryItemStatus.pending) {
    return prisma.groceryListItem.create({
      data: {
        productId,
        requestedQuantity: 1,
        status,
        source: GroceryItemSource.api,
      },
    });
  }

  async function storedStatus(id: string): Promise<GroceryItemStatus | null> {
    const item = await prisma.groceryListItem.findUnique({ where: { id } });
    return item?.status ?? null;
  }
});
