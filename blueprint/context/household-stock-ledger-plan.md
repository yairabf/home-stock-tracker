# Household Stock Ledger and Daily Estimation

## Summary

Add a hybrid household-stock capability within `src/inventory`. Explicit purchases and user updates maintain one current stock projection per product, while a daily service workflow estimates remaining quantity from elapsed time, shelf life, learned consumption, and household composition.

The feature ships end to end: persistence, REST, MCP, scheduled evaluation, recommendations, documentation, contract fixtures, and Hermes/OpenClaw behavior.

## Key Changes

### Stock persistence and events

- Add one stock projection per product containing:
  - canonical stock unit;
  - last explicitly recorded quantity, timestamp, source, and event reference;
  - materialized estimated quantity and state;
  - confidence, reason, prediction reference, and evaluation timestamp.
- No migration backfill. Existing products return `untracked` until a new purchase, quantity set, or qualifying stock report creates a projection.
- Extend `InventoryEvent` with explicit set and consumption event types.
- Write explicit events and projection changes atomically.
- Purchases and restocks reset stock to the purchased quantity rather than adding to the previous balance.
- Grocery completion uses explicit actual quantity/unit when supplied; otherwise it uses the positive requested quantity and grocery unit.
- Direct purchases default an omitted quantity to `1`.
- Absolute set overwrites stock. Decrement applies atomically to the current estimate, preserves uncertainty, and clamps at zero. Mark-out sets zero.
- `STOCK_LOW` may override the state without inventing a quantity. A quantity-free `STOCK_CONFIRMED` does not update stock; agent instructions must ask how many and then perform a set.
- Resolve the initial unit from the explicit input, grocery unit, product typical unit, then `item`. Reject incompatible later units unless an explicitly confirmed absolute set establishes a new unit.
- Recalculate affected product statistics after successful mutations. Statistics failure is logged and does not roll back the stock transaction.

### Daily stock workflow

- Add a configurable internal scheduler:
  - `STOCK_WORKFLOW_ENABLED`, default enabled;
  - `STOCK_WORKFLOW_CRON`, default `0 2 * * *`;
  - `STOCK_WORKFLOW_TIMEZONE`, default `Asia/Jerusalem`.
- Use one ordered daily workflow with two isolated phases:
  1. Find every product without a shelf-life policy, obtain a structured LLM assessment, and persist shelf-life days or a nonperishable result with model, confidence, rationale, and evaluation provenance.
  2. Evaluate every tracked stock projection and materialize its estimated quantity, state, confidence, reason, and prediction reference.
- Product creation and stock writes never wait for shelf-life inference.
- Failed shelf-life inference leaves the product eligible for the next run. Stock evaluation falls back to learned consumption with reduced confidence.
- Quantity decay is deterministic and incremental from the last evaluation:
  - subtract household-adjusted expected consumption;
  - incorporate explicit decrements;
  - clamp at zero;
  - force zero when finite shelf life has expired;
  - preserve internal decimal precision and expose unit-appropriate precision.
- Use the existing deterministic estimation rules for low/available classification, with explicit out/low observations and zero quantity taking precedence.
- Daily evaluation updates only estimated projection fields and prediction records. It never changes the last explicit stock fact or creates inferred consumption events.
- Reads and recommendations use the latest materialized daily estimate rather than recalculating on demand.
- Emit structured workflow start/end logs, duration, processed counts, successes, skips, and isolated product failures.
- Document the single-service-replica scheduler assumption. Distributed locking is deferred.

### REST, MCP, and agent behavior

- Add `GET /api/v1/inventory` returning the complete household view:
  - `current`: available and low tracked products;
  - `uncertain`: tracked products whose presence cannot be established reliably.
  - Depleted and expired products are omitted.
- Enrich `GET /api/v1/inventory/estimate/:productId` and MCP `get_inventory` with:
  - `trackingStatus`, including `untracked`;
  - last explicit quantity/unit/time;
  - estimated quantity/state;
  - confidence, reason, evaluation time, and prediction ID.
- Add `POST /api/v1/inventory/stock/:productId` and MCP `update_inventory` with strict operation-specific validation:
  - `set`: positive quantity and optional unit;
  - `decrement`: positive quantity and optional matching unit;
  - `mark_out`: no quantity or unit.
- Add MCP `list_inventory` with no pagination or filters in this release.
- Make low-stock recommendations filter the materialized daily projections:
  - include only qualifying low/out states at the household confidence threshold;
  - continue suppressing products already pending on the grocery list;
  - allow a low product to appear in both current inventory and suggestions.
- Keep `grocery_list` and recommendations as separate backend contracts.
- Update Hermes and OpenClaw skills so "show me the list" calls both reads and presents:
  1. committed grocery items;
  2. clearly labeled suggested items.
- Suggestions enter the grocery list only after explicit confirmation through the existing grocery-add workflow.
- Bump the additive MCP contract to `1.3.0` and the integration skill from `1.12.0` to `1.13.0`. Regenerate fixtures, manifests, bundles, shared scenarios, and installation probes.

## Public Types

- `InventoryTrackingStatus`: `tracked | untracked`.
- Reuse existing predicted states: `likely_available | probably_low | probably_out | uncertain`.
- Stock projection responses include product identity, canonical name, recorded fact, materialized estimate, provenance, confidence, reason, and evaluation time.
- Add a typed shelf-life policy with finite days or a nonperishable result, LLM provenance, confidence, rationale, and evaluation timestamp.
- Add explicit `STOCK_SET` and `STOCK_CONSUMED` inventory event types.
- Keep existing MCP and REST fields backward-compatible; all new read fields and tools are additive.

## Test Plan

- Unit-test purchase reset, actual-versus-requested quantity precedence, default direct-purchase quantity, canonical-unit resolution, set, decrement, clamping, mark-out, and qualitative-signal behavior.
- Prove stock projection and explicit event history commit or roll back together under concurrent mutations.
- Use fake timers to verify daily consumption decay, shelf-life expiration, nonperishable policy, missing-policy fallback, unit-aware precision, and absence of cumulative double-decrement errors.
- Test the ordered workflow, retry eligibility, per-product failure isolation, disabled scheduling, configurable cron/timezone, and structured summaries.
- PostgreSQL-backed tests cover no-backfill deployment, `untracked` reads, grocery completion creating stock, direct purchase reset, manual updates, current/uncertain list membership, and depleted-item exclusion.
- REST and MCP contract tests cover `list_inventory`, additive `get_inventory`, strict `update_inventory` schemas, safe errors, authentication, and unchanged existing tools.
- Recommendation tests prove use of daily snapshots, confidence filtering, pending-list suppression, and low products appearing in both inventory and suggestions.
- Agent scenarios verify combined list presentation, explicit suggestion confirmation, quantity clarification for "we still have milk," and no automatic grocery mutation.
- Final gates: `npm run test`, `npm run test:e2e`, `npm run build`, contract generation/probe checks, and `git diff --check`.

## Assumptions and Deferred Work

- One household and one user-visible balance per product.
- No batches, storage locations, individual expiration lots, unit conversion, historical backfill, policy-editing tool, distributed scheduler lock, or automatic suggestion insertion.
- Shelf-life policy is intrinsic product metadata. Household composition affects consumption estimates, not shelf life.
- Existing inventory history remains available but does not establish current stock after deployment.
- User-facing inventory is explicitly an estimate: recorded facts remain visible separately from materialized current estimates.
