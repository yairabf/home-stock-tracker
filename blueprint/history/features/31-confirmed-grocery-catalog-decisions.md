# Feature: Confirmed grocery catalog decisions

**Type:** Feature
**From build-plan:** feature 31
**Status:** complete
**Base branch:** `main`
**Depends on:** feature 30 (complete)

## Completion record

**Completed:** 2026-09-01

Delivered deterministic confirmation operations for the two catalog decisions
that can follow a grocery-add proposal. Authenticated REST clients and MCP agents
can submit a final approved product definition or attach an approved alias to an
exact product ID, then complete the original grocery addition through shared,
transactional `GroceryService` orchestration. Confirmation never invokes the LLM,
accepts proposal state, or trusts caller-supplied source attribution. Product and
grocery writes are atomic, pending-line ambiguity is preserved, alias retries are
same-owner idempotent, and catalog conflicts return stable errors.

Main changed areas:

- `src/grocery/` adds strict confirmation DTOs and result types, transactional
  create/alias orchestration, thin REST endpoints, and focused unit tests.
- `src/product/` adds transaction-aware explicit-product and alias confirmation
  boundaries, batched namespace ownership validation, and stable not-found and
  conflict behavior.
- `src/mcp/` publishes `grocery_confirm_new_product` and
  `grocery_confirm_product_alias` with strict schemas, structured results, and
  server-owned `mcp` provenance.
- `test/` proves the service, authenticated REST, and real MCP flows against
  PostgreSQL, including rollback, retries, pending-line confirmation, and
  concurrent-write convergence.
- `docs/`, `README.md`, and `integrations/hermes/` document that proposals are
  advisory, confirmation payloads are authoritative, and quantity ambiguity is a
  separate decision; the grocery-specific MCP-05 path is recorded as delivered.
- `blueprint/` records the feature and final audit repairs, while `graphify-out/`
  was refreshed after the source changes.

Verification:

- `npm test -- --runInBand`: 46 suites and 613 tests passed.
- `npm run test:e2e -- --runInBand`: 23 suites and 205 tests passed against
  PostgreSQL, including authenticated REST, real MCP-client discovery and calls,
  rollback, stable error branches, and concurrent convergence.
- `npm run build`: passed.
- Focused `npx eslint` over every changed TypeScript source and test file: passed.
  Repository-wide lint was not used as the gate because it has a known
  pre-existing baseline of 237 errors and runs with auto-fix enabled.
- `git diff --check main...HEAD`: passed.
- Behavioral done-whens were proven by the real REST and MCP E2E suites and the
  PostgreSQL-backed service suite. The manual path is to start the dev server and
  call either confirmation REST route or its matching MCP tool; `/try latest`
  provides the full walkthrough.
- `/audit current` found two P2 issues. Step 7 batched confirmed-name validation
  and corrected contradictory API guidance; the follow-up audit closed both.

Material deviations:

- The supplied feature plan was queued but not yet registered in the build plan.
  Autopilot added it as feature 31 and refreshed the project overview before
  implementation.
- The targeted audit added Step 7 to repair two P2 findings before completion.
- No behavioral scope was removed, and no database migration was needed.

## Goal

Let REST, MCP, UIs, and agents apply a user's final, explicit catalog decision and
complete the original grocery-add request through deterministic, concurrency-safe
operations. Confirmation never invokes the LLM, trusts proposal state, or guesses
product or quantity intent.

## In scope

- Two grocery use cases: confirm a new product and confirm an alias for an exact
  target product ID.
- Separate product and grocery-item payloads, with server-owned transport source.
- Atomic product creation plus grocery-line creation when both are needed.
- Same-owner-idempotent alias persistence followed by normal pending-line detection.
- Alias persistence when the grocery result is `confirmation_required`.
- Stable validation, not-found, name-conflict, retry, and concurrent-write behavior.
- Thin REST endpoints and MCP tools over shared `GroceryService` orchestration.
- API, MCP, Hermes, scenario, and MCP-05 tracking updates.

## Out of scope

- Generic product administration tools, canonical rename, alias removal, product
  merge, or deletion.
- Proposal IDs, proposal persistence, regeneration, or any confirmation-time LLM call.
- Automatic grocery-line merging or server-side quantity arithmetic.
- Standalone alias teaching outside an original grocery-add flow.
- Multi-household catalog governance.

## Build loop

Build and verify one reviewable step at a time. Autopilot may checkpoint each
passing step on the feature branch, but stops before `/complete`, merge, push, or
deployment.

## Build steps

- [x] **Step 1 - Lock confirmation contracts and conflicts** - define focused
  request DTOs, shared result types, MCP input schemas, and stable error codes.
  **Done when:** product and grocery fields validate independently, alias targets
  require exact IDs, invalid or conflicting shapes have stable results, and no
  contract accepts proposal state or source attribution.
- [x] **Step 2 - Expose confirmed new-product orchestration** - reuse feature 30's
  explicit product-and-grocery transaction through a dedicated confirmation use
  case. **Done when:** first calls are atomic, exact-identity retries safely reuse
  the product, conflicting canonical or alias names stop with
  `PRODUCT_NAME_CONFLICT`, pending quantities remain unchanged, and tests prove no
  LLM path is called.
- [x] **Step 3 - Implement confirmed alias orchestration** - add a caller-owned
  transaction boundary for same-owner-idempotent alias persistence followed by
  duplicate-aware grocery handling. **Done when:** deleted targets and cross-owner
  aliases return stable errors, same-target retries converge, an approved alias
  survives `confirmation_required`, and concurrent calls create neither duplicate
  aliases nor implicit grocery lines.
- [x] **Step 4 - Expose REST confirmation endpoints** - add thin authenticated
  routes and explicit response DTOs for both operations. **Done when:** real HTTP
  E2E tests cover create, alias, pending-line confirmation, idempotent retries,
  malformed requests, deleted targets, and name conflicts.
- [x] **Step 5 - Expose MCP confirmation tools** - register
  `grocery_confirm_new_product` and `grocery_confirm_product_alias` with complete
  descriptions and structured results. **Done when:** real MCP-client tests prove
  both tools are discoverable, use `mcp` provenance, never invoke the LLM, preserve
  confirmation and conflict details, and reject proposal or source fields.
- [x] **Step 6 - Align documentation and agent workflows** - update public API and
  MCP guidance, Hermes instructions and scenarios, and MCP-05 tracking. **Done
  when:** clients are told proposals are advisory, confirmations require final
  approved payloads, quantity ambiguity is a separate decision, stale conflicts
  are not auto-retried, the grocery-specific MCP-05 path is delivered, and
  standalone alias teaching remains deferred.
- [x] **Step 7 - Repair F-01 and F-02 from the targeted audit** - batch confirmed
  namespace ownership validation and remove stale API-reference contradictions.
  **Done when:** one indexed query validates all supplied names, the documented
  current behavior is coherent, affected tests and full gates pass, and a fresh
  audit closes both findings.

## Files / areas

- `src/grocery/grocery.service.ts`, `src/grocery/grocery.controller.ts`, and
  `src/grocery/dto/`.
- `src/product/product.service.ts` transaction-aware catalog boundaries.
- `src/mcp/mcp-server.factory.ts` and focused unit/contract tests.
- PostgreSQL-backed service, REST, and real MCP E2E suites under `test/`.
- `docs/api-reference.md`, root integration guidance, and
  `integrations/hermes/home-stock-tracker/`.
- `blueprint/context/bugs/mcp-05-no-controlled-alias-management-tool.md`.

## Data / contracts

- Confirm-new-product accepts `product` with `canonicalName`, `aliases`,
  `category`, nullable `typicalUnit`, `productType`, and `isPerishable`, plus a
  separate `groceryItem` with optional positive `requestedQuantity`, `unit`, and
  `note`.
- Confirm-alias accepts exact `targetProductId`, approved `alias`, and the same
  separate `groceryItem` shape.
- Both operations force `ifPendingExists: return_existing`; confirmation callers
  cannot bypass ambiguity by asking the service to create a separate line.
- New grocery lines default omitted quantity to `1`; existing pending lines return
  `confirmation_required` with the original material request and no quantity write.
- `ProductName` remains the globally unique canonical-and-alias namespace. No
  migration or proposal table is required.
- Source is transport-owned (`api` or `mcp`) and is never accepted in request bodies.
- Stable catalog failures use `PRODUCT_NAME_CONFLICT` and `PRODUCT_NOT_FOUND`.

## Testing

- DTO and schema tests for strict confirmation shapes, positive quantities, exact
  IDs, and rejected proposal/source fields.
- Service tests for atomic create-and-add, rollback, same-identity retry, alias
  success, same-target retry, cross-target conflict, target deletion, alias
  persistence on grocery confirmation, and no LLM invocation.
- PostgreSQL concurrency coverage for product-name and pending-line convergence.
- REST E2E coverage for both endpoints and every result/error branch.
- Real MCP-client coverage for discovery, source ownership, structured success,
  `confirmation_required`, and stable errors.
- Run `npm test -- --runInBand`, `npm run test:e2e -- --runInBand`, and
  `npm run build`. Run focused ESLint on changed TypeScript because repository-wide
  lint has a known pre-existing baseline outside this feature.

## Notes for the AI

- `GroceryService` owns orchestration; `ProductService` owns namespace validation
  and writes. Controllers and MCP handlers stay thin.
- Reuse feature 30's `addForProductWithinTransaction` and explicit-product path;
  do not build a parallel grocery algorithm.
- Do not hold a transaction open across an LLM call. Confirmation has no LLM call.
- Treat a proposal as advisory input to the user only. The final approved payload
  is the complete authority at confirmation time.
- Preserve local NestJS DTO, Prisma serializable-transaction, exception, MCP schema,
  and test patterns. No unrelated refactor.

## Findings

### 31/F-01 [P2] closed - Confirmed-name validation issues one query per approved name

**File:** src/product/product.service.ts:406
**Found:** 2026-09-01 by /audit (scope: current; lens: performance)
**Why it matters:** Retrying a confirmed product with many aliases performs one
namespace query for every canonical or alias name inside the serializable
transaction. The request body is bounded, but transaction duration and database
work still grow linearly when one indexed query can validate the same set.
**Suggested fix:** Fetch all matching `ProductName` owners in one `in` query,
group them by normalized name, and preserve the existing integrity and conflict
checks per supplied name.
**Resolution:** Batched all supplied normalized names into one indexed `in`
query, then preserved per-name integrity and ownership checks from the grouped
result. Re-audit confirmed one namespace query, intact per-name conflict checks,
passing focused tests, PostgreSQL concurrency coverage, and no new defect.

### 31/F-02 [P2] closed - Grocery API reference still describes delivered flows as future or impossible

**File:** docs/api-reference.md:104
**Found:** 2026-09-01 by /audit (scope: current; lens: quality)
**Why it matters:** The reference calls policy-aware additions a future flow and
later says grocery routes cannot create unknown products, contradicting the
delivered add and confirmation contracts documented in the same section.
Clients could avoid the supported flow or implement the wrong precondition.
**Suggested fix:** Describe the advisory service as part of the current
policy-aware flow and scope exact-name requirements to update/remove operations
instead of all grocery routes.
**Resolution:** Updated the stale future wording and scoped the existing-ID
requirement to grocery updates and removals. Re-audit confirmed both
contradictions are gone and the surrounding product, add, confirmation, update,
and removal guidance remains coherent.
