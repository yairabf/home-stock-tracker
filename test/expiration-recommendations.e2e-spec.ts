import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { type INestApplication, RequestMethod } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import request from 'supertest';
import type { App } from 'supertest/types';
import { TEST_APP_MODULE as AppModule } from './app-module-fixture';
import {
  InventoryEventType,
  PredictedState,
  ShelfLifePolicyKind,
} from '../src/generated/prisma/enums';
import { PrismaService } from '../src/prisma/prisma.service';
import { createProductFixture } from './product-fixture';

const AUTHORIZATION = 'Bearer e2e-service-token';
const DAY = 86_400_000;

interface Recommendation {
  productId: string;
  purchaseEventId: string;
  expiresAt: string;
  expirySource: string;
  expiryConfidence: number;
  stockConfidence: number;
  confidenceScore: number;
  batchPresenceUnconfirmed: boolean;
}

interface RecommendationResponse {
  evaluatedAt: string;
  expiringSoon: Recommendation[];
  possiblyExpired: Recommendation[];
}

describe('Expiration recommendations REST and MCP reads (e2e)', () => {
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
    client = new Client({
      name: 'expiration-recommendations-e2e',
      version: '1.0.0',
    });
    await client.connect(
      new StreamableHTTPClientTransport(new URL('/mcp', await app.getUrl()), {
        requestInit: { headers: { authorization: AUTHORIZATION } },
      }),
    );
  });

  afterAll(async () => {
    await client?.close();
    if (prisma && productIds.length > 0) {
      const where = { productId: { in: productIds } };
      await prisma.expirationBatch.deleteMany({ where });
      await prisma.stockProjection.deleteMany({ where });
      await prisma.productShelfLifePolicy.deleteMany({ where });
      await prisma.groceryListItem.deleteMany({ where });
      await prisma.inventoryEvent.deleteMany({ where });
      await prisma.product.deleteMany({ where: { id: { in: productIds } } });
    }
    await app?.close();
    if (originalMcpEnabled === undefined) delete process.env.MCP_ENABLED;
    else process.env.MCP_ENABLED = originalMcpEnabled;
  });

  it('uses the earliest eligible event, excludes depleted stock, and leaves data unchanged', async () => {
    const now = new Date();
    const explicit = await product('explicit');
    const policy = await product('policy');
    const depleted = await product('depleted');

    const older = await event(explicit, new Date(now.getTime() - 5 * DAY));
    const newer = await event(explicit, new Date(now.getTime() - DAY));
    await batch(explicit, older.id, new Date(now.getTime() - DAY));
    await batch(explicit, newer.id, new Date(now.getTime() + 4 * DAY));
    await projection(
      explicit,
      newer.id,
      2,
      PredictedState.likely_available,
      0.9,
    );

    const policyEvent = await event(policy, new Date(now.getTime() - DAY));
    await prisma.productShelfLifePolicy.create({
      data: {
        productId: policy,
        kind: ShelfLifePolicyKind.finite,
        shelfLifeDays: 4,
        confidence: 0.72,
        rationale: 'isolated e2e fixture',
        evaluatedAt: now,
      },
    });
    await projection(
      policy,
      policyEvent.id,
      null,
      PredictedState.uncertain,
      0.8,
    );

    const depletedEvent = await event(depleted, new Date(now.getTime() - DAY));
    await batch(depleted, depletedEvent.id, new Date(now.getTime() + DAY));
    await projection(
      depleted,
      depletedEvent.id,
      0,
      PredictedState.probably_out,
      0.95,
    );

    const lowStockBefore = await request(app.getHttpServer())
      .get('/api/v1/inventory/predictions/low-stock')
      .set('authorization', AUTHORIZATION)
      .expect(200);
    const before = await counts();

    const rest = await request(app.getHttpServer())
      .get('/api/v1/inventory/expiration/recommendations')
      .set('authorization', AUTHORIZATION)
      .expect(200);
    const mcp = await client.callTool({
      name: 'get_expiration_recommendations',
      arguments: {},
    });
    const lowStockAfter = await request(app.getHttpServer())
      .get('/api/v1/inventory/predictions/low-stock')
      .set('authorization', AUTHORIZATION)
      .expect(200);

    expect(mcp.isError).not.toBe(true);
    const restData = rest.body as RecommendationResponse;
    const mcpData = mcp.structuredContent as unknown as RecommendationResponse;
    expect(new Date(restData.evaluatedAt).getTime()).not.toBeNaN();
    expect(new Date(mcpData.evaluatedAt).getTime()).not.toBeNaN();
    expect(restData.expiringSoon).toEqual(mcpData.expiringSoon);
    expect(restData.possiblyExpired).toEqual(mcpData.possiblyExpired);
    expect(restData.expiringSoon).toEqual([
      expect.objectContaining({
        productId: policy,
        purchaseEventId: policyEvent.id,
        expiresAt: new Date(
          policyEvent.timestamp.getTime() + 4 * DAY,
        ).toISOString(),
        expirySource: 'shelf_life_policy',
        expiryConfidence: 0.72,
        stockConfidence: 0.8,
        confidenceScore: 0.72,
        batchPresenceUnconfirmed: true,
      }),
    ]);
    expect(restData.possiblyExpired).toEqual([
      expect.objectContaining({
        productId: explicit,
        purchaseEventId: older.id,
        expirySource: 'explicit',
        expiryConfidence: 1,
        stockConfidence: 0.9,
        confidenceScore: 0.9,
        batchPresenceUnconfirmed: true,
      }),
    ]);
    expect(restData.expiringSoon).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ productId: depleted }),
      ]),
    );
    expect(lowStockAfter.body).toEqual(lowStockBefore.body);
    await expect(counts()).resolves.toEqual(before);
  });

  async function product(label: string): Promise<string> {
    const created = await createProductFixture(prisma, {
      canonicalName: `expiration-recommendation-${label}-${randomUUID()}`,
      category: 'e2e',
      typicalUnit: 'item',
      isPerishable: true,
    });
    productIds.push(created.id);
    return created.id;
  }

  function event(productId: string, timestamp: Date) {
    return prisma.inventoryEvent.create({
      data: {
        productId,
        eventType: InventoryEventType.PURCHASED,
        timestamp,
        source: 'e2e',
      },
    });
  }

  function batch(productId: string, purchaseEventId: string, expiresAt: Date) {
    return prisma.expirationBatch.create({
      data: { productId, purchaseEventId, expiresAt, source: 'e2e' },
    });
  }

  function projection(
    productId: string,
    recordedEventId: string,
    estimatedQuantity: number | null,
    estimatedState: PredictedState,
    confidence: number,
  ) {
    return prisma.stockProjection.create({
      data: {
        productId,
        unit: 'item',
        recordedQuantity: estimatedQuantity,
        recordedAt: new Date(),
        recordedSource: 'e2e',
        recordedEventId,
        estimatedQuantity,
        estimatedState,
        confidence,
        reason: 'isolated e2e fixture',
        evaluatedAt: new Date(),
      },
    });
  }

  async function counts() {
    const where = { productId: { in: productIds } };
    const [
      products,
      names,
      events,
      batches,
      projections,
      policies,
      groceries,
      predictions,
      households,
    ] = await Promise.all([
      prisma.product.count({ where: { id: { in: productIds } } }),
      prisma.productName.count({ where }),
      prisma.inventoryEvent.count({ where }),
      prisma.expirationBatch.count({ where }),
      prisma.stockProjection.count({ where }),
      prisma.productShelfLifePolicy.count({ where }),
      prisma.groceryListItem.count({ where }),
      prisma.prediction.count({ where }),
      prisma.household.count(),
    ]);
    return {
      products,
      names,
      events,
      batches,
      projections,
      policies,
      groceries,
      predictions,
      households,
    };
  }
});
