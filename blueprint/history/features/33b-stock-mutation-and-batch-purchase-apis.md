# Feature: Stock mutation and batch purchase APIs

**From build-plan:** feature 33b
**Status:** verified

## Goal

Expose strict, atomic stock mutations and multi-product purchase recording through
REST and MCP. A trusted client can set a known balance, record consumption, mark
a product out, or report a shopping batch while the service preserves event
history, canonical-unit rules, current stock projections, and transaction safety.

## In scope

- Add absolute `set`, relative `decrement`, and `mark_out` stock operations.
- Expose stock mutations at `POST /api/v1/inventory/stock/:productId` and through
  the additive MCP tool `update_inventory`.
- Extend the existing direct purchase path with an optional non-future
  `purchasedAt` timestamp while preserving its accepted fields and response.
- Extend the existing `POST /api/v1/inventory/purchases` route to also accept a
  distinct batch shape without breaking the legacy single-purchase shape.
- Add MCP `record_purchases` for the batch shape.
- Record a non-empty, duplicate-free batch of resolved product IDs in one
  serializable transaction, with request-level and per-item purchase timestamps.
- Materialize backdated purchases forward to the server receipt time using a
  small reusable deterministic calculation boundary. This prerequisite slice is
  needed here so a backdated write never publishes a stale current estimate;
  feature 33c will reuse it for daily evaluation.
- Recalculate product statistics after successful commits. Statistics failures
  are logged and do not change mutation results.
- Reject `STOCK_SET` and `STOCK_CONSUMED` on the generic inventory-event write
  endpoint so callers cannot create mutation events without the matching ledger
  update. Event history remains able to return both types.
- Advance the additive MCP contract to `1.3.0` and regenerate its runtime
  constants and tool fixtures so the checked-in contract matches tool discovery.

## Out of scope

- Shelf-life inference, LLM calls, scheduled or daily workflow orchestration,
  prediction creation, and workflow logs. Those belong to 33c.
- The complete household inventory read, enriched single-product inventory read,
  presentation precision, and recommendation changes. Those belong to 33d.
- Hermes or OpenClaw behavior changes, conversation scenarios, skill-version
  `1.13.0`, installation guidance, or release prose. Those belong to 33e.
- Resolving names inside a purchase batch. Every batch item supplies an already
  resolved product UUID; agents use existing product search first when needed.
- Grocery-item completion, automatic grocery-list mutation, unit conversion,
  per-lot inventory, storage locations, and historical backfill.
- Adding Redis, queues, or distributed transaction infrastructure.

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

- [x] **Step 1 - Lock request, result, and validation contracts** - add focused
      domain types and DTOs for stock operations, batch purchases, timestamps,
      and mutation receipts. Keep the existing single-purchase body and
      event-only response valid on `POST /inventory/purchases`; select the batch
      contract only when `items` is present, and reject mixed or incomplete
      shapes. _Done when:_ unit tests prove exact-one-shape selection; non-empty
      batch size `1..100` and unique-product rules; finite positive quantities; trimmed,
      nonblank units; strict operation-specific fields; valid ISO 8601 timestamps;
      per-item timestamp precedence; and rejection of future timestamps against
      one captured server receipt time.

- [x] **Step 2 - Add reusable forward materialization for backdated facts** - add
      a pure deterministic calculator and a transaction-aware input loader for a
      purchase quantity, purchase time, receipt time, optional shelf-life policy,
      and optional learned consumption interval. Subtract elapsed expected
      consumption, clamp at zero, force zero after finite shelf-life expiry, and
      retain the purchase quantity with reduced confidence and an explicit
      fallback reason when evidence is missing. Do not call an LLM or create a
      prediction. _Done when:_ fake-timer unit tests prove current-time identity,
      learned-consumption decay, zero clamping, finite expiry, nonperishable
      behavior, missing-policy and missing-statistics fallbacks, deterministic
      confidence/reason output, decimal preservation, and no evaluation before
      the purchase timestamp.

- [x] **Step 3 - Implement transaction-aware ledger mutation primitives** -
      extend the stock-ledger service with projection helpers for `set`,
      `decrement`, and `mark_out`; the inventory service remains responsible for
      creating events around these helpers. `set` stores a positive absolute balance and may
      explicitly replace the established unit; omission retains the established
      unit or uses product/default precedence. `decrement` requires a tracked
      numeric estimate, records the positive consumed amount as `STOCK_CONSUMED`,
      preserves the last recorded absolute fact and confidence, subtracts from
      the current estimate, and clamps at zero. `mark_out` records `STOCK_OUT`
      and replaces the recorded and estimated balance with zero. _Done when:_
      service tests prove first and repeated sets, confirmed unit replacement,
      same-unit decrement, incompatible-unit rejection, untracked and
      quantity-unknown conflicts, over-decrement clamping, positive remainder
      state preservation, zero becoming `probably_out`, mark-out idempotent
      balance behavior, and stale-write protection without opening nested
      transactions.

- [x] **Step 4 - Orchestrate single stock and purchase mutations** - add inventory
      service methods that validate product existence inside the serializable
      transaction, write the event and projection together, return a stable
      mutation receipt, and run statistics recalculation after commit. Extend
      legacy direct `PURCHASED` and `RESTOCKED` writes with `purchasedAt`; a
      backdated fact records that timestamp but evaluates its projection at the
      captured receipt time through Step 2. _Done when:_ focused service tests
      prove server-owned `api`/`mcp` provenance, correct event-type mapping,
      default direct-purchase quantity `1`, historical event and recorded-fact
      timestamps, immediate forward materialization, serializable retries, safe
      domain errors, event/projection rollback, rejection of mutation-only event
      types through the generic event path, and non-blocking statistics failure.

- [x] **Step 5 - Implement all-or-nothing batch purchases** - add one service
      operation that resolves every distinct product ID, applies request-level
      `purchasedAt` unless an item overrides it, defaults omitted quantities to
      `1`, resolves canonical units, creates one `PURCHASED` event and projection
      per input item, and returns results in input order. Perform all validation
      and writes within one retryable serializable transaction, then recalculate
      statistics per distinct product after commit with isolated failures.
      _Done when:_ service and PostgreSQL-backed tests prove multi-product
      success, mixed timestamp precedence, unit fallback, backdated estimates,
      missing-product rejection, duplicate rejection, incompatible-unit failure,
      persistence-failure rollback with no partial events or projections,
      concurrent-write provenance, ordered results, and post-commit statistics
      isolation.

- [x] **Step 6 - Expose the backward-compatible REST surface** - add
      `POST /api/v1/inventory/stock/:productId` and route the existing purchases
      endpoint to either its legacy single contract or the new batch contract.
      Return the unchanged event DTO for legacy single purchases, a stock
      mutation receipt for stock operations, and `{ items: [...] }` for batch
      purchases. Keep the global bearer-token guard, validation pipe behavior,
      and safe HTTP errors. _Done when:_ controller and Supertest coverage proves
      all three stock operations, both purchase body variants on the same route,
      unknown products, malformed and mixed bodies, operation-field rejection,
      timestamp validation, duplicate products, ordered batch results,
      authentication, `201` creation responses, stable `400` validation, `404`
      product, and `409` stock-state conflicts, plus unchanged legacy response
      fields.

- [x] **Step 7 - Publish MCP mutation tools without contract drift** - register
      `update_inventory` and `record_purchases` with strict Zod input/output
      schemas that call the same inventory service methods with server-owned
      `mcp` provenance. Add `purchasedAt` to the existing `record_purchase` tool.
      Advance the MCP contract to `1.3.0` and regenerate the runtime constant,
      versioned tools fixture, and platform manifests required for honest tool
      discovery; leave agent skill content, skill version, and new behavioral
      scenarios for 33e. _Done when:_ MCP tests prove tool discovery, schema
      strictness, service mapping, safe errors, timestamp inheritance, ordered
      results, and output-schema conformance; generated artifacts are clean;
      `npm run contract:check`, `npm run skills:check`, and the installation probe
      pass without claiming the agents already use the new tools.

- [x] **Step 8 - Close integration and concurrency coverage** - consolidate
      focused PostgreSQL-backed cases across REST and MCP, document the public
      mutation contracts and the deliberate 33c/33d/33e boundaries, and verify
      all existing purchase, grocery-completion, event-history, auth, and agent
      contract behavior remains compatible. _Done when:_ `npm run test`,
      `npm run test:e2e`, `npm run build`, `npm run contract:check`,
      `npm run skills:check`, `npm run agent:probe`, and `git diff --check` pass,
      and `graphify update .` completes.

## Files / areas

- `src/inventory/types/stock-ledger.ts` and new focused purchase/mutation types
- `src/inventory/stock-ledger.service.ts`
- A focused deterministic stock-materialization helper under `src/inventory/`
- `src/inventory/inventory.service.ts`
- New DTOs under `src/inventory/dto/`, plus `record-purchase.dto.ts`
- `src/inventory/inventory.controller.ts`
- `src/inventory/inventory.module.ts`
- `src/mcp/mcp-server.factory.ts`
- `integrations/shared/home-stock-tracker/release-contract.json`
- Generated MCP contract constants, fixtures, and manifests
- Focused Jest tests under `src/inventory/` and `src/mcp/`
- Focused PostgreSQL-backed tests under `test/`
- Public API and MCP contract documentation affected by the new operations

No Prisma schema change is expected. Feature 33a already added the projection,
shelf-life, and event-type persistence contracts required here.

## Data / contracts

### Stock mutation request

`POST /api/v1/inventory/stock/:productId` and MCP `update_inventory` use the same
strict discriminated contract:

- `{ operation: "set", quantity: number, unit?: string }`
- `{ operation: "decrement", quantity: number, unit?: string }`
- `{ operation: "mark_out" }`

`quantity` is finite and greater than zero. `mark_out` rejects quantity and unit.
REST takes `productId` from the UUID path; MCP includes `productId` in its input.
Clients never supply source, event type, confidence, reason, or evaluated time.
An untracked or quantity-unknown decrement is a `409` state conflict. Invalid
operation fields or units are `400`; an unknown product is `404`.

### Stock mutation semantics

- `set` writes `STOCK_SET`. Its quantity is the new absolute recorded and
  estimated balance. A supplied unit is explicit confirmation to replace an
  established canonical unit; an omitted unit retains the existing unit, then
  falls back to product `typicalUnit`, then `item` for a first write.
- `decrement` writes `STOCK_CONSUMED` with the consumed amount. It requires an
  existing non-null estimate, never creates a projection, preserves the last
  absolute `recorded*` fields and current confidence, updates `evaluatedAt`, and
  clamps `estimatedQuantity` to zero. A positive remainder retains the prior
  materialized state; zero is `probably_out`.
- `mark_out` writes `STOCK_OUT`, stores zero as the new recorded and estimated
  absolute balance, and resolves the canonical unit from existing, product, then
  `item` without accepting a client unit.
- Event and projection writes share the existing retryable serializable
  transaction. An older timestamp may remain in event history but cannot replace
  a newer materialized projection.
- Generic `POST /api/v1/inventory/events` rejects `STOCK_SET` and
  `STOCK_CONSUMED`; only the dedicated stock-operation path may create them.
  Event-list filters and output schemas include both types.

### Mutation receipt

REST stock mutations and both new MCP tools return a load-bearing receipt shape:

```text
{
  event: InventoryEventResponseDto,
  stock: {
    productId: string,
    unit: string,
    recordedQuantity: number | null,
    recordedAt: ISO-8601 string,
    recordedSource: string,
    recordedEventId: string,
    estimatedQuantity: number | null,
    estimatedState: likely_available | probably_low | probably_out | uncertain,
    confidence: number,
    reason: string,
    predictionId: string | null,
    evaluatedAt: ISO-8601 string
  }
}
```

Feature 33d may reuse or enrich `stock` for reads, but must not rename or change
the meaning of these fields.

### Purchase timestamp

- `purchasedAt?: string` is ISO 8601 with an explicit timezone.
- Omission uses the one server receipt time captured for the request.
- A timestamp after that receipt time is rejected before any write.
- The chosen value becomes both the `InventoryEvent.timestamp` and
  `StockProjection.recordedAt`. `StockProjection.evaluatedAt` is the receipt time
  after immediate forward materialization.
- Backdating never calls an external provider. Missing policy or learned data
  produces a deterministic reduced-confidence fallback and never blocks a valid
  purchase.
- A positive forward-estimated quantity is `likely_available`; a clamped or
  expired zero is `probably_out`. Low-threshold classification remains part of
  the full 33c daily workflow.

### Backward-compatible purchases route

`POST /api/v1/inventory/purchases` accepts exactly one body shape:

- Existing single purchase, unchanged except additive `purchasedAt?`:
  `{ productId, eventType: "PURCHASED" | "RESTOCKED", quantity?, unit?,
  confidence?, metadata?, purchasedAt? }`.
- New batch purchase:
  `{ purchasedAt?, items: [{ productId, quantity?, unit?, purchasedAt? }] }`.

The single shape keeps its current `InventoryEventResponseDto`. The batch shape
returns `{ items: MutationReceipt[] }` in input order. Batch items always create
`PURCHASED` events, default quantity to `1`, and use explicit unit, product
`typicalUnit`, then `item`. A request containing `items` plus any single-purchase
field is invalid. Duplicate `productId` values are invalid even when other item
fields differ. `items` contains between 1 and 100 entries.

### MCP contracts

- Existing `record_purchase` remains and gains optional `purchasedAt` without
  changing its output.
- New `update_inventory` accepts `productId` plus the stock-operation union and
  returns one mutation receipt.
- New `record_purchases` accepts the batch body and returns the ordered batch
  result.
- MCP contract `1.3.0` is additive and remains inside the checked-in agent
  skill's compatible range `>=1.0.0 <2.0.0`. Tool descriptions must not claim
  Hermes or OpenClaw already route conversations to the tools before 33e.

## Testing

- Jest is configured and is a required gate for every validation, timestamp,
  estimation, unit, mutation, aggregation, and error-mapping branch added here.
- Use fake timers for receipt-time capture, future-date checks, and deterministic
  backdated materialization.
- Use mocked transaction clients for small ledger and service cases, including
  rollback, retry, result ordering, and statistics-failure isolation.
- Use PostgreSQL-backed Supertest coverage for transaction atomicity, concurrent
  mutations, historical timestamps, route-shape compatibility, authentication,
  and event-to-projection provenance.
- Add MCP tool discovery and invocation coverage plus generated-contract checks.
- There is no configured browser-test command and no UI in scope.
- With no configured Verify command, the final fallback gate is
  `npm run test`, `npm run test:e2e`, `npm run build`,
  `npm run contract:check`, `npm run skills:check`, `npm run agent:probe`, and
  `git diff --check`.

## Notes for the AI

- Keep controllers and MCP handlers thin. Validation may differ by transport,
  but both transport layers call one set of domain operations.
- Preserve the legacy single-purchase REST and MCP contracts while adding the
  new batch contracts. Do not repurpose `record_purchase` as a batch tool.
- Capture `receivedAt` once per request and pass it inward. Do not call
  `new Date()` independently for validation, event timestamps, and evaluation.
- Use the existing `runStockTransaction` serializable retry boundary. The batch
  opens one transaction for the whole request; ledger helpers never open nested
  transactions.
- Keep decrement event quantity as the amount consumed. Preserve the projection's
  prior `recorded*` absolute fact so provenance does not falsely claim the
  consumed amount is the remaining balance.
- Resolve products and stock inputs inside the transaction where atomicity or a
  concurrent update matters. Never trust a pre-transaction existence check as
  the mutation guard.
- Do not use `Promise.all` for concurrent writes to the same transaction client
  when deterministic ordering is required.
- Keep transport provenance server-owned and maintain service-auth protection.
- Translate stock-ledger and Prisma failures to stable client-safe errors without
  exposing internal details.
- Treat the forward calculator and mutation receipt as load-bearing for 33c and
  33d. Prefer pure functions and explicit types over duplicated calculations.
- Regenerate contract-owned artifacts through repository scripts. Do not
  hand-edit generated files.
- Run `graphify update .` after implementation changes.

## Completion record

- Verified on 2026-09-03 with `npm run build`, `npm test -- --runInBand`,
  `npm run test:e2e -- --runInBand --silent`, `npm run contract:check`,
  `npm run skills:check`, live Hermes and OpenClaw installation probes,
  `git diff --check`, and `graphify update .`.
- Final automated evidence: 867 unit tests, 265 PostgreSQL-backed end-to-end
  tests, 53 contract tests, and 93 executable agent scenarios passed.
