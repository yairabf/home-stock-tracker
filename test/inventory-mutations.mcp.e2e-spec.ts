import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import {
  type INestApplication,
  RequestMethod,
  ValidationPipe,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { createProductFixture } from './product-fixture';

const AUTHORIZATION = 'Bearer e2e-service-token';

interface MutationReceipt {
  event: {
    id: string;
    productId: string;
    eventType: string;
    quantity: number;
    source: string;
    timestamp: string;
  };
  stock: {
    productId: string;
    recordedEventId: string;
    recordedQuantity: number;
    estimatedQuantity: number;
    unit: string;
  };
}

describe('Inventory mutations MCP API (e2e)', () => {
  let app: INestApplication<App>;
  let client: Client;
  let prisma: PrismaService;
  const productIds: string[] = [];
  const originalMcpEnabled = process.env.MCP_ENABLED;

  beforeAll(async () => {
    process.env.MCP_ENABLED = 'true';
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = module.createNestApplication();
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

    client = new Client({ name: 'inventory-mutations-e2e', version: '1.0.0' });
    await client.connect(
      new StreamableHTTPClientTransport(new URL('/mcp', await app.getUrl()), {
        requestInit: { headers: { authorization: AUTHORIZATION } },
      }),
    );
  });

  afterEach(async () => {
    await prisma.stockProjection.deleteMany({
      where: { productId: { in: productIds } },
    });
    await prisma.productStatistics.deleteMany({
      where: { productId: { in: productIds } },
    });
    await prisma.productShelfLifePolicy.deleteMany({
      where: { productId: { in: productIds } },
    });
    await prisma.inventoryEvent.deleteMany({
      where: { productId: { in: productIds } },
    });
    await prisma.product.deleteMany({ where: { id: { in: productIds } } });
    productIds.length = 0;
  });

  afterAll(async () => {
    await client.close();
    await app.close();
    if (originalMcpEnabled === undefined) {
      delete process.env.MCP_ENABLED;
    } else {
      process.env.MCP_ENABLED = originalMcpEnabled;
    }
  });

  it('persists set, decrement, and mark_out with MCP provenance', async () => {
    const product = await createProduct('stock-operations', 'liter');

    const set = await callMutation({
      productId: product.id,
      operation: 'set',
      quantity: 5,
    });
    expect(set).toMatchObject({
      event: {
        productId: product.id,
        eventType: 'STOCK_SET',
        quantity: 5,
        source: 'mcp',
      },
      stock: { recordedQuantity: 5, estimatedQuantity: 5, unit: 'liter' },
    });

    const decrement = await callMutation({
      productId: product.id,
      operation: 'decrement',
      quantity: 2,
    });
    expect(decrement).toMatchObject({
      event: { eventType: 'STOCK_CONSUMED', quantity: 2, source: 'mcp' },
      stock: {
        recordedEventId: set.event.id,
        recordedQuantity: 5,
        estimatedQuantity: 3,
      },
    });

    const markOut = await callMutation({
      productId: product.id,
      operation: 'mark_out',
    });
    expect(markOut).toMatchObject({
      event: { eventType: 'STOCK_OUT', quantity: 0, source: 'mcp' },
      stock: { recordedQuantity: 0, estimatedQuantity: 0 },
    });
    await expect(
      prisma.inventoryEvent.count({ where: { productId: product.id } }),
    ).resolves.toBe(3);
  });

  it('records an ordered timestamped batch and rejects missing products atomically', async () => {
    const milk = await createProduct('batch-milk', 'liter');
    const rice = await createProduct('batch-rice', 'packet');
    const requestPurchasedAt = new Date(Date.now() - 2 * 86_400_000);
    const itemPurchasedAt = new Date(Date.now() - 86_400_000);

    const missing = await client.callTool({
      name: 'record_purchases',
      arguments: {
        items: [
          { productId: milk.id },
          { productId: '00000000-0000-4000-8000-000000000000' },
        ],
      },
    });
    expect(missing.isError).toBe(true);
    await expect(eventCount([milk.id, rice.id])).resolves.toBe(0);

    const result = await client.callTool({
      name: 'record_purchases',
      arguments: {
        purchasedAt: requestPurchasedAt.toISOString(),
        items: [
          { productId: milk.id, quantity: 2 },
          {
            productId: rice.id,
            purchasedAt: itemPurchasedAt.toISOString(),
          },
        ],
      },
    });
    const content = result.structuredContent as {
      items: MutationReceipt[];
    };
    expect(result.isError).not.toBe(true);
    expect(content.items.map((item) => item.event.productId)).toEqual([
      milk.id,
      rice.id,
    ]);
    expect(content.items[0]).toMatchObject({
      event: {
        quantity: 2,
        timestamp: requestPurchasedAt.toISOString(),
        source: 'mcp',
      },
      stock: { recordedQuantity: 2, unit: 'liter' },
    });
    expect(content.items[1]).toMatchObject({
      event: {
        quantity: 1,
        timestamp: itemPurchasedAt.toISOString(),
        source: 'mcp',
      },
      stock: { recordedQuantity: 1, unit: 'packet' },
    });
  });

  it('keeps concurrent MCP batch projections tied to their recorded events', async () => {
    const product = await createProduct('concurrent-batch', 'item');

    const results = await Promise.all([
      callBatch(product.id, 2),
      callBatch(product.id, 7),
    ]);
    expect(results.every((result) => result.isError !== true)).toBe(true);

    const projection = await prisma.stockProjection.findUniqueOrThrow({
      where: { productId: product.id },
    });
    const recordedEvent = await prisma.inventoryEvent.findUniqueOrThrow({
      where: { id: projection.recordedEventId },
    });
    expect(projection.recordedQuantity).toBe(recordedEvent.quantity);
    expect(projection.recordedAt).toEqual(recordedEvent.timestamp);
    expect(projection.recordedSource).toBe('mcp');
    await expect(eventCount([product.id])).resolves.toBe(2);
  });

  async function callMutation(
    arguments_: Record<string, unknown>,
  ): Promise<MutationReceipt> {
    const result = await client.callTool({
      name: 'update_inventory',
      arguments: arguments_,
    });
    expect(result.isError).not.toBe(true);
    return result.structuredContent as MutationReceipt;
  }

  function callBatch(productId: string, quantity: number) {
    return client.callTool({
      name: 'record_purchases',
      arguments: { items: [{ productId, quantity }] },
    });
  }

  function eventCount(ids: string[]) {
    return prisma.inventoryEvent.count({
      where: { productId: { in: ids } },
    });
  }

  async function createProduct(label: string, typicalUnit: string) {
    const product = await createProductFixture(prisma, {
      canonicalName: `inventory-mcp-${label}-${randomUUID()}`,
      typicalUnit,
    });
    productIds.push(product.id);
    return product;
  }
});
