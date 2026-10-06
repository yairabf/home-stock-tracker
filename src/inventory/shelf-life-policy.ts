import { z } from 'zod';
import type {
  DecisionAttemptProvenance,
  FieldOutcome,
} from '../llm/decision-routing/decision-routing.types';
import {
  shelfLifeInferenceInputSchema,
  type ShelfLifeInferenceResult,
} from './types/shelf-life-inference';

export const SHELF_LIFE_POLICY = Symbol('SHELF_LIFE_POLICY');
export const shelfLifeContextSchema = z
  .object({
    version: z.literal(1),
    storage: z.enum(['refrigerated', 'ambient', 'frozen', 'unknown']),
    maxTemperatureC: z.number().finite().nullable(),
    preparation: z.enum(['raw', 'cooked', 'unknown']),
    form: z.enum(['shell', 'whole_or_pieces', 'unknown']),
  })
  .strict();
export type ShelfLifeContext = z.infer<typeof shelfLifeContextSchema>;
export const shelfLifePolicyInputSchema = shelfLifeInferenceInputSchema.extend({
  context: shelfLifeContextSchema.nullable(),
});
export type ShelfLifePolicyInput = z.infer<typeof shelfLifePolicyInputSchema>;

interface PolicyMetadata {
  taskVersion: string;
  attempts: DecisionAttemptProvenance[];
  policyId?: string;
  registryVersion?: string;
}
export type ShelfLifePolicyResult = PolicyMetadata &
  (
    | {
        status: 'resolved';
        value: ShelfLifeInferenceResult;
        provider: string;
        model: string;
      }
    | {
        status: 'unresolved';
        outcome: Exclude<
          FieldOutcome,
          { status: 'resolved' } | { status: 'needs_choice' }
        >;
      }
  );
export interface ShelfLifePolicy {
  infer(input: ShelfLifePolicyInput): Promise<ShelfLifePolicyResult>;
}

export function readShelfLifeContext(config: unknown): ShelfLifeContext | null {
  const parsed = z
    .object({ shelfLifeContext: shelfLifeContextSchema })
    .safeParse(config);
  return parsed.success ? parsed.data.shelfLifeContext : null;
}
