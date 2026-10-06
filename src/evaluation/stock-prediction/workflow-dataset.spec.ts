import { workflowFixture } from './workflow-fixture';
import { parseWorkflowDataset, workflowInputHash } from './workflow-dataset';
import { workflowMetrics, type WorkflowObservation } from './workflow-metrics';

describe('Workflow cutoff evidence and final recommendations', () => {
  it('rejects future, missing and inconsistent projection facts', () => {
    const d = workflowFixture();
    for (const patch of [
      { knownAt: '2026-01-12T00:00:00Z' },
      { recordedEventId: 'missing' },
      { previousEvaluatedAt: '2025-12-01T00:00:00Z' },
    ])
      expect(() =>
        parseWorkflowDataset({
          ...d,
          snapshots: [{ ...d.snapshots[0], ...patch }],
        }),
      ).toThrow();
    expect(() =>
      parseWorkflowDataset({
        ...d,
        snapshots: [...d.snapshots, ...d.snapshots],
      }),
    ).toThrow();
  });
  it('excludes future labels/events from the provider-input binding', () => {
    const d = workflowFixture(),
      before = workflowInputHash(d, 'held_out');
    d.history.cases[0].events.push({
      id: 'future',
      eventType: 'PURCHASED',
      occurredAt: '2026-01-12T00:00:00Z',
      knownAt: '2026-01-12T00:00:00Z',
      quantity: 5,
      unit: 'unit',
    });
    d.history.cases[0].confirmations.push({
      evidenceReference: 'truth',
      confirmedAt: '2026-01-10T01:00:00Z',
      state: 'low',
      sourceType: 'STOCK_LOW',
    });
    expect(workflowInputHash(d, 'held_out')).toBe(before);
  });
  it('scores final recommendations, distinguishes acceptance/publication and censors intervening mutations', () => {
    const d = workflowFixture();
    const c = d.history.cases[0];
    c.review.episodeComplete = true;
    c.confirmations = [
      {
        evidenceReference: 'truth',
        confirmedAt: '2026-01-10T01:00:00Z',
        state: 'low',
        sourceType: 'STOCK_LOW',
      },
    ];
    const projection = {
      state: 'uncertain' as const,
      confidence: 0.6,
      quantity: null,
      recordedQuantity: null,
      recommended: false,
      reason: 'daily_stock_uncertain',
    };
    const row: WorkflowObservation = {
      caseId: c.id,
      baseline: projection,
      final: { ...projection, state: 'probably_low', recommended: true },
      accepted: true,
      application: 'applied',
      repeatInference: false,
      calls: [],
    };
    expect(workflowMetrics([c], [row]).final.precision).toEqual({
      numerator: 1,
      denominator: 1,
      value: 1,
    });
    expect(
      workflowMetrics(
        [c],
        [{ ...row, final: { ...row.final, recommended: false } }],
      ).final.precision.value,
    ).toBeNull();
    c.events.push({
      id: 'intervening',
      eventType: 'PURCHASED',
      occurredAt: '2026-01-10T00:30:00Z',
      knownAt: '2026-01-10T00:30:00Z',
      quantity: 1,
      unit: 'unit',
    });
    expect(workflowMetrics([c], [row]).final.precision.value).toBeNull();
    expect(workflowMetrics([c], [row]).unscoredReasons).toHaveProperty(
      'intervening_mutation',
      1,
    );
    expect(
      workflowMetrics([c], [{ ...row, repeatInference: true }])
        .safetyViolations,
    ).toBe(1);
  });
});
