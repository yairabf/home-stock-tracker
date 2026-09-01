import { ZodError } from 'zod';
import { Prisma } from '../generated/prisma/client';
import { ProductNameKind, ProductType } from '../generated/prisma/enums';
import type { PrismaService } from '../prisma/prisma.service';
import { ProductSearchService } from './product-search.service';
import type { ProductWithNames } from './types/product-with-names';

describe('ProductSearchService', () => {
  let findUniqueName: jest.Mock;
  let queryRaw: jest.Mock;
  let findManyProducts: jest.Mock;
  let service: ProductSearchService;

  beforeEach(() => {
    findUniqueName = jest.fn().mockResolvedValue(null);
    queryRaw = jest.fn().mockResolvedValue([]);
    findManyProducts = jest.fn().mockResolvedValue([]);
    const transactionClient = {
      productName: { findUnique: findUniqueName },
      product: { findMany: findManyProducts },
      $queryRaw: queryRaw,
    };
    const prisma = {
      $transaction: jest
        .fn()
        .mockImplementation(
          async <T>(
            operation: (tx: typeof transactionClient) => Promise<T>,
            options: { isolationLevel: Prisma.TransactionIsolationLevel },
          ): Promise<T> => {
            expect(options).toEqual({
              isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
            });
            return operation(transactionClient);
          },
        ),
    } as unknown as PrismaService;
    service = new ProductSearchService(prisma);
  });

  it.each([ProductNameKind.canonical, ProductNameKind.alias])(
    'returns an exact %s owner without candidate search or hydration',
    async (kind) => {
      const product = productWithNames('exact-product', false);
      findUniqueName.mockResolvedValue({
        id: 'name-id',
        productId: product.id,
        displayName: 'Milk',
        normalizedName: 'milk',
        kind,
        product,
      });

      const result = await service.search({ query: '  MILK  ', limit: 10 });

      expect(result.exactMatch).toMatchObject({
        id: product.id,
        predictionEnabled: false,
      });
      expect(result.candidates).toEqual([]);
      expect(findUniqueName).toHaveBeenCalledWith(
        expect.objectContaining({ where: { normalizedName: 'milk' } }),
      );
      expect(queryRaw).not.toHaveBeenCalled();
      expect(findManyProducts).not.toHaveBeenCalled();
    },
  );

  it('returns an empty response without hydration when no candidate matches', async () => {
    await expect(
      service.search({ query: 'unknown', limit: 10 }),
    ).resolves.toEqual({
      exactMatch: null,
      candidates: [],
    });
    expect(queryRaw).toHaveBeenCalledTimes(1);
    expect(findManyProducts).not.toHaveBeenCalled();
  });

  it('hydrates only ranked IDs and preserves the database product-ID tie-breaker', async () => {
    queryRaw.mockResolvedValue([
      { productId: 'product-a' },
      { productId: 'product-b' },
    ]);
    findManyProducts.mockResolvedValue([
      productWithNames('product-b', false),
      productWithNames('product-a'),
    ]);

    const result = await service.search({ query: 'mil', limit: 2 });

    expect(findManyProducts).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: ['product-a', 'product-b'] } },
      }),
    );
    expect(result.candidates.map(({ id }) => id)).toEqual([
      'product-a',
      'product-b',
    ]);
    expect(result.candidates[1].predictionEnabled).toBe(false);
  });

  it('omits a candidate deleted between ranking and hydration', async () => {
    queryRaw.mockResolvedValue([
      { productId: 'deleted-product' },
      { productId: 'product-a' },
    ]);
    findManyProducts.mockResolvedValue([productWithNames('product-a')]);

    await expect(service.search({ query: 'mil', limit: 2 })).resolves.toEqual({
      exactMatch: null,
      candidates: [expect.objectContaining({ id: 'product-a' })],
    });
  });

  it('normalizes input and uses the default limit in parameterized SQL', async () => {
    await service.search({ query: '  MIL  ' });

    expect(findUniqueName).toHaveBeenCalledWith(
      expect.objectContaining({ where: { normalizedName: 'mil' } }),
    );
    expect(queryRaw).toHaveBeenCalledTimes(1);
    const calls = queryRaw.mock.calls as unknown as Array<
      [
        {
          values: unknown[];
          strings: string[];
        },
      ]
    >;
    const query = calls[0][0];
    expect(query.values).toEqual(['mil', 'mil', 10]);
    expect(query.strings.join('')).toContain('LIMIT ');
  });

  it.each([
    { query: '   ', limit: 10 },
    { query: 'milk', limit: 21 },
  ])('rejects invalid input before querying: %j', async (input) => {
    await expect(service.search(input)).rejects.toBeInstanceOf(ZodError);
    expect(findUniqueName).not.toHaveBeenCalled();
    expect(queryRaw).not.toHaveBeenCalled();
    expect(findManyProducts).not.toHaveBeenCalled();
  });
});

function productWithNames(
  id: string,
  predictionEnabled = true,
): ProductWithNames {
  return {
    id,
    category: 'dairy',
    typicalUnit: 'carton',
    productType: ProductType.fast_consumable,
    isPerishable: true,
    predictionStrategy: null,
    predictionEnabled,
    config: null,
    names: [
      {
        id: `${id}-canonical`,
        productId: id,
        displayName: `${id} Milk`,
        normalizedName: `${id} milk`,
        kind: ProductNameKind.canonical,
      },
    ],
  };
}
