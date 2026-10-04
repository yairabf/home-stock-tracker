import {
  decideModelRoute,
  type RoutingRequest,
} from './decision-routing-policy';
import type { DecisionField, FieldOutcome } from './decision-routing.types';

function request(outcome: FieldOutcome): RoutingRequest {
  return {
    task: 'product_understanding',
    enabled: true,
    generationAttempts: 0,
    fields: [
      {
        field: 'canonicalName',
        required: true,
        outcome: { status: 'resolved', source: 'supplied' },
      },
      {
        field: 'aliases',
        required: false,
        outcome: { status: 'resolved', source: 'supplied' },
      },
      {
        field: 'isPerishable',
        required: true,
        outcome: { status: 'resolved', source: 'jev' },
      },
      { field: 'category', required: true, outcome },
    ],
  };
}

function providers() {
  return {
    jev: jest
      .fn<Promise<Partial<Record<DecisionField, unknown>>>, [DecisionField[]]>()
      .mockResolvedValue({ category: 'dairy' }),
    openai: jest
      .fn<Promise<Partial<Record<DecisionField, unknown>>>, [DecisionField[]]>()
      .mockResolvedValue({ category: 'unsupported category' }),
  };
}

// This harness exercises the policy's dispatch contract, not application adapters.
async function dispatch(
  input: RoutingRequest,
  stubs: ReturnType<typeof providers>,
) {
  const plan = decideModelRoute(input);
  if (plan.route === 'jev') return stubs.jev(plan.fields);
  if (plan.route === 'openai_generation') return stubs.openai(plan.fields);
  return null;
}

describe('decision-routing callback contract', () => {
  it('uses JEV for supported choices and does not call OpenAI after an accepted answer', async () => {
    const input = request({ status: 'needs_choice' });
    const stubs = providers();
    expect(await dispatch(input, stubs)).toEqual({ category: 'dairy' });
    input.fields[3].outcome = { status: 'resolved', source: 'jev' };
    expect(await dispatch(input, stubs)).toBeNull();
    expect(stubs.jev).toHaveBeenCalledTimes(1);
    expect(stubs.jev).toHaveBeenCalledWith(['category']);
    expect(stubs.openai).not.toHaveBeenCalled();
  });

  it('generates only unsupported required fields once and preserves supplied/accepted fields', async () => {
    const input = request({
      status: 'unsupported',
      generationApplicable: true,
    });
    const snapshot = JSON.stringify(input);
    const stubs = providers();
    expect(await dispatch(input, stubs)).toEqual({
      category: 'unsupported category',
    });
    expect(JSON.stringify(input)).toBe(snapshot);
    expect(stubs.openai).toHaveBeenCalledWith(['category']);
    expect(stubs.jev).not.toHaveBeenCalled();
    input.generationAttempts = 1;
    expect(await dispatch(input, stubs)).toBeNull();
    expect(stubs.openai).toHaveBeenCalledTimes(1);
  });

  it.each([
    { status: 'uncertain', reason: 'unknown' },
    { status: 'uncertain', reason: 'low_confidence' },
    { status: 'uncertain', reason: 'ambiguous' },
    { status: 'uncertain', reason: 'schema_rejected' },
    { status: 'unavailable' },
  ] satisfies FieldOutcome[])(
    'does not dispatch another model for $status $reason',
    async (outcome) => {
      const stubs = providers();
      expect(await dispatch(request(outcome), stubs)).toBeNull();
      expect(stubs.jev).not.toHaveBeenCalled();
      expect(stubs.openai).not.toHaveBeenCalled();
    },
  );

  it('does not dispatch either model for entirely supplied/deterministic values', async () => {
    const input = request({ status: 'resolved', source: 'deterministic' });
    const stubs = providers();
    expect(await dispatch(input, stubs)).toBeNull();
    expect(stubs.jev).not.toHaveBeenCalled();
    expect(stubs.openai).not.toHaveBeenCalled();
  });

  it('leaves the other model unused when a selected provider callback rejects', async () => {
    const stubs = providers();
    stubs.jev.mockRejectedValueOnce(new Error('stubbed provider failure'));
    await expect(
      dispatch(request({ status: 'needs_choice' }), stubs),
    ).rejects.toThrow('stubbed provider failure');
    expect(stubs.jev).toHaveBeenCalledTimes(1);
    expect(stubs.openai).not.toHaveBeenCalled();
  });
});
