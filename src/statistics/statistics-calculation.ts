import { InventoryEventType } from '../generated/prisma/enums';
import { MS_PER_DAY } from '../common/constants';

const MAX_EVENTS_FOR_CALCULATION = 20;

const PURCHASE_EVENT_TYPES: InventoryEventType[] = [
  InventoryEventType.PURCHASED,
  InventoryEventType.RESTOCKED,
];

const NEED_EVENT_TYPES: InventoryEventType[] = [
  InventoryEventType.STOCK_LOW,
  InventoryEventType.STOCK_OUT,
  InventoryEventType.GROCERY_ADDED,
];

export interface StatisticsEvent {
  eventType: InventoryEventType;
  timestamp: Date;
  quantity?: number | null;
}
export function calculateStatistics(
  events: StatisticsEvent[],
  householdSize: number,
) {
  let lastPurchaseAt: Date | null = null;
  let lastLowStockSignalAt: Date | null = null;
  let lastStockConfirmationAt: Date | null = null;

  for (const event of events) {
    if (PURCHASE_EVENT_TYPES.includes(event.eventType) && !lastPurchaseAt) {
      lastPurchaseAt = event.timestamp;
    }
    if (NEED_EVENT_TYPES.includes(event.eventType) && !lastLowStockSignalAt) {
      lastLowStockSignalAt = event.timestamp;
    }
    if (
      event.eventType === InventoryEventType.STOCK_CONFIRMED &&
      !lastStockConfirmationAt
    ) {
      lastStockConfirmationAt = event.timestamp;
    }
  }

  const avgPurchaseIntervalDays = calculatePurchaseInterval(events);
  const avgNeedIntervalDays = calculateNeedInterval(events);
  const typicalPurchaseQuantity = calculateTypicalPurchaseQuantity(events);

  const estimatedConsumptionIntervalDays = estimateConsumptionInterval(
    avgPurchaseIntervalDays,
    typicalPurchaseQuantity,
    householdSize,
  );

  const relevantEventTypes = new Set([
    ...PURCHASE_EVENT_TYPES,
    ...NEED_EVENT_TYPES,
    InventoryEventType.STOCK_CONFIRMED,
  ]);
  const observationCount = events.filter((e) =>
    relevantEventTypes.has(e.eventType),
  ).length;

  return {
    avgPurchaseIntervalDays,
    avgNeedIntervalDays,
    typicalPurchaseQuantity,
    estimatedConsumptionIntervalDays,
    lastPurchaseAt,
    lastLowStockSignalAt,
    lastStockConfirmationAt,
    observationCount,
  };
}

export function calculatePurchaseInterval(
  events: Array<{ eventType: InventoryEventType; timestamp: Date }>,
): number | null {
  const purchaseEvents = events
    .filter((e) => PURCHASE_EVENT_TYPES.includes(e.eventType))
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    .slice(0, MAX_EVENTS_FOR_CALCULATION);

  if (purchaseEvents.length < 2) {
    return null;
  }

  const intervals: number[] = [];
  for (let i = 0; i < purchaseEvents.length - 1; i++) {
    const daysBetween =
      (purchaseEvents[i].timestamp.getTime() -
        purchaseEvents[i + 1].timestamp.getTime()) /
      MS_PER_DAY;
    intervals.push(daysBetween);
  }

  const sum = intervals.reduce((acc, val) => acc + val, 0);
  return sum / intervals.length;
}

export function calculateNeedInterval(
  events: Array<{ eventType: InventoryEventType; timestamp: Date }>,
): number | null {
  const needEvents = events
    .filter((e) => NEED_EVENT_TYPES.includes(e.eventType))
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    .slice(0, MAX_EVENTS_FOR_CALCULATION);

  if (needEvents.length < 2) {
    return null;
  }

  const intervals: number[] = [];
  for (let i = 0; i < needEvents.length - 1; i++) {
    const daysBetween =
      (needEvents[i].timestamp.getTime() -
        needEvents[i + 1].timestamp.getTime()) /
      MS_PER_DAY;
    intervals.push(daysBetween);
  }

  const sum = intervals.reduce((acc, val) => acc + val, 0);
  return sum / intervals.length;
}

export function calculateTypicalPurchaseQuantity(
  events: Array<{ eventType: InventoryEventType; quantity?: number | null }>,
): number | null {
  const purchaseEvents = events.filter(
    (e) =>
      PURCHASE_EVENT_TYPES.includes(e.eventType) &&
      e.quantity != null &&
      e.quantity > 0,
  );

  if (purchaseEvents.length === 0) {
    return null;
  }

  const quantities = purchaseEvents
    .map((e) => e.quantity as number)
    .sort((a, b) => a - b);

  const mid = Math.floor(quantities.length / 2);
  return quantities.length % 2 !== 0
    ? quantities[mid]
    : (quantities[mid - 1] + quantities[mid]) / 2;
}

export function estimateConsumptionInterval(
  avgPurchaseIntervalDays: number | null,
  typicalPurchaseQuantity: number | null,
  householdSize: number,
): number | null {
  if (
    avgPurchaseIntervalDays === null ||
    typicalPurchaseQuantity === null ||
    householdSize <= 0
  ) {
    return null;
  }

  return (avgPurchaseIntervalDays * typicalPurchaseQuantity) / householdSize;
}
