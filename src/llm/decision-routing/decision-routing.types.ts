import { z } from 'zod';
import { JEV_TASKS } from '../typesafe/jev-decision.types';
import type {
  JevTokenUsage,
  JevUnavailableReason,
} from '../typesafe/jev-decision.types';

export const decisionTaskSchema = z.enum(JEV_TASKS);

export const decisionFieldSchema = z.enum([
  'productMatch',
  'canonicalName',
  'aliases',
  'category',
  'typicalUnit',
  'productType',
  'isPerishable',
  'shelfLifePolicy',
  'stockState',
]);

export const fieldOutcomeSchema = z.discriminatedUnion('status', [
  z
    .object({
      status: z.literal('resolved'),
      source: z.enum(['supplied', 'deterministic', 'jev', 'openai']),
    })
    .strict(),
  z.object({ status: z.literal('needs_choice') }).strict(),
  z
    .object({
      status: z.literal('unsupported'),
      generationApplicable: z.boolean(),
    })
    .strict(),
  z
    .object({
      status: z.literal('uncertain'),
      reason: z.enum([
        'unknown',
        'low_confidence',
        'ambiguous',
        'schema_rejected',
      ]),
    })
    .strict(),
  z.object({ status: z.literal('unavailable') }).strict(),
]);

export type DecisionTask = z.infer<typeof decisionTaskSchema>;
export type DecisionField = z.infer<typeof decisionFieldSchema>;
export type FieldOutcome = z.infer<typeof fieldOutcomeSchema>;

export interface TaskCapabilities {
  readonly fields: readonly DecisionField[];
  readonly choices: readonly DecisionField[];
  readonly generation: readonly DecisionField[];
}

export const routingReasonSchema = z.enum([
  'invalid_input',
  'task_disabled',
  'already_resolved',
  'optional_missing',
  'supported_choice',
  'unsupported_required_generation',
  'generation_budget_exhausted',
  'generation_not_supported',
  'choice_not_supported',
  'unknown',
  'low_confidence',
  'ambiguous',
  'schema_rejected',
  'provider_unavailable',
]);

export type RoutingReason = z.infer<typeof routingReasonSchema>;

export interface RoutingDecision {
  route: 'none' | 'jev' | 'openai_generation' | 'unresolved';
  reason: RoutingReason;
  fields: DecisionField[];
}

export interface DecisionAttemptProvenance {
  operationId: string;
  fields: readonly DecisionField[];
  task: DecisionTask;
  taskVersion: string;
  vocabularyVersion?: string;
  routingReason: RoutingReason;
  status: 'accepted' | 'rejected' | 'unavailable';
  provider: 'typesafe' | 'openai';
  configuredModel?: string;
  resolvedModel?: string;
  elapsedMs: number;
  usage?: JevTokenUsage;
  unavailableReason?: JevUnavailableReason;
}
