import { calculateStatistics } from './statistics-calculation';
import type { StatisticsEvent } from './statistics-calculation';

describe('pure statistics calculation', () => {
  const purchase = (
    days: number,
    quantity: number | null,
  ): StatisticsEvent => ({
    eventType: 'PURCHASED',
    timestamp: new Date(Date.UTC(2026, 0, days)),
    quantity,
  });
  it('preserves median quantities, mean intervals and household consumption formula', () => {
    const result = calculateStatistics(
      [purchase(21, 4), purchase(11, 2), purchase(1, 6)],
      5,
    );
    expect(result).toMatchObject({
      avgPurchaseIntervalDays: 10,
      typicalPurchaseQuantity: 4,
      estimatedConsumptionIntervalDays: 8,
      observationCount: 3,
    });
  });
  it('limits interval calculations to latest 20 but keeps quantity median and observation count', () => {
    const events = Array.from({ length: 21 }, (_, i) => purchase(31 + i, 2));
    events.push(purchase(1, 0));
    expect(calculateStatistics(events, 0)).toMatchObject({
      avgPurchaseIntervalDays: 1,
      typicalPurchaseQuantity: 2,
      estimatedConsumptionIntervalDays: null,
      observationCount: 22,
    });
  });
  it('handles missing purchases, need signals, zero quantities and confirmations', () => {
    const events: StatisticsEvent[] = [
      { eventType: 'STOCK_CONFIRMED', timestamp: new Date('2026-01-10') },
      { eventType: 'STOCK_LOW', timestamp: new Date('2026-01-09') },
      { eventType: 'GROCERY_ADDED', timestamp: new Date('2026-01-01') },
      purchase(1, 0),
    ];
    expect(calculateStatistics(events, 5)).toMatchObject({
      avgPurchaseIntervalDays: null,
      avgNeedIntervalDays: 8,
      typicalPurchaseQuantity: null,
      observationCount: 4,
    });
    expect(calculateStatistics([], 5)).toMatchObject({
      observationCount: 0,
      avgPurchaseIntervalDays: null,
    });
  });
});
