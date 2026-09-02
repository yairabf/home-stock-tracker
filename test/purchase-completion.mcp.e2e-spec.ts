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
import {
  GroceryItemSource,
  GroceryItemStatus,
  InventoryEventType,
} from '../src/generated/prisma/enums';
import { PrismaService } from '../src/prisma/prisma.service';
import { createProductFixture } from './product-fixture';

const AUTHORIZATION = 'Bearer e2e-service-token';

describe('Purchase completion MCP API (e2e)', () => {
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

    client = new Client({ name: 'purchase-completion-e2e', version: '1.0.0' });
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

  it('uses requested measurements for legacy ID-only completion', async () => {
    const rice = await createProduct('legacy rice');
    const milk = await createProduct('legacy milk');
    const riceItem = await createItem(rice.id, 2, 'bags');
    const milkItem = await createItem(milk.id, 4, 'bottles');

    const result = await callCompletion({
      groceryItemIds: [riceItem.id, milkItem.id],
    });

    const content = result.structuredContent as CompletionContent;
    expect(content.completedItems.map((item) => item.id)).toEqual([
      riceItem.id,
      milkItem.id,
    ]);
    expect(content.events.map((event) => event.productId)).toEqual([
      rice.id,
      milk.id,
    ]);
    expect(content.events).toEqual([
      expect.objectContaining({
        productId: rice.id,
        quantity: 2,
        unit: 'bags',
        source: 'mcp',
      }),
      expect.objectContaining({
        productId: milk.id,
        quantity: 4,
        unit: 'bottles',
        source: 'mcp',
      }),
    ]);
    const stored = await storedCompletion([riceItem.id, milkItem.id]);
    expect(stored[0]).toMatchObject({
      id: riceItem.id,
      status: GroceryItemStatus.purchased,
      requestedQuantity: 2,
      unit: 'bags',
      relatedInventoryEvent: { quantity: 2, unit: 'bags' },
    });
    expect(stored[1]).toMatchObject({
      id: milkItem.id,
      status: GroceryItemStatus.purchased,
      requestedQuantity: 4,
      unit: 'bottles',
      relatedInventoryEvent: { quantity: 4, unit: 'bottles' },
    });
    const projections = await prisma.stockProjection.findMany({
      where: { productId: { in: [rice.id, milk.id] } },
      orderBy: { productId: 'asc' },
    });
    expect(projections).toHaveLength(2);
    expect(projections).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          productId: rice.id,
          recordedQuantity: 2,
          estimatedQuantity: 2,
          unit: 'bags',
        }),
        expect.objectContaining({
          productId: milk.id,
          recordedQuantity: 4,
          estimatedQuantity: 4,
          unit: 'bottles',
        }),
      ]),
    );
  });

  it('aggregates same-unit rows and keeps different products separate', async () => {
    const milk = await createProduct('measured milk');
    const rice = await createProduct('measured rice');
    const firstMilk = await createItem(milk.id, 4, 'requested bottles');
    const secondMilk = await createItem(milk.id, 7, 'requested cases');
    const riceItem = await createItem(rice.id, 1, 'requested bag');

    const result = await callCompletion({
      items: [
        { groceryItemId: riceItem.id, actualQuantity: 1.5 },
        {
          groceryItemId: firstMilk.id,
          actualQuantity: 2,
          actualUnit: 'cartons',
        },
        {
          groceryItemId: secondMilk.id,
          actualQuantity: 3,
          actualUnit: 'cartons',
        },
      ],
    });

    const content = result.structuredContent as CompletionContent;
    expect(content.completedItems.map((item) => item.id)).toEqual([
      riceItem.id,
      firstMilk.id,
      secondMilk.id,
    ]);
    expect(content.events).toEqual([
      expect.objectContaining({
        productId: rice.id,
        quantity: 1.5,
        unit: null,
        source: 'mcp',
      }),
      expect.objectContaining({
        productId: milk.id,
        quantity: 5,
        unit: 'cartons',
        source: 'mcp',
      }),
    ]);
    const stored = await storedCompletion([
      riceItem.id,
      firstMilk.id,
      secondMilk.id,
    ]);
    expect(stored[0]).toMatchObject({
      requestedQuantity: 1,
      unit: 'requested bag',
      relatedInventoryEvent: { productId: rice.id, quantity: 1.5, unit: null },
    });
    expect(stored[1]).toMatchObject({
      requestedQuantity: 4,
      unit: 'requested bottles',
      relatedInventoryEvent: {
        productId: milk.id,
        quantity: 5,
        unit: 'cartons',
      },
    });
    expect(stored[2]).toMatchObject({
      requestedQuantity: 7,
      unit: 'requested cases',
      relatedInventoryEvent: { id: stored[1].relatedInventoryEventId },
    });
    await expect(eventCount()).resolves.toBe(2);
  });

  it.each([
    {
      case: 'partially measured rows',
      items: (firstId: string, secondId: string) => [
        { groceryItemId: firstId, actualQuantity: 2 },
        { groceryItemId: secondId },
      ],
      message: 'must be supplied for every selected item or none',
    },
    {
      case: 'conflicting units',
      items: (firstId: string, secondId: string) => [
        { groceryItemId: firstId, actualQuantity: 2, actualUnit: 'cartons' },
        { groceryItemId: secondId, actualQuantity: 3, actualUnit: 'boxes' },
      ],
      message: 'must match exactly',
    },
  ])('rejects $case without any persisted mutation', async (testCase) => {
    const milk = await createProduct(`invalid ${testCase.case}`);
    const first = await createItem(milk.id);
    const second = await createItem(milk.id);

    const result = await callCompletion({
      items: testCase.items(first.id, second.id),
    });

    expect(result).toMatchObject({ isError: true });
    expect(JSON.stringify(result)).toContain(testCase.message);
    await expect(unchangedItems([first.id, second.id])).resolves.toBe(true);
  });

  it('rejects malformed measurements before persistence', async () => {
    const milk = await createProduct('malformed measurement');
    const item = await createItem(milk.id);

    const result = await callCompletion({
      items: [{ groceryItemId: item.id, actualUnit: 'cartons' }],
    });

    expect(result.isError).toBe(true);
    await expect(unchangedItems([item.id])).resolves.toBe(true);
  });

  it('rejects a repeated completion without another event', async () => {
    const milk = await createProduct('repeated completion');
    const item = await createItem(milk.id);
    const input = { items: [{ groceryItemId: item.id }] };

    await expect(callCompletion(input)).resolves.toHaveProperty(
      'structuredContent',
    );
    const repeated = await callCompletion(input);

    expect(repeated).toEqual({
      content: [
        {
          type: 'text',
          text: 'One or more grocery items cannot be completed',
        },
      ],
      isError: true,
    });
    await expect(eventCount()).resolves.toBe(1);
    await expect(storedStatus(item.id)).resolves.toBe(
      GroceryItemStatus.purchased,
    );
  });

  it('allows one concurrent completion winner without an orphan event', async () => {
    const milk = await createProduct('concurrent completion');
    const item = await createItem(milk.id);
    const input = {
      items: [
        {
          groceryItemId: item.id,
          actualQuantity: 2,
          actualUnit: 'cartons',
        },
      ],
    };

    const results = await Promise.all([
      callCompletion(input),
      callCompletion(input),
    ]);

    expect(results.filter((result) => result.isError !== true)).toHaveLength(1);
    expect(results.filter((result) => result.isError === true)).toHaveLength(1);
    await expect(eventCount()).resolves.toBe(1);
    const stored = await storedCompletion([item.id]);
    expect(stored[0]).toMatchObject({
      status: GroceryItemStatus.purchased,
      relatedInventoryEvent: {
        eventType: InventoryEventType.PURCHASED,
        quantity: 2,
        unit: 'cartons',
        source: 'mcp',
      },
    });
  });

  function callCompletion(arguments_: Record<string, unknown>) {
    return client.callTool({
      name: 'complete_grocery_purchase',
      arguments: arguments_,
    });
  }

  async function createProduct(label: string) {
    const product = await createProductFixture(prisma, {
      canonicalName: `mcp-completion-${label}-${randomUUID()}`,
    });
    productIds.push(product.id);
    return product;
  }

  function createItem(productId: string, requestedQuantity = 1, unit?: string) {
    return prisma.groceryListItem.create({
      data: {
        productId,
        requestedQuantity,
        unit,
        source: GroceryItemSource.mcp,
      },
    });
  }

  function storedCompletion(ids: string[]) {
    return prisma.groceryListItem
      .findMany({
        where: { id: { in: ids } },
        orderBy: { id: 'asc' },
        include: { relatedInventoryEvent: true },
      })
      .then((items) => {
        const byId = new Map(items.map((item) => [item.id, item]));
        return ids.map((id) => {
          const item = byId.get(id);
          if (!item) {
            throw new Error(`Stored grocery item ${id} was not found`);
          }
          return item;
        });
      });
  }

  async function unchangedItems(ids: string[]): Promise<boolean> {
    const [items, events] = await Promise.all([
      prisma.groceryListItem.findMany({ where: { id: { in: ids } } }),
      eventCount(),
    ]);
    return (
      events === 0 &&
      items.every(
        (item) =>
          item.status === GroceryItemStatus.pending &&
          item.relatedInventoryEventId === null,
      )
    );
  }

  function eventCount() {
    return prisma.inventoryEvent.count({
      where: { productId: { in: productIds } },
    });
  }

  async function storedStatus(id: string): Promise<GroceryItemStatus | null> {
    const item = await prisma.groceryListItem.findUnique({ where: { id } });
    return item?.status ?? null;
  }
});

interface CompletionContent {
  events: Array<{
    productId: string;
    quantity: number | null;
    unit: string | null;
  }>;
  completedItems: Array<{ id: string }>;
}
