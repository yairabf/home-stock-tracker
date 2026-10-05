import { calculateCandidate, summarizeHistory } from './candidate-calculation';
import type { ProductEvent } from './types/product-event-history';
const now = Date.parse('2026-01-20T00:00:00Z');
const product = {
  productType: null,
  isPerishable: false,
  predictionStrategy: null,
};
const household = {
  adultsCount: 2,
  childrenCount: 3,
  childAgeGroups: [],
  predictionPreferences: null,
};
const event = (
  eventType: ProductEvent['eventType'],
  days: number,
): ProductEvent => ({
  id: `event-${days}`,
  eventType,
  timestamp: new Date(now - days * 86400000),
});
const calculate = (events: ProductEvent[]) =>
  calculateCandidate(
    summarizeHistory('product', events),
    null,
    product,
    household,
    now,
  );
describe('historical deterministic candidate', () => {
  it('preserves unknown perishability without changing direct stock precedence', () => {
    const result = calculateCandidate(
      summarizeHistory('product', [event('STOCK_OUT', 1)]),
      null,
      { ...product, isPerishable: null },
      household,
      now,
    );
    expect(result.signals.isPerishable).toBeNull();
    expect(result).toMatchObject({
      predictedState: 'probably_out',
      authoritative: true,
    });
  });
  it('uses an explicit clock for recent confirmation and cold starts', () => {
    expect(calculate([event('STOCK_CONFIRMED', 3)])).toMatchObject({
      predictedState: 'likely_available',
      authoritative: true,
    });
    expect(calculate([event('STOCK_CONFIRMED', 4)])).toMatchObject({
      predictedState: 'uncertain',
      authoritative: false,
    });
    expect(
      calculate([event('PURCHASED', 1), event('PURCHASED', 6)]).signals
        .coldStart,
    ).toBe(true);
    expect(
      calculate([event('PURCHASED', 1), event('PURCHASED', 7)]).signals
        .coldStart,
    ).toBe(false);
  });
  it('retains direct signal precedence and confidence calculation', () => {
    expect(
      calculate([event('STOCK_OUT', 20), event('PURCHASED', 30)]),
    ).toMatchObject({
      predictedState: 'probably_out',
      authoritative: true,
      confidenceScore: 0.5,
    });
  });
  it('uses learned interval buffers and preserves purchase before restock preference', () => {
    const history = summarizeHistory('product', [
      event('RESTOCKED', 1),
      event('PURCHASED', 10),
      event('PURCHASED', 20),
    ]);
    const candidate = calculateCandidate(
      history,
      {
        avgPurchaseIntervalDays: 10,
        avgNeedIntervalDays: null,
        estimatedConsumptionIntervalDays: null,
        observationCount: 3,
      },
      product,
      household,
      now,
    );
    expect(candidate.predictedState).toBe('uncertain');
    expect(candidate.signals.daysSinceLastPurchase).toBe(10);
    expect(candidate.signals.eventCount).toBe(3);
  });
});
