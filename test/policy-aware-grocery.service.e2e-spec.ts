import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { Test, type TestingModule } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { GroceryItemSource, ProductType } from '../src/generated/prisma/enums';
import { GroceryService } from '../src/grocery/grocery.service';
import {
  PendingGroceryItemPolicy,
  UnknownProductPolicy,
  type CreateIfMissingGroceryAddition,
} from '../src/grocery/types/policy-aware-grocery-addition';
import { LLM_PROVIDER, type LlmProvider } from '../src/llm/llm-provider';
import { PrismaService } from '../src/prisma/prisma.service';
import { normalizeProductName } from '../src/product/product-name.util';

describe('Policy-aware deterministic grocery addition (e2e)', () => {
  let module: TestingModule;
  let prisma: PrismaService;
  let service: GroceryService;
  let provider: jest.Mocked<LlmProvider>;
  const prefix = `policy-add-${randomUUID()}`;

  beforeAll(async () => {
    provider = { name: 'fake', generateStructured: jest.fn() };
    module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(LLM_PROVIDER)
      .useValue(provider)
      .compile();
    await module.init();
    prisma = module.get(PrismaService);
    service = module.get(GroceryService);
  });

  afterEach(async () => {
    const products = await prisma.product.findMany({
      where: {
        names: {
          some: {
            normalizedName: { startsWith: normalizeProductName(prefix) },
          },
        },
      },
      select: { id: true },
    });
    const productIds = products.map(({ id }) => id);
    await prisma.groceryListItem.deleteMany({
      where: { productId: { in: productIds } },
    });
    await prisma.product.deleteMany({ where: { id: { in: productIds } } });
    provider.generateStructured.mockReset();
  });

  afterAll(async () => {
    await module.close();
  });

  it('atomically creates one product and one pending line', async () => {
    const canonicalName = `${prefix} atomic`;

    await expect(
      service.addPolicyAwareItem(request(canonicalName)),
    ).resolves.toMatchObject({
      outcome: 'created',
      createdItem: { productName: canonicalName, requestedQuantity: 1 },
    });

    await expect(domainCounts(canonicalName)).resolves.toEqual({
      products: 1,
      names: 1,
      groceries: 1,
    });
    expect(provider.generateStructured.mock.calls).toHaveLength(0);
  });

  it('rolls product creation back when grocery persistence fails', async () => {
    const canonicalName = `${prefix} rollback`;
    const invalid = {
      ...request(canonicalName),
      source: 'invalid_source',
    } as unknown as CreateIfMissingGroceryAddition;

    await expect(service.addPolicyAwareItem(invalid)).rejects.toBeDefined();
    await expect(domainCounts(canonicalName)).resolves.toEqual({
      products: 0,
      names: 0,
      groceries: 0,
    });
  });

  it('converges concurrent creation on one product and pending line', async () => {
    const canonicalName = `${prefix} concurrent`;

    const results = await Promise.all([
      service.addPolicyAwareItem(request(canonicalName)),
      service.addPolicyAwareItem(request(canonicalName)),
    ]);

    expect(results.map(({ outcome }) => outcome).sort()).toEqual([
      'confirmation_required',
      'created',
    ]);
    await expect(domainCounts(canonicalName)).resolves.toEqual({
      products: 1,
      names: 1,
      groceries: 1,
    });
    expect(provider.generateStructured.mock.calls).toHaveLength(0);
  });

  it('returns an unresolved proposal outcome without domain mutation', async () => {
    const productName = `${prefix} unresolved`;
    provider.generateStructured.mockResolvedValue({ status: 'unavailable' });
    const before = await allDomainCounts();

    await expect(
      service.addPolicyAwareItem(proposalRequest(productName)),
    ).resolves.toMatchObject({
      outcome: 'product_resolution_required',
      requestedAddition: { productName, requestedQuantity: null },
      candidates: [],
      proposal: null,
      allowedActions: ['create_product', 'cancel'],
    });

    await expect(allDomainCounts()).resolves.toEqual(before);
    expect(provider.generateStructured.mock.calls).toHaveLength(1);
  });

  it('adds an exact proposal-mode identity without invoking the provider', async () => {
    const canonicalName = `${prefix} exact`;
    const created = await service.addPolicyAwareItem(request(canonicalName));
    if (created.outcome !== 'created') {
      throw new Error('Expected deterministic setup to create a line');
    }
    await prisma.groceryListItem.delete({
      where: { id: created.createdItem.id },
    });
    provider.generateStructured.mockClear();

    await expect(
      service.addPolicyAwareItem(proposalRequest(canonicalName)),
    ).resolves.toMatchObject({
      outcome: 'created',
      createdItem: { productName: canonicalName },
    });
    expect(provider.generateStructured.mock.calls).toHaveLength(0);
  });

  function request(canonicalName: string): CreateIfMissingGroceryAddition {
    return {
      unknownProductPolicy: UnknownProductPolicy.create_if_missing,
      product: {
        canonicalName,
        aliases: [],
        category: 'test',
        typicalUnit: null,
        productType: ProductType.fast_consumable,
        isPerishable: false,
      },
      groceryItem: {
        ifPendingExists: PendingGroceryItemPolicy.return_existing,
      },
      source: GroceryItemSource.api,
    };
  }

  function proposalRequest(productName: string) {
    return {
      unknownProductPolicy: UnknownProductPolicy.propose_if_missing as const,
      productName,
      groceryItem: {
        ifPendingExists: PendingGroceryItemPolicy.return_existing,
      },
      source: GroceryItemSource.mcp,
    };
  }

  async function domainCounts(canonicalName: string) {
    const normalizedName = normalizeProductName(canonicalName);
    const [products, names, groceries] = await Promise.all([
      prisma.product.count({
        where: { names: { some: { normalizedName } } },
      }),
      prisma.productName.count({ where: { normalizedName } }),
      prisma.groceryListItem.count({
        where: { product: { names: { some: { normalizedName } } } },
      }),
    ]);
    return { products, names, groceries };
  }

  async function allDomainCounts() {
    const [products, names, groceries, events, predictions, households] =
      await Promise.all([
        prisma.product.count(),
        prisma.productName.count(),
        prisma.groceryListItem.count(),
        prisma.inventoryEvent.count(),
        prisma.prediction.count(),
        prisma.household.count(),
      ]);
    return { products, names, groceries, events, predictions, households };
  }
});
