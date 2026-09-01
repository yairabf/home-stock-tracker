import { ProductType } from '../generated/prisma/enums';
import { type LlmProvider } from '../llm/llm-provider';
import type { StructuredGenerationRequest } from '../llm/types/structured-generation';
import { ProductResolutionService } from './product-resolution.service';
import type { ProductResolutionLogService } from './product-resolution-log.service';
import type { ProductSearchService } from './product-search.service';
import {
  PRODUCT_RESOLUTION_MAX_CONTEXT_BYTES,
  PRODUCT_RESOLUTION_MIN_CONFIDENCE,
  PRODUCT_RESOLUTION_PROMPT_VERSION,
  PRODUCT_RESOLUTION_TIMEOUT_MS,
  type ProductResolutionProposal,
} from './types/product-resolution';
import type { ProductSearchProduct } from './types/product-search';

describe('ProductResolutionService', () => {
  let searchService: jest.Mocked<Pick<ProductSearchService, 'search'>>;
  let provider: jest.Mocked<LlmProvider>;
  let resolutionLog: jest.Mocked<Pick<ProductResolutionLogService, 'record'>>;
  let service: ProductResolutionService;

  beforeEach(() => {
    searchService = { search: jest.fn() };
    provider = { name: 'fake', generateStructured: jest.fn() };
    resolutionLog = { record: jest.fn().mockResolvedValue(null) };
    service = new ProductResolutionService(
      searchService as ProductSearchService,
      provider,
      resolutionLog as ProductResolutionLogService,
    );
    searchService.search.mockResolvedValue({
      exactMatch: null,
      candidates: [candidate('product-a'), candidate('product-b')],
    });
  });

  it('returns exact facts without calling the provider', async () => {
    const exactMatch = candidate('product-a');
    searchService.search.mockResolvedValue({ exactMatch, candidates: [] });

    await expect(service.resolve(' Milk ')).resolves.toEqual({
      exactMatch,
      candidates: [],
      proposal: null,
    });
    expect(searchService.search).toHaveBeenCalledWith({
      query: ' Milk ',
      limit: 20,
    });
    expect(provider.generateStructured.mock.calls).toHaveLength(0);
  });

  it.each([
    {
      recommendation: 'create_product',
      newProduct: {
        canonicalName: '  ３％ Milk ',
        aliases: [' Three Percent Milk '],
        category: ' Dairy ',
        typicalUnit: ' Carton ',
        productType: ProductType.fast_consumable,
        isPerishable: true,
      },
      confidence: 0.9,
      reason: ' New product ',
    },
    {
      recommendation: 'add_alias',
      targetProductId: 'product-a',
      alias: ' Whole Milk ',
      confidence: 0.9,
      reason: ' Same product ',
    },
    {
      recommendation: 'ask_user_to_choose',
      candidateProductIds: ['product-a', 'product-b'],
      confidence: 0.9,
      reason: ' Ambiguous ',
    },
  ] as ProductResolutionProposal[])(
    'returns validated $recommendation advice',
    async (proposal) => {
      provider.generateStructured.mockResolvedValue(success(proposal));

      const result = await service.resolve(' Milk ');

      expect(result.proposal).toMatchObject({
        recommendation: proposal.recommendation,
        confidence: 0.9,
      });
      expect(provider.generateStructured.mock.calls).toHaveLength(1);
    },
  );

  it('records only validated advice and ignores logging failure', async () => {
    provider.generateStructured.mockResolvedValue(success(validAlias()));
    resolutionLog.record.mockRejectedValue(new Error('logging failed'));

    await expect(service.resolve('milk')).resolves.toMatchObject({
      proposal: { recommendation: 'add_alias' },
    });
    expect(resolutionLog.record.mock.calls).toHaveLength(1);
    expect(resolutionLog.record.mock.calls[0][0]).toEqual(
      success(validAlias()),
    );
  });

  it('does not log discarded advice', async () => {
    provider.generateStructured.mockResolvedValue(
      success({ ...validAlias(), targetProductId: 'unknown' }),
    );

    await expect(service.resolve('milk')).resolves.toMatchObject({
      proposal: null,
    });
    expect(resolutionLog.record.mock.calls).toHaveLength(0);
  });

  it('sends only complete allowlisted candidate facts in stable order', async () => {
    provider.generateStructured.mockResolvedValue(success(validAlias()));

    await service.resolve('  MILK  ');

    const request = provider.generateStructured.mock
      .calls[0][0] as StructuredGenerationRequest<ProductResolutionProposal>;
    expect(request).toMatchObject({
      task: 'product-resolution-advice',
      schemaName: 'product_resolution_proposal',
      promptVersion: PRODUCT_RESOLUTION_PROMPT_VERSION,
      input: {
        requestedPhrase: 'milk',
        candidates: [
          {
            id: 'product-a',
            canonicalName: 'Product product-a',
            aliases: ['Alias product-a'],
          },
          {
            id: 'product-b',
            canonicalName: 'Product product-b',
            aliases: ['Alias product-b'],
          },
        ],
      },
    });
    expect(Object.keys(request.input)).toEqual([
      'requestedPhrase',
      'candidates',
    ]);
    expect(
      Object.keys((request.input.candidates as object[])[0]).sort(),
    ).toEqual(
      [
        'aliases',
        'canonicalName',
        'category',
        'id',
        'isPerishable',
        'productType',
        'typicalUnit',
      ].sort(),
    );
  });

  it.each([
    { ...validAlias(), targetProductId: 'unknown' },
    { ...validChoice(), candidateProductIds: ['product-a', 'unknown'] },
    { ...validChoice(), candidateProductIds: ['product-a', 'product-a'] },
    {
      ...validAlias(),
      confidence: PRODUCT_RESOLUTION_MIN_CONFIDENCE - 0.01,
    },
    { ...validAlias(), extra: true },
  ])('discards invalid or unsafe advice: %j', async (proposal) => {
    provider.generateStructured.mockResolvedValue(success(proposal));

    const result = await service.resolve('milk');

    expect(result.proposal).toBeNull();
    expect(result.candidates.map(({ id }) => id)).toEqual([
      'product-a',
      'product-b',
    ]);
  });

  it('accepts advice exactly at the confidence threshold', async () => {
    provider.generateStructured.mockResolvedValue(
      success({
        ...validAlias(),
        confidence: PRODUCT_RESOLUTION_MIN_CONFIDENCE,
      }),
    );

    await expect(service.resolve('milk')).resolves.toMatchObject({
      proposal: { confidence: PRODUCT_RESOLUTION_MIN_CONFIDENCE },
    });
  });

  it.each([
    { status: 'refusal', provider: 'fake', model: 'model' } as const,
    { status: 'unavailable', provider: 'fake', model: 'model' } as const,
  ])('degrades $status to null advice', async (providerResult) => {
    provider.generateStructured.mockResolvedValue(providerResult);

    await expect(service.resolve('milk')).resolves.toMatchObject({
      proposal: null,
      candidates: [{ id: 'product-a' }, { id: 'product-b' }],
    });
  });

  it('degrades thrown provider failures to null advice', async () => {
    provider.generateStructured.mockRejectedValue(new Error('provider failed'));

    await expect(service.resolve('milk')).resolves.toMatchObject({
      proposal: null,
    });
  });

  it('degrades provider timeout to null advice', async () => {
    jest.useFakeTimers();
    provider.generateStructured.mockReturnValue(new Promise(() => undefined));

    const pending = service.resolve('milk');
    await jest.advanceTimersByTimeAsync(PRODUCT_RESOLUTION_TIMEOUT_MS);

    await expect(pending).resolves.toMatchObject({ proposal: null });
    jest.useRealTimers();
  });

  it('calls the provider when complete context is exactly at the UTF-8 byte budget', async () => {
    const boundaryCandidate = candidateForContextBytes(
      PRODUCT_RESOLUTION_MAX_CONTEXT_BYTES,
    );
    searchService.search.mockResolvedValue({
      exactMatch: null,
      candidates: [boundaryCandidate],
    });
    provider.generateStructured.mockResolvedValue(success(validAlias()));

    await expect(service.resolve('milk')).resolves.toMatchObject({
      proposal: { recommendation: 'add_alias' },
    });
    expect(provider.generateStructured.mock.calls).toHaveLength(1);
  });

  it('skips provider when the complete valid UTF-8 context exceeds the byte budget', async () => {
    const oversizedCandidates = Array.from({ length: 20 }, (_, index) => {
      const product = candidate(`product-${index}`);
      product.aliases = Array.from(
        { length: 10 },
        (_alias, aliasIndex) => `${index}-${aliasIndex}-${'🛒'.repeat(45)}`,
      );
      return product;
    });
    expect(
      Buffer.byteLength(
        JSON.stringify({
          requestedPhrase: 'milk',
          candidates: oversizedCandidates.map((product) => ({
            id: product.id,
            canonicalName: product.canonicalName,
            aliases: product.aliases,
            category: product.category,
            typicalUnit: product.typicalUnit,
            productType: product.productType,
            isPerishable: product.isPerishable,
          })),
        }),
        'utf8',
      ),
    ).toBeGreaterThan(PRODUCT_RESOLUTION_MAX_CONTEXT_BYTES);
    searchService.search.mockResolvedValue({
      exactMatch: null,
      candidates: oversizedCandidates,
    });

    await expect(service.resolve('milk')).resolves.toMatchObject({
      candidates: oversizedCandidates,
      proposal: null,
    });
    expect(provider.generateStructured.mock.calls).toHaveLength(0);
  });
});

function candidateForContextBytes(targetBytes: number): ProductSearchProduct {
  const product = candidate('product-a');
  product.aliases = [];
  const contextBytes = () =>
    Buffer.byteLength(
      JSON.stringify({
        requestedPhrase: 'milk',
        candidates: [
          {
            id: product.id,
            canonicalName: product.canonicalName,
            aliases: product.aliases,
            category: product.category,
            typicalUnit: product.typicalUnit,
            productType: product.productType,
            isPerishable: product.isPerishable,
          },
        ],
      }),
      'utf8',
    );

  while (targetBytes - contextBytes() > 203) {
    product.aliases.push('x'.repeat(200));
  }
  const separatorBytes = product.aliases.length === 0 ? 2 : 3;
  product.aliases.push(
    'x'.repeat(targetBytes - contextBytes() - separatorBytes),
  );
  expect(contextBytes()).toBe(targetBytes);
  return product;
}

function candidate(id: string): ProductSearchProduct {
  return {
    id,
    canonicalName: `Product ${id}`,
    aliases: [`Alias ${id}`],
    category: 'dairy',
    typicalUnit: 'carton',
    productType: ProductType.fast_consumable,
    isPerishable: true,
    predictionEnabled: false,
  };
}

function validAlias(): ProductResolutionProposal {
  return {
    recommendation: 'add_alias',
    targetProductId: 'product-a',
    alias: 'Whole Milk',
    confidence: 0.9,
    reason: 'Same product',
  };
}

function validChoice(): ProductResolutionProposal {
  return {
    recommendation: 'ask_user_to_choose',
    candidateProductIds: ['product-a', 'product-b'],
    confidence: 0.9,
    reason: 'Ambiguous',
  };
}

function success(value: ProductResolutionProposal) {
  return {
    status: 'success' as const,
    provider: 'fake',
    model: 'fake-model',
    value,
  };
}
