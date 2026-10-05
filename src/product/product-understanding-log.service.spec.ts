import { ProductUnderstandingLogService } from './product-understanding-log.service';
import { initialUnderstanding } from './product-understanding';
import type { DecisionAttemptProvenance } from '../llm/decision-routing/decision-routing.types';
const attempt: DecisionAttemptProvenance = {
  operationId: 'operation',
  fields: ['category'],
  task: 'product_understanding',
  taskVersion: 'task-v1',
  vocabularyVersion: 'category-v1',
  provider: 'typesafe',
  configuredModel: 'jev-1.13.0',
  resolvedModel: 'jev-1.13.0',
  routingReason: 'supported_choice',
  status: 'accepted',
  elapsedMs: 10,
  usage: { input_tokens: 10, output_tokens: 2 },
};
describe('ProductUnderstandingLogService', () => {
  const create = jest.fn();
  const logs = new ProductUnderstandingLogService({
    llmInferenceLog: { create },
  } as never);
  beforeEach(() => create.mockReset());
  const result = () => ({
    ...initialUnderstanding({
      category: null,
      typicalUnit: null,
      productType: null,
      isPerishable: null,
    }),
    attempts: [attempt],
  });
  it('records validated provenance separately from stale application', async () => {
    await logs.record(result(), [], 'stale');
    expect(create).toHaveBeenCalledWith({
      data: {
        modelProvider: 'typesafe',
        modelVersion: 'jev-1.13.0',
        promptVersion: 'task-v1',
        structuredResponse: {
          version: 'product-understanding-v1',
          attempt,
          modelVersionResolved: true,
          writeOutcome: 'stale',
          appliedFields: [],
        },
      },
    });
  });
  it('records configured rather than resolved versions and omits unknown usage', async () => {
    const failed = result();
    failed.attempts = [
      {
        operationId: 'operation',
        fields: ['category'],
        task: 'product_understanding',
        taskVersion: 'task-v1',
        provider: 'typesafe',
        configuredModel: 'jev-1.13.0',
        routingReason: 'provider_unavailable',
        status: 'unavailable',
        elapsedMs: 10,
        unavailableReason: 'network_error',
      },
    ];
    await logs.record(failed, [], 'unresolved');
    const stored = (
      create.mock.calls as unknown as Array<
        [
          {
            data: {
              structuredResponse: {
                attempt: object;
                modelVersionResolved: boolean;
              };
            };
          },
        ]
      >
    )[0][0];
    expect(stored.data.structuredResponse.modelVersionResolved).toBe(false);
    expect(stored.data.structuredResponse.attempt).not.toHaveProperty('usage');
  });
  it('ignores invalid provenance and diagnostic failures', async () => {
    const malformed = result();
    malformed.attempts = [{ ...attempt, elapsedMs: -1 }];
    await logs.record(malformed, [], 'unresolved');
    expect(create).not.toHaveBeenCalled();
    create.mockRejectedValue(new Error('private persistence detail'));
    await expect(
      logs.record(result(), ['category'], 'applied'),
    ).resolves.toBeUndefined();
  });
});
