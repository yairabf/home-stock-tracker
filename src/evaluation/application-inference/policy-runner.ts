import { JevShelfLifePolicy } from '../../inventory/jev-shelf-life-policy.service';
import { RequiredShelfLifeGeneration } from '../../inventory/openai-shelf-life-policy.service';
import type { ApplicationCase } from './dataset';
import { ChoiceRecorder } from './choice-recorder';
import { GenerationRecorder } from './generation-recorder';

export async function observePolicy(
  item: Extract<ApplicationCase, { task: 'shelf_life_policy' }>,
  client: ChoiceRecorder,
  generation: GenerationRecorder,
) {
  const result = await new JevShelfLifePolicy(
    client,
    new RequiredShelfLifeGeneration(generation),
  ).infer(item.input);
  client.finish();
  generation.finish();
  const { attempts: _attempts, ...policy } = result;
  return {
    caseId: item.caseId,
    policy,
    calls: [...client.calls, ...generation.calls],
  };
}
