import { JevDecisionClient } from '../../llm/typesafe/jev-decision.client';
import type {
  JevChoiceRequest,
  JevDecisionResult,
} from '../../llm/typesafe/jev-decision.types';
import { JevProductUnderstanding } from '../../product/jev-product-understanding.service';
import type { ProductUnderstandingInput } from '../../product/product-understanding';
import type { RequestCapture } from './perishability-request-capture';

// Reapply the shipped acceptance policy without rewriting historical requests.
export async function replayPerishability(
  input: ProductUnderstandingInput,
  transport: Extract<
    RequestCapture['call'],
    { provider: 'typesafe' }
  >['transport'],
) {
  const client = new JevDecisionClient({
    jevModel: transport.status === 'success' ? transport.model : 'jev-1.13.0',
  });
  client.choose = (request): Promise<JevDecisionResult> =>
    Promise.resolve({
      ...(request.questionKey === 'isPerishable'
        ? transport
        : {
            status: 'unavailable' as const,
            reason: 'not_configured' as const,
          }),
      provider: 'typesafe',
      task: request.task,
      taskVersion: request.taskVersion,
    });
  return (await new JevProductUnderstanding(client).understand(input)).fields
    .isPerishable;
}

export async function productionPerishabilityRequest(
  input: ProductUnderstandingInput,
  model: string,
) {
  const client = new JevDecisionClient({ jevModel: model });
  let captured: JevChoiceRequest | undefined;
  client.choose = (request): Promise<JevDecisionResult> => {
    if (request.questionKey === 'isPerishable') captured = request;
    return Promise.resolve({
      status: 'unavailable',
      reason: 'not_configured',
      provider: 'typesafe',
      task: request.task,
      taskVersion: request.taskVersion,
    });
  };
  await new JevProductUnderstanding(client).understand(input);
  if (!captured) throw new Error('No production perishability request');
  return captured;
}
