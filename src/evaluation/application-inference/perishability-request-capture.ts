import { z } from 'zod';
import type { JevChoiceRequest } from '../../llm/typesafe/jev-decision.types';
import {
  validateJevChoiceRequest,
  validateJevChoiceResponse,
} from '../../llm/typesafe/jev-decision.validation';
import { hash, hashSchema, idSchema, modelSchema } from './dataset';
import { callSchema } from './recording';
import { observationSchema } from './observations';

const requestSchema = z.custom<JevChoiceRequest>((value) => {
  const validated = validateJevChoiceRequest(value);
  if (validated.status !== 'valid') return false;
  const request = validated.value;
  return (
    Object.keys(value as object).length === 6 &&
    request.task === 'product_understanding' &&
    request.questionKey === 'isPerishable' &&
    Object.keys(request.criteria).length === 3 &&
    ['unknown', 'perishable', 'nonperishable'].every((id) =>
      Object.hasOwn(request.criteria, id),
    )
  );
});
const choiceId = z.enum(['unknown', 'perishable', 'nonperishable']);
export const requestCaptureSchema = z
  .object({
    caseId: idSchema,
    inputHash: hashSchema,
    request: requestSchema,
    orderedChoiceIds: z.array(choiceId).length(3),
    orderedRequestHash: hashSchema,
    call: callSchema,
    outcome:
      observationSchema.options[0].shape.fields.shape.isPerishable.refine(
        (outcome) =>
          outcome.status !== 'resolved' ||
          (typeof outcome.value === 'boolean' && outcome.source === 'jev'),
        'Only inferred boolean outcomes belong in a perishability capture',
      ),
  })
  .strict()
  .superRefine((row, ctx) => {
    if (
      row.call.provider !== 'typesafe' ||
      row.call.requestHash !== hash(row.request) ||
      hash(row.orderedChoiceIds) !== hash(Object.keys(row.request.criteria)) ||
      row.orderedRequestHash !== orderedRequestHash(row.request)
    )
      ctx.addIssue({ code: 'custom', message: 'Request binding mismatch' });
    if (row.call.provider === 'typesafe') {
      const transport = row.call.transport;
      if (transport.status === 'success') {
        const valid = validateJevChoiceResponse(
          {
            model: transport.model,
            answers: {
              [row.request.questionKey]: {
                type: 'choice',
                choice: transport.choice,
                probabilities: transport.probabilities,
                confidence: transport.confidence,
              },
            },
            usage: transport.usage,
          },
          row.request,
        );
        if (valid.status !== 'valid')
          ctx.addIssue({
            code: 'custom',
            message: 'Invalid recorded response',
          });
      }
    }
  });

export function orderedRequestHash(request: JevChoiceRequest): string {
  return hash({ request, orderedCriteria: Object.entries(request.criteria) });
}
export type RequestCapture = z.infer<typeof requestCaptureSchema>;
export const requestDefinitionSchema = z
  .object({
    variantId: idSchema,
    codeRevision: z.string().regex(/^[a-f0-9]{40}$/),
    adapterVersion: idSchema,
    questionVersion: idSchema,
    configuredModel: modelSchema,
    captureMode: z.enum(['reconstructed', 'captured']),
  })
  .strict();
