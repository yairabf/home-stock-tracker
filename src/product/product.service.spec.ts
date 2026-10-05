import { Prisma } from '../generated/prisma/client';
import { ProductNameKind, ProductType } from '../generated/prisma/enums';
import type { OperationalLogger } from '../observability/operational-logger.service';
import type { PrismaService } from '../prisma/prisma.service';
import {
  PRODUCT_NAME_CONFLICT,
  PRODUCT_NOT_FOUND,
} from './product-name.exception';
import type { ProductUnderstandingLogService } from './product-understanding-log.service';
import type { ProductUnderstandingRunner } from './product-understanding-runner.service';
import { ProductService } from './product.service';
import {
  initialUnderstanding,
  type ProductUnderstandingResult,
} from './product-understanding';
import type { ProductWithNames } from './types/product-with-names';

describe('ProductService', () => {
  let service: ProductService;
  let understandingRunner: jest.Mocked<
    Pick<ProductUnderstandingRunner, 'understand'>
  >;
  let understandingLog: jest.Mocked<
    Pick<ProductUnderstandingLogService, 'record'>
  >;
  let outerProductFindMany: jest.Mock;
  let outerFindUnique: jest.Mock;
  let outerNameFindUnique: jest.Mock;
  let outerNameFindMany: jest.Mock;
  let transactionProductFindMany: jest.Mock;
  let transactionFindUnique: jest.Mock;
  let transactionNameFindUnique: jest.Mock;
  let transactionNameFindMany: jest.Mock;
  let createProduct: jest.Mock;
  let updateProduct: jest.Mock;
  let createName: jest.Mock;
  let transaction: jest.Mock;
  let operationalLogger: jest.Mocked<
    Pick<OperationalLogger, 'catalogIntegrity'>
  >;

  const successfulUnderstanding: ProductUnderstandingResult = {
    fields: {
      category: {
        status: 'resolved',
        source: 'jev',
        value: 'dairy',
        confidence: 0.95,
      },
      typicalUnit: {
        status: 'resolved',
        source: 'jev',
        value: 'liter',
        confidence: 0.95,
      },
      productType: {
        status: 'resolved',
        source: 'jev',
        value: ProductType.fast_consumable,
        confidence: 0.95,
      },
      isPerishable: {
        status: 'resolved',
        source: 'jev',
        value: true,
        confidence: 0.95,
      },
    },
    attempts: [],
  };
  const emptyMetadata = {
    category: null,
    typicalUnit: null,
    productType: null,
    isPerishable: null,
  };

  beforeEach(() => {
    outerProductFindMany = jest.fn().mockResolvedValue([]);
    outerFindUnique = jest.fn();
    outerNameFindUnique = jest.fn().mockResolvedValue(null);
    outerNameFindMany = jest.fn().mockResolvedValue([]);
    transactionProductFindMany = jest.fn().mockResolvedValue([]);
    transactionFindUnique = jest.fn();
    transactionNameFindUnique = jest.fn().mockResolvedValue(null);
    transactionNameFindMany = jest.fn().mockResolvedValue([]);
    createProduct = jest.fn().mockResolvedValue(product());
    updateProduct = jest.fn().mockResolvedValue(product());
    createName = jest.fn().mockResolvedValue({});

    const transactionClient = {
      product: {
        findMany: transactionProductFindMany,
        findUnique: transactionFindUnique,
        create: createProduct,
        update: updateProduct,
      },
      productName: {
        findUnique: transactionNameFindUnique,
        findMany: transactionNameFindMany,
        create: createName,
      },
    };
    transaction = jest
      .fn()
      .mockImplementation(
        async <T>(operation: (tx: unknown) => Promise<T>): Promise<T> =>
          operation(transactionClient),
      );
    const prisma = {
      product: { findMany: outerProductFindMany, findUnique: outerFindUnique },
      productName: {
        findUnique: outerNameFindUnique,
        findMany: outerNameFindMany,
      },
      $transaction: transaction,
    } as unknown as PrismaService;
    understandingRunner = { understand: jest.fn() };
    understandingLog = { record: jest.fn().mockResolvedValue(null) };
    operationalLogger = { catalogIntegrity: jest.fn() };
    service = new ProductService(
      prisma,
      understandingRunner as unknown as ProductUnderstandingRunner,
      understandingLog as unknown as ProductUnderstandingLogService,
      operationalLogger as unknown as OperationalLogger,
    );
  });

  describe('namespace writes', () => {
    it('creates a complete explicit product within the caller transaction', async () => {
      const transactionClient = {
        product: { create: createProduct },
        productName: {
          findMany: transactionNameFindMany,
          findUnique: transactionNameFindUnique,
        },
      } as unknown as Prisma.TransactionClient;

      await service.findOrCreateExplicitWithinTransaction(transactionClient, {
        canonicalName: '  Three Percent Milk ',
        aliases: ['Three Percent'],
        category: 'dairy',
        typicalUnit: 'carton',
        productType: ProductType.fast_consumable,
        isPerishable: true,
      });

      expect(createProduct).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            category: 'dairy',
            typicalUnit: 'carton',
            productType: ProductType.fast_consumable,
            isPerishable: true,
            names: {
              create: [
                expect.objectContaining({
                  displayName: 'Three Percent Milk',
                  normalizedName: 'three percent milk',
                  kind: ProductNameKind.canonical,
                }),
                expect.objectContaining({
                  displayName: 'Three Percent',
                  normalizedName: 'three percent',
                  kind: ProductNameKind.alias,
                }),
              ],
            },
          },
        }),
      );
      expect(understandingRunner.understand).not.toHaveBeenCalled();
      expect(understandingLog.record).not.toHaveBeenCalled();
    });

    it('reuses an exact explicit identity without applying creation metadata', async () => {
      const existing = product({ canonicalName: 'Milk' });
      transactionNameFindMany.mockResolvedValue([{ productId: existing.id }]);
      transactionNameFindUnique.mockResolvedValue({ product: existing });
      const transactionClient = {
        product: { create: createProduct },
        productName: {
          findMany: transactionNameFindMany,
          findUnique: transactionNameFindUnique,
        },
      } as unknown as Prisma.TransactionClient;

      await expect(
        service.findOrCreateExplicitWithinTransaction(transactionClient, {
          canonicalName: ' milk ',
          aliases: ['conflicting metadata'],
          category: 'changed',
          typicalUnit: null,
          productType: ProductType.pantry_staple,
          isPerishable: false,
        }),
      ).resolves.toBe(existing);
      expect(createProduct).not.toHaveBeenCalled();
      expect(understandingRunner.understand).not.toHaveBeenCalled();
    });

    it('reuses a confirmed identity only when every supplied name is compatible', async () => {
      const existing = product({ canonicalName: 'Milk' });
      transactionNameFindMany
        .mockResolvedValueOnce([{ productId: existing.id }])
        .mockResolvedValueOnce([
          { normalizedName: 'milk', productId: existing.id },
        ]);
      transactionNameFindUnique.mockResolvedValue({ product: existing });
      const transactionClient = {
        product: { create: createProduct },
        productName: {
          findMany: transactionNameFindMany,
          findUnique: transactionNameFindUnique,
        },
      } as unknown as Prisma.TransactionClient;

      await expect(
        service.confirmExplicitWithinTransaction(transactionClient, {
          canonicalName: 'milk',
          aliases: ['Whole Milk'],
          category: 'dairy',
          typicalUnit: 'carton',
          productType: ProductType.fast_consumable,
          isPerishable: true,
        }),
      ).resolves.toBe(existing);
      expect(createProduct).not.toHaveBeenCalled();
      expect(understandingRunner.understand).not.toHaveBeenCalled();
      expect(transactionNameFindMany).toHaveBeenLastCalledWith({
        where: { normalizedName: { in: ['milk', 'whole milk'] } },
        select: { normalizedName: true, productId: true },
      });
    });

    it('rejects a confirmed alias owned by another product', async () => {
      const existing = product({ canonicalName: 'Milk' });
      transactionNameFindMany
        .mockResolvedValueOnce([{ productId: existing.id }])
        .mockResolvedValueOnce([
          { normalizedName: 'milk', productId: existing.id },
          { normalizedName: 'other product', productId: 'product-2' },
        ]);
      transactionNameFindUnique.mockResolvedValue({ product: existing });
      const transactionClient = {
        product: { create: createProduct },
        productName: {
          findMany: transactionNameFindMany,
          findUnique: transactionNameFindUnique,
        },
      } as unknown as Prisma.TransactionClient;

      await expect(
        service.confirmExplicitWithinTransaction(transactionClient, {
          canonicalName: 'milk',
          aliases: ['Other Product'],
          category: 'dairy',
          typicalUnit: 'carton',
          productType: ProductType.fast_consumable,
          isPerishable: true,
        }),
      ).rejects.toMatchObject({
        response: { code: PRODUCT_NAME_CONFLICT },
      });
      expect(createProduct).not.toHaveBeenCalled();
    });

    it('adds a confirmed alias within the caller transaction', async () => {
      const existing = product({ canonicalName: 'Milk' });
      transactionFindUnique
        .mockResolvedValueOnce(existing)
        .mockResolvedValueOnce(existing);
      const transactionClient = {
        product: { findUnique: transactionFindUnique },
        productName: {
          findMany: transactionNameFindMany,
          create: createName,
        },
      } as unknown as Prisma.TransactionClient;

      await expect(
        service.confirmAliasWithinTransaction(
          transactionClient,
          existing.id,
          '  Whole Milk  ',
        ),
      ).resolves.toBe(existing);
      expect(createName).toHaveBeenCalledWith({
        data: {
          productId: existing.id,
          displayName: 'Whole Milk',
          normalizedName: 'whole milk',
          kind: ProductNameKind.alias,
        },
      });
    });

    it('treats an alias already owned by the target as idempotent', async () => {
      const existing = product({ canonicalName: 'Milk' });
      transactionFindUnique.mockResolvedValue(existing);
      transactionNameFindMany.mockResolvedValue([{ productId: existing.id }]);
      const transactionClient = {
        product: { findUnique: transactionFindUnique },
        productName: {
          findMany: transactionNameFindMany,
          create: createName,
        },
      } as unknown as Prisma.TransactionClient;

      await expect(
        service.confirmAliasWithinTransaction(
          transactionClient,
          existing.id,
          'Whole Milk',
        ),
      ).resolves.toBe(existing);
      expect(createName).not.toHaveBeenCalled();
    });

    it('rejects a confirmed alias owned by another target', async () => {
      const existing = product({ canonicalName: 'Milk' });
      transactionFindUnique.mockResolvedValue(existing);
      transactionNameFindMany.mockResolvedValue([
        { productId: 'other-product' },
      ]);
      const transactionClient = {
        product: { findUnique: transactionFindUnique },
        productName: {
          findMany: transactionNameFindMany,
          create: createName,
        },
      } as unknown as Prisma.TransactionClient;

      await expect(
        service.confirmAliasWithinTransaction(
          transactionClient,
          existing.id,
          'Other Product',
        ),
      ).rejects.toMatchObject({
        response: { code: PRODUCT_NAME_CONFLICT },
      });
      expect(createName).not.toHaveBeenCalled();
    });

    it('returns a stable error when the alias target was deleted', async () => {
      transactionFindUnique.mockResolvedValue(null);
      const transactionClient = {
        product: { findUnique: transactionFindUnique },
      } as unknown as Prisma.TransactionClient;

      await expect(
        service.confirmAliasWithinTransaction(
          transactionClient,
          'missing-product',
          'Milk',
        ),
      ).rejects.toMatchObject({ response: { code: PRODUCT_NOT_FOUND } });
    });

    it('translates an explicit namespace race into the stable conflict', async () => {
      createProduct.mockRejectedValue(prismaError('P2002'));
      const transactionClient = {
        product: { create: createProduct },
        productName: {
          findMany: transactionNameFindMany,
          findUnique: transactionNameFindUnique,
        },
      } as unknown as Prisma.TransactionClient;

      await expect(
        service.findOrCreateExplicitWithinTransaction(transactionClient, {
          canonicalName: 'Milk',
          aliases: [],
          category: 'dairy',
          typicalUnit: null,
          productType: ProductType.fast_consumable,
          isPerishable: true,
        }),
      ).rejects.toMatchObject({
        response: { code: PRODUCT_NAME_CONFLICT },
      });
    });

    it('creates one canonical row and deduplicated aliases atomically', async () => {
      await service.create({
        canonicalName: '  Three\tPercent Milk ',
        aliases: ['three percent milk', ' Full Fat Milk ', 'ＦＵＬＬ FAT MILK'],
        category: 'dairy',
        typicalUnit: 'carton',
      });

      expect(createProduct).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            category: 'dairy',
            typicalUnit: 'carton',
            names: {
              create: [
                {
                  displayName: 'Three Percent Milk',
                  normalizedName: 'three percent milk',
                  kind: ProductNameKind.canonical,
                },
                {
                  displayName: 'Full Fat Milk',
                  normalizedName: 'full fat milk',
                  kind: ProductNameKind.alias,
                },
              ],
            },
          },
        }),
      );
      expect(transaction).toHaveBeenCalledWith(expect.any(Function), {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    });

    it('translates a name uniqueness failure into the stable conflict', async () => {
      createProduct.mockRejectedValue(prismaError('P2002'));

      await expect(
        service.create({ canonicalName: 'Milk' }),
      ).rejects.toMatchObject({
        status: 409,
        response: {
          code: PRODUCT_NAME_CONFLICT,
          message: 'A product name is already assigned to another product',
        },
      });
    });

    it.each([
      ['canonical name', ProductNameKind.canonical],
      ['existing alias', ProductNameKind.alias],
    ])(
      'returns the target without mutation when the alias is its %s',
      async (_label, kind) => {
        const existing = product({ id: 'target-id', canonicalName: 'Milk' });
        transactionFindUnique.mockResolvedValue(existing);
        transactionNameFindMany.mockResolvedValue([
          {
            productId: 'target-id',
            normalizedName: 'milk',
            kind,
          },
        ]);

        await expect(
          service.addAlias('target-id', { alias: ' MILK ' }),
        ).resolves.toBe(existing);
        expect(createName).not.toHaveBeenCalled();
        expect(updateProduct).not.toHaveBeenCalled();
      },
    );

    it('inserts a namespace alias and reloads the product', async () => {
      const existing = product({ id: 'target-id', canonicalName: 'Milk' });
      const updated = product({
        id: 'target-id',
        canonicalName: 'Milk',
        aliases: ['Whole Milk'],
      });
      transactionFindUnique
        .mockResolvedValueOnce(existing)
        .mockResolvedValueOnce(updated);

      await expect(
        service.addAlias('target-id', { alias: '  Whole\tMilk ' }),
      ).resolves.toBe(updated);
      expect(createName).toHaveBeenCalledWith({
        data: {
          productId: 'target-id',
          displayName: 'Whole Milk',
          normalizedName: 'whole milk',
          kind: ProductNameKind.alias,
        },
      });
      expect(transactionFindUnique).toHaveBeenLastCalledWith(
        expect.objectContaining({ where: { id: 'target-id' } }),
      );
      expect(updateProduct).not.toHaveBeenCalled();
    });

    it('rejects an alias owned by another product without mutation', async () => {
      transactionFindUnique.mockResolvedValue(product({ id: 'target-id' }));
      transactionNameFindMany.mockResolvedValue([
        {
          productId: 'other-id',
          normalizedName: 'whole milk',
        },
      ]);

      await expect(
        service.addAlias('target-id', { alias: 'Whole Milk' }),
      ).rejects.toMatchObject({
        response: { code: PRODUCT_NAME_CONFLICT },
      });
      expect(createName).not.toHaveBeenCalled();
      expect(updateProduct).not.toHaveBeenCalled();
    });

    it('resolves a same-owner alias race idempotently', async () => {
      const existing = product({ id: 'target-id' });
      transactionFindUnique.mockResolvedValue(existing);
      createName.mockRejectedValue(prismaError('P2002'));
      outerNameFindMany.mockResolvedValue([{ productId: 'target-id' }]);
      outerFindUnique.mockResolvedValue(existing);

      await expect(
        service.addAlias('target-id', { alias: 'Whole Milk' }),
      ).resolves.toBe(existing);
      expect(updateProduct).not.toHaveBeenCalled();
    });

    it('translates a cross-owner alias race into the stable conflict', async () => {
      transactionFindUnique.mockResolvedValue(product({ id: 'target-id' }));
      createName.mockRejectedValue(prismaError('P2002'));
      outerNameFindMany.mockResolvedValue([{ productId: 'other-id' }]);

      await expect(
        service.addAlias('target-id', { alias: 'Whole Milk' }),
      ).rejects.toMatchObject({
        response: { code: PRODUCT_NAME_CONFLICT },
      });
      expect(updateProduct).not.toHaveBeenCalled();
    });
  });

  describe('LLM-assisted resolution', () => {
    it('returns an exact match without calling the classifier', async () => {
      const existing = product({ canonicalName: 'milk' });
      outerNameFindMany.mockResolvedValue([{ productId: existing.id }]);
      outerNameFindUnique.mockResolvedValue({ product: existing });

      await expect(
        service.findOrCreateByExactOrAliasMatch(' Milk '),
      ).resolves.toBe(existing);
      expect(outerNameFindMany).toHaveBeenCalledWith({
        where: { normalizedName: 'milk' },
        select: { productId: true },
      });
      expect(outerNameFindUnique).toHaveBeenCalledWith({
        where: { normalizedName: 'milk' },
        include: {
          product: {
            include: {
              names: {
                orderBy: [
                  { kind: 'asc' },
                  { normalizedName: 'asc' },
                  { id: 'asc' },
                ],
              },
            },
          },
        },
      });
      expect(outerProductFindMany).not.toHaveBeenCalled();
      expect(understandingRunner.understand).not.toHaveBeenCalled();
      expect(understandingLog.record).not.toHaveBeenCalled();
      expect(createProduct).not.toHaveBeenCalled();
    });

    it.each([
      ['canonical name', product({ canonicalName: 'milk' }), ' Milk '],
      [
        'alias',
        product({ canonicalName: 'milk', aliases: ['whole milk'] }),
        ' WHOLE MILK ',
      ],
    ])(
      'finds a product by exact normalized %s without side effects',
      async (_label, existing, rawName) => {
        outerNameFindMany.mockResolvedValue([{ productId: existing.id }]);
        outerNameFindUnique.mockResolvedValue({ product: existing });

        await expect(service.findByExactOrAliasName(rawName)).resolves.toBe(
          existing,
        );
        expect(understandingRunner.understand).not.toHaveBeenCalled();
        expect(understandingLog.record).not.toHaveBeenCalled();
        expect(createProduct).not.toHaveBeenCalled();
        expect(updateProduct).not.toHaveBeenCalled();
      },
    );

    it('rejects a blank product name without querying or mutating', async () => {
      await expect(service.findByExactOrAliasName('   ')).rejects.toThrow(
        'productName must not be blank',
      );
      expect(outerNameFindMany).not.toHaveBeenCalled();
      expect(outerProductFindMany).not.toHaveBeenCalled();
      expect(understandingRunner.understand).not.toHaveBeenCalled();
      expect(createProduct).not.toHaveBeenCalled();
      expect(updateProduct).not.toHaveBeenCalled();
    });

    it('returns a not-found error without creating an unknown product', async () => {
      await expect(service.findByExactOrAliasName('Oat Milk')).rejects.toThrow(
        'No product named "oat milk"',
      );
      expect(understandingRunner.understand).not.toHaveBeenCalled();
      expect(understandingLog.record).not.toHaveBeenCalled();
      expect(createProduct).not.toHaveBeenCalled();
      expect(updateProduct).not.toHaveBeenCalled();
    });

    it('fails closed and logs safe fields for impossible multiple owners', async () => {
      const first = product({ id: 'product-b', canonicalName: 'Milk' });
      const second = product({ id: 'product-a', canonicalName: 'Other Milk' });
      outerNameFindMany.mockResolvedValue([
        { productId: first.id },
        { productId: second.id },
      ]);

      await expect(
        service.findByExactOrAliasName(' Milk '),
      ).rejects.toMatchObject({
        response: { code: PRODUCT_NAME_CONFLICT },
      });
      expect(operationalLogger.catalogIntegrity).toHaveBeenCalledWith(
        expect.objectContaining({
          outcome: 'failure',
          action: 'lookup',
          productIds: ['product-a', 'product-b'],
          ownerCount: 2,
          errorType: 'multiple_name_owners',
        }),
      );
      const integrityEvent =
        operationalLogger.catalogIntegrity.mock.calls[0][0];
      expect(integrityEvent.normalizedNameFingerprint).toMatch(
        /^sha256:[a-f0-9]{16}$/,
      );
      expect(JSON.stringify(integrityEvent)).not.toContain('milk');
    });

    it('creates metadata while preserving entered spelling and creating no aliases', async () => {
      understandingRunner.understand.mockResolvedValue(successfulUnderstanding);
      createProduct.mockResolvedValue(product({ canonicalName: 'Moo Juice' }));
      await expect(
        service.findOrCreateByExactOrAliasMatch(' Moo Juice '),
      ).resolves.toMatchObject({
        names: [expect.objectContaining({ displayName: 'Moo Juice' })],
      });
      expect(understandingRunner.understand).toHaveBeenCalledWith(
        'Moo Juice',
        emptyMetadata,
      );
      expect(createProduct).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            category: 'dairy',
            typicalUnit: 'liter',
            productType: ProductType.fast_consumable,
            isPerishable: true,
            names: {
              create: [
                {
                  displayName: 'Moo Juice',
                  normalizedName: 'moo juice',
                  kind: ProductNameKind.canonical,
                },
              ],
            },
          },
        }),
      );
      expect(createName).not.toHaveBeenCalled();
      expect(transactionNameFindUnique).toHaveBeenCalledTimes(1);
      expect(understandingLog.record).toHaveBeenCalledWith(
        successfulUnderstanding,
        ['category', 'productType', 'typicalUnit', 'isPerishable'],
        'applied',
      );
    });
    it('runs inference before the transaction and does not search inferred names', async () => {
      understandingRunner.understand.mockImplementation(() => {
        expect(transaction).not.toHaveBeenCalled();
        return Promise.resolve(successfulUnderstanding);
      });
      await service.findOrCreateByExactOrAliasMatch('moo juice');
      expect(transactionNameFindUnique).toHaveBeenCalledTimes(1);
      expect(transactionNameFindUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { normalizedName: 'moo juice' } }),
      );
      expect(createName).not.toHaveBeenCalled();
    });
    it('returns a concurrent exact match without changing names or metadata', async () => {
      const concurrent = product({ canonicalName: 'Moo Juice' });
      understandingRunner.understand.mockResolvedValue(successfulUnderstanding);
      transactionNameFindMany.mockResolvedValueOnce([
        { productId: concurrent.id },
      ]);
      transactionNameFindUnique.mockResolvedValueOnce({ product: concurrent });
      await expect(
        service.findOrCreateByExactOrAliasMatch('Moo Juice'),
      ).resolves.toBe(concurrent);
      expect(createProduct).not.toHaveBeenCalled();
      expect(createName).not.toHaveBeenCalled();
      expect(understandingLog.record).toHaveBeenCalledWith(
        successfulUnderstanding,
        [],
        'reused',
      );
    });
    it('resolves a uniqueness race through only the requested namespace key', async () => {
      const concurrent = product({
        id: 'concurrent-id',
        canonicalName: 'Moo Juice',
      });
      understandingRunner.understand.mockResolvedValue(successfulUnderstanding);
      createProduct.mockRejectedValue(prismaError('P2002'));
      outerNameFindMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ productId: concurrent.id }]);
      outerNameFindUnique.mockResolvedValueOnce({ product: concurrent });
      await expect(
        service.findOrCreateByExactOrAliasMatch('Moo Juice'),
      ).resolves.toBe(concurrent);
      expect(createName).not.toHaveBeenCalled();
    });
    it.each(['unknown', 'throw'])(
      'creates safely after %s metadata',
      async (mode) => {
        if (mode === 'throw')
          understandingRunner.understand.mockRejectedValue(
            new Error('private provider detail'),
          );
        else
          understandingRunner.understand.mockResolvedValue(
            initialUnderstanding(emptyMetadata),
          );
        await service.findOrCreateByExactOrAliasMatch('Moo Juice');
        expect(createProduct).toHaveBeenCalledWith(
          expect.objectContaining({
            data: {
              names: {
                create: [
                  {
                    displayName: 'Moo Juice',
                    normalizedName: 'moo juice',
                    kind: ProductNameKind.canonical,
                  },
                ],
              },
            },
          }),
        );
      },
    );
    it('continues when diagnostic logging fails', async () => {
      understandingRunner.understand.mockResolvedValue(successfulUnderstanding);
      understandingLog.record.mockRejectedValue(
        new Error('private database detail'),
      );
      await expect(
        service.findOrCreateByExactOrAliasMatch('Moo Juice'),
      ).resolves.toBeDefined();
      expect(createProduct).toHaveBeenCalled();
    });
  });
});

function prismaError(code: string): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('database detail', {
    code,
    clientVersion: 'test',
  });
}

function product(
  overrides: Partial<ProductWithNames> & {
    canonicalName?: string;
    aliases?: string[];
  } = {},
): ProductWithNames {
  const {
    canonicalName = 'milk',
    aliases = [],
    ...productOverrides
  } = overrides;
  return {
    id: 'product-id',
    category: null,
    typicalUnit: null,
    productType: null,
    isPerishable: false,
    predictionStrategy: null,
    predictionEnabled: true,
    config: null,
    names: [
      {
        id: 'canonical-name-id',
        productId: productOverrides.id ?? 'product-id',
        displayName: canonicalName,
        normalizedName: canonicalName.toLowerCase(),
        kind: ProductNameKind.canonical,
      },
      ...aliases.map((alias, index) => ({
        id: `alias-name-${index}`,
        productId: productOverrides.id ?? 'product-id',
        displayName: alias,
        normalizedName: alias.toLowerCase(),
        kind: ProductNameKind.alias,
      })),
    ],
    ...productOverrides,
  };
}
