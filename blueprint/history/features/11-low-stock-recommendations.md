# Feature: Low-stock recommendations

**From build-plan:** feature 11
**Status:** complete

## Completion record

- **Completed:** 2026-08-27
- **Delivered:** Added a presentation-neutral low-stock recommendation endpoint that evaluates prediction-enabled products, suppresses products already pending on the grocery list, applies the household confidence threshold, returns only actionable low/out predictions, orders them deterministically, and isolates individual prediction failures.
- **Main changed areas:** `src/inventory/types/` defines the narrowed recommendation contract and selection rules; `src/inventory/low-stock-recommendation.service.ts` orchestrates household, catalog, grocery, and prediction dependencies; the inventory controller, DTO, and module expose and wire the endpoint; focused unit, controller, and PostgreSQL-backed e2e suites prove policy and transport behavior. Graphify was installed across the project adapters and `graphify-out/` was refreshed to include the new service and connections.
- **Verification:** `npm run test -- --runInBand` passed 227 tests across 21 suites; `npm run test:e2e -- --runInBand` passed 45 tests across 7 suites; `npm run build` passed; the exact changed-file Prettier check passed; `git diff --check` passed.
- **Behavioral evidence:** PostgreSQL-backed Supertest calls to `GET /api/v1/inventory/predictions/low-stock` proved the default and custom household thresholds, out-before-low ordering, pending and disabled suppression, the empty `{ "recommendations": [] }` response, and unchanged grocery-item and inventory-event counts.
- **Deviations:** At the user's explicit request, the official Graphify skill and Codex/Claude workflow guidance were installed and the project graph was refreshed as part of this work. Graphify reported that seven SQL migration files require its optional SQL parser; TypeScript service relationships were indexed successfully. No product-scope deviation.

## Goal

Expose a recommendation API that evaluates prediction-enabled products and returns only
actionable, high-confidence low-stock recommendations. Respect the household's
suggestion threshold and suppress products that are uncertain, likely available,
or already pending on the grocery list.

## In scope

- Add a recommendation service that discovers eligible catalog products and asks
  the existing `PredictionEngine` for a fresh prediction for each one.
- Read the household `suggestionConfidenceThreshold`, using the established
  default household behavior when no row exists yet.
- Surface only `probably_low` and `probably_out` results whose confidence meets
  the threshold.
- Suppress products that already have a pending grocery-list item.
- Return a stable, presentation-neutral response with product identity and name,
  prediction identity, state, confidence, reason, and recommended action.
- Sort recommendations deterministically so the most urgent and confident items
  appear first.
- Isolate a failure for one product so other useful recommendations can still be
  returned, while logging the failed product server-side.
- Cover threshold boundaries, suppression, ordering, empty results, and partial
  prediction failures with automated tests.

## Out of scope

- Adding recommendations to the grocery list automatically or writing a new
  inventory event merely because a recommendation was returned.
- Changing prediction weights, confidence scores, or household thresholds.
- Using `ProductStatistics.predictionAccuracy` as a second recommendation score;
  feedback-based calibration needs an explicit policy and remains deferred.
- Query-time filters, pagination, product-specific automation policies, or a
  stored recommendation model.
- MCP tools, Hermes skill/conversation behavior, scheduled scans, WhatsApp
  notifications, authentication, and operational telemetry beyond local logging
  (features 12 through 17).

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - Lock recommendation contracts and pure selection rules** - Add
  typed recommendation result/response shapes and a focused pure selector that
  keeps only `probably_low` or `probably_out` predictions at or above the
  household threshold, excludes pending grocery products, and orders
  `probably_out` before `probably_low`, then confidence descending, then canonical
  name ascending. *Done when:* Jest tests prove both state filters, the inclusive
  threshold boundary, pending-item suppression, deterministic ordering, and an
  empty result without touching HTTP or persistence.
- [x] **Step 2 - Orchestrate fresh recommendations with failure isolation** - Add
  an injectable recommendation service that gets or creates the household,
  loads prediction-enabled products and pending grocery product IDs, evaluates
  each eligible product through `PredictionEngine`, maps the results through the
  selector, and logs then skips an individual prediction failure without failing
  the whole scan. Exclude pending products before prediction to avoid unnecessary
  LLM work and prediction rows. *Done when:* service tests prove disabled and
  pending products are never evaluated, the household threshold is applied,
  successful results survive a sibling failure, no products returns an empty
  list, and the service performs no grocery or inventory mutation.
- [x] **Step 3 - Expose the recommendations endpoint** - Add
  `GET /inventory/predictions/low-stock` to the existing inventory controller and
  wire the recommendation service through the current module boundaries. Map the
  domain result to explicit DTOs without exposing LLM/provider internals or raw
  deterministic signals. *Done when:* controller tests show the static route
  delegates once and returns the documented response, and it cannot be consumed
  by the existing `estimate/:productId` route.
- [x] **Step 4 - Prove the PostgreSQL-backed recommendation flow** - Add focused
  Supertest coverage with real products, household settings, and pending grocery
  items while replacing only the prediction engine at the external reasoning
  boundary. *Done when:* the endpoint returns only qualifying recommendations in
  deterministic order, honors a custom and default threshold, suppresses pending
  and disabled products, returns `200` with `recommendations: []` when nothing
  qualifies, creates no grocery item or inventory event, and `npm run test`,
  `npm run test:e2e`, and `npm run build` pass.

## Files / areas

- `src/inventory/low-stock-recommendation.service.ts` and colocated spec - batch
  orchestration, filtering, ordering, and per-product failure isolation.
- `src/inventory/types/low-stock-recommendation.ts` - domain contracts and pure
  selection rules, with colocated tests if kept separate from the service.
- `src/inventory/dto/low-stock-recommendation-response.dto.ts` - explicit HTTP
  response mapping.
- `src/inventory/inventory.controller.ts` and `src/inventory/inventory.module.ts` -
  route and dependency-injection wiring.
- `test/low-stock-recommendations.e2e-spec.ts` - PostgreSQL-backed HTTP behavior.
- `prisma/schema.prisma` - no change expected; current household, product,
  grocery-item, prediction, and statistics models are sufficient.

## Data / contracts

- **Route:** `GET /inventory/predictions/low-stock`.
- **Response:**

  ```json
  {
    "recommendations": [
      {
        "productId": "uuid",
        "productName": "milk",
        "predictionId": "uuid-or-null",
        "predictedState": "probably_out",
        "confidenceScore": 0.86,
        "reason": "Recent and historical signals suggest the product is out",
        "recommendedAction": "Add milk to the grocery list"
      }
    ]
  }
  ```

- `recommendations` is always an array. An empty scan or a scan with no qualifying
  products returns HTTP 200 with `{ "recommendations": [] }`.
- `predictionId` remains `string | null`, matching the load-bearing prediction
  contract when prediction persistence fails without failing computation.
- `predictedState` in a recommendation is narrowed to `probably_low |
  probably_out`. `recommendedAction` remains `string | null`; the service does not
  invent presentation copy when the engine supplies none.
- Qualification uses `confidenceScore >= suggestionConfidenceThreshold`; the
  boundary is inclusive. The household model's current default is `0.7`.
- Products with `predictionEnabled = false` or any `GroceryListItem` whose status
  is `pending` for that product are not sent to the prediction engine.
- Ordering is `probably_out` before `probably_low`, then confidence descending,
  then canonical product name ascending for a stable tie-break.
- Each non-suppressed eligible product receives a fresh `predictProduct` call, so
  the returned recommendation and persisted `Prediction` reflect current signals.
  A product-level error is logged and omitted; transport responses do not expose
  provider or database error details.
- This response is load-bearing for feature 12's `get_low_stock_predictions` MCP
  tool and features 13 through 15. Those integrations should forward or translate
  it without duplicating recommendation policy.

## Testing

- Jest is configured and is the gate for the selection, threshold, ordering,
  orchestration, failure-isolation, and DTO mapping logic added in each step.
- Mock Prisma, `HouseholdService`, and `PredictionEngine` in focused unit tests.
  Assert that pending and disabled products cause no prediction call.
- Extend PostgreSQL-backed Supertest coverage for the route, real household
  threshold, product eligibility, pending-item suppression, and absence of side
  effects. Mock only the injected prediction engine so endpoint policy remains
  under test without an LLM or nondeterministic estimation inputs.
- Run `npm run test` after each logic-bearing step. Run `npm run test:e2e` for the
  endpoint step and `npm run build` after every step because no umbrella Verify
  command is configured.

## Notes for the AI

- Keep the controller thin and keep recommendation policy in the injected domain
  service. Reuse the `PREDICTION_ENGINE` token rather than constructing
  `EstimationService` or an LLM provider.
- Keep this server-only and presentation-agnostic. Do not add WhatsApp or Hermes
  wording to the service response.
- Resolve the static `predictions/low-stock` route explicitly before any future
  dynamic prediction route to avoid treating `low-stock` as an identifier.
- Preserve the append-only inventory-event source of truth. Reading
  recommendations has no event or grocery-list side effect.
- Use generated Prisma enums at persistence boundaries and explicit DTO/domain
  types at the HTTP boundary.
- Avoid unrelated estimator, feedback, product, or grocery refactors.
