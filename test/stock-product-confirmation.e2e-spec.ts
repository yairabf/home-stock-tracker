import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { StockProductConfirmationResponse } from '../src/inventory/dto/stock-product-confirmation-response';
import { ProductService } from '../src/product/product.service';
import { StatisticsService } from '../src/statistics/statistics.service';
import { OperationalLogger } from '../src/observability/operational-logger.service';
import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { StockProductConfirmationService } from '../src/inventory/stock-product-confirmation.service';
import { StockLedgerService } from '../src/inventory/stock-ledger.service';
import { InventoryService } from '../src/inventory/inventory.service';
import { StockMutationOperation } from '../src/inventory/types/stock-mutation';
import { ProductType } from '../src/generated/prisma/enums';
import { createProductFixture } from './product-fixture';
import type { StockProductConfirmationInput } from '../src/inventory/types/stock-product-confirmation';

describe('Confirmed stock product creation (PostgreSQL)', () => {
  let app: INestApplication;
  let client: Client;
  const originalMcpEnabled = process.env.MCP_ENABLED;
  let prisma: PrismaService;
  let service: StockProductConfirmationService;
  let ledger: StockLedgerService;
  let inventory: InventoryService;
  let prefix: string;
  const operationIds: string[] = [];

  beforeAll(async () => {
    process.env.MCP_ENABLED = 'true';
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    await app.listen(0, '127.0.0.1');
    client = new Client({ name: 'stock-confirmation-e2e', version: '1.0.0' });
    await client.connect(
      new StreamableHTTPClientTransport(new URL('/mcp', await app.getUrl()), {
        requestInit: { headers: { authorization: 'Bearer e2e-service-token' } },
      }),
    );
    prisma = app.get(PrismaService);
    service = app.get(StockProductConfirmationService);
    ledger = app.get(StockLedgerService);
    inventory = app.get(InventoryService);
  });
  beforeEach(() => {
    prefix = `stock-confirm-${randomUUID()}`;
  });
  afterEach(async () => {
    jest.restoreAllMocks();
    const products = await prisma.product.findMany({
      where: { names: { some: { displayName: { startsWith: prefix } } } },
      select: { id: true },
    });
    const where = { productId: { in: products.map(({ id }) => id) } };
    await prisma.stockProductConfirmation.deleteMany({
      where: { operationId: { in: operationIds } },
    });
    await prisma.groceryListItem.deleteMany({ where });
    await prisma.stockProjection.deleteMany({ where });
    await prisma.inventoryEvent.deleteMany({ where });
    await prisma.product.deleteMany({ where: { id: where.productId } });
    operationIds.length = 0;
  });
  afterAll(async () => {
    await client.close();
    await app.close();
    if (originalMcpEnabled === undefined) delete process.env.MCP_ENABLED;
    else process.env.MCP_ENABLED = originalMcpEnabled;
  });

  function request(name = 'milk'): StockProductConfirmationInput {
    const operationId = randomUUID();
    operationIds.push(operationId);
    return {
      operationId,
      product: {
        canonicalName: `${prefix}-${name}`,
        aliases: [],
        category: 'dairy',
        typicalUnit: 'liter',
        productType: ProductType.fast_consumable,
        isPerishable: true,
      },
      stock: { quantity: 2, unit: 'liter' },
    };
  }

  it('creates product, stock, event and durable serialized receipt together', async () => {
    const input = request();
    const response = await service.confirm(input);
    expect(response).toMatchObject({
      productOutcome: 'created',
      stock: { recordedQuantity: 2, unit: 'liter' },
      event: { eventType: 'STOCK_SET', source: 'mcp' },
    });
    expect(
      (
        await prisma.stockProductConfirmation.findUniqueOrThrow({
          where: { operationId: input.operationId },
        })
      ).responsePayload,
    ).toEqual(response);
    expect(
      await prisma.groceryListItem.count({
        where: { productId: response.productId },
      }),
    ).toBe(0);
  });

  it('reuses compatible product without changing pending groceries or aliases', async () => {
    const input = request();
    const product = await createProductFixture(prisma, input.product);
    const pending = await prisma.groceryListItem.create({
      data: {
        productId: product.id,
        requestedQuantity: 6,
        unit: 'liter',
        note: 'keep this',
      },
    });
    input.product.aliases = [`${prefix}-alias`];
    const response = await service.confirm(input);
    expect(response.productOutcome).toBe('reused');
    expect(
      await prisma.groceryListItem.findUnique({ where: { id: pending.id } }),
    ).toEqual(pending);
    expect(
      await prisma.productName.count({ where: { productId: product.id } }),
    ).toBe(1);
  });

  it.each(['facts', 'unit', 'missing-unit'])(
    'holds incompatible existing %s without any writes',
    async (kind) => {
      const input = request();
      const product = await createProductFixture(prisma, {
        ...input.product,
        ...(kind === 'facts'
          ? { category: 'other' }
          : { typicalUnit: kind === 'unit' ? 'carton' : null }),
      });
      await expect(service.confirm(input)).rejects.toMatchObject({
        response: { code: 'STOCK_CONFIRMATION_PRODUCT_CONFLICT' },
      });
      expect(
        await prisma.inventoryEvent.count({ where: { productId: product.id } }),
      ).toBe(0);
      expect(
        await prisma.stockProductConfirmation.findUnique({
          where: { operationId: input.operationId },
        }),
      ).toBeNull();
    },
  );

  it('rolls back a new product when the stock write fails after event creation', async () => {
    const input = request();
    jest
      .spyOn(ledger, 'setWithinTransaction')
      .mockRejectedValueOnce(new Error('injected ledger failure'));
    await expect(service.confirm(input)).rejects.toThrow(
      'injected ledger failure',
    );
    expect(
      await prisma.productName.findUnique({
        where: { normalizedName: input.product.canonicalName },
      }),
    ).toBeNull();
    expect(
      await prisma.stockProductConfirmation.findUnique({
        where: { operationId: input.operationId },
      }),
    ).toBeNull();
  });

  it('rolls back product, event and projection when receipt insertion fails', async () => {
    const input = request();
    const original = ledger.setWithinTransaction.bind(ledger);
    jest
      .spyOn(ledger, 'setWithinTransaction')
      .mockImplementation(async (tx, stockInput) => {
        const stock = await original(tx, stockInput);
        await tx.stockProductConfirmation.create({
          data: {
            operationId: input.operationId,
            requestVersion: 1,
            requestPayload: {},
            responsePayload: {},
          },
        });
        return stock;
      });
    await expect(service.confirm(input)).rejects.toThrow();
    expect(
      await prisma.productName.findUnique({
        where: { normalizedName: input.product.canonicalName },
      }),
    ).toBeNull();
    expect(
      await prisma.stockProductConfirmation.findUnique({
        where: { operationId: input.operationId },
      }),
    ).toBeNull();
  });

  it('rejects name ownership conflicts without a duplicate product', async () => {
    const input = request();
    const other = await createProductFixture(prisma, {
      ...input.product,
      canonicalName: `${prefix}-other`,
    });
    input.product.aliases = [`${prefix}-other`];
    await expect(service.confirm(input)).rejects.toMatchObject({
      response: { code: 'PRODUCT_NAME_CONFLICT' },
    });
    expect(
      await prisma.productName.findUnique({
        where: { normalizedName: input.product.canonicalName },
      }),
    ).toBeNull();
    expect(
      await prisma.inventoryEvent.count({ where: { productId: other.id } }),
    ).toBe(0);
  });

  it('does not acknowledge a stale set that the ledger did not apply', async () => {
    const input = request();
    const product = await createProductFixture(prisma, input.product);
    await inventory.updateStock({
      productId: product.id,
      operation: StockMutationOperation.set,
      quantity: 5,
      unit: 'liter',
      source: 'api',
    });
    await prisma.stockProjection.update({
      where: { productId: product.id },
      data: { evaluatedAt: new Date(Date.now() + 60000) },
    });
    await expect(service.confirm(input)).rejects.toMatchObject({
      response: { code: 'STOCK_STATE_CONFLICT' },
    });
    expect(
      await prisma.inventoryEvent.count({ where: { productId: product.id } }),
    ).toBe(1);
    expect(
      await prisma.stockProductConfirmation.findUnique({
        where: { operationId: input.operationId },
      }),
    ).toBeNull();
  });
  it('returns the original result after service restart and later stock changes', async () => {
    const input = request();
    const original = await service.confirm(input);
    await inventory.updateStock({
      productId: original.productId,
      operation: StockMutationOperation.set,
      quantity: 9,
      unit: 'carton',
      source: 'api',
    });
    const before = await prisma.stockProjection.findUniqueOrThrow({
      where: { productId: original.productId },
    });
    const restarted = new StockProductConfirmationService(
      prisma,
      app.get(ProductService),
      ledger,
      app.get(StatisticsService),
      app.get(OperationalLogger),
    );
    expect(await restarted.confirm(input)).toEqual(original);
    expect(
      await prisma.stockProjection.findUnique({
        where: { productId: original.productId },
      }),
    ).toEqual(before);
    expect(
      await prisma.inventoryEvent.count({
        where: { productId: original.productId },
      }),
    ).toBe(2);
  });

  it('rejects a changed payload after success without changing stock or history', async () => {
    const input = request();
    const original = await service.confirm(input);
    await expect(
      service.confirm({ ...input, stock: { ...input.stock, quantity: 3 } }),
    ).rejects.toMatchObject({
      response: { code: 'STOCK_CONFIRMATION_ID_CONFLICT' },
    });
    expect(
      await prisma.inventoryEvent.count({
        where: { productId: original.productId },
      }),
    ).toBe(1);
  });

  it('concurrent identical confirmations return one result and create one event', async () => {
    const input = request();
    const results = await Promise.all(
      Array.from({ length: 5 }, () => service.confirm(input)),
    );
    for (const result of results) expect(result).toEqual(results[0]);
    expect(
      await prisma.inventoryEvent.count({
        where: { productId: results[0].productId },
      }),
    ).toBe(1);
    expect(
      await prisma.productName.count({
        where: { normalizedName: input.product.canonicalName },
      }),
    ).toBe(1);
  });

  it('concurrent changed payloads under one ID produce one success and one conflict', async () => {
    const input = request();
    const results = await Promise.allSettled([
      service.confirm(input),
      service.confirm({ ...input, stock: { ...input.stock, quantity: 7 } }),
    ]);
    expect(results.filter(({ status }) => status === 'fulfilled')).toHaveLength(
      1,
    );
    const failure = results.find(
      ({ status }) => status === 'rejected',
    ) as PromiseRejectedResult;
    expect(failure.reason).toMatchObject({
      response: { code: 'STOCK_CONFIRMATION_ID_CONFLICT' },
    });
    const receipt = await prisma.stockProductConfirmation.findUniqueOrThrow({
      where: { operationId: input.operationId },
    });
    const result = receipt.responsePayload as unknown as { productId: string };
    expect(
      await prisma.inventoryEvent.count({
        where: { productId: result.productId },
      }),
    ).toBe(1);
  });

  it('distinct operation IDs racing on one new name create one compatible product', async () => {
    const input = request();
    const second = { ...input, operationId: request().operationId };
    const results = await Promise.all([
      service.confirm(input),
      service.confirm(second),
    ]);
    expect(results[0].productId).toBe(results[1].productId);
    expect(results.map(({ productOutcome }) => productOutcome).sort()).toEqual([
      'created',
      'reused',
    ]);
    expect(
      await prisma.inventoryEvent.count({
        where: { productId: results[0].productId },
      }),
    ).toBe(2);
  });
  async function tool<T>(
    name: string,
    args: Record<string, unknown>,
  ): Promise<T> {
    const result = await client.callTool({ name, arguments: args });
    expect(result.isError).not.toBe(true);
    return result.structuredContent as T;
  }

  it('runs mixed stock updates through MCP, holding unresolved lines and preserving groceries', async () => {
    const milk = request('milk');
    const rice = await createProductFixture(prisma, {
      ...milk.product,
      canonicalName: `${prefix}-rice`,
      typicalUnit: 'kg',
      category: 'pantry',
    });
    const yogurts = await Promise.all(
      ['plain', 'fruit'].map((name) =>
        createProductFixture(prisma, {
          ...milk.product,
          canonicalName: `${prefix}-yogurt-${name}`,
        }),
      ),
    );
    const pending = await prisma.groceryListItem.create({
      data: { productId: rice.id, requestedQuantity: 6, unit: 'kg' },
    });
    const known = await tool<{ id: string }>('get_product', {
      productName: `${prefix}-rice`,
    });
    await tool('update_inventory', {
      productId: known.id,
      operation: 'set',
      quantity: 1,
      unit: 'kg',
    });
    const missing = await tool<{ exactMatch: unknown; candidates: unknown[] }>(
      'search_products',
      { query: milk.product.canonicalName },
    );
    expect(missing.exactMatch).toBeNull();
    expect(missing.candidates).toHaveLength(0);
    const ambiguous = await tool<{
      exactMatch: unknown;
      candidates: unknown[];
    }>('search_products', { query: `${prefix}-yogurt` });
    expect(ambiguous.exactMatch).toBeNull();
    expect(ambiguous.candidates).toHaveLength(2);
    expect(
      await prisma.productName.findUnique({
        where: { normalizedName: milk.product.canonicalName },
      }),
    ).toBeNull();
    expect(
      await prisma.inventoryEvent.count({
        where: { productId: { in: yogurts.map(({ id }) => id) } },
      }),
    ).toBe(0);
    const approved = await tool<StockProductConfirmationResponse>(
      'inventory_confirm_new_product',
      milk,
    );
    expect(approved.stock).toMatchObject({
      recordedQuantity: 2,
      unit: 'liter',
    });
    expect(approved.event).toMatchObject({
      eventType: 'STOCK_SET',
      source: 'mcp',
    });
    await tool('update_inventory', {
      productId: approved.productId,
      operation: 'set',
      quantity: 4,
      unit: 'liter',
    });
    const newer = await prisma.stockProjection.findUniqueOrThrow({
      where: { productId: approved.productId },
    });
    expect(await tool('inventory_confirm_new_product', milk)).toEqual(approved);
    expect(
      await prisma.stockProjection.findUnique({
        where: { productId: approved.productId },
      }),
    ).toEqual(newer);
    expect(
      await prisma.inventoryEvent.count({
        where: { productId: approved.productId },
      }),
    ).toBe(2);
    expect(
      await prisma.inventoryEvent.count({ where: { productId: rice.id } }),
    ).toBe(1);
    expect(
      await prisma.groceryListItem.findUnique({ where: { id: pending.id } }),
    ).toEqual(pending);
    expect(
      await prisma.groceryListItem.count({
        where: { productId: approved.productId },
      }),
    ).toBe(0);
  });

  it('rejects invalid MCP confirmations and changed-payload replays without extra writes', async () => {
    const input = request();
    for (const invalid of [
      { ...input, source: 'api' },
      { ...input, stock: { quantity: 0, unit: 'liter' } },
      { ...input, stock: { quantity: 2, unit: 'carton' } },
    ]) {
      expect(
        (
          await client.callTool({
            name: 'inventory_confirm_new_product',
            arguments: invalid,
          })
        ).isError,
      ).toBe(true);
    }
    expect(
      await prisma.productName.findUnique({
        where: { normalizedName: input.product.canonicalName },
      }),
    ).toBeNull();
    const result = await tool<StockProductConfirmationResponse>(
      'inventory_confirm_new_product',
      input,
    );
    const conflict = await client.callTool({
      name: 'inventory_confirm_new_product',
      arguments: { ...input, stock: { ...input.stock, quantity: 7 } },
    });
    expect(conflict.isError).toBe(true);
    expect(JSON.stringify(conflict)).toContain(
      'STOCK_CONFIRMATION_ID_CONFLICT',
    );
    expect(
      await prisma.inventoryEvent.count({
        where: { productId: result.productId },
      }),
    ).toBe(1);
  });
});
