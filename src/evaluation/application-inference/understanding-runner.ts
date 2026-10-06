import { JevProductUnderstanding } from '../../product/jev-product-understanding.service';
import { ChoiceRecorder } from './choice-recorder';
import type { ApplicationCase } from './dataset';

export async function observeUnderstanding(
  item: Extract<ApplicationCase, { task: 'product_understanding' }>,
  client: ChoiceRecorder,
) {
  const result = await new JevProductUnderstanding(client).understand(
    item.input,
  );
  client.finish();
  return { caseId: item.caseId, fields: result.fields, calls: client.calls };
}
