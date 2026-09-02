import { PredictedState, ProductType } from '../../generated/prisma/enums';
import {
  predictionReasoningInputSchema,
  predictionReasoningResultSchema,
} from './prediction-reasoning';

const validInput = {
  deterministicCandidate: {
    predictedState: PredictedState.uncertain,
    confidenceScore: 0.6,
    reason: 'The available evidence is inconclusive',
    authoritative: false,
  },
  signals: {
    lastPurchaseAt: '2026-08-20T10:00:00.000Z',
    lastLowStockSignalAt: null,
    lastStockConfirmationAt: null,
    daysSinceLastPurchase: 7,
    daysSinceLastLowSignal: null,
    productType: ProductType.fast_consumable,
    eventCount: 3,
    coldStart: false,
    hasLearnedStatistics: true,
    avgPurchaseIntervalDays: 8,
    avgNeedIntervalDays: 7,
    estimatedConsumptionIntervalDays: 7.5,
    observationCount: 5,
    isPerishable: true,
    predictionStrategy: null,
    householdContext: {
      adultsCount: 2,
      childrenCount: 3,
      childAgeGroups: ['under_6'],
      predictionPreferences: { favorRecentSignals: true },
    },
    authoritativeDirectSignal: false,
  },
};

const validResult = {
  predictedState: PredictedState.probably_low,
  confidence: 0.75,
  reason: 'Consumption history suggests the product is running low',
  recommendedAction: 'Check the remaining stock',
};

describe('prediction reasoning contracts', () => {
  it('accepts the bounded input and output contracts', () => {
    expect(predictionReasoningInputSchema.parse(validInput)).toEqual(
      validInput,
    );
    expect(predictionReasoningResultSchema.parse(validResult)).toEqual(
      validResult,
    );
  });

  it.each([
    { ...validResult, unexpected: true },
    { ...validResult, predictedState: 'low' },
    { ...validResult, reason: '   ' },
    { ...validResult, confidence: -0.01 },
    { ...validResult, confidence: 1.01 },
  ])('rejects invalid output: %p', (result) => {
    expect(predictionReasoningResultSchema.safeParse(result).success).toBe(
      false,
    );
  });

  it('rejects unknown nested input fields', () => {
    const input = {
      ...validInput,
      signals: { ...validInput.signals, productId: 'private-id' },
    };

    expect(predictionReasoningInputSchema.safeParse(input).success).toBe(false);
  });
});
