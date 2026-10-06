import { ShelfLifePolicyLog } from './shelf-life-policy-log.service';
import type { ShelfLifePolicyResult } from './shelf-life-policy';
import type { PolicyWriteOutcome } from './shelf-life-policy-writer.service';

const result: ShelfLifePolicyResult = {
  status: 'resolved',
  value: {
    kind: 'finite',
    shelfLifeDays: 21,
    confidence: 0.95,
    rationale: 'Private product text never logged',
  },
  provider: 'typesafe',
  model: 'jev-1.0.0',
  taskVersion: 'jev-shelf-life-policy-v1',
  policyId: 'raw-shell-eggs-refrigerated',
  registryVersion: 'shelf-life-policies-v1',
  attempts: [
    {
      operationId: 'op',
      fields: ['shelfLifePolicy'],
      task: 'shelf_life_policy',
      taskVersion: 'jev-shelf-life-policy-v1',
      vocabularyVersion: 'shelf-life-policies-v1',
      provider: 'typesafe',
      resolvedModel: 'jev-1.0.0',
      status: 'accepted',
      routingReason: 'supported_choice',
      elapsedMs: 1,
      confidence: 0.95,
      usage: { input_tokens: 3, output_tokens: 1 },
    },
  ],
};
describe('ShelfLifePolicyLog', () => {
  const create = jest.fn();
  const log = new ShelfLifePolicyLog({ llmInferenceLog: { create } } as never);
  beforeEach(() => {
    create.mockReset();
    create.mockResolvedValue({});
  });
  it.each(['applied', 'stale', 'reused', 'unresolved'] as PolicyWriteOutcome[])(
    'distinguishes selected policy from %s persistence',
    async (outcome) => {
      await log.record(result, outcome);
      expect(captured(create).data.structuredResponse).toMatchObject({
        version: 'shelf-life-policy-log-v1',
        registryVersion: 'shelf-life-policies-v1',
        policyId: 'raw-shell-eggs-refrigerated',
        writeOutcome: outcome,
        applied: outcome === 'applied',
        modelVersionResolved: true,
      });
      expect(JSON.stringify(create.mock.calls)).not.toContain(
        'Private product',
      );
    },
  );
  it('records unavailable attempts without inventing resolved model or usage', async () => {
    await log.record(
      {
        ...result,
        attempts: [
          {
            operationId: 'op',
            fields: ['shelfLifePolicy'],
            task: 'shelf_life_policy',
            taskVersion: 'jev-shelf-life-policy-v1',
            provider: 'typesafe',
            status: 'unavailable',
            routingReason: 'provider_unavailable',
            unavailableReason: 'network_error',
            elapsedMs: 2,
          },
        ],
      },
      'unresolved',
    );
    expect(captured(create).data).toMatchObject({
      modelVersion: 'unresolved',
      structuredResponse: { modelVersionResolved: false },
    });
    expect(captured(create).data.structuredResponse.attempt).not.toHaveProperty(
      'usage',
    );
  });
  it('records rejected generation and marks OpenAI model identity as configured', async () => {
    const attempt = {
      ...result.attempts[0],
      provider: 'openai' as const,
      configuredModel: 'test-model',
      resolvedModel: 'test-model',
      status: 'rejected' as const,
      routingReason: 'schema_rejected' as const,
      taskVersion: 'shelf-life-policy-generation-v2',
    };
    delete attempt.usage;
    await log.record({ ...result, attempts: [attempt] }, 'unresolved');
    expect(captured(create).data.structuredResponse).toMatchObject({
      modelVersionResolved: false,
      attempt: { status: 'rejected', provider: 'openai' },
    });
  });
  it('ignores malformed provenance and cannot block writes on logging failure', async () => {
    await log.record(
      { ...result, attempts: [{ ...result.attempts[0], elapsedMs: -1 }] },
      'applied',
    );
    expect(create).not.toHaveBeenCalled();
    create.mockRejectedValue(new Error('private database failure'));
    await expect(log.record(result, 'applied')).resolves.toBeUndefined();
  });
});

function captured(mock: jest.Mock): {
  data: { modelVersion: string; structuredResponse: Record<string, unknown> };
} {
  return (
    mock.mock.calls as unknown as Array<
      [
        {
          data: {
            modelVersion: string;
            structuredResponse: Record<string, unknown>;
          };
        },
      ]
    >
  )[0][0];
}
