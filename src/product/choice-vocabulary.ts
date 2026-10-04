import { z } from 'zod';
import type {
  JevChoiceCriteria,
  JevJsonObject,
} from '../llm/typesafe/jev-decision.types';
import { validateJevChoiceRequest } from '../llm/typesafe/jev-decision.validation';
import { normalizeProductName } from './product-name.util';
import {
  CHOICE_VOCABULARY_MANIFESTS,
  type VocabularyKind,
} from './choice-vocabulary-manifests';

export const VOCABULARY_MAX_CONTEXT_BYTES = 16_384;
export const VOCABULARY_MAX_DOMAIN_OPTIONS = 254;

export interface ChoiceVocabularyInput {
  kind: VocabularyKind;
  labels: readonly string[];
  context: JevJsonObject;
}

export interface CompleteChoiceVocabulary {
  status: 'complete';
  kind: VocabularyKind;
  version: string;
  values: Record<string, string | null>;
  criteria: JevChoiceCriteria;
  state: JevJsonObject;
  contextBytes: number;
}

export interface UnsupportedChoiceVocabulary {
  status: 'unsupported';
  reason:
    | 'invalid_input'
    | 'ambiguous_labels'
    | 'too_many_options'
    | 'context_too_large';
}

export type ChoiceVocabularyResult =
  CompleteChoiceVocabulary | UnsupportedChoiceVocabulary;

export type VocabularyChoice =
  | { status: 'resolved'; value: string }
  | { status: 'unknown' }
  | { status: 'invalid_choice' };

const inputSchema = z
  .object({
    kind: z.enum(['category', 'unit']),
    labels: z.array(
      z.string().refine((label) => normalizeProductName(label).length > 0),
    ),
    context: z.custom<JevJsonObject>((value) => {
      if (value === null || typeof value !== 'object' || Array.isArray(value))
        return false;
      const prototype: unknown = Object.getPrototypeOf(value);
      return prototype === Object.prototype || prototype === null;
    }),
  })
  .strict();

export function buildChoiceVocabulary(
  input: ChoiceVocabularyInput,
): ChoiceVocabularyResult {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return unsupported('invalid_input');
  const { kind } = parsed.data;
  const manifest = CHOICE_VOCABULARY_MANIFESTS[kind];
  const labels = [
    ...new Set(parsed.data.labels.length ? parsed.data.labels : manifest.seeds),
  ];
  if (labels.length > VOCABULARY_MAX_DOMAIN_OPTIONS)
    return unsupported('too_many_options');
  const normalized = labels.map(normalizeProductName);
  if (new Set(normalized).size !== labels.length)
    return unsupported('ambiguous_labels');
  labels.sort();
  return prepareVocabulary(kind, labels, parsed.data.context);
}

function prepareVocabulary(
  kind: VocabularyKind,
  labels: string[],
  context: JevJsonObject,
): ChoiceVocabularyResult {
  const { version } = CHOICE_VOCABULARY_MANIFESTS[kind];
  const values: Record<string, string | null> = { unknown: null };
  const criteria: JevChoiceCriteria = {
    unknown:
      'The supplied evidence does not support any of the supplied options.',
  };
  labels.forEach((label, index) => {
    const token = `choice_${index}`;
    values[token] = label;
    criteria[token] = { label };
  });
  // Reuse the transport validator without issuing a request or widening JSON rules.
  const validated = validateJevChoiceRequest({
    task: 'product_resolution',
    taskVersion: version,
    questionKey: 'vocabulary_validation',
    instructions: 'Validate choice context.',
    state: { evidence: context },
    criteria,
  });
  if (validated.status !== 'valid') return unsupported('invalid_input');
  const { state } = validated.value;
  const contextBytes = Buffer.byteLength(
    JSON.stringify({ state, criteria }),
    'utf8',
  );
  if (contextBytes > VOCABULARY_MAX_CONTEXT_BYTES)
    return unsupported('context_too_large');
  return {
    status: 'complete',
    kind,
    version,
    values,
    criteria,
    state: structuredClone(state),
    contextBytes,
  };
}

export function resolveVocabularyChoice(
  vocabulary: CompleteChoiceVocabulary,
  token: unknown,
): VocabularyChoice {
  if (typeof token !== 'string' || !Object.hasOwn(vocabulary.values, token)) {
    return { status: 'invalid_choice' };
  }
  const value = vocabulary.values[token];
  return value === null ? { status: 'unknown' } : { status: 'resolved', value };
}

function unsupported(
  reason: UnsupportedChoiceVocabulary['reason'],
): UnsupportedChoiceVocabulary {
  return { status: 'unsupported', reason };
}
