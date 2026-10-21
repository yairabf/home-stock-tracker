import { randomUUID } from 'node:crypto';
import {
  INestApplication,
  RequestMethod,
  ValidationPipe,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import { TEST_APP_MODULE } from './app-module-fixture';
import { LLM_PROVIDER } from '../src/llm/llm-provider';
import type { StructuredGenerationRequest } from '../src/llm/types/structured-generation';
import { assistedActionResponseSchema } from '../src/assisted-action/assisted-action-response.schema';
import { ProductUnderstandingRunner } from '../src/product/product-understanding-runner.service';
import {
  initialUnderstanding,
  PRODUCT_UNDERSTANDING,
  type ProductUnderstanding,
} from '../src/product/product-understanding';

const connectionString = process.env.ASSISTED_CATALOG_TEST_DATABASE_URL;
if (!connectionString || !new URL(connectionString).pathname.endsWith('_test'))
  throw new Error(
    'Set ASSISTED_CATALOG_TEST_DATABASE_URL to an isolated _test database',
  );
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});
const prefix = `assisted-transport-${randomUUID()}`;
const token = 'isolated-assisted-transport-token';
const metadata = {
  category: 'dairy',
  typicalUnit: 'liter',
  productType: 'fast_consumable',
  isPerishable: true,
};
const receiptIds: string[] = [];
let count = 0;
function item() {
  return { productName: `${prefix}-${count++} brand`, quantity: 2, metadata };
}
function input(operation: string, items: object[]) {
  const requestId = randomUUID();
  receiptIds.push(requestId);
  return { requestId, operation, items };
}

describe('Authenticated assisted REST and MCP (isolated PostgreSQL)', () => {
  let app: INestApplication;
  let base: string;
  let client: Client;
  const previousAuth = process.env.API_AUTH_TOKEN;
  const previousMcp = process.env.MCP_ENABLED;
  const generate = jest.fn<
    Promise<unknown>,
    [StructuredGenerationRequest<unknown>]
  >();
  beforeAll(async () => {
    process.env.API_AUTH_TOKEN = token;
    process.env.MCP_ENABLED = 'true';
    const module = await Test.createTestingModule({
      imports: [TEST_APP_MODULE],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(LLM_PROVIDER)
      .useValue({ name: 'test', generateStructured: generate })
      .compile();
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
    base = await app.getUrl();
    client = new Client({ name: 'assisted-integration', version: '1.0.0' });
    await client.connect(
      new StreamableHTTPClientTransport(new URL('/mcp', base), {
        requestInit: { headers: { Authorization: `Bearer ${token}` } },
      }),
    );
  });
  beforeEach(() => {
    generate.mockReset();
    generate.mockImplementation((request) =>
      Promise.resolve({
        status: 'success',
        provider: 'test',
        model: 'mock',
        value: {
          decision: {
            outcome: 'new',
            canonicalName: (request.input.rawName as string).replace(
              / brand$/,
              '',
            ),
            confidence: 0.99,
          },
        },
      }),
    );
  });
  afterEach(() => jest.restoreAllMocks());
  afterAll(async () => {
    await client?.close();
    await prisma.assistedActionReceipt.deleteMany({
      where: { requestId: { in: receiptIds } },
    });
    const products = await prisma.product.findMany({
      where: { names: { some: { displayName: { startsWith: prefix } } } },
      select: { id: true },
    });
    const where = { productId: { in: products.map((p) => p.id) } };
    await prisma.groceryListItem.deleteMany({ where });
    await prisma.stockProjection.deleteMany({ where });
    await prisma.inventoryEvent.deleteMany({ where });
    await prisma.product.deleteMany({ where: { id: where.productId } });
    await app?.close();
    await prisma.$disconnect();
    if (previousAuth === undefined) delete process.env.API_AUTH_TOKEN;
    else process.env.API_AUTH_TOKEN = previousAuth;
    if (previousMcp === undefined) delete process.env.MCP_ENABLED;
    else process.env.MCP_ENABLED = previousMcp;
  });
  async function rest(
    body: unknown,
    authorization: string | null = `Bearer ${token}`,
  ) {
    return fetch(`${base}/api/v1/inventory/assisted-actions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authorization ? { Authorization: authorization } : {}),
      },
      body: JSON.stringify(body),
    });
  }
  async function mcp(body: Record<string, unknown>) {
    const response = await client.callTool({
      name: 'apply_household_items',
      arguments: body,
    });
    expect(response.isError).not.toBe(true);
    return assistedActionResponseSchema.parse(response.structuredContent);
  }
  async function assertNoWrite(requestId: string, names: string[]) {
    expect(
      await prisma.assistedActionReceipt.findUnique({ where: { requestId } }),
    ).toBeNull();
    expect(
      await prisma.productName.count({ where: { displayName: { in: names } } }),
    ).toBe(0);
  }

  it.each([null, 'Bearer wrong-token'])(
    'rejects unauthenticated REST and MCP before inference (%s)',
    async (authorization) => {
      const body = input('grocery_add', [item()]);
      expect((await rest(body, authorization)).status).toBe(401);
      const response = await fetch(`${base}/mcp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authorization ? { Authorization: authorization } : {}),
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/call',
          params: { name: 'apply_household_items', arguments: body },
        }),
      });
      expect(response.status).toBe(401);
      expect(generate).not.toHaveBeenCalled();
    },
  );

  it('adds one named grocery through REST and replays through MCP without another write', async () => {
    const original = item();
    const body = input('grocery_add', [original]);
    const response = await rest(body);
    expect(response.status).toBe(200);
    const result = assistedActionResponseSchema.parse(await response.json());
    expect(result).toMatchObject({
      outcome: 'applied',
      receipts: [
        {
          suppliedName: original.productName,
          canonicalName: original.productName.replace(/ brand$/, ''),
          groceryItem: { source: 'api' },
        },
      ],
    });
    expect(await mcp(body)).toEqual(result);
    expect(generate).toHaveBeenCalledTimes(1);
    const changed = await rest({
      ...body,
      items: [{ ...original, quantity: 3 }],
    });
    expect(changed.status).toBe(409);
  });

  it('classifies missing stock metadata and unit in one authenticated request', async () => {
    const canonicalName = `${prefix}-${count++} milk`;
    const productName = `${canonicalName} 3% by Nestle`;
    generate.mockResolvedValueOnce({
      status: 'success',
      provider: 'test',
      model: 'mock',
      value: { decision: { outcome: 'new', canonicalName, confidence: 0.99 } },
    });
    const adapter = jest
      .spyOn(app.get<ProductUnderstanding>(PRODUCT_UNDERSTANDING), 'understand')
      .mockResolvedValue({
        fields: {
          category: { status: 'resolved', source: 'openai', value: 'dairy' },
          typicalUnit: { status: 'resolved', source: 'openai', value: 'liter' },
          productType: {
            status: 'resolved',
            source: 'openai',
            value: 'fast_consumable',
          },
          isPerishable: { status: 'resolved', source: 'openai', value: true },
        },
        attempts: [],
      });
    const body = input('stock_set', [{ productName, quantity: 2 }]);
    const response = await rest(body);
    expect(response.status).toBe(200);
    const result = assistedActionResponseSchema.parse(await response.json());
    if (result.outcome !== 'applied' || result.operation !== 'stock_set')
      throw new Error('Expected applied stock result');
    expect(result.receipts[0]).toMatchObject({
      canonicalName,
      suppliedName: productName,
      unresolvedMetadata: [],
      inventory: { stock: { unit: 'liter', recordedQuantity: 2 } },
    });
    expect(adapter).toHaveBeenCalledTimes(1);
    expect(JSON.parse(adapter.mock.calls[0][0].rawName)).toEqual({
      version: 'assisted-product-evidence-v1',
      canonicalName,
      originalName: productName,
    });
    const product = await prisma.product.findUniqueOrThrow({
      where: { id: result.receipts[0].productId },
      include: { names: true },
    });
    expect(product).toMatchObject(metadata);
    expect(product.names.map((name) => name.displayName)).toEqual(
      expect.arrayContaining([canonicalName, productName]),
    );
    expect(await mcp(body)).toEqual(result);
    expect(adapter).toHaveBeenCalledTimes(1);
    expect(generate).toHaveBeenCalledTimes(1);
  });

  it('commits a grocery with unknown optional metadata without asking for classification', async () => {
    const productName = item().productName;
    jest
      .spyOn(app.get<ProductUnderstanding>(PRODUCT_UNDERSTANDING), 'understand')
      .mockResolvedValue(
        initialUnderstanding({
          category: null,
          typicalUnit: null,
          productType: null,
          isPerishable: null,
        }),
      );
    const body = input('grocery_add', [{ productName }]);
    const result = await mcp(body);
    expect(result).toMatchObject({
      outcome: 'applied',
      receipts: [
        {
          suppliedName: productName,
          unresolvedMetadata: ['category', 'productType', 'isPerishable'],
          groceryItem: { requestedQuantity: 1 },
        },
      ],
    });
    const product = await prisma.productName.findUniqueOrThrow({
      where: { normalizedName: productName.toLowerCase() },
      include: { product: true },
    });
    expect(product.product.typicalUnit).toBe('item');
    expect(await mcp(body)).toEqual(result);
  });

  it.each(['stock_set', 'purchase'])(
    'applies a named %s batch through MCP and replays through REST',
    async (operation) => {
      const body = input(operation, [item(), item()]);
      const result = await mcp(body);
      expect(result).toMatchObject({
        outcome: 'applied',
        operation,
        receipts: [
          {
            inputIndex: 0,
            inventory: {
              event: {
                source: 'mcp',
                eventType:
                  operation === 'stock_set' ? 'STOCK_SET' : 'PURCHASED',
              },
              stock: { recordedQuantity: 2, unit: 'liter' },
            },
          },
          { inputIndex: 1, inventory: { stock: { recordedQuantity: 2 } } },
        ],
      });
      expect(await (await rest(body)).json()).toEqual(result);
      expect(generate).toHaveBeenCalledTimes(2);
    },
  );

  it('returns typed uncertainty and unavailable outcomes without writes on both transports', async () => {
    for (const transport of ['rest', 'mcp']) {
      for (const outcome of ['needs_input', 'unavailable']) {
        const original = item();
        const body = input('grocery_add', [original]);
        generate.mockResolvedValueOnce(
          outcome === 'needs_input'
            ? {
                status: 'success',
                provider: 'test',
                model: 'mock',
                value: { decision: { outcome: 'unknown' } },
              }
            : { status: 'unavailable' },
        );
        const response: unknown =
          transport === 'rest'
            ? await (await rest(body)).json()
            : await mcp(body);
        expect(response).toMatchObject({ outcome, requestId: body.requestId });
        await assertNoWrite(body.requestId, [original.productName]);
      }
    }
  });

  it('defaults units for a named stock batch through MCP and replays through REST', async () => {
    jest
      .spyOn(app.get(ProductUnderstandingRunner), 'understand')
      .mockResolvedValue(
        initialUnderstanding({ ...metadata, typicalUnit: null }),
      );
    const items = [item(), item()].map((i) => ({
      ...i,
      metadata: { ...metadata, typicalUnit: null },
    }));
    const body = input('stock_set', items);
    const result = await mcp(body);
    expect(result).toMatchObject({
      outcome: 'applied',
      receipts: [
        { inventory: { stock: { unit: 'item', recordedQuantity: 2 } } },
        { inventory: { stock: { unit: 'item', recordedQuantity: 2 } } },
      ],
    });
    expect(await (await rest(body)).json()).toEqual(result);
  });

  it.each([
    { operation: 'stock_set', items: [{ productName: 'milk' }] },
    {
      operation: 'grocery_add',
      items: [{ productName: 'milk', source: 'mcp' }],
    },
    {
      operation: 'grocery_add',
      source: 'mcp',
      items: [{ productName: 'milk' }],
    },
    {
      operation: 'purchase',
      items: [
        {
          productName: 'milk',
          quantity: 1,
          purchasedAt: '2099-01-01T00:00:00Z',
        },
      ],
    },
  ])(
    'rejects invalid or spoofed input on both transports %#',
    async (invalid) => {
      const body = { requestId: randomUUID(), ...invalid };
      expect((await rest(body)).status).toBe(400);
      const result = await client.callTool({
        name: 'apply_household_items',
        arguments: body,
      });
      expect(result.isError).toBe(true);
      expect(generate).not.toHaveBeenCalled();
    },
  );
});
