import { Test } from '@nestjs/testing';
import { PredictedState, ProductType } from '../generated/prisma/enums';
import { LLM_PROVIDER, type LlmProvider } from '../llm/llm-provider';
import { PredictionReasoner } from './prediction-reasoner.service';
import type { DeterministicPredictionCandidate } from './types/prediction-result';

const candidate: DeterministicPredictionCandidate = {
  predictedState: PredictedState.uncertain,
  confidenceScore: 0.5,
  reason: 'Insufficient evidence',
  authoritative: false,
  signals: {
    lastPurchaseAt: new Date('2026-08-20T10:00:00.000Z'),
    lastLowStockSignalAt: null,
    lastStockConfirmationAt: null,
    daysSinceLastPurchase: 7,
    daysSinceLastLowSignal: null,
    productType: ProductType.fast_consumable,
    eventCount: 2,
    coldStart: true,
    hasLearnedStatistics: false,
    avgPurchaseIntervalDays: null,
    avgNeedIntervalDays: null,
    estimatedConsumptionIntervalDays: null,
    observationCount: 0,
    isPerishable: true,
    predictionStrategy: null,
    householdContext: null,
    authoritativeDirectSignal: false,
  },
};

describe('PredictionReasoner', () => {
  let reasoner: PredictionReasoner;
  let provider: jest.Mocked<LlmProvider>;

  beforeEach(async () => {
    provider = {
      name: 'test-provider',
      generateStructured: jest.fn(),
    };
    const module = await Test.createTestingModule({
      providers: [
        PredictionReasoner,
        { provide: LLM_PROVIDER, useValue: provider },
      ],
    }).compile();
    reasoner = module.get(PredictionReasoner);
  });

  it('sends only the bounded structured candidate', async () => {
    provider.generateStructured.mockResolvedValue({
      status: 'unavailable',
      provider: 'test-provider',
      model: 'test-model',
    });

    await reasoner.reason(candidate);

    expect(provider.generateStructured).toHaveBeenCalledWith(
      expect.objectContaining({
        task: 'inventory-prediction-reasoning',
        input: expect.objectContaining({
          deterministicCandidate: expect.any(Object),
          signals: expect.not.objectContaining({
            productId: expect.anything(),
            eventId: expect.anything(),
          }),
        }),
      }),
    );
  });

  it('translates invalid successful output to unavailable', async () => {
    provider.generateStructured.mockResolvedValue({
      status: 'success',
      provider: 'test-provider',
      model: 'test-model',
      value: {
        predictedState: PredictedState.probably_low,
        confidence: 2,
        reason: '',
        recommendedAction: null,
      },
    });

    await expect(reasoner.reason(candidate)).resolves.toEqual({
      status: 'unavailable',
      provider: 'test-provider',
      model: 'test-model',
    });
  });
});
