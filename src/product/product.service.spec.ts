import type { LlmGenerationResult } from '../llm/types/structured-generation';
import { ProductType } from '../generated/prisma/enums';
import type { ProductModel } from '../generated/prisma/models';
import type { PrismaService } from '../prisma/prisma.service';
import type { ProductClassificationLogService } from './product-classification-log.service';
import type { ProductClassifier } from './product-classifier.service';
import { ProductService } from './product.service';
import type { ProductClassificationResult } from './types/product-classification';

describe('ProductService LLM-assisted resolution', () => {
  let service: ProductService;
  let productClassifier: jest.Mocked<Pick<ProductClassifier, 'classify'>>;
  let classificationLog: jest.Mocked<
    Pick<ProductClassificationLogService, 'record'>
  >;
  let outerFindMany: jest.Mock;
  let transactionFindMany: jest.Mock;
  let create: jest.Mock;
  let update: jest.Mock;

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
    outerFindMany = jest.fn().mockResolvedValue([]);
    transactionFindMany = jest.fn().mockResolvedValue([]);
    create = jest.fn().mockImplementation(({ data }) => product(data));
    update = jest
      .fn()
      .mockImplementation(({ data }) =>
        product({ id: 'existing-id', canonicalName: 'milk', ...data }),
      );
    const transactionClient = {
      product: { findMany: transactionFindMany, create, update },
    };
    const prisma = {
      product: { findMany: outerFindMany },
      $transaction: jest
        .fn()
        .mockImplementation((operation) => operation(transactionClient)),
    } as unknown as PrismaService;
    productClassifier = { classify: jest.fn() };
    classificationLog = { record: jest.fn().mockResolvedValue(null) };
    service = new ProductService(
      prisma,
      productClassifier as unknown as ProductClassifier,
      classificationLog as unknown as ProductClassificationLogService,
    );
  });

  it('returns an exact match without calling the classifier', async () => {
    const existing = product({ canonicalName: 'milk' });
    outerFindMany.mockResolvedValue([existing]);

    await expect(
      service.findOrCreateByExactOrAliasMatch(' Milk '),
    ).resolves.toBe(existing);
    expect(productClassifier.classify).not.toHaveBeenCalled();
    expect(classificationLog.record).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it('creates and logs an enriched product from valid inference', async () => {
    productClassifier.classify.mockResolvedValue(successfulClassification);

    await expect(
      service.findOrCreateByExactOrAliasMatch('moo juice'),
    ).resolves.toMatchObject({ canonicalName: 'milk' });
    expect(classificationLog.record).toHaveBeenCalledWith(
      successfulClassification,
    );
    expect(create).toHaveBeenCalledWith({
      data: {
        canonicalName: 'milk',
        aliases: ['whole milk', 'moo juice'],
        category: 'dairy',
        typicalUnit: 'liter',
        productType: ProductType.fast_consumable,
        isPerishable: true,
      },
    });
  });

  it('reuses an inferred existing product and adds the raw name as an alias', async () => {
    const existing = product({ id: 'existing-id', canonicalName: 'milk' });
    productClassifier.classify.mockResolvedValue(successfulClassification);
    transactionFindMany.mockResolvedValue([existing]);

    await service.findOrCreateByExactOrAliasMatch('moo juice');

    expect(update).toHaveBeenCalledWith({
      where: { id: 'existing-id' },
      data: { aliases: ['moo juice'] },
    });
    expect(create).not.toHaveBeenCalled();
  });

  it('returns a concurrent raw-name match without creating a duplicate', async () => {
    const concurrent = product({ canonicalName: 'moo juice' });
    productClassifier.classify.mockResolvedValue(successfulClassification);
    transactionFindMany.mockResolvedValue([concurrent]);

    await expect(
      service.findOrCreateByExactOrAliasMatch('moo juice'),
    ).resolves.toBe(concurrent);
    expect(update).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it.each([
    { status: 'refusal', provider: 'openai', model: 'test-model' },
    { status: 'unavailable', provider: 'openai', model: 'test-model' },
  ] as const)(
    'creates the deterministic fallback for $status',
    async (result) => {
      productClassifier.classify.mockResolvedValue(result);

      await service.findOrCreateByExactOrAliasMatch('Moo Juice');

      expect(create).toHaveBeenCalledWith({
        data: { canonicalName: 'moo juice' },
      });
    },
  );

  it('creates the deterministic fallback when classification throws', async () => {
    productClassifier.classify.mockRejectedValue(new Error('provider detail'));

    await service.findOrCreateByExactOrAliasMatch('Moo Juice');

    expect(classificationLog.record).toHaveBeenCalledWith({
      status: 'unavailable',
    });
    expect(create).toHaveBeenCalledWith({
      data: { canonicalName: 'moo juice' },
    });
  });

  it('continues product creation when inference logging fails', async () => {
    productClassifier.classify.mockResolvedValue(successfulClassification);
    classificationLog.record.mockRejectedValue(new Error('database detail'));

    await expect(
      service.findOrCreateByExactOrAliasMatch('moo juice'),
    ).resolves.toMatchObject({ canonicalName: 'milk' });
    expect(create).toHaveBeenCalled();
  });
});

function product(overrides: Partial<ProductModel> = {}): ProductModel {
  return {
    id: 'product-id',
    canonicalName: 'milk',
    aliases: [],
    category: null,
    typicalUnit: null,
    productType: null,
    isPerishable: false,
    predictionStrategy: null,
    predictionEnabled: true,
    config: null,
    ...overrides,
  };
}
