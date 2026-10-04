import type { DecisionTask, TaskCapabilities } from './decision-routing.types';

export const TASK_CAPABILITIES = {
  product_resolution: {
    fields: ['productMatch'],
    choices: ['productMatch'],
    generation: [],
  },
  product_understanding: {
    fields: [
      'canonicalName',
      'aliases',
      'category',
      'typicalUnit',
      'productType',
      'isPerishable',
    ],
    choices: ['category', 'typicalUnit', 'productType', 'isPerishable'],
    generation: ['category', 'typicalUnit'],
  },
  shelf_life_policy: {
    fields: ['shelfLifePolicy'],
    choices: ['shelfLifePolicy'],
    generation: ['shelfLifePolicy'],
  },
  stock_prediction: {
    fields: ['stockState'],
    choices: ['stockState'],
    generation: [],
  },
} as const satisfies Record<DecisionTask, TaskCapabilities>;
