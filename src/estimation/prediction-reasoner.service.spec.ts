import { Test } from '@nestjs/testing';
import { PredictedState, ProductType } from '../generated/prisma/enums';
import { LLM_PROVIDER } from '../llm/llm-provider';
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
  let provider: { name: string; generateStructured: jest.Mock };

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
      expect.objectContaining<Record<string, unknown>>({
        task: 'inventory-prediction-reasoning',
        input: expect.objectContaining<Record<string, unknown>>({
          deterministicCandidate: expect.any(Object),
          signals: expect.not.objectContaining<Record<string, unknown>>({
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

  it('retains validated OpenAI output and the adapter version', async () => {
    const value = {
      predictedState: PredictedState.probably_low,
      confidence: 0.65,
      reason: 'Check recent purchases',
      recommendedAction: 'Check the pantry',
    };
    provider.generateStructured.mockResolvedValue({
      status: 'success',
      provider: 'openai',
      model: 'resolved-model',
      value,
    });
    await expect(reasoner.reason(candidate)).resolves.toEqual({
      status: 'success',
      provider: 'openai',
      model: 'resolved-model',
      value,
      taskVersion: 'prediction-reasoning-v1',
    });
    expect(provider.generateStructured).toHaveBeenCalledWith(
      expect.objectContaining<Record<string, unknown>>({
        promptVersion: 'prediction-reasoning-v1',
        input: expect.objectContaining<Record<string, unknown>>({
          signals: expect.objectContaining<Record<string, unknown>>({
            lastPurchaseAt: '2026-08-20T10:00:00.000Z',
          }),
        }),
      }),
    );
  });

  it('does not call generation for malformed evidence', async () => {
    await expect(
      reasoner.reason({ ...candidate, confidenceScore: NaN }),
    ).rejects.toThrow();
    expect(provider.generateStructured).not.toHaveBeenCalled();
  });

  it('preserves refusal metadata', async () => {
    const refusal = {
      status: 'refusal' as const,
      provider: 'openai',
      model: 'resolved-model',
    };
    provider.generateStructured.mockResolvedValue(refusal);
    await expect(reasoner.reason(candidate)).resolves.toEqual(refusal);
  });
});
