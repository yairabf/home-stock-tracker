# Fix: Guard grocery removal by pending state

**Type:** Fix
**Status:** Complete

## Completion record

**Completed:** 2026-08-30

Grocery removal now uses a conditional persistence update so only a pending item
can become removed. Unknown IDs return a stable `404`; purchased, removed, and
stale concurrent attempts return a stable `409`. REST and MCP expose the same
domain behavior, and Hermes guidance prohibits retrying final domain failures or
writes with uncertain transport outcomes.

Changed areas:

- `src/grocery/grocery.service.ts` - enforces the atomic pending-state predicate.
- `src/grocery/grocery.service.spec.ts` - covers success, stable failures, and the
  stale concurrent loser.
- `test/grocery-remove.e2e-spec.ts` - verifies REST, MCP, PostgreSQL persistence,
  and a real concurrent purchase/removal race.
- `docs/api-reference.md` and `integrations/hermes/home-stock-tracker/SKILL.md` -
  document the stable contract and safe retry behavior.
- `graphify-out/` - refreshes the project knowledge graph after code changes.

Verification:

- `npm run test -- --runInBand src/grocery/grocery.service.spec.ts` - 1 suite and
  5 tests passed.
- `npm run test -- --runInBand` - 31 suites and 329 tests passed.
- `npm run test:e2e -- --runInBand` - 9 suites and 57 tests passed.
- `npm run build` - NestJS build passed.
- `git diff --check` - passed.
- Persistence-backed REST and MCP assertions verified pending success, terminal
  state rejection, stable errors, and exactly one concurrent terminal winner.

**Deviations:** None.

## The problem

`GroceryService.removeItem()` read a grocery item by ID and then updated it by ID
alone. As a result, REST and MCP callers could change an already `purchased` or
already `removed` item to `removed`, and a concurrent purchase/removal race could
overwrite the terminal state selected by the winning operation. The MCP handler
delegates to this service, so the invariant belongs in the shared service and
persistence operation rather than only at the tool boundary.

## The fix

Make removal an atomic `pending` to `removed` transition in `GroceryService`.
Preserve `404 Not Found` for an unknown grocery-item ID and return a stable `409
Conflict` for any known non-pending item or stale concurrent loser. Keep REST and
MCP delegating to the same service behavior, document the stable errors, and retain
the existing agent guidance that uncertain writes must not be retried blindly.

Do not change the grocery schema, add a hard delete, or allow removal to overwrite
`purchased` or `removed` state.

## Build steps

- [x] **Step 1 - Enforce the transition atomically in the grocery service.** Add a
  persistence-level status predicate so only a row whose current status is
  `pending` can become `removed`; distinguish an unknown ID from a known item that
  is no longer pending and map those outcomes to stable NestJS `404` and `409`
  errors. Add focused service tests for success, not found, purchased, removed, and
  a stale concurrent loser. *Done when:* the service can remove a pending item,
  cannot overwrite either terminal status, and only one competing terminal
  transition can succeed.

- [x] **Step 2 - Prove and document the REST and MCP contracts.** Add
  persistence-backed regression coverage that exercises removal through REST and
  MCP, including pending success plus purchased/already-removed rejection, and
  verify MCP exposes the shared domain failure as a tool error. Update the API and
  agent-facing documentation with the stable `404`/`409` behavior and the rule not
  to retry writes after uncertain transport outcomes. *Done when:* both transports
  demonstrate the same guarded transition against real persistence, and callers
  have an explicit, machine-actionable error contract without blind-write retry
  guidance.

## Verify

- Run `npm run test`.
- Run `npm run test:e2e` with the test PostgreSQL database available.
- Run `npm run build`.
- Confirm a pending item is removed through both REST and MCP.
- Confirm unknown IDs fail with `404`, while purchased, removed, and stale
  concurrent attempts fail with `409` and leave the stored terminal state intact.
