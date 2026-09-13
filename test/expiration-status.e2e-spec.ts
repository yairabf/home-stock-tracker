import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { type INestApplication, RequestMethod } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import {
  InventoryEventType,
  ShelfLifePolicyKind,
} from '../src/generated/prisma/enums';
import { PrismaService } from '../src/prisma/prisma.service';
import { createProductFixture } from './product-fixture';

const AUTHORIZATION = 'Bearer e2e-service-token';

interface ExpirationStatusItem {
  purchaseEventId: string;
  productId: string;
  productName: string;
  purchasedAt: string;
  expiresAt: string | null;
  status: string;
  expirySource: string;
  shelfLifeDays: number | null;
  evaluatedAt: string;
}

describe('Expiration status REST and MCP reads (e2e)', () => {
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
    await app.listen(0, '127.0.0.1');
    prisma = app.get(PrismaService);
    client = new Client({ name: 'expiration-status-e2e', version: '1.0.0' });
    await client.connect(
      new StreamableHTTPClientTransport(new URL('/mcp', await app.getUrl()), {
        requestInit: { headers: { authorization: AUTHORIZATION } },
      }),
    );
  });

  afterEach(async () => {
    await prisma.expirationBatch.deleteMany({
      where: { productId: { in: productIds } },
    });
    await prisma.stockProjection.deleteMany({
      where: { productId: { in: productIds } },
    });
    await prisma.prediction.deleteMany({
      where: { productId: { in: productIds } },
    });
    await prisma.productShelfLifePolicy.deleteMany({
      where: { productId: { in: productIds } },
    });
    await prisma.groceryListItem.deleteMany({
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

  it('returns mixed batch evidence through REST and MCP without changing household state', async () => {
    const explicit = await createProduct('explicit');
    const finite = await createProduct('finite');
    const nonperishable = await createProduct('nonperishable');
    const unknown = await createProduct('unknown');
    const excluded = await createProduct('excluded');
    const asOf = new Date();
    const purchasedAt = new Date(asOf.getTime() - 2 * 86_400_000);
    const explicitEvent = await createEvent(
      explicit.id,
      InventoryEventType.PURCHASED,
      purchasedAt,
    );
    const finiteEvent = await createEvent(
      finite.id,
      InventoryEventType.RESTOCKED,
      purchasedAt,
    );
    const nonperishableEvent = await createEvent(
      nonperishable.id,
      InventoryEventType.PURCHASED,
      purchasedAt,
    );
    const unknownEvent = await createEvent(
      unknown.id,
      InventoryEventType.RESTOCKED,
      purchasedAt,
    );
    await createEvent(excluded.id, InventoryEventType.STOCK_LOW, purchasedAt);
    await prisma.expirationBatch.create({
      data: {
        productId: explicit.id,
        purchaseEventId: explicitEvent.id,
        expiresAt: new Date(asOf.getTime() - 1_000),
        source: 'test',
      },
    });
    await createPolicy(finite.id, ShelfLifePolicyKind.finite, 7);
    await createPolicy(
      nonperishable.id,
      ShelfLifePolicyKind.nonperishable,
      null,
    );
    const before = await sideEffectCounts();

    const rest = await request(app.getHttpServer())
      .get('/api/v1/inventory/expiration')
      .set('authorization', AUTHORIZATION)
      .expect(200);
    const mcp = await client.callTool({
      name: 'list_expiration_status',
      arguments: {},
    });

    expect(mcp.isError).not.toBe(true);
    const restItems = relevantItems(rest.body.items);
    const mcpItems = relevantItems(
      (mcp.structuredContent as { items: ExpirationStatusItem[] }).items,
    );
    expect(restItems).toHaveLength(4);
    expect(mcpItems).toHaveLength(4);
    expect(restItems.map(withoutEvaluationTime)).toEqual(
      mcpItems.map(withoutEvaluationTime),
    );
    expect(restItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          purchaseEventId: explicitEvent.id,
          productId: explicit.id,
          productName: explicit.name,
          purchasedAt: purchasedAt.toISOString(),
          expiresAt: expect.any(String),
          status: 'expired',
          expirySource: 'explicit',
          shelfLifeDays: null,
          evaluatedAt: expect.any(String),
        }),
        expect.objectContaining({
          purchaseEventId: finiteEvent.id,
          productId: finite.id,
          productName: finite.name,
          purchasedAt: purchasedAt.toISOString(),
          expiresAt: new Date(
            purchasedAt.getTime() + 7 * 86_400_000,
          ).toISOString(),
          status: 'expiring_soon',
          expirySource: 'shelf_life_policy',
          shelfLifeDays: 7,
          evaluatedAt: expect.any(String),
        }),
        expect.objectContaining({
          purchaseEventId: nonperishableEvent.id,
          productId: nonperishable.id,
          productName: nonperishable.name,
          expiresAt: null,
          status: 'nonperishable',
          expirySource: 'shelf_life_policy',
          shelfLifeDays: null,
          evaluatedAt: expect.any(String),
        }),
        expect.objectContaining({
          purchaseEventId: unknownEvent.id,
          productId: unknown.id,
          productName: unknown.name,
          expiresAt: null,
          status: 'unknown',
          expirySource: 'none',
          shelfLifeDays: null,
          evaluatedAt: expect.any(String),
        }),
      ]),
    );
    expect(restItems).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ productId: excluded.id }),
      ]),
    );
    await expect(sideEffectCounts()).resolves.toEqual(before);
  });

  async function createProduct(label: string) {
    const name = `expiration-status-${label}-${randomUUID()}`;
    const product = await createProductFixture(prisma, {
      canonicalName: name,
      typicalUnit: 'item',
    });
    productIds.push(product.id);
    return { id: product.id, name };
  }

  function createEvent(
    productId: string,
    eventType: InventoryEventType,
    timestamp: Date,
  ) {
    return prisma.inventoryEvent.create({
      data: { productId, eventType, timestamp, source: 'test' },
    });
  }

  function createPolicy(
    productId: string,
    kind: ShelfLifePolicyKind,
    shelfLifeDays: number | null,
  ) {
    return prisma.productShelfLifePolicy.create({
      data: {
        productId,
        kind,
        shelfLifeDays,
        confidence: 1,
        rationale: 'e2e fixture',
        evaluatedAt: new Date(),
      },
    });
  }

  function relevantItems(items: ExpirationStatusItem[]) {
    return items.filter((item) => productIds.includes(item.productId));
  }

  function withoutEvaluationTime(item: ExpirationStatusItem) {
    const { evaluatedAt: _evaluatedAt, ...rest } = item;
    return rest;
  }

  async function sideEffectCounts() {
    const where = { productId: { in: productIds } };
    const [expirationBatches, events, projections, predictions, groceries] =
      await Promise.all([
        prisma.expirationBatch.count({ where }),
        prisma.inventoryEvent.count({ where }),
        prisma.stockProjection.count({ where }),
        prisma.prediction.count({ where }),
        prisma.groceryListItem.count({ where }),
      ]);
    return { expirationBatches, events, projections, predictions, groceries };
  }
});
