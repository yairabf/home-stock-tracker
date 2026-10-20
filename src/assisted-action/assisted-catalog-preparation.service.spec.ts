import type { StructuredGenerationRequest } from '../llm/types/structured-generation';
import { AssistedCatalogPreparation } from './assisted-catalog-preparation.service';
import { AssistedIdentityNormalizer } from './assisted-identity-normalizer.service';
import { initialUnderstanding } from '../product/product-understanding';
import type {
  ProductMetadataSnapshot,
  ProductUnderstandingResult,
} from '../product/product-understanding';

const id = '4aa264e5-c7ec-4ebf-8f40-5f7b48dd0107';
const metadata: ProductMetadataSnapshot = {
  category: 'dairy',
  typicalUnit: 'liter',
  productType: 'fast_consumable',
  isPerishable: true,
};
const entity = (name = 'milk', fields = metadata) => ({
  id,
  ...fields,
  predictionEnabled: true,
  names: [
    {
      kind: 'canonical',
      displayName: name,
      normalizedName: name,
      id: 'name-id',
    },
  ],
});
const item = (productName = '3% milk by Nestle') => ({
  productName,
  ifPendingExists: 'return_existing' as const,
});

describe('AssistedCatalogPreparation', () => {
  const findName = jest.fn<
    Promise<unknown>,
    [{ where: { normalizedName: string } }]
  >();
  const findProduct = jest.fn();
  const search = jest.fn<
    Promise<unknown>,
    [{ query: string; limit: number }]
  >();
  const generate = jest.fn<
    Promise<unknown>,
    [StructuredGenerationRequest<never>]
  >();
  const understand = jest.fn<
    Promise<ProductUnderstandingResult>,
    [string, ProductMetadataSnapshot]
  >();
  const service = new AssistedCatalogPreparation(
    {
      productName: { findUnique: findName },
      product: { findUnique: findProduct },
    } as never,
    { search } as never,
    new AssistedIdentityNormalizer({
      name: 'test',
      generateStructured: generate as never,
    }),
    { understand } as never,
  );
  const prepare = (input = item()) =>
    service.prepare(input, performance.now() + 60_000);
  beforeEach(() => {
    jest.resetAllMocks();
    findName.mockResolvedValue(null);
    findProduct.mockResolvedValue(null);
    search.mockResolvedValue({ exactMatch: null, candidates: [] });
    generate.mockResolvedValue({
      status: 'success',
      provider: 'test',
      model: 'mock',
      value: {
        decision: { outcome: 'new', canonicalName: 'milk', confidence: 0.95 },
      },
    });
    understand.mockImplementation(
      (_name: string, supplied: ProductMetadataSnapshot) => {
        const result = initialUnderstanding(supplied);
        result.fields.category = {
          status: 'resolved',
          source: 'openai',
          value: 'dairy',
        };
        return Promise.resolve(result);
      },
    );
  });
  afterEach(() => jest.useRealTimers());

  it('prepares an AI generic name, the exact supplied alias and missing metadata', async () => {
    const result = await prepare();
    expect(result).toMatchObject({
      outcome: 'prepared',
      product: {
        canonicalName: 'milk',
        aliasToAdd: '3% milk by Nestle',
        existing: null,
        metadata: { category: 'dairy', isPerishable: null },
      },
    });
    expect(JSON.parse(understand.mock.calls[0][0])).toEqual({
      version: 'assisted-product-evidence-v1',
      canonicalName: 'milk',
      originalName: '3% milk by Nestle',
    });
    expect(generate).toHaveBeenCalledTimes(1);
    expect(understand).toHaveBeenCalledTimes(1);
  });

  it.each(['חלב 3% תנובה', 'Nestle חלב 3%'])(
    'retains original multilingual alias %s',
    async (name) => {
      expect(await prepare(item(name))).toMatchObject({
        product: { aliasToAdd: name },
      });
    },
  );

  it.each(['oat milk', 'infant formula', 'dish detergent'])(
    'retains the AI-selected meaningful distinction %s',
    async (name) => {
      generate.mockResolvedValue({
        status: 'success',
        provider: 'test',
        model: 'mock',
        value: {
          decision: { outcome: 'new', canonicalName: name, confidence: 0.95 },
        },
      });
      expect(await prepare()).toMatchObject({
        product: { canonicalName: name },
      });
    },
  );

  it('bypasses inference for complete exact canonical or alias matches', async () => {
    findName.mockResolvedValue({
      product: {
        ...entity(),
        names: [
          ...entity().names,
          {
            kind: 'alias',
            displayName: '3% milk by Nestle',
            normalizedName: '3% milk by nestle',
            id: 'alias-id',
          },
        ],
      },
    });
    expect(await prepare()).toMatchObject({
      product: { existing: { id }, aliasToAdd: null },
    });
    expect(generate).not.toHaveBeenCalled();
    expect(understand).not.toHaveBeenCalled();
    expect(search).not.toHaveBeenCalled();
  });

  it('bypasses naming for ID input and does not invent aliases', async () => {
    findProduct.mockResolvedValue(entity());
    expect(
      await service.prepare(
        { productId: id, quantity: 1 },
        performance.now() + 1000,
      ),
    ).toMatchObject({
      product: { suppliedName: null, aliasToAdd: null, existing: { id } },
    });
    expect(generate).not.toHaveBeenCalled();
  });

  it('returns needs_input for an unknown ID without naming or metadata calls', async () => {
    expect(
      await service.prepare(
        { productId: id, quantity: 1 },
        performance.now() + 1000,
      ),
    ).toMatchObject({ outcome: 'needs_input' });
    expect(generate).not.toHaveBeenCalled();
    expect(understand).not.toHaveBeenCalled();
  });

  it('rechecks the generated generic name and reuses an existing owner', async () => {
    findName
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ product: entity() });
    expect(await prepare()).toMatchObject({
      product: {
        existing: { id },
        canonicalName: 'milk',
        aliasToAdd: '3% milk by Nestle',
      },
    });
    expect(findName.mock.calls[1][0].where).toEqual({ normalizedName: 'milk' });
    expect(understand).not.toHaveBeenCalled();
  });

  it('uses a validated existing candidate and preserves its display name', async () => {
    search.mockResolvedValue({
      exactMatch: null,
      candidates: [
        {
          id,
          canonicalName: 'Milk',
          aliases: [],
          ...metadata,
          predictionEnabled: true,
        },
      ],
    });
    generate.mockResolvedValue({
      status: 'success',
      provider: 'test',
      model: 'mock',
      value: {
        decision: { outcome: 'existing', productId: id, confidence: 0.99 },
      },
    });
    expect(await prepare()).toMatchObject({
      product: { canonicalName: 'Milk', existing: { id } },
    });
  });

  it('preserves supplied false and metadata even if inference contradicts it', async () => {
    const result = await prepare({
      ...item(),
      metadata: { category: 'supplied', isPerishable: false },
    } as never);
    expect(result).toMatchObject({
      product: { metadata: { category: 'supplied', isPerishable: false } },
    });
    expect(understand.mock.calls[0][1]).toMatchObject({
      category: 'supplied',
      isPerishable: false,
    });
  });

  it('reports stored/supplied conflicts without inference', async () => {
    findName.mockResolvedValue({ product: entity() });
    expect(
      await prepare({ ...item(), metadata: { isPerishable: false } } as never),
    ).toEqual({ outcome: 'needs_input', code: 'metadata_conflict' });
    expect(generate).not.toHaveBeenCalled();
    expect(understand).not.toHaveBeenCalled();
  });

  it('fills missing fields on exact matches without naming calls', async () => {
    findName.mockResolvedValue({
      product: entity('milk', { ...metadata, category: null }),
    });
    expect(await prepare()).toMatchObject({ product: { metadata } });
    expect(generate).not.toHaveBeenCalled();
    expect(understand).toHaveBeenCalledTimes(1);
  });

  it('does not fabricate optional fields when metadata inference abstains', async () => {
    understand.mockImplementation((_name, supplied) =>
      Promise.resolve(initialUnderstanding(supplied)),
    );
    expect(await prepare()).toMatchObject({
      outcome: 'prepared',
      product: {
        metadata: {
          category: null,
          typicalUnit: null,
          productType: null,
          isPerishable: null,
        },
      },
    });
  });

  it('does not save an alias identical under namespace normalization', async () => {
    expect(await prepare(item('MILK'))).toMatchObject({
      product: { aliasToAdd: null },
    });
  });

  it('bounds discovery to 200 characters while retaining the entire phrase for AI', async () => {
    const raw = 'a'.repeat(300);
    await prepare(item(raw));
    expect(search.mock.calls[0][0].query).toHaveLength(200);
    expect(generate.mock.calls[0][0].input.rawName).toBe(raw);
  });

  it('stops after uncertain identity without calling metadata classification', async () => {
    generate.mockResolvedValue({
      status: 'success',
      provider: 'test',
      model: 'mock',
      value: { decision: { outcome: 'unknown' } },
    });
    expect(await prepare()).toMatchObject({ outcome: 'needs_input' });
    expect(understand).not.toHaveBeenCalled();
  });

  it('does not start later provider work when a lookup finishes after the deadline', async () => {
    jest.useFakeTimers();
    let resolve!: (value: null) => void;
    findName.mockImplementation(
      () =>
        new Promise<null>((done) => {
          resolve = done;
        }),
    );
    const pending = service.prepare(item(), performance.now() + 10);
    await jest.advanceTimersByTimeAsync(10);
    expect(await pending).toMatchObject({ code: 'provider_deadline' });
    resolve(null);
    await jest.advanceTimersByTimeAsync(1);
    expect(search).not.toHaveBeenCalled();
    expect(generate).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
  });
});
