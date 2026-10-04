import {
  calculateCandidate,
  summarizeHistory,
} from '../../estimation/candidate-calculation';
import { STOCK_HISTORY_EVENT_TYPES } from '../../estimation/candidate-calculation';
import { advisorBypassReason } from '../../estimation/hybrid-calculation';
import { serializePredictionEvidence } from '../../estimation/prediction-reasoning-input';
import { calculateStatistics } from '../../statistics/statistics-calculation';
import { hash, inputEvents, type StockCase } from './dataset';

export function reconstructCase(item: StockCase) {
  const events = inputEvents(item).map((e) => ({
    id: e.id,
    eventType: e.eventType,
    timestamp: new Date(e.occurredAt),
    quantity: e.quantity ?? undefined,
    unit: e.unit ?? undefined,
  }));
  const history = summarizeHistory(
    item.id,
    events
      .filter((e) => STOCK_HISTORY_EVENT_TYPES.includes(e.eventType))
      .slice(0, 20),
  );
  const stats = calculateStatistics(
    events,
    item.household.adultsCount + item.household.childrenCount,
  );
  const candidate = calculateCandidate(
    history,
    stats.observationCount > 0 ? stats : null,
    item.product,
    {
      adultsCount: item.household.adultsCount,
      childrenCount: item.household.childrenCount,
      childAgeGroups: [],
      predictionPreferences: null,
    },
    Date.parse(item.asOf),
  );
  const bypassReason = item.product.predictionEnabled
    ? advisorBypassReason(candidate, 'typesafe')
    : 'disabled';
  return { candidate, bypassReason };
}

export function selectedInputHash(cases: StockCase[]): string {
  return hash(
    cases.map((item) => {
      const { candidate, bypassReason } = reconstructCase(item);
      return {
        caseId: item.id,
        asOf: item.asOf,
        bypassReason,
        evidence: serializePredictionEvidence(candidate),
      };
    }),
  );
}
