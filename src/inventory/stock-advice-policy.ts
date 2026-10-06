import { createHash } from 'node:crypto';
import { PredictedState } from '../generated/prisma/enums';
import type { DeterministicPredictionCandidate } from '../estimation/types/prediction-result';
import { advisorBypassReason } from '../estimation/hybrid-calculation';
import { hasSufficientColdStartEvidence } from '../estimation/stock-prediction-policy';

export interface DailyAdviceBaseline {
  productId: string;
  projectionId: string;
  revision: number;
  predictionId: string;
  evaluatedAt: Date;
  estimatedQuantity: number | null;
  estimatedState: PredictedState;
  confidence: number;
  reason: string;
}

const AUTHORITATIVE_REASONS = new Set([
  'daily_explicit_out',
  'daily_explicit_low',
  'daily_stock_expired',
  'daily_stock_depleted',
]);

export function dailyAdviceCandidate(
  baseline: DailyAdviceBaseline,
  history: DeterministicPredictionCandidate,
): DeterministicPredictionCandidate {
  return {
    ...history,
    predictedState: baseline.estimatedState,
    confidenceScore: Math.min(baseline.confidence, history.confidenceScore),
    reason: baseline.reason,
    authoritative:
      history.authoritative || AUTHORITATIVE_REASONS.has(baseline.reason),
    signals: {
      ...history.signals,
      householdContext: history.signals.householdContext
        ? {
            ...history.signals.householdContext,
            childAgeGroups: [],
            predictionPreferences: null,
          }
        : null,
    },
  };
}

export function dailyAdviceBypass(
  candidate: DeterministicPredictionCandidate,
  predictionEnabled: boolean,
): string | null {
  if (!predictionEnabled) return 'disabled';
  const bypass = advisorBypassReason(candidate, 'typesafe');
  if (bypass) return bypass;
  if (candidate.signals.coldStart && !hasSufficientColdStartEvidence(candidate))
    return 'insufficient_cold_start';
  return null;
}

export function stockAdviceFingerprint(
  baseline: DailyAdviceBaseline,
  evidence: Record<string, unknown>,
  configuredModel: string,
  taskVersion: string,
): string {
  return createHash('sha256')
    .update(
      canonicalJson({
        version: 'daily-stock-advice-v1',
        evaluatedDay: baseline.evaluatedAt.toISOString().slice(0, 10),
        baseline: {
          quantity: baseline.estimatedQuantity,
          state: baseline.estimatedState,
          confidence: baseline.confidence,
          reason: baseline.reason,
        },
        evidence,
        configuredModel,
        taskVersion,
      }),
    )
    .digest('hex');
}

function canonicalJson(value: unknown): string {
  return JSON.stringify(value, (_key: string, item: unknown) => {
    if (
      item !== null &&
      typeof item === 'object' &&
      !Array.isArray(item) &&
      !(item instanceof Date)
    )
      return Object.fromEntries(
        Object.entries(item).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
      );
    return item;
  });
}
