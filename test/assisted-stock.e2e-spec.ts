import { ScheduleModule } from '@nestjs/schedule';
import { randomUUID } from 'node:crypto';
import { Test, type TestingModule } from '@nestjs/testing';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaModule } from '../src/prisma/prisma.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { ModelConfigModule } from '../src/config/model-config.module';
import { TEST_MODEL_CONFIG } from './app-module-fixture';
import { LLM_PROVIDER } from '../src/llm/llm-provider';
import type { StructuredGenerationRequest } from '../src/llm/types/structured-generation';
import { AssistedActionModule } from '../src/assisted-action/assisted-action.module';
import { AssistedStockService } from '../src/assisted-action/assisted-stock.service';
import { InventoryService } from '../src/inventory/inventory.service';
import { StatisticsService } from '../src/statistics/statistics.service';
import { ProductUnderstandingRunner } from '../src/product/product-understanding-runner.service';
import { initialUnderstanding } from '../src/product/product-understanding';
import type { AssistedActionWireResult } from '../src/assisted-action/assisted-action-response.schema';

const connectionString = process.env.ASSISTED_CATALOG_TEST_DATABASE_URL;
if (!connectionString || !new URL(connectionString).pathname.endsWith('_test'))
  throw new Error(
    'Set ASSISTED_CATALOG_TEST_DATABASE_URL to a dedicated database ending in _test',
  );
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});
const prefix = `assisted-stock-${randomUUID()}`;
const receiptIds: string[] = [];
const choices = new Map<string, string | null>();
let next = 0;
const metadata = {
  category: 'dairy',
  typicalUnit: 'liter',
  productType: 'fast_consumable',
  isPerishable: true,
};
function newItem() {
  const canonical = `${prefix}-${next++}`;
  choices.set(`${canonical} brand`, canonical);
  return { productName: `${canonical} brand`, metadata, quantity: 2 };
}
function request(items: object[], operation = 'stock_set') {
  const requestId = randomUUID();
  receiptIds.push(requestId);
  return { requestId, operation, items };
}
function applied(result: AssistedActionWireResult) {
  if (result.outcome !== 'applied' || result.operation === 'grocery_add')
    throw new Error(
      `Expected stock success, received ${JSON.stringify(result)}`,
    );
  return result;
}

describe('Assisted stock action (isolated PostgreSQL)', () => {
  let module: TestingModule;
  let service: AssistedStockService;
  let inventory: InventoryService;
  let statistics: StatisticsService;
  const generate = jest.fn<
    Promise<unknown>,
    [StructuredGenerationRequest<unknown>]
  >();
  beforeAll(async () => {
    await prisma.$connect();
    module = await Test.createTestingModule({
      imports: [
        ScheduleModule.forRoot(),
        ModelConfigModule.register(TEST_MODEL_CONFIG),
        PrismaModule,
        AssistedActionModule,
      ],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(LLM_PROVIDER)
      .useValue({ name: 'test', generateStructured: generate })
      .compile();
    service = module.get(AssistedStockService);
    inventory = module.get(InventoryService);
    statistics = module.get(StatisticsService);
  });
  beforeEach(() => {
    generate.mockReset();
    generate.mockImplementation((input) => {
      const canonicalName = choices.get(input.input.rawName as string);
      if (canonicalName === undefined) throw new Error('Unexpected test name');
      return Promise.resolve({
        status: 'success',
        provider: 'test',
        model: 'mock',
        value: {
          decision:
            canonicalName === null
              ? { outcome: 'unknown' }
              : { outcome: 'new', canonicalName, confidence: 0.99 },
        },
      });
    });
  });
  afterEach(() => jest.restoreAllMocks());
  afterAll(async () => {
    await prisma.assistedActionReceipt.deleteMany({
      where: { requestId: { in: receiptIds } },
    });
    const products = await prisma.product.findMany({
      where: { names: { some: { displayName: { startsWith: prefix } } } },
      select: { id: true },
    });
    await prisma.stockProjection.deleteMany({
      where: { productId: { in: products.map((p) => p.id) } },
    });
    await prisma.inventoryEvent.deleteMany({
      where: { productId: { in: products.map((p) => p.id) } },
    });
    await prisma.product.deleteMany({
      where: { id: { in: products.map((p) => p.id) } },
    });
    await module.close();
    await prisma.$disconnect();
  });

  it('sets mixed existing/new stock in input order with inferred canonical units', async () => {
    const known = applied(await service.apply(request([newItem()]), 'api'))
      .receipts[0];
    generate.mockClear();
    const unknown = newItem();
    const result = applied(
      await service.apply(
        request([{ productId: known.productId, quantity: 7 }, unknown]),
        'mcp',
      ),
    );
    expect(result.receipts.map((r) => r.inputIndex)).toEqual([0, 1]);
    expect(result.receipts[0].inventory.stock.recordedQuantity).toBe(7);
    expect(result.receipts[1]).toMatchObject({
      suppliedName: unknown.productName,
      catalogAction: 'created',
      inventory: {
        event: { eventType: 'STOCK_SET', source: 'mcp' },
        stock: { recordedQuantity: 2, unit: 'liter' },
      },
    });
    expect(generate).toHaveBeenCalledTimes(1);
  });

  it('purchases reset stock and replay without additional events or statistics', async () => {
    const known = applied(await service.apply(request([newItem()]), 'api'))
      .receipts[0];
    const input = request(
      [{ productId: known.productId, quantity: 5 }],
      'purchase',
    );
    const original = statistics.calculateProductStatistics.bind(
      statistics,
    ) as StatisticsService['calculateProductStatistics'];
    const stats = jest
      .spyOn(statistics, 'calculateProductStatistics')
      .mockImplementation(async (id) => {
        expect(
          await prisma.assistedActionReceipt.findUnique({
            where: { requestId: input.requestId },
          }),
        ).not.toBeNull();
        return original(id);
      });
    const first = applied(await service.apply(input, 'api'));
    expect(first.receipts[0].inventory).toMatchObject({
      event: { eventType: 'PURCHASED' },
      stock: { recordedQuantity: 5 },
    });
    expect(await service.apply(input, 'mcp')).toEqual(first);
    expect(stats).toHaveBeenCalledTimes(1);
    expect(
      await prisma.inventoryEvent.count({
        where: { productId: known.productId },
      }),
    ).toBe(2);
  });

  it('preserves historical purchase time without replacing newer recorded stock', async () => {
    const known = applied(await service.apply(request([newItem()]), 'api'))
      .receipts[0];
    const purchasedAt = new Date(Date.now() - 86400000).toISOString();
    const result = applied(
      await service.apply(
        request(
          [{ productId: known.productId, quantity: 9, purchasedAt }],
          'purchase',
        ),
        'api',
      ),
    );
    expect(result.receipts[0].inventory.event.timestamp).toBe(purchasedAt);
    expect(result.receipts[0].inventory.stock.recordedQuantity).toBe(2);
  });

  it('allows explicit set unit changes but rejects purchase unit conflicts atomically', async () => {
    const known = applied(await service.apply(request([newItem()]), 'api'))
      .receipts[0];
    const set = applied(
      await service.apply(
        request([{ productId: known.productId, quantity: 3, unit: 'bottle' }]),
        'api',
      ),
    );
    expect(set.receipts[0].inventory.stock.unit).toBe('bottle');
    const unknown = newItem();
    const input = request(
      [unknown, { productId: known.productId, quantity: 4, unit: 'liter' }],
      'purchase',
    );
    expect(await service.apply(input, 'api')).toMatchObject({
      outcome: 'needs_input',
      issues: [{ inputIndex: 1, code: 'metadata_conflict' }],
    });
    expect(
      await prisma.productName.count({
        where: { displayName: unknown.productName },
      }),
    ).toBe(0);
    expect(
      await prisma.inventoryEvent.count({
        where: { productId: known.productId },
      }),
    ).toBe(2);
  });

  it('consolidates missing units and rolls back catalog creation', async () => {
    jest
      .spyOn(module.get(ProductUnderstandingRunner), 'understand')
      .mockResolvedValue(
        initialUnderstanding({ ...metadata, typicalUnit: null }),
      );
    const items = [newItem(), newItem()].map((item) => ({
      ...item,
      metadata: { ...metadata, typicalUnit: null },
    }));
    const input = request(items);
    expect(await service.apply(input, 'api')).toMatchObject({
      outcome: 'needs_input',
      issues: [
        { inputIndex: 0, code: 'missing_unit' },
        { inputIndex: 1, code: 'missing_unit' },
      ],
    });
    expect(
      await prisma.productName.count({
        where: { displayName: { in: items.map((i) => i.productName) } },
      }),
    ).toBe(0);
    expect(
      await prisma.assistedActionReceipt.findUnique({
        where: { requestId: input.requestId },
      }),
    ).toBeNull();
  });

  it('rejects duplicate resolved products without stock writes', async () => {
    const a = newItem();
    const b = newItem();
    choices.set(b.productName, choices.get(a.productName)!);
    expect(await service.apply(request([a, b]), 'api')).toMatchObject({
      outcome: 'needs_input',
      issues: [
        { inputIndex: 0, code: 'duplicate_product' },
        { inputIndex: 1, code: 'duplicate_product' },
      ],
    });
    expect(
      await prisma.productName.count({ where: { displayName: a.productName } }),
    ).toBe(0);
  });

  it('rolls back catalog, events, projections and receipt after a later set fails', async () => {
    const items = [newItem(), newItem()];
    const input = request(items);
    const original = inventory.updateStockWithinTransaction.bind(
      inventory,
    ) as InventoryService['updateStockWithinTransaction'];
    const stats = jest.spyOn(statistics, 'calculateProductStatistics');
    let calls = 0;
    jest
      .spyOn(inventory, 'updateStockWithinTransaction')
      .mockImplementation((...args) => {
        if (++calls === 2) throw new Error('later stock failure');
        return original(...args);
      });
    await expect(service.apply(input, 'api')).rejects.toThrow(
      'later stock failure',
    );
    expect(
      await prisma.productName.count({
        where: { displayName: { in: items.map((i) => i.productName) } },
      }),
    ).toBe(0);
    expect(
      await prisma.assistedActionReceipt.findUnique({
        where: { requestId: input.requestId },
      }),
    ).toBeNull();
    expect(stats).not.toHaveBeenCalled();
  });

  it('commits one purchase for concurrent retries and recalculates only once', async () => {
    const known = applied(await service.apply(request([newItem()]), 'api'))
      .receipts[0];
    const stats = jest.spyOn(statistics, 'calculateProductStatistics');
    const input = request(
      [{ productId: known.productId, quantity: 4 }],
      'purchase',
    );
    const [a, b] = await Promise.all([
      service.apply(input, 'api'),
      service.apply(input, 'mcp'),
    ]);
    expect(applied(a)).toEqual(applied(b));
    expect(
      await prisma.inventoryEvent.count({
        where: { productId: known.productId },
      }),
    ).toBe(2);
    expect(stats).toHaveBeenCalledTimes(1);
  });

  it('keeps a committed action replayable when statistics fail', async () => {
    jest
      .spyOn(statistics, 'calculateProductStatistics')
      .mockRejectedValue(new Error('statistics unavailable'));
    const input = request([newItem()], 'purchase');
    const result = applied(await service.apply(input, 'api'));
    expect(await service.apply(input, 'api')).toEqual(result);
  });
});
