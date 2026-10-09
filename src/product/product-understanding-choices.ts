import { perishabilityChoices } from './perishability-question';
import { categoryChoices } from './category-question';
import { productTypeChoices } from './product-type-question';
import type {
  JevChoiceCriteria,
  JevJsonObject,
} from '../llm/typesafe/jev-decision.types';
import { buildChoiceVocabulary } from './choice-vocabulary';
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
  if (field === 'isPerishable') return perishabilityChoices(input);
  if (field === 'productType') return productTypeChoices(input);
  if (field === 'category') return categoryChoices(input);
  const context = { rawName: input.rawName, metadata: { ...input.metadata } };
  if (field === 'typicalUnit') {
    const vocabulary = buildChoiceVocabulary({
      kind: 'unit',
      labels: input.units,
      context,
    });
    return vocabulary.status === 'complete'
      ? vocabulary
      : { status: 'unsupported' };
  }
  return { status: 'unsupported' };
}
