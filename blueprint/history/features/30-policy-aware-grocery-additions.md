# Feature: Policy-aware grocery additions

**Proposed build-plan:** feature 30
**Status:** complete
**Depends on:** features 27, 28, and 29 (complete)
**Intended history file:** `blueprint/history/features/30-policy-aware-grocery-additions.md`

## Completion record

**Completed:** 2026-09-01

Delivered one policy-aware grocery-add application operation shared by REST and
MCP. Deterministic clients can atomically resolve or create a fully specified
product and its first grocery line without LLM use. Assisted clients can resolve
exact identities or receive a successful, non-mutating
`product_resolution_required` result with deterministic candidates, optional
non-authoritative advice, and server-computed actions. Pending-line confirmation,
positive quantity rules, source attribution, stable concurrency handling, API
documentation, and Hermes behavior now use the same contract.

Main changed areas:

- `src/grocery/` defines and orchestrates the policy-aware request and result
  contracts, transaction ownership, pending-line behavior, REST mapping, and
  validation.
- `src/product/product.service.ts` supplies caller-owned transaction support for
  exact reuse or complete explicit creation without classification.
- `src/mcp/mcp-server.factory.ts` exposes discoverable policy fields, the MCP
  proposal default, deterministic override, successful resolution outcomes, and
  server-owned `mcp` provenance.
- `test/` proves REST, MCP, atomicity, rollback, proposal no-write behavior, and
  concurrent convergence against PostgreSQL and real HTTP/MCP clients.
- `docs/`, `README.md`, and `integrations/hermes/` document the direct and
  assisted flows and prevent guessed product identity or quantity.
- `graphify-out/` was refreshed after the source changes.

Verification:

- `npm test -- --runInBand`: 44 suites and 579 tests passed.
- `npm run test:e2e -- --runInBand`: 22 suites and 180 tests passed against
  PostgreSQL, including authenticated REST, a real MCP client, transaction
  rollback, no-write proposal outcomes, and concurrent product and pending-line
  convergence.
- `npm run build`: passed.
- `npx eslint` on the feature's changed production files, focused tests, and the
  post-audit repair: passed. Repository-wide lint still has an existing baseline
  of 237 errors outside the delivered production changes.
- `/check` equivalent evidence came from the real REST and MCP E2E suites, plus
  the PostgreSQL-backed service suite. `/audit current` reviewed all lenses and
  closed finding `30/F-01` after its repair and re-verification.

Material deviations:

- The MCP SDK does not preserve a root Zod union as a useful discoverable JSON
  schema. MCP therefore publishes one strict object containing every branch
  field and enforces branch exclusivity with runtime refinement. Real-client
  tests prove discovery and cross-branch rejection.
- The final audit removed the remaining legacy `GroceryService.addItem()` path
  and its compatibility-only tests so internal callers cannot bypass the new
  policy contract.

## Goal

Make add-to-grocery-list behavior explicit for deterministic and assisted clients.
A deterministic client can provide complete product facts and create a missing
catalog identity, while an assisted client can pause for a product decision
without changing catalog or grocery state.

## In scope

- Replace implicit exact-or-alias auto-creation with one policy-aware grocery-add
  application operation.
- Support the named policies `create_if_missing` and `propose_if_missing`.
- Default REST to `create_if_missing` and MCP to `propose_if_missing` at their
  transport boundaries.
- Use mutually exclusive product inputs and keep product facts separate from
  grocery-line facts.
- Reuse exact namespace lookup, product search, product-resolution proposals,
  positive quantity rules, pending-line policies, and source attribution.
- Add `product_resolution_required` as a successful, non-error domain outcome.
- Return the material grocery request, deterministic candidates, optional advice,
  and server-computed allowed actions when product resolution is required.
- Make deterministic product creation and grocery-line creation atomic when both
  are required.
- Make concurrent product creation converge on one product and then use the normal
  pending-line behavior without exposing raw database errors.
- Align the application service, REST, MCP, API docs, Hermes guidance, scenarios,
  and the SKILL-01 finding.

## Out of scope

- Applying a proposed create or alias decision. Feature 31 owns confirmation
  writes.
- Generic catalog administration, canonical rename, alias removal, product merge,
  deletion, or grocery-line merge.
- LLM use in `create_if_missing`.
- Server-side quantity arithmetic or implicit pending-line quantity changes.
- Proposal persistence, proposal IDs, or a second LLM call after confirmation.
- Changes to the standalone product-create REST contract unless a shared internal
  type can be reused without widening that public endpoint.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step, including focused tests for its logic.
3. It shows the diff, not full files; you read and understand it.
4. You approve, then choose whether to commit a checkpoint or continue.
   Checkpoints are optional; `/complete` makes the feature-level commit.

Never accept a step you have not read. If a diff is too big to review, split the
step.

## Build steps

- [x] **Step 1 - Lock policy-aware contracts and defaults** - define the internal
  request union, REST DTO validation, MCP Zod schemas, product-creation payload,
  grocery payload, result union, allowed-action enum, and transport default
  mapping without replacing the active handler yet. *Done when:* focused tests
  prove the branches are mutually exclusive, reject mixed or incomplete product
  inputs and unknown fields, validate positive finite quantities, materialize the
  correct transport default, preserve the pending-line policy, and represent
  `product_resolution_required` as a successful discriminated result.
- [x] **Step 2 - Add transaction-aware explicit product resolution** - add a
  focused internal `ProductService` boundary that resolves an exact canonical or
  alias identity or creates a missing product from the complete explicit payload
  inside a caller-owned transaction. It must not classify, invoke an LLM, add an
  alias to an existing product, or update existing metadata. *Done when:* service
  and database tests prove exact reuse, complete explicit creation, a stable
  namespace-conflict signal for caller-level race recovery, and zero classifier
  or resolution-provider calls. End-to-end convergence is proved in Step 3.
- [x] **Step 3 - Implement deterministic grocery orchestration** - route
  `create_if_missing` through `GroceryService`, using the transaction-aware product
  boundary and the existing pending-line policies. Keep product and grocery-line
  creation atomic when both are new, default a newly created line's omitted
  quantity to `1`, and preserve `confirmation_required` without changing existing
  quantities. *Done when:* tests prove known products ignore creation-only
  metadata, unknown products and their first grocery line commit or roll back
  together, `return_existing` and intentional `create_separate` retain their
  behavior, concurrent requests converge on one product and no unintended
  duplicate line, and no raw uniqueness or serialization error escapes.
- [x] **Step 4 - Implement non-mutating proposal orchestration** - route
  `propose_if_missing` through `ProductResolutionService` after grocery input
  validation and outside any open database transaction. Exact matches continue
  through normal pending-line handling; unresolved phrases return
  `product_resolution_required` with the request echo, candidates, optional
  proposal, and deterministic allowed actions. *Done when:* tests prove exact
  matches bypass candidate advice, unresolved requests create no product, alias,
  grocery item, inventory, prediction, or household state, provider failure yields
  `proposal: null`, allowed actions never come from provider output, and only the
  allowlisted inference log permitted by feature 29 may be written.
- [x] **Step 5 - Replace the REST add boundary** - map the REST request union to
  the shared operation with `create_if_missing` as the omission default and keep
  source attribution server-owned. *Done when:* authenticated REST E2E tests prove
  the default and both explicit policies, all three result branches, invalid mixed
  shapes, atomic rollback, stable conflict serialization, and a 2xx
  `product_resolution_required` response rather than an exception.
- [x] **Step 6 - Replace the MCP grocery-add boundary** - expose the same operation
  with `propose_if_missing` as the omission default, an explicit deterministic
  override, complete runtime input/output schemas, and correctness-critical tool
  text. *Done when:* a real MCP client discovers all policy-specific input and
  result fields, runtime validation rejects cross-branch shapes, omitted and
  explicit policies behave as documented, proposal
  outcomes have `isError: false`, source remains `mcp`, and existing structured
  grocery errors remain safely serialized.
- [x] **Step 7 - Align documentation and agent behavior** - update API docs,
  Hermes skill metadata/guidance, README, executable scenarios, and SKILL-01
  tracking. *Done when:* direct-client and assisted-client flows are both
  documented, proposal advice is clearly non-authoritative, agents begin uncertain
  names in proposal mode, never invent quantity or product identity, and SKILL-01
  records passing REST/MCP evidence and is marked resolved.

## Files / areas

- `src/grocery/grocery.service.ts`
- `src/grocery/grocery.controller.ts`
- `src/grocery/dto/` and focused DTO/contract tests
- `src/product/product.service.ts` and focused unit/database tests
- `src/product/product-resolution.service.ts` only through its delivered public
  application boundary
- `src/mcp/mcp-server.factory.ts` and real MCP contract tests
- Grocery, product, REST, MCP, concurrency, and rollback E2E tests under `test/`
- `integrations/hermes/home-stock-tracker/`
- `docs/api-reference.md`
- `blueprint/context/bugs/skill-01-the-checked-in-skill-contradicts-actual-product-creation-behavior.md`
- `blueprint/context/bugs/triage.md` if it still indexes SKILL-01 as open

## Data / contracts

### Shared request policies

```ts
type UnknownProductPolicy = 'create_if_missing' | 'propose_if_missing';

type PendingGroceryItemPolicy = 'return_existing' | 'create_separate';
```

- Transports must resolve an omitted unknown-product policy before calling the
  application service. The shared service always receives an explicit policy.
- For REST, omission selects `create_if_missing`; therefore `product` is required
  and `productName` is forbidden.
- For MCP, omission selects `propose_if_missing`; therefore `productName` is
  required and `product` is forbidden.
- An explicit policy selects its matching branch in either transport.
- The legacy flat `{ productName, requestedQuantity, unit, note }` write shape is
  replaced rather than silently interpreted. Contract and documentation tests must
  make that breaking migration visible.

### `create_if_missing` request

```json
{
  "unknownProductPolicy": "create_if_missing",
  "product": {
    "canonicalName": "3% Milk",
    "aliases": ["Three Percent Milk"],
    "category": "dairy",
    "typicalUnit": "carton",
    "productType": "fast_consumable",
    "isPerishable": true
  },
  "groceryItem": {
    "requestedQuantity": 2,
    "unit": "cartons",
    "note": "for the children",
    "ifPendingExists": "return_existing"
  }
}
```

- `canonicalName`, `aliases`, `category`, `typicalUnit`, `productType`, and
  `isPerishable` are explicit creation facts. `aliases` may be empty and
  `typicalUnit` may be `null`; the other fields are required.
- Normalize and look up `canonicalName` first. If it already resolves, reuse that
  product and ignore all creation-only metadata, including supplied aliases.
- If canonical identity is absent, validate the complete payload and create it
  without classification, proposal generation, or silent alias inference.

### `propose_if_missing` request

```json
{
  "unknownProductPolicy": "propose_if_missing",
  "productName": "3% milk",
  "groceryItem": {
    "requestedQuantity": 2,
    "unit": "cartons",
    "note": "for the children",
    "ifPendingExists": "return_existing"
  }
}
```

- `productName` is a non-blank product phrase and `product` is forbidden.
- An exact canonical or alias match proceeds directly to pending-line detection.
- An unresolved phrase returns candidates and optional feature-29 advice without a
  catalog or grocery mutation.

### Shared grocery request

- `groceryItem` is required in both branches, even when it is an empty object.
- `requestedQuantity` is optional but, when present, must be finite and positive.
- A new line persists `requestedQuantity: 1` when it was omitted.
- `ifPendingExists` defaults to `return_existing`; `create_separate` remains an
  intentional explicit override.
- `source` is not accepted in either public body. REST supplies `api`; MCP supplies
  `mcp`.

### Result union

- Every branch returns `requestedAddition` with display-normalized `productName`,
  nullable `requestedQuantity`, `unit`, and `note`, plus the resolved
  `ifPendingExists` value. In deterministic mode, the echoed product name is the
  supplied canonical display name.
- `created` retains `createdItem`, empty `existingItems`, and
  `requestedAddition`.
- `confirmation_required` retains `createdItem: null`, all current matching
  pending lines, and `requestedAddition` without mutation.
- `product_resolution_required` contains only the resolution fields in addition
  to its discriminator:

```json
{
  "outcome": "product_resolution_required",
  "requestedAddition": {
    "productName": "3% milk",
    "requestedQuantity": 2,
    "unit": "cartons",
    "note": "for the children",
    "ifPendingExists": "return_existing"
  },
  "candidates": [],
  "proposal": null,
  "allowedActions": ["create_product", "cancel"]
}
```

- The request echo uses display-normalized input (NFKC, trim, collapsed internal
  whitespace) without case-folding. Omitted quantity remains `null`; the resolved
  pending policy is echoed so a later confirmation can preserve intent.
- Allowed-action values are `use_existing_product`, `add_alias`,
  `create_product`, and `cancel` in that stable order after filtering.
- With no candidates, allowed actions are `create_product`, then `cancel`.
- With candidates, all four actions are allowed. The server computes this list
  from deterministic state; an LLM proposal cannot add, remove, or authorize an
  action.
- Proposal advice and candidates use the exact feature-29 contracts. A successful
  proposal may produce the allowlisted `LlmInferenceLog`; this is diagnostic, not
  catalog or grocery mutation.
- `product_resolution_required` is a successful domain result: REST returns 2xx
  and MCP returns a structured result with `isError: false`.

### Transaction and concurrency rules

- `GroceryService` owns the use case and transaction; `ProductService` owns
  product-name validation, lookup, creation, and catalog conflict translation.
- Never hold a database transaction open across `ProductResolutionService` or an
  LLM request.
- When both product and grocery line are new, create them in one transaction.
- A concurrent canonical-name winner is re-read and reused; creation metadata from
  the losing request never updates it.
- Pending-line detection uses the delivered product-scoped concurrency boundary.
  A concurrent pending-line winner causes `confirmation_required` with all current
  matching lines.
- No Prisma uniqueness or serialization error reaches REST or MCP.

## Testing

- Jest is configured and is a gate for every logic-bearing step. Each contract,
  validator, mapper, transaction helper, and service branch ships focused tests in
  the same step.
- Unit tests cover discriminated validation, per-transport defaults, request
  echoes, allowed-action ordering, result mapping, known-product metadata ignore,
  provider bypass, provider failure, and existing grocery result regressions.
- PostgreSQL-backed tests cover atomic commit and rollback, canonical and alias
  exact reuse, product-name conflicts, product convergence, pending-line races,
  no unintended duplicates, and proposal-mode domain no-write assertions.
- REST E2E tests cover both explicit policies, REST omission behavior, all result
  branches, invalid bodies, authentication, source attribution, and safe errors.
- Real MCP tests cover tool discovery, runtime discriminated schemas, MCP omission
  behavior, explicit deterministic creation, structured outcomes, source
  attribution, and safe errors.
- Guidance tests and scenarios cover uncertain names, candidate choice, create,
  alias, cancel, omitted quantity, duplicate quantities, and multi-item sequencing.
- No `Verify` command is configured. Run focused tests during each step, then run
  `npm test -- --runInBand`, the PostgreSQL-backed `npm run test:e2e`, and
  `npm run build` before completion.

## Acceptance criteria

- Direct clients can add an unknown product deterministically without an LLM.
- Assisted clients can receive deterministic candidates and optional advice
  without catalog or grocery mutation.
- Product and grocery data are separated and the transport defaults are explicit.
- Existing product metadata is never overwritten through grocery addition.
- Product and pending-line races produce stable domain outcomes, not raw database
  failures.
- Unknown-product behavior is consistent across service, REST, MCP, docs, and
  Hermes guidance.
- Existing pending quantities remain behind the feature-28 confirmation flow.

## Notes for the AI

- Keep controllers and MCP handlers thin. Unknown-product policy, request echoes,
  allowed actions, pending-line behavior, and transaction orchestration belong in
  shared application/domain code.
- Reuse feature 27 namespace normalization and conflict translation, feature 28
  quantity and pending-line contracts, and feature 29 search/proposal types. Do not
  create parallel normalization, candidate, or proposal shapes.
- Keep the transaction-aware product boundary internal. Do not expose a Prisma
  transaction client through REST, MCP, or exported public DTOs.
- Do not reuse legacy `findOrCreateByExactOrAliasMatch` for deterministic mode; it
  invokes classification and infers identity. Remove it only after all callers and
  regression tests prove the policy-aware replacement is complete.
- Creation-only metadata is ignored only after exact canonical or alias resolution
  succeeds. A genuinely new product still validates canonical and alias namespace
  ownership atomically.
- Preserve existing grocery error helpers and MCP safe-error serialization.
- Do not log raw product phrases, grocery notes, prompts, or candidate context
  beyond feature 29's existing allowlisted proposal logging contract.
- No schema migration is expected. If implementation evidence shows one is needed,
  stop and review that scope change before adding it.
- Keep feature 31 confirmation writes out of this feature.
- Do not hand-edit generated Prisma output. Keep comments sparse and limited to
  non-obvious concurrency or contract decisions.

## Findings

### 30/F-01 [P1] closed - Legacy grocery add still permits implicit product creation

**File:** src/grocery/grocery.service.ts:305
**Found:** 2026-09-01 by /audit (scope: current; lens: all)
**Why it matters:** Feature 30 replaces implicit exact-or-alias auto-creation
with one policy-aware grocery-add operation, but the public service still exposed
`addItem()` and a database E2E test preserved that implicit classifier-backed
creation path. A future internal caller could bypass the explicit product policy,
source-separated request shape, atomic product-and-line transaction, and
non-mutating proposal branch even though REST and MCP were safe.
**Suggested fix:** Remove the legacy `GroceryService.addItem()` path and its
private result helpers, migrate or remove its compatibility-only tests, and keep
the delivered policy-aware tests as the single grocery-add contract.
**Resolution:** Removed the legacy `GroceryService.addItem()` entry point, its
implicit product-resolution and result helpers, the legacy unit-test block, and
the database compatibility test that preserved implicit creation. REST, MCP, and
internal grocery callers now have only `addPolicyAwareItem()`. A fresh all-lens
review found no remaining grocery caller, focused lint and build passed, all 44
unit suites passed with 579 tests, and all 22 E2E suites passed with 180 tests.
