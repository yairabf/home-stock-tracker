import { z } from 'zod';
import { fieldOutcomeSchema } from '../../llm/decision-routing/decision-routing.types';
import {
  metadataSchema,
  UNDERSTANDING_FIELDS,
} from '../../product/product-understanding';
import { shelfLifeInferenceResultSchema } from '../../inventory/types/shelf-life-inference';
import { callSchema } from './recording';
import { idSchema } from './dataset';

const resolved = z
  .object({
    status: z.literal('resolved'),
    source: z.enum(['supplied', 'deterministic', 'jev', 'openai']),
    value: z.union([z.string(), z.boolean()]),
    confidence: z.number().min(0).max(1).optional(),
  })
  .strict();
const unresolved = fieldOutcomeSchema.refine((o) => o.status !== 'resolved');
const outcome = z.union([resolved, unresolved]);
const fields = z
  .object(
    Object.fromEntries(UNDERSTANDING_FIELDS.map((f) => [f, outcome])) as Record<
      (typeof UNDERSTANDING_FIELDS)[number],
      typeof outcome
    >,
  )
  .strict()
  .superRefine((values, ctx) => {
    for (const f of UNDERSTANDING_FIELDS) {
      const value = values[f];
      if (
        value.status === 'resolved' &&
        'value' in value &&
        !metadataSchema.shape[f].safeParse(value.value).success
      )
        ctx.addIssue({ code: 'custom', message: 'Invalid accepted metadata' });
    }
  });
const policy = z.discriminatedUnion('status', [
  z
    .object({
      status: z.literal('resolved'),
      value: shelfLifeInferenceResultSchema,
      provider: z.string().min(1),
      model: z.string().min(1),
      taskVersion: z.string().min(1),
      policyId: z.string().optional(),
      registryVersion: z.string().optional(),
    })
    .strict(),
  z
    .object({
      status: z.literal('unresolved'),
      outcome: unresolved,
      taskVersion: z.string().min(1),
      policyId: z.string().optional(),
      registryVersion: z.string().optional(),
    })
    .strict(),
]);
export const observationSchema = z.discriminatedUnion('task', [
  z
    .object({
      task: z.literal('product_understanding'),
      caseId: idSchema,
      fields,
      calls: z.array(callSchema).max(4),
    })
    .strict(),
  z
    .object({
      task: z.literal('shelf_life_policy'),
      caseId: idSchema,
      policy,
      calls: z.array(callSchema).max(4),
    })
    .strict(),
]);
export type Observation = z.infer<typeof observationSchema>;
