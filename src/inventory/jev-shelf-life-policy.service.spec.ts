import type { JevChoiceRequest } from '../llm/typesafe/jev-decision.types';
import { JevShelfLifePolicy } from './jev-shelf-life-policy.service';
import type { ShelfLifePolicyInput } from './shelf-life-policy';

const input: ShelfLifePolicyInput = {
  productId: 'product',
  canonicalName: 'ביצים',
  category: null,
  typicalUnit: null,
  productType: null,
  isPerishable: true,
  context: {
    version: 1,
    storage: 'refrigerated',
    maxTemperatureC: 4,
    preparation: 'raw',
    form: 'shell',
  },
};
const success = {
  status: 'success',
  provider: 'typesafe',
  task: 'shelf_life_policy',
  taskVersion: 'jev-shelf-life-policy-v1',
  model: 'jev-1.0.0',
  choice: 'policy_0',
  confidence: 0.95,
  probabilities: { policy_0: 0.96, unknown: 0.04 },
  usage: { input_tokens: 10, output_tokens: 2 },
};
describe('JevShelfLifePolicy', () => {
  const choose = jest.fn();
  const generate = jest.fn();
  const choices = () =>
    choose.mock.calls as unknown as Array<[JevChoiceRequest, number]>;
  const generations = () =>
    generate.mock.calls as unknown as Array<[ShelfLifePolicyInput, number]>;
  const service = new JevShelfLifePolicy(
    {
      choose,
      model: 'jev-1.0.0',
    } as never,
    { infer: generate } as never,
  );
  beforeEach(() => {
    choose.mockReset();
    generate.mockReset();
    choose.mockResolvedValue(success);
  });
  it.each(['ביצים', 'eggs'])(
    'supplies reviewed days for %s and records safe provenance',
    async (name) => {
      const result = await service.infer({ ...input, canonicalName: name });
      expect(result).toMatchObject({
        status: 'resolved',
        provider: 'typesafe',
        policyId: 'raw-shell-eggs-refrigerated',
        value: { shelfLifeDays: 21, confidence: 0.95 },
      });
      expect(result.attempts).toEqual([
        expect.objectContaining({
          status: 'accepted',
          vocabularyVersion: 'shelf-life-policies-v1',
          usage: success.usage,
        }),
      ]);
      expect(choose).toHaveBeenCalledTimes(1);
      expect(choices()[0][1]).toBeLessThanOrEqual(10_000);
    },
  );
  it('supports only the reviewed nonperishable household goods', async () => {
    expect(
      await service.infer({
        ...input,
        canonicalName: 'toilet paper',
        productType: 'household_consumable',
        isPerishable: false,
        context: { ...input.context!, storage: 'ambient' },
      }),
    ).toMatchObject({
      status: 'resolved',
      value: { kind: 'nonperishable', shelfLifeDays: null },
    });
  });
  it.each([
    [
      {
        ...success,
        choice: 'unknown',
        probabilities: { policy_0: 0.04, unknown: 0.96 },
      },
      'unknown',
    ],
    [{ ...success, confidence: 0.89 }, 'low_confidence'],
    [
      { ...success, probabilities: { policy_0: 0.89, unknown: 0.11 } },
      'low_confidence',
    ],
    [{ ...success, choice: 'invented' }, 'schema_rejected'],
    [
      { ...success, probabilities: { policy_0: 1.5, unknown: -0.5 } },
      'schema_rejected',
    ],
    [{ ...success, taskVersion: 'wrong' }, 'schema_rejected'],
  ])('rejects unsuitable responses', async (response, reason) => {
    choose.mockResolvedValue(response);
    expect(await service.infer(input)).toMatchObject({
      status: 'unresolved',
      outcome: { reason },
    });
  });
  it('abstains without context or complete bounded request', async () => {
    expect(await service.infer({ ...input, context: null })).toMatchObject({
      status: 'unresolved',
    });
    expect(
      await service.infer({ ...input, category: 'x'.repeat(17_000) }),
    ).toMatchObject({
      status: 'unresolved',
      outcome: { reason: 'schema_rejected' },
    });
    expect(choose).not.toHaveBeenCalled();
  });
  it('isolates transport errors without generating a policy', async () => {
    choose.mockRejectedValue(new Error('private error'));
    const result = await service.infer(input);
    expect(result).toMatchObject({
      status: 'unresolved',
      outcome: { status: 'unavailable' },
      attempts: [
        expect.objectContaining({
          status: 'unavailable',
          unavailableReason: 'network_error',
        }),
      ],
    });
    expect(JSON.stringify(result)).not.toContain('private error');
    expect(generate).not.toHaveBeenCalled();
  });
  it('generates only locally established registry gaps', async () => {
    generate.mockResolvedValue({ status: 'unresolved' });
    await service.infer({
      ...input,
      canonicalName: 'salmon',
      context: { ...input.context!, form: 'whole_or_pieces' },
    });
    expect(choose).not.toHaveBeenCalled();
    expect(generate).toHaveBeenCalledTimes(1);
    expect(generations()[0][1]).toBeGreaterThan(performance.now());
  });
  it('rejects late choices and records a deadline diagnostic', async () => {
    jest.useFakeTimers();
    try {
      choose.mockImplementation(() => {
        jest.advanceTimersByTime(10_001);
        return success;
      });
      expect(await service.infer(input)).toMatchObject({
        status: 'unresolved',
        attempts: [
          expect.objectContaining({
            status: 'unavailable',
            unavailableReason: 'deadline_exceeded',
          }),
        ],
      });
      expect(generate).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });
});
