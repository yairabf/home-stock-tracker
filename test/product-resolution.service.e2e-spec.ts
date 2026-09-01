import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { Test, type TestingModule } from '@nestjs/testing';
import { GroceryItemSource } from '../src/generated/prisma/enums';
import { AppModule } from '../src/app.module';
import { LLM_PROVIDER, type LlmProvider } from '../src/llm/llm-provider';
import { PrismaService } from '../src/prisma/prisma.service';
import { ProductResolutionService } from '../src/product/product-resolution.service';
import { GroceryService } from '../src/grocery/grocery.service';
import { createProductFixture } from './product-fixture';

describe('ProductResolutionService (e2e)', () => {
  let module: TestingModule;
  let prisma: PrismaService;
  let provider: jest.Mocked<LlmProvider>;
  let service: ProductResolutionService;
  const prefix = `resolution-${randomUUID()}`;
  const productIds: string[] = [];

  beforeAll(async () => {
    provider = { name: 'fake', generateStructured: jest.fn() };
    module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(LLM_PROVIDER)
      .useValue(provider)
      .compile();
    await module.init();
    prisma = module.get(PrismaService);
    service = module.get(ProductResolutionService);
  });

  afterEach(async () => {
    await prisma.groceryListItem.deleteMany({
      where: { productId: { in: productIds } },
    });
    await prisma.product.deleteMany({ where: { id: { in: productIds } } });
    productIds.length = 0;
    provider.generateStructured.mockReset();
  });

  afterAll(async () => {
    await module.close();
  });

  it('bypasses the provider for a real exact alias match', async () => {
    const alias = `${prefix} Exact Alias`;
    const product = await createProduct({
      canonicalName: `${prefix} Exact Milk`,
      aliases: [alias],
    });

    const result = await service.resolve(alias);

    expect(result.exactMatch).toMatchObject({ id: product.id });
    expect(result.candidates).toEqual([]);
    expect(result.proposal).toBeNull();
    expect(provider.generateStructured.mock.calls).toHaveLength(0);
  });

  it('returns real deterministic candidates with validated optional advice', async () => {
    const query = `${prefix} candidate`;
    const first = await createProduct({ canonicalName: `${query} A` });
    const second = await createProduct({ canonicalName: `${query} B` });
    provider.generateStructured.mockResolvedValue({
      status: 'success',
      provider: 'fake',
      model: 'fake-model',
      value: {
        recommendation: 'ask_user_to_choose',
        candidateProductIds: [first.id, second.id],
        confidence: 0.8,
        reason: 'Both catalog products are plausible',
      },
    });
    const before = await domainCounts();

    const result = await service.resolve(query);

    expect(result.exactMatch).toBeNull();
    expect(result.candidates.map(({ id }) => id)).toEqual([
      first.id,
      second.id,
    ]);
    expect(result.proposal).toEqual({
      recommendation: 'ask_user_to_choose',
      candidateProductIds: [first.id, second.id],
      confidence: 0.8,
      reason: 'Both catalog products are plausible',
    });
    await expect(domainCounts()).resolves.toEqual(before);
  });

  it('does not change the existing grocery_add domain flow', async () => {
    const name = `${prefix} Grocery Compatibility`;
    const before = await domainCounts();
    const groceryService = module.get(GroceryService);

    const result = await groceryService.addItem({
      productName: name,
      source: GroceryItemSource.api,
    });
    const productId = result.createdItem?.productId;
    expect(productId).toBeDefined();
    if (!productId) {
      throw new Error('Expected grocery_add to create an item');
    }
    productIds.push(productId);

    expect(result).toMatchObject({
      outcome: 'created',
      createdItem: { productId, productName: name },
    });
    const after = await domainCounts();
    expect(after.products).toBe(before.products + 1);
    expect(after.names).toBe(before.names + 1);
    expect(after.groceries).toBe(before.groceries + 1);
  });

  async function createProduct(
    input: Parameters<typeof createProductFixture>[1],
  ) {
    const product = await createProductFixture(prisma, input);
    productIds.push(product.id);
    return product;
  }

  async function domainCounts() {
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
