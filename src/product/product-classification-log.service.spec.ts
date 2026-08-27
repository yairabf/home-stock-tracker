import { Test } from '@nestjs/testing';
import type { LlmGenerationResult } from '../llm/types/structured-generation';
import { ProductType } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import {
  PRODUCT_CLASSIFICATION_MIN_CONFIDENCE,
  PRODUCT_CLASSIFICATION_PROMPT_VERSION,
} from './product-classifier.service';
import { ProductClassificationLogService } from './product-classification-log.service';
import type { ProductClassificationResult } from './types/product-classification';

describe('ProductClassificationLogService', () => {
  let service: ProductClassificationLogService;
  let create: jest.Mock;

  const classification: ProductClassificationResult = {
    canonicalName: 'milk',
    aliases: ['whole milk'],
    category: 'dairy',
    typicalUnit: 'liter',
    productType: ProductType.fast_consumable,
    isPerishable: true,
    confidence: 0.95,
  };

  const successfulResult = (
    value: ProductClassificationResult = classification,
  ): LlmGenerationResult<ProductClassificationResult> => ({
    status: 'success',
    provider: ' openai ',
    model: ' test-model ',
    value,
  });

  beforeEach(async () => {
    create = jest.fn().mockResolvedValue({ id: 'log-id' });
    const module = await Test.createTestingModule({
      providers: [
        ProductClassificationLogService,
        {
          provide: PrismaService,
          useValue: { llmInferenceLog: { create } },
        },
      ],
    }).compile();

    service = module.get(ProductClassificationLogService);
  });

  it('persists only the validated classification and model metadata', async () => {
    await expect(service.record(successfulResult())).resolves.toEqual({
      id: 'log-id',
    });
    expect(create).toHaveBeenCalledWith({
      data: {
        modelProvider: 'openai',
        modelVersion: 'test-model',
        promptVersion: PRODUCT_CLASSIFICATION_PROMPT_VERSION,
        confidence: classification.confidence,
        structuredResponse: classification,
      },
    });
  });

  it.each([
    { status: 'refusal', provider: 'openai', model: 'test-model' },
    { status: 'unavailable', provider: 'openai', model: 'test-model' },
  ] as const)('does not persist a $status result', async (result) => {
    await expect(service.record(result)).resolves.toBeNull();
    expect(create).not.toHaveBeenCalled();
  });

  it('does not persist malformed successful output', async () => {
    const malformed = successfulResult({
      ...classification,
      productType: 'unknown',
    } as ProductClassificationResult);

    await expect(service.record(malformed)).resolves.toBeNull();
    expect(create).not.toHaveBeenCalled();
  });

  it('does not persist output containing an unexpected secret-bearing field', async () => {
    const withSecret = successfulResult({
      ...classification,
      apiKey: 'must-not-be-stored',
    } as ProductClassificationResult);

    await expect(service.record(withSecret)).resolves.toBeNull();
    expect(create).not.toHaveBeenCalled();
  });

  it('does not persist low-confidence output', async () => {
    const lowConfidence = successfulResult({
      ...classification,
      confidence: PRODUCT_CLASSIFICATION_MIN_CONFIDENCE - 0.01,
    });

    await expect(service.record(lowConfidence)).resolves.toBeNull();
    expect(create).not.toHaveBeenCalled();
  });

  it('does not persist blank provider metadata', async () => {
    const result = successfulResult() as Extract<
      LlmGenerationResult<ProductClassificationResult>,
      { status: 'success' }
    >;
    result.provider = ' ';

    await expect(service.record(result)).resolves.toBeNull();
    expect(create).not.toHaveBeenCalled();
  });
});
