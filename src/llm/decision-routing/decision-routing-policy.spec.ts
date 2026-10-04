import {
  decideModelRoute,
  type RoutingRequest,
} from './decision-routing-policy';
import type { DecisionField, FieldOutcome } from './decision-routing.types';

function request(
  outcome: FieldOutcome,
  field: DecisionField = 'category',
): RoutingRequest {
  return {
    task: 'product_understanding',
    enabled: true,
    generationAttempts: 0,
    fields: [{ field, required: true, outcome }],
  };
}

describe('decideModelRoute', () => {
  it.each(['supplied', 'deterministic', 'jev', 'openai'] as const)(
    'does not regenerate a value resolved by %s',
    (source) => {
      expect(decideModelRoute(request({ status: 'resolved', source }))).toEqual(
        { route: 'none', reason: 'already_resolved', fields: [] },
      );
    },
  );

  it('routes supported unresolved choices to JEV before generation', () => {
    const input = request({ status: 'needs_choice' });
    input.fields.push({
      field: 'typicalUnit',
      required: true,
      outcome: { status: 'unsupported', generationApplicable: true },
    });
    expect(decideModelRoute(input)).toEqual({
      route: 'jev',
      reason: 'supported_choice',
      fields: ['category'],
    });
    input.fields[0].outcome = { status: 'resolved', source: 'jev' };
    expect(decideModelRoute(input)).toEqual({
      route: 'openai_generation',
      reason: 'unsupported_required_generation',
      fields: ['typicalUnit'],
    });
  });

  it.each([
    'unknown',
    'low_confidence',
    'ambiguous',
    'schema_rejected',
  ] as const)('preserves %s without treating it as unsupported', (reason) => {
    expect(decideModelRoute(request({ status: 'uncertain', reason }))).toEqual({
      route: 'unresolved',
      reason,
      fields: ['category'],
    });
  });

  it('does not escalate provider failure', () => {
    expect(decideModelRoute(request({ status: 'unavailable' }))).toEqual({
      route: 'unresolved',
      reason: 'provider_unavailable',
      fields: ['category'],
    });
  });

  it.each(['category', 'typicalUnit'] as const)(
    'permits required unsupported %s generation',
    (field) => {
      expect(
        decideModelRoute(
          request(
            {
              status: 'unsupported',
              generationApplicable: true,
            },
            field,
          ),
        ),
      ).toEqual({
        route: 'openai_generation',
        reason: 'unsupported_required_generation',
        fields: [field],
      });
    },
  );

  it.each(['canonicalName', 'aliases', 'productType', 'isPerishable'] as const)(
    'never permits generation of %s even when marked applicable',
    (field) => {
      expect(
        decideModelRoute(
          request(
            {
              status: 'unsupported',
              generationApplicable: true,
            },
            field,
          ),
        ),
      ).toEqual({
        route: 'unresolved',
        reason: 'generation_not_supported',
        fields: [field],
      });
    },
  );

  it('requires explicit generation applicability', () => {
    expect(
      decideModelRoute(
        request({
          status: 'unsupported',
          generationApplicable: false,
        }),
      ),
    ).toMatchObject({
      route: 'unresolved',
      reason: 'generation_not_supported',
    });
  });

  it.each([1, 2, Number.MAX_SAFE_INTEGER])(
    'does not permit another generation after %s attempts',
    (generationAttempts) => {
      const input = request({
        status: 'unsupported',
        generationApplicable: true,
      });
      input.generationAttempts = generationAttempts;
      expect(decideModelRoute(input)).toEqual({
        route: 'unresolved',
        reason: 'generation_budget_exhausted',
        fields: ['category'],
      });
    },
  );

  it('allows choice routing when the generation budget is spent', () => {
    const input = request({ status: 'needs_choice' });
    input.generationAttempts = 1;
    expect(decideModelRoute(input)).toMatchObject({ route: 'jev' });
  });

  it.each([
    { status: 'needs_choice' },
    { status: 'unsupported', generationApplicable: true },
    { status: 'uncertain', reason: 'unknown' },
    { status: 'unavailable' },
  ] satisfies FieldOutcome[])(
    'skips optional missing $status fields',
    (outcome) => {
      const input = request(outcome);
      input.fields[0].required = false;
      expect(decideModelRoute(input)).toEqual({
        route: 'none',
        reason: 'optional_missing',
        fields: [],
      });
    },
  );

  it('does not select a model for a disabled unresolved task', () => {
    const input = request({ status: 'needs_choice' });
    input.enabled = false;
    expect(decideModelRoute(input)).toEqual({
      route: 'unresolved',
      reason: 'task_disabled',
      fields: ['category'],
    });
  });

  it.each([
    ['product_resolution', 'productMatch', false],
    ['stock_prediction', 'stockState', false],
    ['shelf_life_policy', 'shelfLifePolicy', true],
  ] as const)('enforces %s capabilities', (task, field, generationAllowed) => {
    const input: RoutingRequest = {
      ...request({ status: 'needs_choice' }),
      task,
      fields: [{ field, required: true, outcome: { status: 'needs_choice' } }],
    };
    expect(decideModelRoute(input)).toMatchObject({
      route: 'jev',
      fields: [field],
    });
    input.fields[0].outcome = {
      status: 'unsupported',
      generationApplicable: true,
    };
    expect(decideModelRoute(input).route).toBe(
      generationAllowed ? 'openai_generation' : 'unresolved',
    );
  });

  it('does not ask JEV to invent a canonical name or aliases', () => {
    for (const field of ['canonicalName', 'aliases'] as const) {
      expect(
        decideModelRoute(request({ status: 'needs_choice' }, field)),
      ).toMatchObject({ route: 'unresolved', reason: 'choice_not_supported' });
    }
  });

  it('handles an operation with no requested fields', () => {
    expect(
      decideModelRoute({ ...request({ status: 'needs_choice' }), fields: [] }),
    ).toEqual({ route: 'none', reason: 'already_resolved', fields: [] });
  });

  it('does not mutate the caller outcomes or allow the result to mutate input fields', () => {
    const input = request({ status: 'needs_choice' });
    const snapshot = structuredClone(input);
    const result = decideModelRoute(input);
    result.fields.push('typicalUnit');
    expect(input).toEqual(snapshot);
  });

  it.each([
    null,
    {},
    { ...request({ status: 'needs_choice' }), task: 'unknown' },
    { ...request({ status: 'needs_choice' }), enabled: 'true' },
    ...[-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1].map(
      (generationAttempts) => ({
        ...request({ status: 'needs_choice' }),
        generationAttempts,
      }),
    ),
    { ...request({ status: 'needs_choice' }), task: 'stock_prediction' },
    {
      ...request({ status: 'needs_choice' }),
      fields: [
        ...request({ status: 'needs_choice' }).fields,
        ...request({ status: 'needs_choice' }).fields,
      ],
    },
    {
      ...request({ status: 'needs_choice' }),
      fields: [
        {
          field: 'category',
          required: true,
          outcome: { status: 'unsupported' },
        },
      ],
    },
    {
      ...request({ status: 'needs_choice' }),
      fields: [
        {
          field: 'category',
          required: true,
          outcome: {
            status: 'resolved',
            source: 'untrusted',
            rawResponse: 'unexpected',
          },
        },
      ],
    },
  ])('fails closed for malformed routing input %#', (input) => {
    expect(decideModelRoute(input as RoutingRequest)).toEqual({
      route: 'unresolved',
      reason: 'invalid_input',
      fields: [],
    });
  });
});
