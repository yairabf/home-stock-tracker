import { z } from 'zod';
import {
  decisionFieldSchema,
  decisionTaskSchema,
  fieldOutcomeSchema,
  type FieldOutcome,
  type RoutingDecision,
  type TaskCapabilities,
} from './decision-routing.types';
import { TASK_CAPABILITIES } from './task-capabilities';

const requestSchema = z
  .object({
    task: decisionTaskSchema,
    enabled: z.boolean(),
    generationAttempts: z.number().int().nonnegative(),
    fields: z
      .array(
        z
          .object({
            field: decisionFieldSchema,
            required: z.boolean(),
            outcome: fieldOutcomeSchema,
          })
          .strict(),
      )
      .max(decisionFieldSchema.options.length),
  })
  .strict()
  .refine(({ task, fields }) => {
    const capabilities: TaskCapabilities = TASK_CAPABILITIES[task];
    return (
      new Set(fields.map(({ field }) => field)).size === fields.length &&
      fields.every(({ field }) => capabilities.fields.includes(field))
    );
  });

export type RoutingRequest = z.infer<typeof requestSchema>;

export function decideModelRoute(input: RoutingRequest): RoutingDecision {
  const parsed = requestSchema.safeParse(input);
  if (!parsed.success) return decision('unresolved', 'invalid_input', []);
  const { task, enabled, fields, generationAttempts } = parsed.data;
  const pending = fields.filter(({ outcome }) => outcome.status !== 'resolved');
  const required = pending.filter((field) => field.required);
  const unresolvedFields = required.map(({ field }) => field);
  if (!required.length)
    return decision(
      'none',
      pending.length ? 'optional_missing' : 'already_resolved',
      [],
    );
  if (!enabled)
    return decision('unresolved', 'task_disabled', unresolvedFields);

  const capabilities: TaskCapabilities = TASK_CAPABILITIES[task];
  const choices = required.filter(
    ({ field, outcome }) =>
      outcome.status === 'needs_choice' && capabilities.choices.includes(field),
  );
  if (choices.length)
    return decision(
      'jev',
      'supported_choice',
      choices.map(({ field }) => field),
    );
  const generation = required.filter(
    ({ field, outcome }) =>
      outcome.status === 'unsupported' &&
      outcome.generationApplicable &&
      capabilities.generation.includes(field),
  );
  if (generation.length)
    return decision(
      generationAttempts ? 'unresolved' : 'openai_generation',
      generationAttempts
        ? 'generation_budget_exhausted'
        : 'unsupported_required_generation',
      generation.map(({ field }) => field),
    );
  return decision(
    'unresolved',
    unresolvedReason(required[0].outcome),
    unresolvedFields,
  );
}

function unresolvedReason(outcome: FieldOutcome): RoutingDecision['reason'] {
  switch (outcome.status) {
    case 'uncertain':
      return outcome.reason;
    case 'unavailable':
      return 'provider_unavailable';
    case 'needs_choice':
      return 'choice_not_supported';
    default:
      return 'generation_not_supported';
  }
}

function decision(
  route: RoutingDecision['route'],
  reason: RoutingDecision['reason'],
  fields: RoutingDecision['fields'],
): RoutingDecision {
  return { route, reason, fields };
}
