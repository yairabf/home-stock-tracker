import { ProductType } from '../generated/prisma/enums';
import type {
  JevChoiceCriteria,
  JevJsonObject,
} from '../llm/typesafe/jev-decision.types';
import {
  buildChoiceVocabulary,
  VOCABULARY_MAX_CONTEXT_BYTES,
} from './choice-vocabulary';
import type {
  ProductUnderstandingInput,
  UnderstandingField,
} from './product-understanding';

export interface UnderstandingChoices {
  status: 'complete';
  version: string;
  values: Record<string, string | boolean | null>;
  criteria: JevChoiceCriteria;
  state: JevJsonObject;
}
export function understandingChoices(
  field: UnderstandingField,
  input: ProductUnderstandingInput,
): UnderstandingChoices | { status: 'unsupported' } {
  const context = { rawName: input.rawName, metadata: { ...input.metadata } };
  if (field === 'category' || field === 'typicalUnit') {
    const vocabulary = buildChoiceVocabulary({
      kind: field === 'category' ? 'category' : 'unit',
      labels: field === 'category' ? input.categories : input.units,
      context,
    });
    return vocabulary.status === 'complete'
      ? vocabulary
      : { status: 'unsupported' };
  }
  const values: UnderstandingChoices['values'] =
    field === 'productType'
      ? {
          unknown: null,
          ...Object.fromEntries(
            Object.values(ProductType).map((value) => [value, value]),
          ),
        }
      : { unknown: null, perishable: true, nonperishable: false };
  const criteria = Object.fromEntries(
    Object.keys(values).map((token) => [
      token,
      token === 'unknown'
        ? 'Insufficient evidence to select an option.'
        : token,
    ]),
  );
  const state = { evidence: context };
  if (
    Buffer.byteLength(JSON.stringify({ state, criteria }), 'utf8') >
    VOCABULARY_MAX_CONTEXT_BYTES
  )
    return { status: 'unsupported' };
  return {
    status: 'complete',
    version: `${field}-choices-v1`,
    values,
    criteria,
    state,
  };
}
