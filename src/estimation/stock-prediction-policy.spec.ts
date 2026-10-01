import { PredictedState } from '../generated/prisma/enums';
import {
  composeJevStockAdvice,
  hasSufficientColdStartEvidence,
} from './stock-prediction-policy';
import { stockCandidate } from './stock-prediction.fixture';
import type { EstimationResult } from './types/estimation-result';

describe('Jev stock composition', () => {
  const advice = (
    confidence = 0.9,
    predictedState: PredictedState = PredictedState.probably_low,
  ) => ({
    status: 'success' as const,
    provider: 'typesafe',
    model: 'jev-1.14.0',
    taskVersion: 'jev-stock-prediction-v1',
    value: {
      confidence,
      predictedState,
      reason: 'Ignored model explanation',
      recommendedAction: 'Ignored model action',
    },
  });
  const deterministic = (candidate = stockCandidate()): EstimationResult => ({
    productId: 'product',
    predictedState: candidate.predictedState,
    confidenceScore: candidate.confidenceScore,
    deterministicSignals: candidate.signals,
    reason: candidate.reason,
    recommendedAction: null,
    llmContributed: false,
    llmAttempt: null,
  });

  it.each([0.89999, 0.9, 1])(
    'applies the 0.9 acceptance gate to confidence %s',
    (confidence) => {
      const candidate = stockCandidate();
      const result = composeJevStockAdvice(
        candidate,
        deterministic(candidate),
        advice(confidence),
      ).result;
      expect(result.llmAttempt?.accepted).toBe(confidence >= 0.9);
      expect(result.confidenceScore).toBe(candidate.confidenceScore);
      expect(result.recommendedAction).toBeNull();
    },
  );

  it('abstains on uncertain answers without altering deterministic output', () => {
    const candidate = stockCandidate();
    candidate.predictedState = PredictedState.likely_available;
    const result = composeJevStockAdvice(
      candidate,
      deterministic(candidate),
      advice(1, PredictedState.uncertain),
    ).result;
    expect(result).toMatchObject({
      predictedState: PredictedState.likely_available,
      reason: candidate.reason,
      llmContributed: false,
      llmAttempt: { accepted: false },
    });
  });

  it.each([
    PredictedState.likely_available,
    PredictedState.probably_low,
    PredictedState.probably_out,
  ])('preserves deterministic %s and explains final state', (state) => {
    const candidate = stockCandidate();
    candidate.predictedState = state;
    const choice =
      state === PredictedState.probably_low
        ? PredictedState.probably_out
        : PredictedState.probably_low;
    const result = composeJevStockAdvice(
      candidate,
      deterministic(candidate),
      advice(0.95, choice),
    ).result;
    expect(result.predictedState).toBe(state);
    expect(result.reason).toContain(state.replace('_', ' '));
    expect(result.reason).toContain('2 valid stock events');
    expect(result.reason).toContain('10.0 days');
    expect(result.reason).not.toContain('Ignored');
  });

  it('uses min rather than confidence uplift', () => {
    const candidate = stockCandidate();
    candidate.confidenceScore = 1;
    expect(
      composeJevStockAdvice(candidate, deterministic(candidate), advice(0.95))
        .result.confidenceScore,
    ).toBe(0.95);
  });

  it.each([
    { eventCount: 1 },
    { hasLearnedStatistics: false },
    { observationCount: 1 },
    { avgPurchaseIntervalDays: null },
    { avgPurchaseIntervalDays: 0 },
    { avgPurchaseIntervalDays: -1 },
    { avgPurchaseIntervalDays: Infinity },
    { daysSinceLastPurchase: null },
    { daysSinceLastPurchase: -1 },
    { daysSinceLastPurchase: NaN },
  ])('rejects insufficient cold-start evidence %j', (changes) => {
    const candidate = stockCandidate();
    candidate.signals = { ...candidate.signals, coldStart: true, ...changes };
    expect(hasSufficientColdStartEvidence(candidate)).toBe(false);
    expect(
      composeJevStockAdvice(candidate, deterministic(candidate), advice())
        .result,
    ).toMatchObject({
      predictedState: PredictedState.uncertain,
      llmContributed: false,
      llmAttempt: { accepted: false },
    });
  });

  it('permits a cold-start decision with the required learned evidence', () => {
    const candidate = stockCandidate();
    candidate.signals.coldStart = true;
    expect(hasSufficientColdStartEvidence(candidate)).toBe(true);
    expect(
      composeJevStockAdvice(candidate, deterministic(candidate), advice())
        .result.predictedState,
    ).toBe(PredictedState.probably_low);
  });
});
