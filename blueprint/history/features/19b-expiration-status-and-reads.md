# Feature: Expiration status and reads

**From build-plan:** feature 19b
**Status:** verified

## Goal

Expose a read-only, batch-level expiry view so a client can see whether each
purchase or restock is fresh, expiring soon, expired, nonperishable, or lacks
enough shelf-life information. Exact recorded expiry timestamps take precedence
over a product's existing shelf-life policy. This creates no inventory fact,
prediction, recommendation, or grocery-list change.

## In scope

- A pure, injectable expiry-status evaluator with a fixed seven-day
  expiring-soon window and a single supplied evaluation time.
- Read-only derivation for every `PURCHASED` or `RESTOCKED` event: use its
  linked `ExpirationBatch.expiresAt` when present, otherwise use a finite
  `ProductShelfLifePolicy.shelfLifeDays` added to the event timestamp.
- A new authenticated REST read, `GET /api/v1/inventory/expiration`, and an
  additive MCP read tool, `list_expiration_status`, that delegate to one
  inventory-domain read service.
- Released MCP contract, agent-bundle, API-reference, scenario, fixture, and
  probe updates required by the new MCP tool.

## Out of scope

- Recording, editing, deleting, importing, or allocating expiration batches.
- Changing the existing purchase, restock, inventory-event, stock-projection,
  grocery, low-stock, prediction, or materialized inventory read contracts.
- Mutating `StockProjection`, inferring consumption, deciding whether a batch
  remains physically on hand, or removing expired stock.
- Adding a recommendation, notification, grocery addition, scheduler, UI,
  pagination, filters, or product-specific expiry-window configuration. Those
  belong to feature 19c or later work.

## Build steps

- [x] **Step 1 - Lock the pure batch-expiry contract** - add the expiry-status
  types and a pure evaluator that accepts a purchase/restock timestamp, optional
  explicit expiry timestamp, optional shelf-life policy, and one `asOf` time.
  *Done when:* an explicit timestamp always wins over a policy; finite-policy
  expiry is exactly `event.timestamp + shelfLifeDays` in elapsed UTC time;
  `expiresAt <= asOf` is `expired`; a later expiry at or before `asOf + 7 days`
  is `expiring_soon`; a later expiry is `fresh`; a nonperishable policy is
  `nonperishable`; and no explicit date or usable policy is `unknown`, with no
  database writes or clock read inside the evaluator.

- [x] **Step 2 - Add the read-only REST domain path** - query eligible events,
  their optional batches, canonical product names, and policies once; map them
  through the evaluator; then expose `GET /api/v1/inventory/expiration` through
  a thin controller. *Done when:* the response returns one item per eligible
  event, is sorted by known expiry ascending then product name and event ID,
  includes expired and unknown items, returns an empty list when none exist,
  rejects no valid product state, and creates or changes no database row.

- [x] **Step 3 - Publish the additive MCP read contract** - register
  `list_expiration_status` as a strict empty-input, read-only MCP tool that
  returns the same domain response, then release MCP contract `1.6.0` and
  regenerate and validate its artifacts and agent guidance. *Done when:* REST
  and MCP serialize the same item shape and source semantics; the MCP tool is
  marked read-only, idempotent, non-destructive, and closed-world; released
  fixtures, manifests, Hermes/OpenClaw guidance, API documentation, scenarios,
  and probes include the new tool; and existing tool schemas remain unchanged.

- [x] **Step 4 - Prove status boundaries and non-interference** - add focused
  unit, REST, MCP, and PostgreSQL evidence for the evaluator and read paths.
  *Done when:* tests prove exact-boundary classification, precedence, all policy
  cases, ordering, empty data, transport parity, and read-only behavior; existing
  materialized inventory and low-stock outputs remain unchanged before and after
  expiry reads; and the repository quality gates pass.

## Files / areas

- `src/inventory/types/` and `src/inventory/` - pure expiry evaluation, domain
  read service/query, response DTOs, controller and module wiring, plus focused
  Jest tests.
- `src/mcp/mcp-server.factory.ts`, MCP tests, contract fixtures, and generated
  release artifacts - the additive `list_expiration_status` tool and released
  public contract.
- `test/` - PostgreSQL-backed REST/MCP and non-interference coverage.
- `docs/api-reference.md`, `integrations/shared/home-stock-tracker/`, and
  generated Hermes/OpenClaw bundles - public read guidance and release evidence.

## Data / contracts

### Load-bearing status contract

`ExpirationStatus` is one of `expired`, `expiring_soon`, `fresh`,
`nonperishable`, or `unknown`.

Every response item is batch-oriented and contains:

```text
purchaseEventId: UUID
productId: UUID
productName: string
purchasedAt: ISO 8601 timestamp
expiresAt: ISO 8601 timestamp | null
status: ExpirationStatus
expirySource: "explicit" | "shelf_life_policy" | "none"
shelfLifeDays: number | null
evaluatedAt: ISO 8601 timestamp
```

- `explicit` means `expiresAt` comes from `ExpirationBatch` and always wins.
- `shelf_life_policy` means the product has a finite policy and `expiresAt` is
  derived as `purchasedAt + shelfLifeDays`.
- A nonperishable policy returns `status: nonperishable`, `expiresAt: null`,
  `expirySource: shelf_life_policy`, and `shelfLifeDays: null`.
- `none` means no explicit date and no usable policy; it returns
  `status: unknown`, `expiresAt: null`, and `shelfLifeDays: null`.
- `EXPIRING_SOON_WINDOW_DAYS = 7` is a load-bearing fixed domain constant for
  this feature. The boundary is inclusive. A later feature may introduce a
  policy only through an explicit contract change.
- The result is evidence about a purchase event, not proof that its quantity is
  still present. No quantity or on-hand claim is included.

The REST response is `{ items: ExpirationStatusItem[] }`. The MCP output is
identical. Both use server evaluation time and return it per item so a client
can interpret a status without relying on its own clock. Neither accepts input,
filters, or pagination in this feature.

## Testing

- Jest unit tests cover explicit-over-policy precedence, finite-policy elapsed
  UTC calculation, exact expired and seven-day boundaries, fresh values,
  nonperishable policy, missing policy, malformed impossible persistence shape,
  and stable sort ordering.
- PostgreSQL/Supertest tests cover mixed eligible events, explicit batches,
  finite and nonperishable policies, no-policy events, empty reads, response
  serialization, and no writes to expiration batches, events, projections,
  predictions, or grocery rows.
- MCP tests cover strict empty input, annotations, response parity, contract
  fixture generation, and unchanged existing tool schemas. Extend the existing
  compatibility scenarios and generated bundle/probe checks for the new read
  tool.
- Run focused Jest tests during each logic-bearing step, then `npm run test`,
  `npm run test:e2e`, `npm run contract:check`, `npm run verify`, and
  `git diff --check` before completion. There is no browser-test command;
  direct REST/MCP evidence is the verification path.

## Notes for the AI

- Keep the evaluator pure and pass `asOf` from the read layer so time-boundary
  tests never depend on wall-clock timing.
- Use explicit Prisma selects and one read query. Controllers and MCP handlers
  stay transport-only; do not put precedence or status logic there.
- Preserve the source-fact rule from 19a: never overwrite `ExpirationBatch` or
  treat a policy-derived date as stored fact.
- Preserve the materialized-inventory boundary from 33d: this feature does not
  alter `get_inventory`, `list_inventory`, projections, or low-stock behavior.
- Adding an MCP tool is a released compatibility-contract change. Follow the
  repository generation workflow, make the additive `1.5.0` to `1.6.0` release,
  and do not hand-edit generated bundles or replace an existing fixture without
  its release checks.
- Use `apply_patch` for edits. After implementation changes, run
  `graphify update .`.
