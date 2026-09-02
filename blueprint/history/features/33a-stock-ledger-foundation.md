# Feature: Stock ledger foundation

**From build-plan:** feature 33a
**Status:** verified

## Goal

Introduce the durable household stock ledger that later mutation, estimation,
read, recommendation, and agent features can build on. Existing purchase,
restock, grocery-completion, and qualifying stock-signal paths will atomically
maintain one materialized stock projection per product without backfilling old
inventory history.

## In scope

- Add one stock projection per product with separate last-recorded facts and
  materialized estimated fields.
- Add typed product shelf-life policy storage for a finite lifetime or an
  explicitly nonperishable result. This feature stores the contract only; 33c
  will infer and apply policies.
- Add `STOCK_SET` and `STOCK_CONSUMED` inventory event types for the mutation
  operations introduced by 33b.
- Centralize canonical-unit selection and comparison for all projection writes.
- Make existing direct purchase and restock recording reset the projection to
  the purchased quantity, defaulting an omitted quantity to `1`.
- Make all existing grocery-completion variants derive the recorded quantity
  from explicit actual quantity when provided, otherwise from the positive
  requested grocery quantity; resolve the unit using the shared precedence.
- Make existing `STOCK_OUT` reports set the projection to zero and existing
  `STOCK_LOW` reports override the materialized state without inventing a
  quantity. Other qualitative reports remain event-only in this sub-feature.
- Commit each explicit event, grocery status transition, and affected
  projection update in the same database transaction.
- Recalculate product statistics after a successful stock mutation. A
  statistics failure is logged and does not roll back the committed stock fact.
- Preserve old events without creating projections during migration. A product
  stays untracked until a qualifying new write occurs.

## Out of scope

- New REST or MCP tools for setting, decrementing, marking out, or batch-recording
  stock. Those belong to 33b.
- `purchasedAt`, backdated purchase estimation, and request-level or per-item
  purchase timestamps. Those arrive with the 33b purchase contracts.
- Shelf-life inference, deterministic consumption or expiration decay,
  prediction creation, scheduling, and workflow logs. Those belong to 33c.
- Public projection DTOs, household inventory listing, enriched
  `get_inventory`, and recommendation changes. Those belong to 33d.
- Agent instructions, scenarios, version bumps, generated MCP fixtures,
  manifests, installation probes, or release documentation. Those belong to
  33e.
- Historical backfill, per-lot inventory, storage locations, unit conversion,
  and distributed locking.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step
was too big, so split it.

## Build steps

- [x] **Step 1 - Add the ledger persistence contracts** - extend the Prisma
      schema with `StockProjection`, `ProductShelfLifePolicy`, their enums and
      product relations, plus `STOCK_SET` and `STOCK_CONSUMED`; add a migration
      that creates empty tables and does not derive rows from historical events.
      _Done when:_ Prisma validation and generation pass, the migration applies
      to an existing schema without inserting projection or shelf-life rows, and
      database constraints enforce one projection and at most one shelf-life
      policy per product plus the conditional finite/nonperishable policy shape.

- [x] **Step 2 - Centralize stock fact and unit rules** - add focused inventory
      types and a ledger service that validates finite positive quantities,
      selects the canonical unit from explicit input, grocery unit, product
      typical unit, then `item`, rejects incompatible later units, and prepares
      projection resets and qualitative state overrides through a transaction
      client supplied by the caller. _Done when:_ unit tests cover every unit
      precedence branch, trimmed and blank units, invalid quantities, first-write
      creation, same-unit resets, mismatched-unit rejection, zero clamping for an
      out report, low-state override without invented quantity, and preservation
      of recorded facts during qualitative overrides.

- [x] **Step 3 - Make direct purchases atomic ledger resets** - refactor
      `recordPurchase` so transaction-scoped product lookup, a `PURCHASED` or `RESTOCKED` event, and
      the matching projection reset commit together; use quantity `1` when the
      existing input omits it and stamp recorded and evaluated times from the
      server receipt time. Trigger statistics recalculation only after commit and
      log, but do not fail the purchase, if recalculation fails. _Done when:_ a
      direct purchase or restock replaces rather than adds to the prior estimate,
      stores matching event/projection provenance, rejects an incompatible unit
      without either write, rolls both writes back on persistence failure, and
      focused service tests plus existing purchase controller behavior pass.

- [x] **Step 4 - Make compound grocery completion update the ledger** - extend
      `completeGroceryPurchase` so its existing all-or-nothing transaction also
      resets one projection per affected product using summed actual quantities
      when every selected line for that product supplies them, otherwise summed
      requested quantities, with unit resolution through the shared rules.
      Recalculate statistics after commit for each affected product with isolated
      failures. _Done when:_ multi-product completion commits events, grocery
      transitions, and projections together; requested quantities are no longer
      discarded when actual measurements are absent; same-product lines combine
      only compatible units; validation or a stale row leaves the entire request
      unchanged; and focused unit and PostgreSQL-backed tests pass.

- [x] **Step 5 - Cover legacy completion paths and stock signals** - route
      `completePurchase` and `completePartialPurchase` through the same ledger
      reset contract, using explicit quantity when supplied and the sum of the
      completed rows' requested quantities otherwise; then make new `STOCK_OUT`
      and `STOCK_LOW` events update the
      projection atomically while leaving quantity-free `STOCK_CONFIRMED` and
      other qualitative signals event-only. _Done when:_ every currently exposed
      purchase-completion route produces the same projection semantics; out sets
      estimated quantity to zero and state to `probably_out`; low sets state to
      `probably_low` without changing or inventing quantity; nonqualifying signals
      do not create or alter a projection; and event/projection rollback behavior
      is proven for each path.

- [x] **Step 6 - Prove deployment and concurrency invariants** - add focused
      PostgreSQL-backed coverage for migration with pre-existing products and
      events, first qualifying writes, competing resets, unit conflicts, grocery
      completion rollback, and post-commit statistics failure; document the new
      internal persistence boundary without publishing later REST or MCP shapes.
      _Done when:_ existing data remains untracked after migration, concurrent
      qualifying writes leave one projection whose recorded fact matches its
      referenced committed event, no partial grocery completion survives a
      failure, statistics failure is observable in logs but not the client result,
      `npm run test`, `npm run test:e2e`, `npm run build`, and
      `git diff --check` pass, and `graphify update .` completes.

- [x] **Repair review finding - Prevent stale transaction retries from
      overwriting newer stock facts** - guard every ledger projection mutation
      by the current projection evaluation time and strengthen concurrent-write
      coverage. _Done when:_ an older reset or qualitative observation remains
      in event history without replacing a newer projection, and concurrent
      reset coverage proves the projection references the newest committed fact.

## Files / areas

- `prisma/schema.prisma`
- A new migration under `prisma/migrations/`
- Generated Prisma client files under `src/generated/prisma/`
- `src/inventory/inventory.module.ts`
- `src/inventory/inventory.service.ts`
- A focused stock-ledger service and types under `src/inventory/`
- Existing inventory DTOs and internal purchase types where quantity defaults
  or transaction inputs must become explicit
- `src/statistics/statistics.service.ts` only if a transaction-safe public
  recalculation boundary is needed
- Focused unit tests under `src/inventory/`
- Focused PostgreSQL-backed coverage under `test/`
- Internal architecture or data-contract documentation affected by the ledger

## Data / contracts

### `StockProjection`

One row per product, load-bearing for 33b through 33e:

- `id: string` and unique `productId: string`.
- `unit: string`, the canonical stock unit selected on first tracked write.
- `recordedQuantity: number | null`, the last explicit numeric stock fact when
  one exists.
- `recordedAt: DateTime`, initially the server receipt time.
- `recordedSource: string` and `recordedEventId: string`, with the event reference
  unique so one explicit event cannot anchor multiple product projections.
- `estimatedQuantity: number | null`, initialized to the recorded quantity, zero
  for a qualifying out report, or null when a low-only observation has no numeric
  fact.
- `estimatedState: PredictedState`, initialized from the explicit fact.
- `confidence: number`, initialized to full confidence for a numeric or out fact;
  a low override retains a defined explicit-signal confidence.
- `reason: string`, a stable service-owned explanation, not agent prose.
- nullable `predictionId: string`, reserved for 33c materialization.
- `evaluatedAt: DateTime`, initialized to the write receipt time.
- `createdAt` and `updatedAt` timestamps.

The product relation uses cascade deletion consistently with product-owned
derived state. The recorded event relation uses restrict semantics so the
append-only fact cannot be removed while referenced. The prediction relation is
nullable and uses `SetNull` if prediction history is removed.

### `ProductShelfLifePolicy`

One optional row per product, load-bearing for 33c:

- `id: string` and unique `productId: string`.
- `kind: finite | nonperishable`.
- `shelfLifeDays: number | null`, required and positive only for `finite`, and
  null only for `nonperishable`; enforce this in both database and service
  validation.
- nullable `modelProvider`, `modelVersion`, and `promptVersion` strings.
- `confidence: number`, constrained to `0..1`.
- `rationale: string` and `evaluatedAt: DateTime`.
- `createdAt` and `updatedAt` timestamps.

### Existing write semantics

- Purchase and restock quantities are finite and positive. An omitted direct
  purchase quantity becomes `1` before the event is written.
- A purchase is an absolute reset, never an increment over the prior estimate.
- Grocery completion uses actual quantity and unit only when supplied under the
  existing all-or-none same-product rules. Otherwise it sums stored positive
  requested quantities and resolves units from grocery/product defaults.
- Canonical-unit precedence is explicit input, grocery unit, product
  `typicalUnit`, then `item`. Values are trimmed before comparison. This feature
  has no unit conversion.
- After first tracking, a different unit fails the complete transaction. The
  confirmed unit-replacement operation is deferred to 33b's absolute set.
- `STOCK_OUT` can create a projection at quantity zero using normal unit
  fallback. `STOCK_LOW` can create a projection only when a canonical unit can
  be resolved, and it must not invent a positive quantity. Qualitative-only
  projections keep numeric recorded and estimated quantities null rather than
  storing a fabricated value.
- `STOCK_CONFIRMED`, `STOCK_CORRECTED`, prediction feedback, inferred events,
  grocery-added events, and grocery-removed events do not mutate projections in
  33a.
- Every event and projection mutation uses one Prisma interactive transaction.
  Competing writes for one product must serialize or retry on conflict so an
  older transaction cannot overwrite a newer committed fact and the final
  projection always references the event whose values it materializes.
  Statistics recalculation runs after that transaction and cannot change its
  outcome.

## Testing

- Use the configured Jest unit gate for validation, unit selection, reset and
  override preparation, event mapping, aggregation, error translation, and
  statistics-failure isolation.
- Extend inventory service tests for every existing direct and grocery purchase
  path, including missing quantity, actual-versus-requested precedence, multiple
  lines for one product, multiple products, stale rows, incompatible units, and
  transaction rollback.
- Use PostgreSQL-backed tests for schema constraints, no-backfill migration
  behavior, atomic event/grocery/projection changes, concurrent resets, and
  append-only event provenance.
- Preserve existing REST and MCP tests. Public schema fixtures and tool versions
  must not change in 33a because no public tool contract is added here.
- With no configured Verify command, the final fallback gate is
  `npm run test`, `npm run test:e2e`, `npm run build`, and
  `git diff --check`, plus focused migration deployment evidence and
  `graphify update .`.

## Notes for the AI

- Keep controllers and MCP handlers unchanged unless an existing response must
  reflect the now-defaulted direct purchase quantity. The ledger is an internal
  domain and persistence boundary in this sub-feature.
- Put transaction-aware writes behind one stock-ledger provider. Do not let each
  controller or purchase path reproduce unit and projection rules.
- Accept a Prisma transaction client in internal helpers so callers can include
  grocery transitions and events in the same transaction. Never open a nested
  transaction from the ledger helper.
- Preserve service-owned transport provenance and existing authentication.
- Do not derive projections from historical events in application startup,
  migration SQL, reads, or tests.
- Keep decimal values internally. Presentation precision is deferred to 33d.
- Use stable domain errors without leaking Prisma or provider details.
- Run `graphify update .` after implementation changes.
