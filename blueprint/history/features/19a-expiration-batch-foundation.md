# Feature: Expiration-batch foundation

**From build-plan:** feature 19a
**Status:** complete

## Goal

Record an explicit, immutable expiry timestamp against one exact purchase or
restock event. The record gives later expiry evaluation a reliable source fact
without changing stock balances, existing purchase inputs or outputs, daily
stock estimation, or low-stock recommendations.

## In scope

- A PostgreSQL-backed expiration-batch record linked one-to-one with an existing
  `PURCHASED` or `RESTOCKED` inventory event and its product.
- A transactional domain operation that records a caller-supplied, timezone-aware
  expiry timestamp for an exact eligible event.
- One additive authenticated REST write route and one additive MCP mutation tool
  for that operation.
- Exact compatibility-contract, agent-bundle, documentation, unit, and
  PostgreSQL end-to-end updates required by the added MCP tool.

## Out of scope

- Changing `record_purchase`, `record_purchases`, grocery-purchase completion,
  stock-mutation, or inventory-event request and response shapes.
- Replacing, estimating, or deriving an expiry timestamp from
  `ProductShelfLifePolicy`; that is feature 19b.
- Evaluating expired or expiring-soon state, altering `StockProjection`, writing
  predictions, modifying low-stock recommendations, adding grocery items, or
  sending notifications; those belong to 19b and 19c.
- Quantity allocation, remaining quantity, per-location stock, receipt/barcode
  ingestion, bulk import, deletion, or expiry-record editing.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan the next step before editing.
2. Implement only that step and show its diff for review.
3. Verify its observable done-when before proceeding.
4. Keep checkpoints optional; `/complete` makes the feature commit after all
   steps and final checks pass.

## Build steps

- [x] **Step 1 - Add the immutable expiration-batch domain record** - add the
  Prisma migration, model relations, domain input/response types, validation,
  and a transactional service method. *Done when:* an expiry record can be
  created only once for an existing `PURCHASED` or `RESTOCKED` event; its product
  is derived from that event; `expiresAt` is an ISO timestamp with an explicit
  timezone and is not earlier than the event timestamp; invalid event IDs,
  ineligible event types, ambiguous timestamps, and duplicate records fail with
  stable safe errors; and every rejected write leaves no expiration record,
  inventory event, projection, prediction, or grocery item changed.

- [x] **Step 2 - Expose additive REST and MCP recording contracts** - add
  `POST /api/v1/inventory/purchases/:purchaseEventId/expiration` and
  `record_purchase_expiration`, both delegating to the same service method, and
  publish the required additive MCP contract release.
  *Done when:* the two transports accept only an exact event ID and explicit
  expiry timestamp, return the same record shape, preserve service-owned source
  attribution, and do not alter any existing route/tool schema or response.

- [x] **Step 3 - Prove the compatibility boundary** - update the API reference
  and compatibility scenarios, then prove old purchase, inventory, recommendation, and
  Home-Assistant read scenarios remain valid unchanged; focused tests prove
  successful REST/MCP writes, validation, duplicate rejection, event-type
  rejection, transaction rollback, and that current stock projections and
  low-stock output are byte-for-byte unchanged before and after expiry recording.

## Files / areas

- `prisma/schema.prisma` and a new Prisma migration - expiration-batch
  persistence and database constraints.
- `src/inventory/` - expiration service, domain types, DTO, controller wiring,
  module registration, and focused unit tests.
- `src/mcp/mcp-server.factory.ts` and MCP tests/fixtures - additive mutation
  tool and released contract evidence.
- `test/` - PostgreSQL end-to-end coverage across REST, MCP, ledger, and
  recommendation compatibility.
- `docs/api-reference.md`, `integrations/shared/home-stock-tracker/`, and the
  generated Hermes/OpenClaw bundles - public contract and agent guidance.

## Data / contracts

### Expiration batch

`ExpirationBatch` is a source fact, never an estimate:

- `id` - UUID primary key.
- `purchaseEventId` - unique FK to `InventoryEvent`, restricted to
  `PURCHASED` or `RESTOCKED` by the service. One event has zero or one record.
- `productId` - FK derived inside the transaction from `purchaseEventId`; no
  client can provide or change it.
- `expiresAt` - required absolute timestamp with an explicit timezone, at or
  after the purchase event timestamp.
- `recordedAt` - server timestamp for the recording operation.
- `source` - server-owned transport provenance (`api` or `mcp`).

The database uniqueness constraint on `purchaseEventId` is load-bearing. A
second write is a conflict, never an update or replacement. Recording the fact
does not mutate `InventoryEvent`, `StockProjection`, `Prediction`, statistics,
or grocery-list rows.

### Transport contract

Both transports accept:

```text
purchaseEventId: UUID
expiresAt: ISO 8601 datetime with explicit timezone
```

Both return the stored batch record with its ID, product ID, purchase-event ID,
expiry timestamp, recording timestamp, and server-owned source. The REST route
uses the event ID path parameter. MCP uses a new tool rather than extending
existing purchase tools, preserving released purchase schemas and allowing a
client to record the fact after it receives an event receipt.

Adding an MCP tool changes the published contract. Follow feature 32's capture,
version, generated-artifact, scenario, and probe workflow; do not hand-edit
generated bundles or silently overwrite a released fixture.

## Testing

- Add unit tests for timestamp parsing and validation, eligible event types,
  duplicate conflicts, and mapping of persistence failures to stable safe errors.
- Add PostgreSQL integration coverage for atomic success, no side effects after
  each rejected request, concurrent duplicate attempts, and exact event/product
  linkage.
- Add REST and MCP tests proving their response shape and source attribution,
  then update the MCP contract fixture and agent scenarios through the existing
  generation commands.
- Extend the stock-ledger and low-stock end-to-end checks with before/after
  assertions for projection rows and recommendation responses. These are the
  primary regression tests for this feature.
- Run focused Jest tests during each logic-bearing step, then `npm run test`,
  `npm run test:e2e`, `npm run contract:check`, `npm run verify`, and
  `git diff --check` before completion.

## Notes for the AI

- Preserve the current one-projection-per-product ledger. An expiration batch is
  evidence for later evaluation, not a second inventory balance.
- Use the existing serializable transaction and error conventions in
  `InventoryService`; never create an expiry record outside the event lookup and
  insert transaction.
- Keep controllers and MCP handlers thin. The domain service owns event
  eligibility, product derivation, timestamp validation, duplicate handling, and
  source attribution.
- Keep public additions strictly additive. Existing clients must be able to send
  their current purchase and stock requests and receive unchanged responses.
- Use `apply_patch` for edits. After implementation changes, run
  `graphify update .` to refresh the repository graph.
