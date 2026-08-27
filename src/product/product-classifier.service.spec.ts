import { Test } from '@nestjs/testing';
import { ProductType } from '../generated/prisma/enums';
import { LLM_PROVIDER, type LlmProvider } from '../llm/llm-provider';
import type { StructuredGenerationRequest } from '../llm/types/structured-generation';
import {
  PRODUCT_CLASSIFICATION_MIN_CONFIDENCE,
  PRODUCT_CLASSIFICATION_PROMPT_VERSION,
  ProductClassifier,
} from './product-classifier.service';
import type { ProductClassificationResult } from './types/product-classification';

describe('ProductClassifier', () => {
  let classifier: ProductClassifier;
  let provider: jest.Mocked<LlmProvider>;

  const validResult: ProductClassificationResult = {
    canonicalName: ' Milk ',
    aliases: [' Whole Milk ', 'milk'],
    category: ' Dairy ',
    typicalUnit: ' Liter ',
    productType: ProductType.fast_consumable,
    isPerishable: true,
    confidence: 0.95,
  };

  beforeEach(async () => {
    provider = {
      name: 'fake',
      generateStructured: jest.fn(),
    };
    const module = await Test.createTestingModule({
      providers: [
        ProductClassifier,
        { provide: LLM_PROVIDER, useValue: provider },
      ],
    }).compile();

    classifier = module.get(ProductClassifier);
  });

  it('sends only product input and returns normalized validated output', async () => {
    provider.generateStructured.mockResolvedValue({
      status: 'success',
      provider: 'fake',
      model: 'fake-model',
      value: validResult,
    });

    const result = await classifier.classify({
      rawName: '  MILK  ',
      hints: { category: ' dairy ' },
    });

    expect(provider.generateStructured).toHaveBeenCalledTimes(1);
    const request = provider.generateStructured.mock
      .calls[0][0] as StructuredGenerationRequest<ProductClassificationResult>;
    expect(request).toMatchObject({
      task: 'product-classification',
      input: { rawName: 'MILK', hints: { category: 'dairy' } },
      schemaName: 'product_classification',
      promptVersion: PRODUCT_CLASSIFICATION_PROMPT_VERSION,
    });
    expect(Object.keys(request.input)).toEqual(['rawName', 'hints']);
    expect(result).toEqual({
      status: 'success',
      provider: 'fake',
      model: 'fake-model',
      value: {
        ...validResult,
        canonicalName: 'milk',
        aliases: ['whole milk'],
        category: 'Dairy',
        typicalUnit: 'Liter',
      },
    });
  });

  it('preserves provider refusals', async () => {
    provider.generateStructured.mockResolvedValue({
      status: 'refusal',
      provider: 'fake',
      model: 'fake-model',
    });

    await expect(classifier.classify({ rawName: 'milk' })).resolves.toEqual({
      status: 'refusal',
      provider: 'fake',
      model: 'fake-model',
    });
  });

  it('rejects malformed successful output', async () => {
    provider.generateStructured.mockResolvedValue({
      status: 'success',
      provider: 'fake',
      model: 'fake-model',
      value: {
        ...validResult,
        productType: 'unknown',
      } as ProductClassificationResult,
    });

    await expect(classifier.classify({ rawName: 'milk' })).resolves.toEqual({
      status: 'unavailable',
      provider: 'fake',
      model: 'fake-model',
    });
  });

  it('rejects output below the classification confidence threshold', async () => {
    provider.generateStructured.mockResolvedValue({
      status: 'success',
      provider: 'fake',
      model: 'fake-model',
      value: {
        ...validResult,
        confidence: PRODUCT_CLASSIFICATION_MIN_CONFIDENCE - 0.01,
      },
    });

    await expect(classifier.classify({ rawName: 'milk' })).resolves.toEqual({
      status: 'unavailable',
      provider: 'fake',
      model: 'fake-model',
    });
  });
});
