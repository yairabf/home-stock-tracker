import { JevDecisionClient } from '../llm/typesafe/jev-decision.client';
import type { JevDecisionSuccess } from '../llm/typesafe/jev-decision.types';
import {
  JevProductResolutionAdvisor,
  JEV_PRODUCT_RESOLUTION_VERSION,
} from './jev-product-resolution-advisor.service';
import type { ProductResolutionContext } from './types/product-resolution';

function context(count = 2): ProductResolutionContext {
  return {
    requestedPhrase: ' חלב MILK ',
    candidates: Array.from({ length: count }, (_, index) => ({
      id: ['ambiguous', 'no_match'][index] ?? `candidate_${index}`,
      canonicalName: `Milk ${index}`,
      aliases: [],
      category: 'dairy',
      typicalUnit: 'liter',
      productType: null,
      isPerishable: true,
    })),
  };
}

function decision(
  choice = 'candidate_0',
  confidence = 0.9,
): JevDecisionSuccess {
  return {
    status: 'success',
    provider: 'typesafe',
    task: 'product_resolution',
    taskVersion: JEV_PRODUCT_RESOLUTION_VERSION,
    model: 'jev-1.14.0',
    choice,
    confidence,
    probabilities: {
      candidate_0: 0.9,
      candidate_1: 0.05,
      ambiguous: 0.03,
      no_match: 0.02,
    },
    usage: { input_tokens: 10, output_tokens: 5 },
  };
}

describe('JevProductResolutionAdvisor', () => {
  let choose: jest.MockedFunction<JevDecisionClient['choose']>;
  let advisor: JevProductResolutionAdvisor;
  beforeEach(() => {
    choose = jest.fn().mockResolvedValue(decision());
    advisor = new JevProductResolutionAdvisor({
      choose,
    } as unknown as JevDecisionClient);
  });

  it('maps a collision-safe token to known advisory alias with resolved provenance', async () => {
    const result = await advisor.advise(context());
    expect(result).toEqual({
      status: 'success',
      provider: 'typesafe',
      model: 'jev-1.14.0',
      taskVersion: JEV_PRODUCT_RESOLUTION_VERSION,
      value: {
        recommendation: 'add_alias',
        targetProductId: 'ambiguous',
        alias: 'חלב milk',
        confidence: 0.9,
        reason:
          'Requested phrase matches catalog product: Milk 0. Confirm before adding the alias.',
      },
    });
    const request = choose.mock.calls[0][0];
    expect(request).toMatchObject({
      task: 'product_resolution',
      taskVersion: JEV_PRODUCT_RESOLUTION_VERSION,
      questionKey: 'product_match',
      state: { requestedPhrase: 'חלב milk' },
    });
    expect(Object.keys(request.criteria)).toEqual([
      'candidate_0',
      'candidate_1',
      'ambiguous',
      'no_match',
    ]);
    expect(
      (request.state.candidates as Array<{ token: string }>).map(
        ({ token }: { token: string }) => token,
      ),
    ).toEqual(['candidate_0', 'candidate_1']);
    expect(
      (request.state.candidates as Array<{ token: string }>)[0],
    ).not.toHaveProperty('id');
  });

  it.each([1, 2, 20])(
    'maps the last of %i candidates without reordering',
    async (count) => {
      choose.mockResolvedValue(decision(`candidate_${count - 1}`));
      const input = context(count);
      await expect(advisor.advise(input)).resolves.toMatchObject({
        value: { targetProductId: input.candidates[count - 1].id },
      });
    },
  );

  it('maps high-confidence ambiguity to all candidates in search order', async () => {
    choose.mockResolvedValue(decision('ambiguous'));
    await expect(advisor.advise(context())).resolves.toMatchObject({
      value: {
        recommendation: 'ask_user_to_choose',
        candidateProductIds: ['ambiguous', 'no_match'],
      },
    });
  });

  it.each(['candidate_0', 'ambiguous'])(
    'abstains below the confidence gate for %s',
    async (choice) => {
      choose.mockResolvedValue(decision(choice, 0.8999));
      await expect(advisor.advise(context())).resolves.toEqual({
        status: 'unavailable',
      });
    },
  );

  it.each(['no_match', 'unknown', 'candidate_20', '__proto__'])(
    'abstains for %s',
    async (choice) => {
      choose.mockResolvedValue(decision(choice));
      await expect(advisor.advise(context())).resolves.toEqual({
        status: 'unavailable',
      });
    },
  );

  it('abstains from ambiguity with only one candidate', async () => {
    choose.mockResolvedValue(decision('ambiguous'));
    await expect(advisor.advise(context(1))).resolves.toEqual({
      status: 'unavailable',
    });
  });

  it.each([NaN, Infinity, 1.01, -0.1])(
    'rejects malformed confidence %s at the domain boundary',
    async (confidence) => {
      choose.mockResolvedValue(decision('candidate_0', confidence));
      await expect(advisor.advise(context())).resolves.toEqual({
        status: 'unavailable',
      });
    },
  );

  it.each(['empty', 'duplicate', 'oversized', 'malformed', 'too_many'])(
    'bypasses Jev for %s context',
    async (kind) => {
      const input = context(kind === 'too_many' ? 21 : 2);
      if (kind === 'empty') input.candidates = [];
      if (kind === 'duplicate') input.candidates[1].id = input.candidates[0].id;
      if (kind === 'malformed') input.requestedPhrase = '';
      if (kind === 'oversized')
        input.candidates[0].aliases = Array.from({ length: 100 }, () =>
          'x'.repeat(200),
        );
      await expect(advisor.advise(input)).resolves.toEqual({
        status: 'unavailable',
      });
      expect(choose).not.toHaveBeenCalled();
    },
  );

  it('contains unavailable and thrown transport failures', async () => {
    choose.mockResolvedValue({
      status: 'unavailable',
      provider: 'typesafe',
      task: 'product_resolution',
      taskVersion: JEV_PRODUCT_RESOLUTION_VERSION,
      reason: 'network_error',
    });
    await expect(advisor.advise(context())).resolves.toEqual({
      status: 'unavailable',
    });
    choose.mockRejectedValue(new Error('private transport failure'));
    await expect(advisor.advise(context())).resolves.toEqual({
      status: 'unavailable',
    });
  });

  it('keeps code-built reason within the existing limit for Unicode names', async () => {
    const input = context();
    input.candidates[0].canonicalName = '🛒'.repeat(200);
    const result = await advisor.advise(input);
    expect(result.status).toBe('success');
    if (result.status === 'success')
      expect([...result.value.reason].length).toBeLessThanOrEqual(500);
  });
});
