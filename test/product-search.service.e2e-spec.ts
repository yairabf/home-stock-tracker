import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { Test, type TestingModule } from '@nestjs/testing';
import { PrismaModule } from '../src/prisma/prisma.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { ProductSearchService } from '../src/product/product-search.service';
import { createProductFixture } from './product-fixture';

interface FixtureProduct {
  id: string;
  canonicalName: string;
  aliases?: string[];
  predictionEnabled?: boolean;
}

describe('ProductSearchService (e2e)', () => {
  let module: TestingModule;
  let prisma: PrismaService;
  let service: ProductSearchService;
  const prefix = `search-${randomUUID()}`;
  const productIds: string[] = [];

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [PrismaModule],
      providers: [ProductSearchService],
    }).compile();
    await module.init();
    prisma = module.get(PrismaService);
    service = module.get(ProductSearchService);
  });

  afterEach(async () => {
    await prisma.product.deleteMany({ where: { id: { in: productIds } } });
    productIds.length = 0;
  });

  afterAll(async () => {
    await module.close();
  });

  it.each([
    ['canonical', (fixture: FixtureProduct) => fixture.canonicalName],
    ['alias', (fixture: FixtureProduct) => fixture.aliases?.[0] ?? ''],
  ])('short-circuits an exact %s namespace match', async (_label, queryFor) => {
    const fixture = await createFixture({
      canonicalName: `${prefix} Exact Milk`,
      aliases: [`${prefix} Exact Alias`],
    });

    const result = await service.search({ query: queryFor(fixture) });

    expect(result.exactMatch).toMatchObject({ id: fixture.id });
    expect(result.candidates).toEqual([]);
  });

  it('applies category and tie-breaker ordering with unique products', async () => {
    const query = `${prefix} rank`;
    const fixtures = await Promise.all([
      createFixture({ canonicalName: `${query} ctp` }),
      createFixture({
        canonicalName: `${prefix} unrelated alias-prefix`,
        aliases: [`${query} atp`],
      }),
      createFixture({ canonicalName: `x${query} cs` }),
      createFixture({
        canonicalName: `${prefix} unrelated alias-substring`,
        aliases: [`x${query} as`],
      }),
    ]);

    const result = await service.search({ query, limit: 20 });

    expect(result.candidates.map(({ id }) => id)).toEqual(
      fixtures.map(({ id }) => id),
    );
  });

  it('uses length then C collation within a rank', async () => {
    const lengthQuery = `${prefix} len`;
    const shorter = await createFixture({ canonicalName: `x${lengthQuery}` });
    const longer = await createFixture({ canonicalName: `xx${lengthQuery}` });

    const collationQuery = `${prefix} coll`;
    const digit = await createFixture({ canonicalName: `0${collationQuery}` });
    const letter = await createFixture({ canonicalName: `a${collationQuery}` });

    await expect(candidateIds(lengthQuery)).resolves.toEqual([
      shorter.id,
      longer.id,
    ]);
    await expect(candidateIds(collationQuery)).resolves.toEqual([
      digit.id,
      letter.id,
    ]);
  });

  it('requires contiguous multi-token prefixes', async () => {
    const product = await createFixture({
      canonicalName: `${prefix} organic whole milk`,
    });

    await expect(candidateIds(`${prefix} org wh`)).resolves.toEqual([
      product.id,
    ]);
    await expect(candidateIds(`${prefix} org mi`)).resolves.toEqual([]);
  });

  it.each(['%', '_', '\\'])(
    'treats %s as literal text in candidate search',
    async (literal) => {
      const matching = await createFixture({
        canonicalName: `${prefix} literal ${literal} milk`,
      });
      await createFixture({ canonicalName: `${prefix} literal plain milk` });

      await expect(candidateIds(literal)).resolves.toEqual([matching.id]);
    },
  );

  it('deduplicates by best name and limits before hydration', async () => {
    const query = `${prefix} bounded`;
    const first = await createFixture({
      canonicalName: `${query} first`,
      aliases: [`${query} first alias`, `${query} another alias`],
    });
    const second = await createFixture({ canonicalName: `${query} second` });

    await expect(candidateIds(query, 2)).resolves.toEqual([
      first.id,
      second.id,
    ]);
    await expect(candidateIds(query, 1)).resolves.toEqual([first.id]);
  });

  it('includes prediction-disabled products and does not mutate domain state', async () => {
    const query = `${prefix} readonly`;
    const disabled = await createFixture({
      canonicalName: `${query} milk`,
      predictionEnabled: false,
    });
    const before = await domainCounts();

    const result = await service.search({ query, limit: 10 });

    expect(result.candidates).toEqual([
      expect.objectContaining({ id: disabled.id, predictionEnabled: false }),
    ]);
    await expect(domainCounts()).resolves.toEqual(before);
  });

  async function createFixture(
    input: Omit<FixtureProduct, 'id'> & { id?: string },
  ) {
    const product = await createProductFixture(prisma, {
      id: input.id,
      canonicalName: input.canonicalName,
      aliases: input.aliases,
      predictionEnabled: input.predictionEnabled,
    });
    productIds.push(product.id);
    return { ...input, id: product.id };
  }

  async function candidateIds(query: string, limit = 20): Promise<string[]> {
    const result = await service.search({ query, limit });
    return result.candidates.map(({ id }) => id);
  }

  async function domainCounts() {
    const [products, names, groceries, events] = await Promise.all([
      prisma.product.count(),
      prisma.productName.count(),
      prisma.groceryListItem.count(),
      prisma.inventoryEvent.count(),
    ]);
    return { products, names, groceries, events };
  }
});
