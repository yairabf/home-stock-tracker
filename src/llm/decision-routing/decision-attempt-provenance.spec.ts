import { validateDecisionAttemptProvenance } from './decision-attempt-provenance';
import type { DecisionAttemptProvenance } from './decision-routing.types';

const ATTEMPT: DecisionAttemptProvenance = {
  operationId: 'operation-1',
  fields: ['category'],
  task: 'product_understanding',
  taskVersion: 'jev-product-understanding-v1',
  vocabularyVersion: 'product-category-v1',
  routingReason: 'supported_choice',
  status: 'accepted',
  provider: 'typesafe',
  configuredModel: 'jev-1.13.0',
  resolvedModel: 'jev-1.13.0',
  elapsedMs: 12.5,
  usage: { input_tokens: 10, output_tokens: 2 },
};

describe('validateDecisionAttemptProvenance', () => {
  it.each(['accepted', 'rejected'] as const)(
    'retains validated %s provenance',
    (status) => {
      const attempt = { ...ATTEMPT, status };
      expect(validateDecisionAttemptProvenance(attempt)).toEqual(attempt);
    },
  );

  it('preserves missing failed-call usage as unknown', () => {
    const attempt = {
      operationId: 'operation-1',
      fields: ['shelfLifePolicy'],
      task: 'shelf_life_policy',
      taskVersion: 'jev-shelf-life-policy-v1',
      routingReason: 'provider_unavailable',
      status: 'unavailable',
      provider: 'typesafe',
      configuredModel: 'jev-1.13.0',
      elapsedMs: 15_000,
      unavailableReason: 'deadline_exceeded',
    };
    const result = validateDecisionAttemptProvenance(attempt);
    expect(result).toEqual(attempt);
    expect(result).not.toHaveProperty('usage');
    expect(result).not.toHaveProperty('resolvedModel');
  });

  it('allows validated OpenAI metadata without inventing usage', () => {
    const { usage, configuredModel, ...attempt } = ATTEMPT;
    void usage;
    void configuredModel;
    expect(
      validateDecisionAttemptProvenance({
        ...attempt,
        provider: 'openai',
        resolvedModel: 'configured-openai-model',
        routingReason: 'unsupported_required_generation',
      }),
    ).toMatchObject({
      provider: 'openai',
      resolvedModel: 'configured-openai-model',
    });
  });

  it('returns detached field and usage data', () => {
    const attempt = {
      ...ATTEMPT,
      fields: [...ATTEMPT.fields],
      usage: { ...ATTEMPT.usage! },
    };
    const result = validateDecisionAttemptProvenance(attempt);
    attempt.usage.input_tokens = 999;
    attempt.fields.push('aliases');
    expect(result).toEqual(ATTEMPT);
  });

  it.each([
    null,
    {},
    { ...ATTEMPT, rawResponse: 'private payload' },
    { ...ATTEMPT, apiKey: 'private credential' },
    { ...ATTEMPT, rawContext: { name: 'household item' } },
    { ...ATTEMPT, error: 'raw provider failure' },
    {
      ...ATTEMPT,
      usage: { input_tokens: 1, output_tokens: 1, secret: 'private' },
    },
    { ...ATTEMPT, task: 'unsupported' },
    { ...ATTEMPT, taskVersion: ' ' },
    { ...ATTEMPT, operationId: '' },
    { ...ATTEMPT, routingReason: 'raw arbitrary reason' },
    { ...ATTEMPT, provider: 'unsupported' },
    { ...ATTEMPT, fields: [] },
    { ...ATTEMPT, fields: ['category', 'category'] },
    { ...ATTEMPT, fields: ['stockState'] },
    { ...ATTEMPT, resolvedModel: 'jev-latest' },
    { ...ATTEMPT, resolvedModel: 'jev-1.13' },
    { ...ATTEMPT, elapsedMs: -1 },
    { ...ATTEMPT, elapsedMs: Infinity },
    { ...ATTEMPT, usage: { input_tokens: -1, output_tokens: 1 } },
    { ...ATTEMPT, usage: { input_tokens: 0.5, output_tokens: 1 } },
    {
      ...ATTEMPT,
      usage: { input_tokens: Number.MAX_SAFE_INTEGER + 1, output_tokens: 1 },
    },
    { ...ATTEMPT, status: 'unavailable', unavailableReason: 'provider_error' },
    { ...ATTEMPT, unavailableReason: 'provider_error' },
    { ...ATTEMPT, usage: undefined },
    { ...ATTEMPT, resolvedModel: undefined },
  ])('rejects malformed or unsafe provenance %#', (input) => {
    expect(validateDecisionAttemptProvenance(input)).toBeNull();
  });

  it('rejects an unavailable attempt without a safe reason', () => {
    expect(
      validateDecisionAttemptProvenance({
        operationId: 'operation-1',
        fields: ['category'],
        task: 'product_understanding',
        taskVersion: 'v1',
        routingReason: 'provider_unavailable',
        provider: 'typesafe',
        status: 'unavailable',
        elapsedMs: 0,
      }),
    ).toBeNull();
  });

  it('rejects Typesafe accepted/rejected provenance when usage is omitted', () => {
    const { usage, ...attempt } = ATTEMPT;
    void usage;
    expect(validateDecisionAttemptProvenance(attempt)).toBeNull();
  });

  it('does not invoke accessors or expose inspection errors', () => {
    const getter = jest.fn(() => {
      throw new Error('private failure');
    });
    const attempt = Object.defineProperty({ ...ATTEMPT }, 'rawResponse', {
      enumerable: true,
      get: getter,
    });
    expect(validateDecisionAttemptProvenance(attempt)).toBeNull();
    expect(getter).not.toHaveBeenCalled();
    expect(
      validateDecisionAttemptProvenance(
        new Proxy(
          {},
          {
            getPrototypeOf() {
              throw new Error('private detail');
            },
          },
        ),
      ),
    ).toBeNull();
  });

  it('accepts validated token boundaries', () => {
    expect(
      validateDecisionAttemptProvenance({
        ...ATTEMPT,
        usage: { input_tokens: 0, output_tokens: Number.MAX_SAFE_INTEGER },
      }),
    ).not.toBeNull();
  });
});
