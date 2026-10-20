import { ScheduleModule } from '@nestjs/schedule';
import { AssistedActionTransactions } from '../src/assisted-action/assisted-action-transactions.service';
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
import { AssistedGroceryService } from '../src/assisted-action/assisted-grocery.service';
import { GroceryService } from '../src/grocery/grocery.service';
import type { AssistedActionWireResult } from '../src/assisted-action/assisted-action-response.schema';

const connectionString = process.env.ASSISTED_CATALOG_TEST_DATABASE_URL;
if (!connectionString || !new URL(connectionString).pathname.endsWith('_test'))
  throw new Error(
    'Set ASSISTED_CATALOG_TEST_DATABASE_URL to a dedicated database ending in _test',
  );
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});
const prefix = `assisted-grocery-${randomUUID()}`;
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
  return { productName: `${canonical} brand`, metadata };
}
function request(items: object[]) {
  const requestId = randomUUID();
  receiptIds.push(requestId);
  return { requestId, operation: 'grocery_add', items };
}
function applied(result: AssistedActionWireResult) {
  if (result.outcome !== 'applied' || result.operation !== 'grocery_add')
    throw new Error(
      `Expected grocery success, received ${JSON.stringify(result)}`,
    );
  return result;
}

describe('Assisted grocery action (isolated PostgreSQL)', () => {
  let module: TestingModule;
  let service: AssistedGroceryService;
  let grocery: GroceryService;
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
    service = module.get(AssistedGroceryService);
    grocery = module.get(GroceryService);
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
    await prisma.groceryListItem.deleteMany({
      where: { productId: { in: products.map((p) => p.id) } },
    });
    await prisma.product.deleteMany({
      where: { id: { in: products.map((p) => p.id) } },
    });
    await module.close();
    await prisma.$disconnect();
  });

  it('completes mixed known/new items and returns ordered receipts in one service call', async () => {
    const known = applied(await service.apply(request([newItem()]), 'api'))
      .receipts[0];
    generate.mockClear();
    const unknown = newItem();
    const input = request([
      { productId: known.productId, quantity: 7 },
      { ...unknown, quantity: 2, unit: 'liter', note: 'requested note' },
    ]);
    const result = applied(await service.apply(input, 'mcp'));
    expect(result.receipts.map((r) => r.inputIndex)).toEqual([0, 1]);
    expect(result.receipts[0]).toMatchObject({
      itemAction: 'returned_existing',
      groceryItem: { requestedQuantity: 1 },
    });
    expect(result.receipts[1]).toMatchObject({
      itemAction: 'created',
      catalogAction: 'created',
      suppliedName: unknown.productName,
      groceryItem: {
        requestedQuantity: 2,
        unit: 'liter',
        note: 'requested note',
        source: 'mcp',
      },
    });
    expect(generate).toHaveBeenCalledTimes(1);
    const saved = await prisma.assistedActionReceipt.findUniqueOrThrow({
      where: { requestId: input.requestId },
    });
    expect(saved.response).toEqual(result);
  });

  it('returns the same receipt after a lost response without another AI call', async () => {
    const input = request([newItem(), newItem()]);
    const first = applied(await service.apply(input, 'mcp'));
    generate.mockClear();
    expect(await service.apply(input, 'api')).toEqual(first);
    expect(generate).not.toHaveBeenCalled();
    expect(
      await prisma.groceryListItem.count({
        where: { productId: { in: first.receipts.map((r) => r.productId) } },
      }),
    ).toBe(2);
  });

  it('replays persisted receipts from a newly constructed service instance', async () => {
    const input = request([newItem()]);
    const first = await service.apply(input, 'api');
    const restarted = new AssistedGroceryService(
      {
        prepare: () => {
          throw new Error('must replay');
        },
      } as never,
      new AssistedActionTransactions(prisma as never),
      {} as never,
      grocery,
    );
    expect(await restarted.apply(input, 'mcp')).toEqual(first);
  });

  it('rejects changed content under an existing request ID before inference', async () => {
    const item = newItem();
    const input = request([item]);
    await service.apply(input, 'api');
    generate.mockClear();
    await expect(
      service.apply({ ...input, items: [{ ...item, quantity: 3 }] }, 'api'),
    ).rejects.toMatchObject({ status: 409 });
    expect(generate).not.toHaveBeenCalled();
  });

  it('preserves pending quantities and honors explicit separate-line creation', async () => {
    const original = applied(
      await service.apply(request([{ ...newItem(), quantity: 5 }]), 'api'),
    ).receipts[0];
    const again = applied(
      await service.apply(
        request([{ productId: original.productId, quantity: 9 }]),
        'mcp',
      ),
    ).receipts[0];
    expect(again.groceryItem.id).toBe(original.groceryItem.id);
    expect(again.groceryItem.requestedQuantity).toBe(5);
    const separate = applied(
      await service.apply(
        request([
          {
            productId: original.productId,
            quantity: 3,
            ifPendingExists: 'create_separate',
          },
        ]),
        'mcp',
      ),
    ).receipts[0];
    expect(separate.groceryItem.id).not.toBe(original.groceryItem.id);
    expect(separate.groceryItem.requestedQuantity).toBe(3);
  });

  it('returns one consolidated ambiguity response without catalog or grocery writes', async () => {
    const a = newItem();
    const b = newItem();
    choices.set(b.productName, null);
    const input = request([a, b]);
    expect(await service.apply(input, 'api')).toMatchObject({
      outcome: 'needs_input',
      issues: [{ inputIndex: 1, code: 'ambiguous_product' }],
    });
    expect(
      await prisma.productName.count({
        where: { normalizedName: { in: [a.productName, b.productName] } },
      }),
    ).toBe(0);
    expect(
      await prisma.assistedActionReceipt.findUnique({
        where: { requestId: input.requestId },
      }),
    ).toBeNull();
  });

  it('rejects two phrases resolving to one product before writing', async () => {
    const a = newItem();
    const b = newItem();
    choices.set(b.productName, choices.get(a.productName)!);
    const input = request([a, b]);
    expect(await service.apply(input, 'api')).toMatchObject({
      outcome: 'needs_input',
      issues: [
        { inputIndex: 0, code: 'duplicate_product' },
        { inputIndex: 1, code: 'duplicate_product' },
      ],
    });
    expect(
      await prisma.productName.count({
        where: { normalizedName: choices.get(a.productName)! },
      }),
    ).toBe(0);
  });

  it('rolls back every new catalog row and grocery line on a later item failure', async () => {
    const a = newItem();
    const b = newItem();
    const input = request([a, b]);
    const original = grocery.addAssistedWithinTransaction.bind(
      grocery,
    ) as GroceryService['addAssistedWithinTransaction'];
    let calls = 0;
    jest
      .spyOn(grocery, 'addAssistedWithinTransaction')
      .mockImplementation((...args) => {
        if (++calls === 2) throw new Error('second item failed');
        return original(...args);
      });
    await expect(service.apply(input, 'api')).rejects.toThrow(
      'second item failed',
    );
    expect(
      await prisma.productName.count({
        where: {
          normalizedName: {
            in: [
              a.productName,
              b.productName,
              choices.get(a.productName)!,
              choices.get(b.productName)!,
            ],
          },
        },
      }),
    ).toBe(0);
    expect(
      await prisma.assistedActionReceipt.findUnique({
        where: { requestId: input.requestId },
      }),
    ).toBeNull();
  });

  it('commits only one separate grocery line for concurrent retries of one request', async () => {
    const product = applied(await service.apply(request([newItem()]), 'api'))
      .receipts[0];
    const input = request([
      {
        productId: product.productId,
        ifPendingExists: 'create_separate',
        quantity: 2,
      },
    ]);
    const [a, b] = await Promise.all([
      service.apply(input, 'api'),
      service.apply(input, 'mcp'),
    ]);
    expect(a).toEqual(b);
    expect(
      await prisma.groceryListItem.count({
        where: { productId: product.productId },
      }),
    ).toBe(2);
  });

  it('converges concurrent distinct requests for the same new product to one pending line', async () => {
    const item = newItem();
    const [a, b] = await Promise.all([
      service.apply(request([item]), 'api'),
      service.apply(request([item]), 'mcp'),
    ]);
    const first = applied(a).receipts[0];
    const second = applied(b).receipts[0];
    expect(first.productId).toBe(second.productId);
    expect(first.groceryItem.id).toBe(second.groceryItem.id);
    expect(
      await prisma.groceryListItem.count({
        where: { productId: first.productId },
      }),
    ).toBe(1);
  });

  it('allows the same unchanged request ID after a retryable preparation failure', async () => {
    const input = request([newItem()]);
    generate.mockResolvedValueOnce({ status: 'unavailable' });
    expect(await service.apply(input, 'api')).toMatchObject({
      outcome: 'unavailable',
    });
    expect(
      await prisma.assistedActionReceipt.findUnique({
        where: { requestId: input.requestId },
      }),
    ).toBeNull();
    expect(applied(await service.apply(input, 'api')).receipts).toHaveLength(1);
  });
});
