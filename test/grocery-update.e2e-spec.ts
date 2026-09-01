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

describe('Pending grocery field updates (e2e)', () => {
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
    const product = await createProductFixture(prisma, {
      canonicalName: `e2e grocery update ${Date.now()}`,
    });
    productId = product.id;

    client = new Client({ name: 'grocery-update-e2e', version: '1.0.0' });
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

  describe('REST', () => {
    it('sets a final quantity while preserving omitted fields', async () => {
      const item = await createItem();

      await patch(item.id, {
        requestedQuantity: 4,
        expectedRequestedQuantity: 2,
      })
        .expect(200)
        .expect(({ body }) => {
          expect(body).toMatchObject({
            id: item.id,
            requestedQuantity: 4,
            unit: 'liter',
            note: 'usual brand',
            source: GroceryItemSource.api,
          });
        });
      await expect(storedItem(item.id)).resolves.toMatchObject({
        requestedQuantity: 4,
        unit: 'liter',
        note: 'usual brand',
        source: GroceryItemSource.api,
      });
    });

    it.each([
      {
        name: 'unit',
        update: { unit: null, expectedUnit: 'liter' },
        expected: { unit: null, note: 'usual brand' },
      },
      {
        name: 'note',
        update: { note: null, expectedNote: 'usual brand' },
        expected: { unit: 'liter', note: null },
      },
    ])('clears a nullable $name', async ({ update, expected }) => {
      const item = await createItem();

      await patch(item.id, update)
        .expect(200)
        .expect(({ body }) => {
          expect(body).toMatchObject({
            id: item.id,
            requestedQuantity: 2,
            ...expected,
          });
        });
      await expect(storedItem(item.id)).resolves.toMatchObject({
        requestedQuantity: 2,
        ...expected,
      });
    });

    it('updates quantity, unit, and note in one request', async () => {
      const item = await createItem();

      await patch(item.id, combinedUpdate())
        .expect(200)
        .expect(({ body }) => {
          expect(body).toMatchObject({
            id: item.id,
            requestedQuantity: 4,
            unit: 'cartons',
            note: 'lactose-free',
          });
        });
      await expect(storedItem(item.id)).resolves.toMatchObject({
        requestedQuantity: 4,
        unit: 'cartons',
        note: 'lactose-free',
      });
    });

    it.each([
      {
        name: 'quantity',
        update: { requestedQuantity: 4, expectedRequestedQuantity: 1 },
      },
      {
        name: 'unit',
        update: { unit: 'cartons', expectedUnit: 'bottle' },
      },
      {
        name: 'note',
        update: { note: 'lactose-free', expectedNote: 'old note' },
      },
    ])('returns current state for stale $name', async ({ update }) => {
      const item = await createItem();

      await patch(item.id, update)
        .expect(409)
        .expect(({ body }) => {
          expect(body).toMatchObject({
            code: 'GROCERY_ITEM_CHANGED',
            currentItem: {
              id: item.id,
              requestedQuantity: 2,
              unit: 'liter',
              note: 'usual brand',
            },
          });
        });
      await expect(storedItem(item.id)).resolves.toMatchObject(
        originalFields(),
      );
    });

    it.each([
      { name: 'empty update', update: {}, status: 422 },
      {
        name: 'missing expected quantity',
        update: { requestedQuantity: 4 },
        status: 400,
      },
      {
        name: 'invalid quantity',
        update: { requestedQuantity: 0, expectedRequestedQuantity: 2 },
        status: 400,
      },
      {
        name: 'empty note',
        update: { note: ' ', expectedNote: 'usual brand' },
        status: 400,
      },
    ])('rejects $name without mutation', async ({ update, status }) => {
      const item = await createItem();

      await patch(item.id, update).expect(status);
      await expect(storedItem(item.id)).resolves.toMatchObject(
        originalFields(),
      );
    });

    it('rejects a non-pending item without mutation', async () => {
      const item = await createItem(GroceryItemStatus.purchased);

      await patch(item.id, {
        requestedQuantity: 4,
        expectedRequestedQuantity: 2,
      })
        .expect(409)
        .expect(({ body }) => {
          expect(body).toMatchObject({ code: 'GROCERY_ITEM_NOT_PENDING' });
        });
      await expect(storedItem(item.id)).resolves.toMatchObject({
        status: GroceryItemStatus.purchased,
        requestedQuantity: 2,
      });
    });
  });

  describe('MCP', () => {
    it('discovers direct fields without quantity operations', async () => {
      const tools = await client.listTools();
      const schema = tools.tools.find(
        ({ name }) => name === 'grocery_update',
      )?.inputSchema;

      expect(schema).toMatchObject({
        additionalProperties: false,
        required: ['id'],
        properties: {
          id: { type: 'string', format: 'uuid' },
          requestedQuantity: { type: 'number', exclusiveMinimum: 0 },
          expectedRequestedQuantity: {},
          unit: {},
          expectedUnit: {},
          note: {},
          expectedNote: {},
        },
      });
      expect(schema?.properties).not.toHaveProperty('quantityMode');
      expect(schema?.properties).not.toHaveProperty('quantity');
    });

    it('updates final quantity, unit, and note together', async () => {
      const item = await createItem();

      await expect(
        client.callTool({
          name: 'grocery_update',
          arguments: { id: item.id, ...combinedUpdate() },
        }),
      ).resolves.toMatchObject({
        structuredContent: {
          id: item.id,
          requestedQuantity: 4,
          unit: 'cartons',
          note: 'lactose-free',
        },
      });
      await expect(storedItem(item.id)).resolves.toMatchObject({
        requestedQuantity: 4,
        unit: 'cartons',
        note: 'lactose-free',
        source: GroceryItemSource.api,
      });
    });

    it.each([
      {
        name: 'unit',
        update: { unit: null, expectedUnit: 'liter' },
        expected: { unit: null, note: 'usual brand' },
      },
      {
        name: 'note',
        update: { note: null, expectedNote: 'usual brand' },
        expected: { unit: 'liter', note: null },
      },
    ])('clears a nullable $name', async ({ update, expected }) => {
      const item = await createItem();

      await expect(
        client.callTool({
          name: 'grocery_update',
          arguments: { id: item.id, ...update },
        }),
      ).resolves.toMatchObject({
        structuredContent: { id: item.id, ...expected },
      });
      await expect(storedItem(item.id)).resolves.toMatchObject({
        requestedQuantity: 2,
        ...expected,
      });
    });

    it('returns current state for a stale expected value', async () => {
      const item = await createItem();

      const result = await client.callTool({
        name: 'grocery_update',
        arguments: {
          id: item.id,
          note: 'lactose-free',
          expectedNote: 'old note',
        },
      });

      expect(result.isError).toBe(true);
      expect(JSON.parse(textContent(result))).toMatchObject({
        code: 'GROCERY_ITEM_CHANGED',
        currentItem: { id: item.id, ...originalFields() },
      });
      await expect(storedItem(item.id)).resolves.toMatchObject(
        originalFields(),
      );
    });

    it.each([
      {
        name: 'an empty update',
        update: {},
        message: 'INVALID_UPDATE',
      },
      {
        name: 'a selected field without its expected value',
        update: { requestedQuantity: 4 },
        message: 'INVALID_QUANTITY',
      },
      {
        name: 'an operation-based payload',
        update: { quantityMode: 'increment', quantity: 2 },
        message: 'Invalid arguments',
      },
    ])('rejects $name without mutation', async ({ update, message }) => {
      const item = await createItem();

      const result = await client.callTool({
        name: 'grocery_update',
        arguments: { id: item.id, ...update },
      });

      expect(result.isError).toBe(true);
      expect(textContent(result)).toContain(message);
      await expect(storedItem(item.id)).resolves.toMatchObject(
        originalFields(),
      );
    });

    it('rejects a non-pending item without mutation', async () => {
      const item = await createItem(GroceryItemStatus.purchased);

      const result = await client.callTool({
        name: 'grocery_update',
        arguments: {
          id: item.id,
          requestedQuantity: 4,
          expectedRequestedQuantity: 2,
        },
      });

      expect(result.isError).toBe(true);
      expect(textContent(result)).toContain('GROCERY_ITEM_NOT_PENDING');
      await expect(storedItem(item.id)).resolves.toMatchObject({
        status: GroceryItemStatus.purchased,
        ...originalFields(),
      });
    });
  });

  function patch(id: string, body: Record<string, unknown>) {
    return request(app.getHttpServer())
      .patch(`/api/v1/grocery/items/${id}`)
      .send(body);
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

  function combinedUpdate() {
    return {
      requestedQuantity: 4,
      expectedRequestedQuantity: 2,
      unit: 'cartons',
      expectedUnit: 'liter',
      note: 'lactose-free',
      expectedNote: 'usual brand',
    };
  }

  function originalFields() {
    return {
      requestedQuantity: 2,
      unit: 'liter',
      note: 'usual brand',
    };
  }

  async function storedItem(id: string) {
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
