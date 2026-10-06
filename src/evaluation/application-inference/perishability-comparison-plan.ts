import { z } from 'zod';
import { hash, type ApplicationDataset } from './dataset';
import {
  comparisonBinding,
  comparisonSchema,
  parsePerishabilityComparison,
  type PerishabilityComparison,
} from './perishability-comparison-contract';
import {
  requestCaptureSchema,
  requestDefinitionSchema,
  orderedRequestHash,
} from './perishability-request-capture';
import {
  productionPerishabilityRequest,
  replayPerishability,
} from './perishability-replay';
import { JEV_UNDERSTANDING_VERSION } from '../../product/jev-product-understanding.service';
import { PERISHABILITY_QUESTION_VERSION } from '../../product/perishability-question';

const plannedRequest = z
  .object({
    caseId: requestCaptureSchema.shape.caseId,
    inputHash: requestCaptureSchema.shape.inputHash,
    request: requestCaptureSchema.shape.request,
    orderedChoiceIds: requestCaptureSchema.shape.orderedChoiceIds,
    orderedRequestHash: requestCaptureSchema.shape.orderedRequestHash,
  })
  .strict();
export const comparisonPlanSchema = z
  .object({
    schemaVersion: z.literal('perishability-request-plan-v1'),
    binding: comparisonSchema.omit({ variants: true }),
    variants: z
      .array(
        z
          .object({
            definition: requestDefinitionSchema,
            requests: z.array(plannedRequest).min(1).max(200),
          })
          .strict(),
      )
      .min(1)
      .max(16),
  })
  .strict();
export type ComparisonPlan = z.infer<typeof comparisonPlanSchema>;

export async function parseComparisonPlan(
  value: unknown,
  dataset: ApplicationDataset,
): Promise<ComparisonPlan> {
  const plan = comparisonPlanSchema.parse(value);
  if (
    hash(plan.binding) !== hash(comparisonBinding(dataset, plan.binding.split))
  )
    throw new Error('Plan dataset binding mismatch');
  const ids = plan.variants.map((v) => v.definition.variantId);
  if (
    new Set(ids).size !== ids.length ||
    new Set(plan.variants.map((v) => v.definition.configuredModel)).size !== 1
  )
    throw new Error('Duplicate variants or mixed model pins');
  const cases = dataset.cases.filter(
    (c) => c.task === 'product_understanding' && c.split === plan.binding.split,
  );
  for (const variant of plan.variants) {
    if (
      variant.requests.length !== cases.length ||
      new Set(variant.requests.map((r) => r.caseId)).size !== cases.length
    )
      throw new Error('Unequal planned case pairing');
    for (const row of variant.requests) {
      const item = cases.find((c) => c.caseId === row.caseId);
      if (
        !item ||
        item.task !== 'product_understanding' ||
        item.input.metadata.isPerishable !== null ||
        row.inputHash !== hash(item.input) ||
        row.request.taskVersion !== variant.definition.adapterVersion ||
        row.orderedRequestHash !== orderedRequestHash(row.request) ||
        hash(row.orderedChoiceIds) !== hash(Object.keys(row.request.criteria))
      )
        throw new Error('Planned request binding mismatch');
      if (variant.definition.adapterVersion === JEV_UNDERSTANDING_VERSION) {
        if (
          variant.definition.questionVersion !== PERISHABILITY_QUESTION_VERSION
        )
          throw new Error('Question version mismatch');
        const production = await productionPerishabilityRequest(
          item.input,
          variant.definition.configuredModel,
        );
        // Canonical hashing permits only an option-order rotation of production.
        if (hash(production) !== hash(row.request))
          throw new Error('Plan differs from production request');
      }
    }
  }
  return plan;
}

export async function validatePlannedComparison(
  value: unknown,
  dataset: ApplicationDataset,
  plan: ComparisonPlan,
): Promise<PerishabilityComparison> {
  const parsed = parsePerishabilityComparison(
    value,
    dataset,
    plan.variants.map((v) => v.definition),
  );
  for (const [index, variant] of parsed.variants.entries()) {
    for (const row of variant.rows) {
      const planned = plan.variants[index].requests.find(
        (r) => r.caseId === row.caseId,
      );
      if (
        !planned ||
        hash(planned) !==
          hash({
            caseId: row.caseId,
            inputHash: row.inputHash,
            request: row.request,
            orderedChoiceIds: row.orderedChoiceIds,
            orderedRequestHash: row.orderedRequestHash,
          })
      )
        throw new Error('Capture does not match frozen plan');
      const item = dataset.cases.find((c) => c.caseId === row.caseId);
      if (
        !item ||
        item.task !== 'product_understanding' ||
        row.call.provider !== 'typesafe'
      )
        throw new Error('Invalid replay case');
      const outcome = await replayPerishability(item.input, row.call.transport);
      if (hash(outcome) !== hash(row.outcome))
        throw new Error('Captured outcome does not match runtime acceptance');
    }
  }
  return parsed;
}
