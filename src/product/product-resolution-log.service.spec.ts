import { Test } from '@nestjs/testing';
import { ProductType } from '../generated/prisma/enums';
import type { LlmGenerationResult } from '../llm/types/structured-generation';
import { PrismaService } from '../prisma/prisma.service';
import { ProductResolutionLogService } from './product-resolution-log.service';
import {
  PRODUCT_RESOLUTION_MIN_CONFIDENCE,
  PRODUCT_RESOLUTION_PROMPT_VERSION,
  type ProductResolutionProposal,
} from './types/product-resolution';

describe('ProductResolutionLogService', () => {
  let service: ProductResolutionLogService;
  let create: jest.Mock;

  beforeEach(async () => {
    create = jest.fn().mockResolvedValue({ id: 'log-id' });
    const module = await Test.createTestingModule({
      providers: [
        ProductResolutionLogService,
        {
          provide: PrismaService,
          useValue: { llmInferenceLog: { create } },
        },
      ],
    }).compile();
    service = module.get(ProductResolutionLogService);
  });

  it.each([createProposal(), aliasProposal(), choiceProposal()])(
    'persists only validated $recommendation advice and provider metadata',
    async (proposal) => {
      await expect(service.record(success(proposal))).resolves.toEqual({
        id: 'log-id',
      });
      expect(create).toHaveBeenCalledWith({
        data: {
          modelProvider: 'openai',
          modelVersion: 'test-model',
          promptVersion: PRODUCT_RESOLUTION_PROMPT_VERSION,
          confidence: proposal.confidence,
          structuredResponse: {
            status: 'validated',
            proposal,
          },
        },
      });
      const calls = create.mock.calls as unknown as Array<
        [{ data: { structuredResponse: Record<string, unknown> } }]
      >;
      const stored = calls[0][0];
      expect(Object.keys(stored.data.structuredResponse)).toEqual([
        'status',
        'proposal',
      ]);
      expect(JSON.stringify(stored)).not.toMatch(
        /requestedPhrase|candidates|apiKey|rawPrompt|context/,
      );
    },
  );

  it.each([
    { status: 'refusal', provider: 'openai', model: 'test-model' },
    { status: 'unavailable', provider: 'openai', model: 'test-model' },
  ] as const)('does not persist a $status result', async (result) => {
    await expect(service.record(result)).resolves.toBeNull();
    expect(create).not.toHaveBeenCalled();
  });

  it.each([
    success({
      ...aliasProposal(),
      confidence: PRODUCT_RESOLUTION_MIN_CONFIDENCE - 0.01,
    }),
    success({
      ...aliasProposal(),
      extra: 'secret',
    } as ProductResolutionProposal),
    { ...success(aliasProposal()), provider: ' ' },
    { ...success(aliasProposal()), model: ' ' },
  ])('does not persist malformed or unsafe output: %j', async (result) => {
    await expect(service.record(result)).resolves.toBeNull();
    expect(create).not.toHaveBeenCalled();
  });

  it('surfaces persistence failure for the orchestrator to isolate', async () => {
    create.mockRejectedValue(new Error('database failed'));

    await expect(service.record(success(aliasProposal()))).rejects.toThrow(
      'database failed',
    );
  });
});

function createProposal(): ProductResolutionProposal {
  return {
    recommendation: 'create_product',
    newProduct: {
      canonicalName: '3% Milk',
      aliases: ['Three Percent Milk'],
      category: 'dairy',
      typicalUnit: 'carton',
      productType: ProductType.fast_consumable,
      isPerishable: true,
    },
    confidence: 0.9,
    reason: 'Distinct product',
  };
}

function aliasProposal(): ProductResolutionProposal {
  return {
    recommendation: 'add_alias',
    targetProductId: 'product-a',
    alias: 'Whole Milk',
    confidence: 0.8,
    reason: 'Same product',
  };
}

function choiceProposal(): ProductResolutionProposal {
  return {
    recommendation: 'ask_user_to_choose',
    candidateProductIds: ['product-a', 'product-b'],
    confidence: 0.7,
    reason: 'Ambiguous',
  };
}

function success(
  value: ProductResolutionProposal,
): LlmGenerationResult<ProductResolutionProposal> {
  return {
    status: 'success',
    provider: ' openai ',
    model: ' test-model ',
    value,
  };
}
