import { z } from 'zod';
import { PredictedState, ProductType } from '../../generated/prisma/enums';

const nullableNonNegativeNumber = z.number().nonnegative().nullable();
const nullableDateTime = z.string().datetime().nullable();
const nonBlankString = z.string().trim().min(1);

export const predictionReasoningInputSchema = z
  .object({
    deterministicCandidate: z
      .object({
        predictedState: z.enum(PredictedState),
        confidenceScore: z.number().min(0).max(1),
        reason: nonBlankString,
        authoritative: z.boolean(),
      })
      .strict(),
    signals: z
      .object({
        lastPurchaseAt: nullableDateTime,
        lastLowStockSignalAt: nullableDateTime,
        lastStockConfirmationAt: nullableDateTime,
        daysSinceLastPurchase: nullableNonNegativeNumber,
        daysSinceLastLowSignal: nullableNonNegativeNumber,
        productType: z.enum(ProductType).nullable(),
        eventCount: z.number().int().nonnegative(),
        coldStart: z.boolean(),
        hasLearnedStatistics: z.boolean(),
        avgPurchaseIntervalDays: nullableNonNegativeNumber,
        avgNeedIntervalDays: nullableNonNegativeNumber,
        estimatedConsumptionIntervalDays: nullableNonNegativeNumber,
        observationCount: z.number().int().nonnegative(),
        isPerishable: z.boolean(),
        predictionStrategy: nonBlankString.nullable(),
        householdContext: z
          .object({
            adultsCount: z.number().int().nonnegative(),
            childrenCount: z.number().int().nonnegative(),
            childAgeGroups: z.array(nonBlankString),
            predictionPreferences: z.record(z.string(), z.unknown()).nullable(),
          })
          .strict()
          .nullable(),
        authoritativeDirectSignal: z.boolean(),
      })
      .strict(),
  })
  .strict();

export const predictionReasoningResultSchema = z
  .object({
    predictedState: z.enum(PredictedState),
    confidence: z.number().min(0).max(1),
    reason: nonBlankString,
    recommendedAction: nonBlankString.nullable(),
  })
  .strict();

export type PredictionReasoningInput = z.infer<
  typeof predictionReasoningInputSchema
>;

export type PredictionReasoningResult = z.infer<
  typeof predictionReasoningResultSchema
>;
