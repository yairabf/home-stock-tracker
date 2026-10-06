import { stockDataset } from './fixture';
import {
  parseWorkflowDataset,
  WORKFLOW_REPLAY_VERSION,
} from './workflow-dataset';
export function workflowFixture() {
  const history = stockDataset();
  history.cases[0].events = [
    {
      id: 'recorded-event',
      eventType: 'PURCHASED',
      occurredAt: '2026-01-01T00:00:00Z',
      knownAt: '2026-01-01T00:00:00Z',
      quantity: null,
      unit: 'unit',
    },
  ];
  return parseWorkflowDataset({
    schemaVersion: 1,
    version: 'workflow-authored-v1',
    workflowVersion: WORKFLOW_REPLAY_VERSION,
    frozenAt: '2026-01-11T00:00:00Z',
    history,
    snapshots: [
      {
        caseId: history.cases[0].id,
        knownAt: '2026-01-01T00:00:00Z',
        unit: 'unit',
        recordedEventId: 'recorded-event',
        recordedAt: '2026-01-01T00:00:00Z',
        previousEvaluatedAt: '2026-01-01T00:00:00Z',
        recordedQuantity: null,
        estimatedQuantity: null,
        revision: 0,
        confidenceThreshold: 0.5,
        pendingGrocery: false,
        policy: {
          kind: 'nonperishable',
          shelfLifeDays: null,
          confidence: 1,
          rationale: 'Authored nonfood fixture',
        },
      },
    ],
  });
}

export function workflowSafetyDataset() {
  const base = workflowFixture();
  const scenarios = [
    'accepted_low',
    'pending_grocery',
    'high_threshold',
    'uncertain_advice',
    'provider_failure',
    'explicit_out',
    'expired',
    'zero_history',
  ];
  const cases = scenarios.map((scenario, i) => {
    const c = structuredClone(base.history.cases[0]);
    c.id = `workflow-${scenario}`;
    c.productGroupId = `workflow-group-${i}`;
    c.episodeId = `workflow-episode-${i}`;
    c.tags = [scenario];
    c.product.productType = null;
    c.product.isPerishable = null;
    c.events.unshift({
      id: 'older-purchase',
      eventType: 'PURCHASED',
      occurredAt: '2025-12-22T00:00:00Z',
      knownAt: '2025-12-22T00:00:00Z',
      quantity: null,
      unit: 'unit',
    });
    c.events.push({
      id: 'future-purchase',
      eventType: 'PURCHASED',
      occurredAt: '2026-01-12T00:00:00Z',
      knownAt: '2026-01-12T00:00:00Z',
      quantity: 5,
      unit: 'unit',
    });
    if (scenario === 'explicit_out')
      c.events.push({
        id: 'explicit-signal',
        eventType: 'STOCK_OUT',
        occurredAt: c.asOf,
        knownAt: c.asOf,
        quantity: null,
        unit: null,
      });
    if (scenario === 'zero_history')
      for (const e of c.events)
        if (e.id !== 'future-purchase') e.eventType = 'GROCERY_ADDED';
    const out = ['explicit_out', 'expired'].includes(scenario);
    c.confirmations = [
      {
        evidenceReference: `authored-confirmation-${i}`,
        confirmedAt: '2026-01-10T01:00:00Z',
        state: out ? 'out' : 'low',
        sourceType: out ? 'STOCK_OUT' : 'STOCK_LOW',
      },
    ];
    return c;
  });
  const snapshots = cases.map((c) => ({
    ...base.snapshots[0],
    caseId: c.id,
    pendingGrocery: c.tags.includes('pending_grocery'),
    confidenceThreshold: c.tags.includes('high_threshold') ? 0.9 : 0.5,
    policy: c.tags.includes('expired')
      ? {
          kind: 'finite' as const,
          shelfLifeDays: 1,
          confidence: 1,
          rationale: 'Authored expiration fixture',
        }
      : base.snapshots[0].policy,
  }));
  return parseWorkflowDataset({
    ...base,
    version: 'workflow-safety-v1',
    history: { ...base.history, version: 'workflow-safety-history-v1', cases },
    snapshots,
  });
}
