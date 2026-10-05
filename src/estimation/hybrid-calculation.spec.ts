import {
  advisorBypassReason,
  applyHybridReasoning,
  buildDisabledResult,
} from './hybrid-calculation';
import { stockCandidate } from './stock-prediction.fixture';
import type {
  StockPredictionAdvisor,
  StockPredictionAdviceResult,
} from './stock-prediction-advisor';
import type { PredictedState } from '../generated/prisma/enums';

function advice(
  provider: StockPredictionAdvisor['provider'],
  confidence = 0.95,
  predictedState: PredictedState = 'probably_low',
): StockPredictionAdviceResult {
  return {
    status: 'success',
    provider,
    model: provider === 'typesafe' ? 'jev-1.13.0' : 'openai-model',
    taskVersion:
      provider === 'typesafe'
        ? 'jev-stock-prediction-v1'
        : 'prediction-reasoning-v1',
    value: {
      predictedState,
      confidence,
      reason: 'Advisor reason',
      recommendedAction: 'Advisor action',
    },
  };
}
function advisor(provider: StockPredictionAdvisor['provider']) {
  return {
    provider,
    reason: jest
      .fn<Promise<StockPredictionAdviceResult>, []>()
      .mockResolvedValue(advice(provider)),
  };
}

describe('shared hybrid calculation', () => {
  it.each(['openai', 'typesafe'] as const)(
    'keeps zero-history safety for %s with stale learned statistics',
    async (provider) => {
      const candidate = stockCandidate();
      candidate.signals.eventCount = 0;
      candidate.predictedState = 'probably_out';
      candidate.confidenceScore = 1;
      const port = advisor(provider);
      expect(advisorBypassReason(candidate, provider)).toBe('zero_history');
      expect(
        (await applyHybridReasoning('product', candidate, port)).result,
      ).toMatchObject({
        predictedState: 'uncertain',
        confidenceScore: 0,
        recommendedAction: null,
        llmContributed: false,
        llmAttempt: null,
      });
      expect(port.reason).not.toHaveBeenCalled();
    },
  );
  it('builds the same disabled result without invoking an advisor', () => {
    expect(buildDisabledResult('product', 'fast_consumable')).toMatchObject({
      predictedState: 'uncertain',
      confidenceScore: 0,
      llmAttempt: null,
      deterministicSignals: {
        productType: 'fast_consumable',
        eventCount: 0,
        householdContext: null,
        isPerishable: null,
      },
    });
  });
  it('bypasses authoritative candidates only for Jev below the shared confidence gate', async () => {
    const candidate = stockCandidate();
    candidate.authoritative = true;
    const jev = advisor('typesafe');
    const openai = advisor('openai');
    expect(advisorBypassReason(candidate, 'typesafe')).toBe('authoritative');
    await applyHybridReasoning('product', candidate, jev);
    await applyHybridReasoning('product', candidate, openai);
    expect(jev.reason).not.toHaveBeenCalled();
    expect(openai.reason).toHaveBeenCalledTimes(1);
  });
  it.each(['openai', 'typesafe'] as const)(
    'preserves the 0.8 non-uncertain bypass for %s',
    async (provider) => {
      const candidate = stockCandidate();
      candidate.predictedState = 'probably_low';
      candidate.confidenceScore = 0.8;
      const port = advisor(provider);
      expect(advisorBypassReason(candidate, provider)).toBe('high_confidence');
      expect(
        (await applyHybridReasoning('product', candidate, port)).result
          .predictedState,
      ).toBe('probably_low');
      expect(port.reason).not.toHaveBeenCalled();
    },
  );
  it('retains OpenAI acceptance boundaries and 70/30 confidence composition', async () => {
    const candidate = stockCandidate();
    const port = advisor('openai');
    port.reason.mockResolvedValue(advice('openai', 0.64999));
    expect(
      (await applyHybridReasoning('product', candidate, port)).result,
    ).toMatchObject({
      llmContributed: false,
      llmAttempt: { accepted: false },
      confidenceScore: 0.6,
    });
    port.reason.mockResolvedValue(advice('openai', 0.65));
    const result = (await applyHybridReasoning('product', candidate, port))
      .result;
    expect(result).toMatchObject({
      llmContributed: true,
      predictedState: 'probably_low',
      reason: 'Advisor reason',
      recommendedAction: 'Advisor action',
    });
    expect(result.confidenceScore).toBeCloseTo(0.7 * 0.6 + 0.3 * 0.65);
  });
  it('preserves non-uncertain states on OpenAI disagreement', async () => {
    const candidate = stockCandidate();
    candidate.predictedState = 'likely_available';
    expect(
      (await applyHybridReasoning('product', candidate, advisor('openai')))
        .result.predictedState,
    ).toBe('likely_available');
  });
  it.each([0.89999, 0.9])(
    'shares Jev acceptance and no-uplift composition at %s',
    async (confidence) => {
      const candidate = stockCandidate();
      const port = advisor('typesafe');
      port.reason.mockResolvedValue(advice('typesafe', confidence));
      expect(
        (await applyHybridReasoning('product', candidate, port)).result,
      ).toMatchObject({
        confidenceScore: 0.6,
        recommendedAction: null,
        llmContributed: confidence >= 0.9,
        llmAttempt: { accepted: confidence >= 0.9 },
      });
    },
  );
  it('rejects insufficient cold starts and accepts sufficient evidence', async () => {
    const candidate = stockCandidate();
    candidate.signals.coldStart = true;
    const port = advisor('typesafe');
    candidate.signals.observationCount = 1;
    expect(
      (await applyHybridReasoning('product', candidate, port)).result
        .predictedState,
    ).toBe('uncertain');
    candidate.signals.observationCount = 2;
    expect(
      (await applyHybridReasoning('product', candidate, port)).result
        .predictedState,
    ).toBe('probably_low');
  });
  it.each([
    'unavailable',
    'refusal',
    'throw',
    'invalid',
    'wrong_version',
    'wrong_provider',
  ])('retains deterministic fallback for %s', async (failure) => {
    const candidate = stockCandidate();
    const port = advisor('typesafe');
    const response = advice('typesafe');
    if (failure === 'throw')
      port.reason.mockRejectedValue(new Error('private error'));
    else if (failure === 'unavailable')
      port.reason.mockResolvedValue({ status: 'unavailable' });
    else if (failure === 'refusal')
      port.reason.mockResolvedValue({
        status: 'refusal',
        provider: 'typesafe',
        model: 'jev-1.13.0',
      });
    else if (response.status === 'success') {
      if (failure === 'invalid') response.value.confidence = NaN;
      if (failure === 'wrong_version') response.taskVersion = 'wrong';
      if (failure === 'wrong_provider') response.provider = 'openai';
      port.reason.mockResolvedValue(response);
    }
    expect(
      await applyHybridReasoning('product', candidate, port),
    ).toMatchObject({
      outcome: 'fallback',
      result: {
        predictedState: candidate.predictedState,
        confidenceScore: candidate.confidenceScore,
        reason: candidate.reason,
        llmAttempt: null,
        llmContributed: false,
      },
    });
  });
});
