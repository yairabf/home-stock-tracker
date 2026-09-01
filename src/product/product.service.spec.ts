import { Prisma } from '../generated/prisma/client';
import { ProductNameKind, ProductType } from '../generated/prisma/enums';
import type { LlmGenerationResult } from '../llm/types/structured-generation';
import type { OperationalLogger } from '../observability/operational-logger.service';
import type { PrismaService } from '../prisma/prisma.service';
import {
  PRODUCT_NAME_CONFLICT,
  PRODUCT_NOT_FOUND,
} from './product-name.exception';
import type { ProductClassificationLogService } from './product-classification-log.service';
import type { ProductClassifier } from './product-classifier.service';
import { ProductService } from './product.service';
import type { ProductClassificationResult } from './types/product-classification';
import type { ProductWithNames } from './types/product-with-names';

describe('ProductService', () => {
  let service: ProductService;
  let productClassifier: jest.Mocked<Pick<ProductClassifier, 'classify'>>;
  let classificationLog: jest.Mocked<
    Pick<ProductClassificationLogService, 'record'>
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

  const classification: ProductClassificationResult = {
    canonicalName: 'milk',
    aliases: ['whole milk'],
    category: 'dairy',
    typicalUnit: 'liter',
    productType: ProductType.fast_consumable,
    isPerishable: true,
    confidence: 0.95,
  };

  const successfulClassification: LlmGenerationResult<ProductClassificationResult> =
    {
      status: 'success',
      provider: 'openai',
      model: 'test-model',
      value: classification,
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
    productClassifier = { classify: jest.fn() };
    classificationLog = { record: jest.fn().mockResolvedValue(null) };
    operationalLogger = { catalogIntegrity: jest.fn() };
    service = new ProductService(
      prisma,
      productClassifier as unknown as ProductClassifier,
      classificationLog as unknown as ProductClassificationLogService,
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
      expect(productClassifier.classify).not.toHaveBeenCalled();
      expect(classificationLog.record).not.toHaveBeenCalled();
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
      expect(productClassifier.classify).not.toHaveBeenCalled();
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
      expect(productClassifier.classify).not.toHaveBeenCalled();
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
      expect(productClassifier.classify).not.toHaveBeenCalled();
      expect(classificationLog.record).not.toHaveBeenCalled();
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
        expect(productClassifier.classify).not.toHaveBeenCalled();
        expect(classificationLog.record).not.toHaveBeenCalled();
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
      expect(productClassifier.classify).not.toHaveBeenCalled();
      expect(createProduct).not.toHaveBeenCalled();
      expect(updateProduct).not.toHaveBeenCalled();
    });

    it('returns a not-found error without creating an unknown product', async () => {
      await expect(service.findByExactOrAliasName('Oat Milk')).rejects.toThrow(
        'No product named "oat milk"',
      );
      expect(productClassifier.classify).not.toHaveBeenCalled();
      expect(classificationLog.record).not.toHaveBeenCalled();
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

    it('creates and logs an enriched product with namespace rows', async () => {
      productClassifier.classify.mockResolvedValue(successfulClassification);

      await expect(
        service.findOrCreateByExactOrAliasMatch('moo juice'),
      ).resolves.toMatchObject({
        names: [expect.objectContaining({ displayName: 'milk' })],
      });
      expect(classificationLog.record).toHaveBeenCalledWith(
        successfulClassification,
      );
      expect(createProduct).toHaveBeenLastCalledWith(
        expect.objectContaining({
          data: {
            category: 'dairy',
            typicalUnit: 'liter',
            productType: ProductType.fast_consumable,
            isPerishable: true,
            names: {
              create: [
                {
                  displayName: 'milk',
                  normalizedName: 'milk',
                  kind: ProductNameKind.canonical,
                },
                {
                  displayName: 'whole milk',
                  normalizedName: 'whole milk',
                  kind: ProductNameKind.alias,
                },
                {
                  displayName: 'moo juice',
                  normalizedName: 'moo juice',
                  kind: ProductNameKind.alias,
                },
              ],
            },
          },
        }),
      );
    });

    it('reuses an inferred existing product and adds the raw name as an alias', async () => {
      const existing = product({ id: 'existing-id', canonicalName: 'milk' });
      productClassifier.classify.mockResolvedValue(successfulClassification);
      const updated = product({
        id: 'existing-id',
        canonicalName: 'milk',
        aliases: ['moo juice'],
      });
      transactionNameFindMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ productId: existing.id }])
        .mockResolvedValueOnce([]);
      transactionNameFindUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ product: existing });
      transactionFindUnique.mockResolvedValue(updated);

      await service.findOrCreateByExactOrAliasMatch('moo juice');

      expect(createName).toHaveBeenCalledWith({
        data: {
          productId: 'existing-id',
          displayName: 'moo juice',
          normalizedName: 'moo juice',
          kind: ProductNameKind.alias,
        },
      });
      expect(transactionFindUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'existing-id' } }),
      );
      expect(updateProduct).not.toHaveBeenCalled();
      expect(createProduct).not.toHaveBeenCalled();
    });

    it('returns a concurrent raw-name match without creating a duplicate', async () => {
      const concurrent = product({ canonicalName: 'moo juice' });
      productClassifier.classify.mockResolvedValue(successfulClassification);
      transactionNameFindMany.mockResolvedValueOnce([
        { productId: concurrent.id },
      ]);
      transactionNameFindUnique.mockResolvedValueOnce({ product: concurrent });

      await expect(
        service.findOrCreateByExactOrAliasMatch('moo juice'),
      ).resolves.toBe(concurrent);
      expect(updateProduct).not.toHaveBeenCalled();
      expect(createProduct).not.toHaveBeenCalled();
    });

    it('resolves a uniqueness race through the requested namespace key', async () => {
      const concurrent = product({
        id: 'concurrent-id',
        canonicalName: 'milk',
      });
      productClassifier.classify.mockResolvedValue(successfulClassification);
      createProduct.mockRejectedValue(prismaError('P2002'));
      outerNameFindMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ productId: concurrent.id }]);
      outerNameFindUnique.mockResolvedValueOnce({ product: concurrent });

      await expect(
        service.findOrCreateByExactOrAliasMatch('moo juice'),
      ).resolves.toBe(concurrent);
    });

    it.each([
      { status: 'refusal', provider: 'openai', model: 'test-model' },
      { status: 'unavailable', provider: 'openai', model: 'test-model' },
    ] as const)(
      'creates the deterministic fallback for $status',
      async (result) => {
        productClassifier.classify.mockResolvedValue(result);

        await service.findOrCreateByExactOrAliasMatch('Moo Juice');

        expect(createProduct).toHaveBeenLastCalledWith(
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

    it('creates the deterministic fallback when classification throws', async () => {
      productClassifier.classify.mockRejectedValue(
        new Error('provider detail'),
      );

      await service.findOrCreateByExactOrAliasMatch('Moo Juice');

      expect(classificationLog.record).toHaveBeenCalledWith({
        status: 'unavailable',
      });
      expect(createProduct).toHaveBeenLastCalledWith(
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
    });

    it('continues product creation when inference logging fails', async () => {
      productClassifier.classify.mockResolvedValue(successfulClassification);
      classificationLog.record.mockRejectedValue(new Error('database detail'));

      await expect(
        service.findOrCreateByExactOrAliasMatch('moo juice'),
      ).resolves.toMatchObject({
        names: [expect.objectContaining({ displayName: 'milk' })],
      });
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
