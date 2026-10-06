import { ChoiceRecorder } from './choice-recorder';
import { hash, type ApplicationDataset } from './dataset';
import type { ComparisonPlan } from './perishability-comparison-plan';
import { validatePlannedComparison } from './perishability-comparison-plan';
import type { PerishabilityComparison } from './perishability-comparison-contract';
import { requestCaptureSchema } from './perishability-request-capture';
import { replayPerishability } from './perishability-replay';
import { RequestBudget } from './request-budget';
import { JEV_UNDERSTANDING_VERSION } from '../../product/jev-product-understanding.service';

export async function captureComparison(
  dataset: ApplicationDataset,
  plan: ComparisonPlan,
  budget: RequestBudget,
  config: { typesafeApiKey: string },
  fetcher?: typeof fetch,
  baseline?: PerishabilityComparison,
) {
  const comparison: PerishabilityComparison = {
    ...plan.binding,
    variants: plan.variants.map(
      (v) =>
        baseline?.variants.find(
          (b) => b.definition.variantId === v.definition.variantId,
        ) ?? {
          definition: v.definition,
          evidenceMode: 'live',
          complete: false,
          rows: [],
        },
    ),
  };
  for (const [index, variant] of comparison.variants.entries()) {
    if (variant.complete) continue;
    if (
      variant.definition.adapterVersion !== JEV_UNDERSTANDING_VERSION ||
      variant.definition.captureMode !== 'captured'
    )
      throw new Error('Live capture requires the current adapter');
    if (variant.rows.length)
      throw new Error('Partial baseline cannot be resumed');
    variant.evidenceMode = 'live';
    for (const planned of plan.variants[index].requests) {
      if (variant.rows.some((r) => r.caseId === planned.caseId)) continue;
      if (budget.stopped) break;
      const item = dataset.cases.find((c) => c.caseId === planned.caseId);
      if (!item || item.task !== 'product_understanding')
        throw new Error('Missing capture input');
      const recorder = new ChoiceRecorder(
        variant.definition.configuredModel,
        undefined,
        config,
        budget.fetch('typesafe', fetcher),
      );
      await recorder.choose(planned.request, budget.remainingMs());
      recorder.finish();
      const call = recorder.calls[0];
      if (!call || call.provider !== 'typesafe')
        throw new Error('Missing captured transport');
      variant.rows.push(
        requestCaptureSchema.parse({
          ...planned,
          call,
          outcome: await replayPerishability(item.input, call.transport),
        }),
      );
    }
    variant.complete =
      variant.rows.length === plan.variants[index].requests.length;
  }
  return validatePlannedComparison(comparison, dataset, plan);
}

export function remainingComparisonRequests(
  plan: ComparisonPlan,
  baseline?: PerishabilityComparison,
) {
  return plan.variants.reduce(
    (sum, variant) =>
      sum +
      variant.requests.length -
      (baseline?.variants.find(
        (v) => hash(v.definition) === hash(variant.definition),
      )?.rows.length ?? 0),
    0,
  );
}
