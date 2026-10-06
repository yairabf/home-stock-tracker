import { stockCandidate } from '../estimation/stock-prediction.fixture';
import {
  dailyAdviceCandidate,
  dailyAdviceBypass,
  stockAdviceFingerprint,
  type DailyAdviceBaseline,
} from './stock-advice-policy';

export function dailyBaseline(): DailyAdviceBaseline {
  return {
    productId: 'p',
    projectionId: 'projection',
    revision: 1,
    predictionId: 'prediction',
    evaluatedAt: new Date('2026-10-06T10:00:00Z'),
    estimatedQuantity: null,
    estimatedState: 'uncertain',
    confidence: 0.6,
    reason: 'daily_stock_uncertain',
  };
}

describe('Daily stock advice policy', () => {
  it('uses daily state and confidence while removing private context', () => {
    const history = stockCandidate();
    history.predictedState = 'probably_low';
    const candidate = dailyAdviceCandidate(dailyBaseline(), history);
    expect(candidate).toMatchObject({
      predictedState: 'uncertain',
      confidenceScore: 0.6,
      signals: {
        householdContext: { childAgeGroups: [], predictionPreferences: null },
      },
    });
    expect(dailyAdviceBypass(candidate, true)).toBeNull();
  });
  it.each([
    'daily_explicit_out',
    'daily_explicit_low',
    'daily_stock_expired',
    'daily_stock_depleted',
  ])('does not spend on %s', (reason) => {
    const candidate = dailyAdviceCandidate(
      { ...dailyBaseline(), reason },
      stockCandidate(),
    );
    expect(dailyAdviceBypass(candidate, true)).toBe('authoritative');
  });
  it('bypasses disabled, zero history, cold start and high confidence', () => {
    const c = stockCandidate();
    expect(dailyAdviceBypass(c, false)).toBe('disabled');
    c.signals.eventCount = 0;
    expect(dailyAdviceBypass(c, true)).toBe('zero_history');
    c.signals.eventCount = 1;
    c.signals.coldStart = true;
    expect(dailyAdviceBypass(c, true)).toBe('insufficient_cold_start');
    c.signals.coldStart = false;
    c.predictedState = 'likely_available';
    c.confidenceScore = 0.8;
    expect(dailyAdviceBypass(c, true)).toBe('high_confidence');
  });
  it('deduplicates same-day evidence without relying on evaluation IDs or JSON key order', () => {
    const a = stockAdviceFingerprint(
      dailyBaseline(),
      { x: 1, y: 2 },
      'jev-1.13.0',
      'v1',
    );
    expect(
      stockAdviceFingerprint(
        {
          ...dailyBaseline(),
          revision: 4,
          predictionId: 'new',
          evaluatedAt: new Date('2026-10-06T12:00:00Z'),
        },
        { y: 2, x: 1 },
        'jev-1.13.0',
        'v1',
      ),
    ).toBe(a);
    for (const baseline of [
      { ...dailyBaseline(), evaluatedAt: new Date('2026-10-07T10:00:00Z') },
      { ...dailyBaseline(), estimatedQuantity: 1 },
    ])
      expect(
        stockAdviceFingerprint(baseline, { x: 1, y: 2 }, 'jev-1.13.0', 'v1'),
      ).not.toBe(a);
    expect(
      stockAdviceFingerprint(
        dailyBaseline(),
        { x: 2, y: 2 },
        'jev-1.13.0',
        'v1',
      ),
    ).not.toBe(a);
  });
});
