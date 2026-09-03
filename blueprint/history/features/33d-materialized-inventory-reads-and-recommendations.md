# Feature: Materialized inventory reads and recommendations

**From build-plan:** feature 33d
**Status:** verified

## Goal

Expose the latest persisted household stock projection without recalculating on reads, provide a complete REST household inventory view, and make low-stock recommendations filter the same materialized estimates.

## In scope

- A load-bearing, additive product inventory response that preserves legacy prediction-shaped fields while distinguishing `tracked` from `untracked` products and adding the last explicit fact, latest estimate, and prediction provenance.
- `GET /api/v1/inventory/estimate/:productId` backed only by persisted product and projection data.
- `GET /api/v1/inventory` with `current` and `uncertain` groups for tracked products.
- Stable display precision at response boundaries while persisted projection decimals remain unchanged.
- Low-stock recommendations backed only by materialized projections, filtered by prediction enablement, household confidence threshold, and pending grocery membership.
- Service-level read methods and DTOs that 33e can publish through MCP without duplicating business rules.

## Out of scope

- Registering or publishing the additive MCP `list_inventory` tool or changing the released `get_inventory` schema. Feature 32 makes the MCP fixture immutable per released version, while 33e explicitly owns the `1.3.0` contract bump, fixtures, manifests, and tool publication.
- Hermes/OpenClaw skills, generated bundles, scenarios, probes, manifests, documentation, or MCP/skill version changes (33e).
- On-demand prediction or stock recalculation during reads.
- Historical projection backfill, policy editing, automatic grocery-list mutation, pagination or filters for the household view, unit conversion, or changes to daily estimation.

## Build loop

Build one step at a time, never the whole feature at once.

1. Implement only the next unchecked step.
2. Add focused tests for response logic and failure or empty paths.
3. Run the relevant Jest slice, `npm run test`, `npm run test:e2e`, `npm run build`, and repository diff checks.
4. Review the step against this spec and create the enabled Autopilot checkpoint commit only after all required checks pass.

## Build steps

- [x] **Step 1 - Add the materialized per-product read contract** - create focused read DTOs and an `InventoryService` query for tracked and untracked products, replace the REST estimate handler's prediction-engine call, and apply presentation-only quantity precision. _Done when:_ an existing product without a projection returns `trackingStatus: untracked` with null recorded and estimated fields, a tracked product returns its canonical name and persisted recorded/estimated fields without writes or prediction calls, unknown IDs return a safe not-found response, discrete `item`/`unit`/`count` quantities are rounded to whole values, other quantities are rounded to two decimal places, and stored decimals are unchanged.
- [x] **Step 2 - Add the household inventory REST view** - query tracked projections once and group them into `current` and `uncertain`, using the same item DTO and stable canonical-name ordering. _Done when:_ `likely_available` and `probably_low` products appear in `current`, `uncertain` products appear in `uncertain`, `probably_out` and zero-quantity products are omitted, untracked products are omitted, an empty household returns two empty arrays, a low product remains eligible to appear in recommendations, and the route performs no prediction or mutation.
- [x] **Step 3 - Drive recommendations from materialized projections** - replace per-product prediction-engine calls with one persisted projection query and adapt the pure selector to the projection candidate shape. _Done when:_ only `probably_low` and `probably_out` projections at or above the household threshold are returned, prediction-disabled and pending-grocery products are suppressed, ordering stays out-before-low then confidence then name, a low item may also appear in the household `current` view, missing canonical names are isolated and logged safely, and recommendation reads create no predictions, events, or grocery rows.
- [x] **Step 4 - Verify the integrated read surface** - add PostgreSQL-backed REST coverage for untracked and tracked product reads, household grouping, depleted exclusion, display precision, persisted recommendation filtering, and read-only behavior; update API documentation only for the REST contracts shipped in 33d. _Done when:_ focused unit/e2e tests, `npm run test`, `npm run test:e2e`, `npm run build`, `git diff --check`, and `graphify update .` pass without changing released MCP fixtures or agent artifacts.

## Files / areas

- `src/inventory/dto/` and `src/inventory/types/` - materialized inventory response contracts and presentation precision.
- `src/inventory/inventory.service.ts` and `src/inventory/inventory.controller.ts` - per-product and household read paths.
- `src/inventory/low-stock-recommendation.service.ts` and its selector - persisted recommendation candidates.
- `src/inventory/*.spec.ts` and `test/` - unit and PostgreSQL-backed REST evidence.
- `docs/api-reference.md` - shipped REST read contracts.
- `blueprint/context/project-overview.md` - refreshed generated context with the plan fingerprint and stock models.
- `blueprint/context/current-feature.md` and `blueprint/.state/run.json` - durable workflow state.

## Data / contracts

- `InventoryTrackingStatus` is `tracked | untracked`.
- The per-product response preserves `predictionId`, `productId`, `predictedState`, `confidenceScore`, `reason`, `recommendedAction`, `llmContributed`, and `deterministicSignals`, then adds `productName`, `trackingStatus`, `unit`, `recordedQuantity`, `recordedAt`, `recordedSource`, `recordedEventId`, `estimatedQuantity`, `estimatedState`, `confidence`, and `evaluatedAt`. Missing materialized evidence uses `uncertain`, zero confidence, a safe reason, and empty deterministic signals without persisting a prediction.
- The household response is `{ current: InventoryItem[], uncertain: InventoryItem[] }`. It contains tracked non-depleted products only, has no pagination or filters, and sorts each group by canonical product name then product ID.
- Reads select the canonical `ProductName` plus optional `StockProjection`; they never invoke `PredictionEngine`, persist a `Prediction`, or update a projection.
- Presentation rounding recognizes case-insensitive discrete units `item`, `items`, `unit`, `units`, `count`, `each`, `piece`, and `pieces` as whole-number quantities. Other units expose at most two decimal places. Rounding affects DTO output only.
- Recommendation candidates come directly from `StockProjection.estimatedState`, `confidence`, `reason`, and `predictionId`; `recommendedAction` remains nullable and is not invented by the read layer.
- MCP publication remains load-bearing deferred work for 33e because a new tool or output schema requires the planned additive contract release.

## Testing

- Unit tests cover DTO precision, tracked/untracked mapping, product not-found, list grouping and ordering, selector thresholds, pending suppression, and recommendation error isolation.
- Controller tests prove REST handlers delegate only to materialized read services.
- PostgreSQL/Supertest tests prove persisted projection reads, no-backfill untracked behavior, list membership and exclusion, recommendation reuse of daily snapshots, and absence of read side effects.
- Final fallback gates are `npm run test`, `npm run test:e2e`, `npm run build`, and `git diff --check`. No Verify command is configured.

## Notes for the AI

- Select explicit Prisma fields and keep controllers thin.
- Do not reuse `EstimationResponseDto`; it describes legacy on-demand prediction details rather than the materialized stock contract.
- Do not delete the legacy prediction engine or alter daily workflow semantics.
- Keep a tracked `probably_low` product in the household `current` group even when it also qualifies as a recommendation.
- Treat a tracked zero quantity as depleted regardless of a stale non-out state.
- Preserve authentication and safe error behavior already applied globally.
- Do not change MCP fixtures, release manifests, generated agent skills, or versions in 33d.
- Run `graphify update .` after code changes.
