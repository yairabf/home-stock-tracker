import { ChoiceRecorder } from './choice-recorder';
import { GenerationRecorder } from './generation-recorder';
import { observePolicy } from './policy-runner';
import { safetyDataset } from './fixture';
import type { RecordedCall } from './recording';
import type { JevChoiceRequest } from '../../llm/typesafe/jev-decision.types';
import { hash } from './dataset';

function item(id = 'policy-0') {
  const c = safetyDataset().cases.find((c) => c.caseId === id)!;
  if (c.task !== 'shelf_life_policy') throw new Error('Wrong fixture');
  return c;
}
describe('Shelf-life runtime replay', () => {
  it('replays applicable policy identity through real selection and unknown handling', async () => {
    const client = new ChoiceRecorder('jev-1.13.0', undefined);
    const spy = jest
      .spyOn(client, 'choose')
      .mockImplementation(async (request: JevChoiceRequest) => {
        const transport = {
          status: 'success' as const,
          model: 'jev-1.13.0',
          choice: 'policy_0',
          confidence: 0.99,
          probabilities: { unknown: 0, policy_0: 1 },
          usage: { input_tokens: 10, output_tokens: 2 },
        };
        client.calls.push({
          provider: 'typesafe',
          requestHash: hash(request),
          elapsedMs: 10,
          transport,
        });
        return {
          ...transport,
          provider: 'typesafe',
          task: request.task,
          taskVersion: request.taskVersion,
        };
      });
    const first = await observePolicy(
      item(),
      client,
      new GenerationRecorder([]),
    );
    expect(first.policy).toMatchObject({
      status: 'resolved',
      policyId: 'raw-shell-eggs-refrigerated',
      value: { shelfLifeDays: 21 },
    });
    spy.mockRestore();
    const replay = await observePolicy(
      item(),
      new ChoiceRecorder('jev-1.13.0', first.calls),
      new GenerationRecorder([]),
    );
    expect(replay).toEqual(first);
    const unknown = first.calls.map((r) => ({
      ...r,
      transport: {
        ...r.transport,
        choice: 'unknown',
        probabilities: { unknown: 1, policy_0: 0 },
      },
    })) as RecordedCall[];
    expect(
      (
        await observePolicy(
          item(),
          new ChoiceRecorder('jev-1.13.0', unknown),
          new GenerationRecorder([]),
        )
      ).policy,
    ).toMatchObject({ status: 'unresolved', outcome: { reason: 'unknown' } });
  });
  it('abstains without storage or for contradictory local identity, with no calls', async () => {
    for (const id of ['policy-3', 'policy-7']) {
      const out = await observePolicy(
        item(id),
        new ChoiceRecorder('jev-1.13.0', []),
        new GenerationRecorder([]),
      );
      expect(out.policy.status).toBe('unresolved');
      expect(out.calls).toEqual([]);
    }
  });
  it('generates exactly once only for locally identified unsupported finite policy', async () => {
    const generate = jest.fn().mockResolvedValue({
      status: 'success',
      provider: 'openai',
      model: 'configured-openai',
      value: {
        kind: 'finite',
        shelfLifeDays: 1,
        confidence: 0.99,
        rationale: 'Authored safety example only',
      },
    });
    const out = await observePolicy(
      item('policy-5'),
      new ChoiceRecorder('jev-1.13.0', []),
      new GenerationRecorder(undefined, {
        name: 'openai',
        generateStructured: generate,
      }),
    );
    expect(generate).toHaveBeenCalledTimes(1);
    expect(out.calls).toHaveLength(1);
    expect(out.policy).toMatchObject({
      status: 'resolved',
      value: { kind: 'finite', shelfLifeDays: 1 },
    });
    const replay = await observePolicy(
      item('policy-5'),
      new ChoiceRecorder('jev-1.13.0', []),
      new GenerationRecorder(out.calls),
    );
    expect(replay).toEqual(out);
    await expect(
      observePolicy(
        item('policy-5'),
        new ChoiceRecorder('jev-1.13.0', []),
        new GenerationRecorder([]),
      ),
    ).rejects.toThrow();
  });
  it('never escalates unavailable or low-confidence bounded choices to generation', async () => {
    const client = new ChoiceRecorder('jev-1.13.0', undefined);
    jest.spyOn(client, 'choose').mockResolvedValue({
      status: 'unavailable',
      provider: 'typesafe',
      task: 'shelf_life_policy',
      taskVersion: 'fixture',
      reason: 'network_error',
    });
    const out = await observePolicy(item(), client, new GenerationRecorder([]));
    expect(out.policy.status).toBe('unresolved');
    expect(out.calls).toEqual([]);
  });
});
