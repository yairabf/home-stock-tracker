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
import { GroceryItemStatus } from '../src/generated/prisma/enums';
import { PrismaService } from '../src/prisma/prisma.service';
import { AUTH_TEST_BYPASS } from './auth-test-bypass';

describe('Duplicate-safe grocery additions (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let client: Client;
  let productId: string;
  let canonicalName: string;
  let alias: string;
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
    const suffix = Date.now();
    canonicalName = `e2e duplicate milk ${suffix}`;
    alias = `e2e duplicate dairy ${suffix}`;
    const product = await prisma.product.create({
      data: { canonicalName, aliases: [alias] },
    });
    productId = product.id;

    const address = app.getHttpServer().address();
    if (!address || typeof address === 'string') {
      throw new Error('Test server did not bind to a TCP port');
    }
    client = new Client({ name: 'grocery-add-e2e', version: '1.0.0' });
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

  it('creates once then returns confirmation for a canonical alias', async () => {
    const created = await addThroughRest(canonicalName).expect(201);
    const duplicate = await addThroughRest(alias).expect(201);

    expect(created.body).toMatchObject({
      outcome: 'created',
      createdItem: { productId },
      existingItems: [],
    });
    expect(duplicate.body).toMatchObject({
      outcome: 'confirmation_required',
      createdItem: null,
      existingItems: [{ id: created.body.createdItem.id, productId }],
      requestedAddition: { requestedQuantity: 1 },
    });
    await expect(pendingCount()).resolves.toBe(1);
  });

  it('creates a separate line only when explicitly requested', async () => {
    await addThroughRest(canonicalName).expect(201);
    await addThroughRest(canonicalName, 'create_separate')
      .expect(201)
      .expect(({ body }) => expect(body.outcome).toBe('created'));

    await expect(pendingCount()).resolves.toBe(2);
  });

  it('does not let completed history block a new pending add', async () => {
    const first = await addThroughRest(canonicalName).expect(201);
    await prisma.groceryListItem.update({
      where: { id: first.body.createdItem.id },
      data: { status: GroceryItemStatus.purchased },
    });

    await addThroughRest(canonicalName)
      .expect(201)
      .expect(({ body }) => expect(body.outcome).toBe('created'));
    await expect(pendingCount()).resolves.toBe(1);
  });

  it('serializes concurrent default adds for the same product', async () => {
    const [first, second] = await Promise.all([
      addThroughRest(canonicalName),
      addThroughRest(canonicalName),
    ]);

    expect([first.body.outcome, second.body.outcome].sort()).toEqual([
      'confirmation_required',
      'created',
    ]);
    await expect(pendingCount()).resolves.toBe(1);
  });

  it('returns the confirmation contract through MCP', async () => {
    await client.callTool({
      name: 'grocery_add',
      arguments: { productName: canonicalName, requestedQuantity: 1 },
    });

    await expect(
      client.callTool({
        name: 'grocery_add',
        arguments: { productName: alias, requestedQuantity: 2 },
      }),
    ).resolves.toMatchObject({
      structuredContent: {
        outcome: 'confirmation_required',
        createdItem: null,
        existingItems: [{ productId }],
        requestedAddition: { requestedQuantity: 2 },
      },
    });
    await expect(pendingCount()).resolves.toBe(1);
  });

  function addThroughRest(
    productName: string,
    ifPendingExists?: 'create_separate',
  ) {
    return request(app.getHttpServer())
      .post('/api/v1/grocery/items')
      .send({
        productName,
        requestedQuantity: 1,
        ...(ifPendingExists ? { ifPendingExists } : {}),
      });
  }

  async function pendingCount(): Promise<number> {
    return prisma.groceryListItem.count({
      where: { productId, status: GroceryItemStatus.pending },
    });
  }
});
