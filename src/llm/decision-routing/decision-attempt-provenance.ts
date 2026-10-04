import { z } from 'zod';
import { JEV_UNAVAILABLE_REASONS } from '../typesafe/jev-decision.types';
import { validateJevJsonObject } from '../typesafe/jev-decision.validation';
import {
  decisionFieldSchema,
  decisionTaskSchema,
  routingReasonSchema,
  type DecisionAttemptProvenance,
  type TaskCapabilities,
} from './decision-routing.types';
import { TASK_CAPABILITIES } from './task-capabilities';

const nonblank = z.string().trim().min(1);
const tokenCount = z.number().int().nonnegative();
const attemptSchema = z
  .object({
    operationId: nonblank,
    fields: z
      .array(decisionFieldSchema)
      .min(1)
      .max(decisionFieldSchema.options.length),
    task: decisionTaskSchema,
    taskVersion: nonblank,
    vocabularyVersion: nonblank.optional(),
    routingReason: routingReasonSchema,
    status: z.enum(['accepted', 'rejected', 'unavailable']),
    provider: z.enum(['typesafe', 'openai']),
    configuredModel: nonblank.optional(),
    resolvedModel: nonblank.optional(),
    elapsedMs: z.number().nonnegative(),
    usage: z
      .object({ input_tokens: tokenCount, output_tokens: tokenCount })
      .strict()
      .optional(),
    unavailableReason: z.enum(JEV_UNAVAILABLE_REASONS).optional(),
  })
  .strict()
  .refine((attempt) => {
    const capabilities: TaskCapabilities = TASK_CAPABILITIES[attempt.task];
    if (
      new Set(attempt.fields).size !== attempt.fields.length ||
      !attempt.fields.every((field) => capabilities.fields.includes(field))
    )
      return false;
    if (attempt.status === 'unavailable')
      return (
        attempt.unavailableReason !== undefined &&
        attempt.usage === undefined &&
        attempt.resolvedModel === undefined
      );
    if (attempt.unavailableReason !== undefined || !attempt.resolvedModel)
      return false;
    return (
      attempt.provider !== 'typesafe' ||
      (/^jev-\d+\.\d+\.\d+$/.test(attempt.resolvedModel) &&
        attempt.usage !== undefined)
    );
  });

export function validateDecisionAttemptProvenance(
  input: unknown,
): DecisionAttemptProvenance | null {
  // Inspect own JSON data first so parsing cannot invoke accessors or retain hidden data.
  if (!validateJevJsonObject(input)) return null;
  const parsed = attemptSchema.safeParse(input);
  return parsed.success ? parsed.data : null;
}
