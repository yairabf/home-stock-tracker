# Fix: Confirmed product creation during absolute stock updates

**Source:** [Approved decision document](bugs/create-product-in-stock-update.md)
**From build-plan:** ad-hoc fix extending completed items 31 and 33b/33e; no new plan item
**Status:** verified
**Branch for implementation:** `fix/confirmed-stock-product-creation`

## Goal

Let Hermes handle an unknown product in an explicit absolute stock request through
user confirmation, then create the product and set its stock atomically. Preserve
safe retries and all grocery-list state. This is a stock-update flow, not purchase
reconciliation.

## In scope

- Existing read-only resolution, immediate known-product stock updates, and held
  unknown/ambiguous lines coordinated by Hermes.
- A dedicated MCP confirmation tool for one approved product and absolute stock set.
- Atomic product creation or compatible exact reuse, `STOCK_SET` event, projection,
  and durable confirmation receipt.
- Stable operation IDs, original-result replay, payload-conflict rejection, and
  protection against concurrent identical confirmations.
- Explicit approval, generic product identity, explicit package conversions,
  bundled confirmation questions, and truthful partial-progress reporting.
- Focused service, PostgreSQL integration, MCP, and generated agent-contract coverage.

## Out of scope

- Purchase imports, order/source/receipt-line IDs, historical timestamps, partial
  grocery fulfillment, and any grocery-list mutation.
- Changes to purchase reset semantics or additive stock accounting.
- New batch endpoints, whole-request atomicity, stock-set name selectors, standalone
  catalog administration, alias-confirmation tools, or new REST routes.
- Creating products through decrement, mark-out, or zero sets.
- Service-side brand storage, receipt parsing, or guessing identity/unit conversions.
- General idempotency changes to existing tools, server-stored approval proposals,
  multi-household support, deployment, commits, or plan edits in this spec pass.

## Build loop

Build one step at a time. Explain the next step, implement that step and its focused
checks, then show the diff and observable done-whens for user review. Wait for step
approval before continuing. Checkpoint commits require approval and passing gates.
Do not start implementation until this draft is reviewed.

## Build steps

- [x] **Step 1 - Lock confirmation validation and persistence.** Add the strict
  internal request/result contracts, deterministic payload encoding, compatibility
  helpers, and additive Prisma confirmation-receipt migration. Keep the public
  surface unchanged. *Done when:* malformed/zero/non-finite quantities, blank units,
  invalid IDs and unexpected fields fail validation; canonical encoding ignores
  object-key order but detects changed approved values; migration and client
  generation succeed in the isolated test database; focused tests and build pass.
- [x] **Step 2 - Implement atomic confirmed stock setting internally.** Add an
  inventory-owned service using transaction-aware product and stock primitives.
  Validate compatible exact reuse before overwriting stock; persist event,
  projection and original response receipt together. Do not expose the tool yet.
  *Done when:* new and compatible existing products receive the approved positive
  absolute balance; conflicts and injected failures roll back every write; all
  grocery rows remain unchanged; focused service tests pass.
- [x] **Step 3 - Prove replay and concurrency safety.** Complete receipt lookup,
  duplicate-key/serialization recovery and bounded transaction retries. Replays
  return the stored response before checking current catalog or projection state.
  *Done when:* identical sequential/concurrent calls create one event; changed
  payloads conflict; retry after a newer stock update leaves that update intact;
  process-restart replay succeeds against durable storage; PostgreSQL tests pass.
- [x] **Step 4 - Expose the MCP tool and additive contract.** Register the new tool
  with strict input/output schemas, existing authentication/error handling and
  server-owned provenance. Update the release contract, fixture, generated metadata
  and manifests together so the repository remains consistent. *Done when:*
  `tools/list` and actual tool calls agree, invalid inputs cannot reach mutations,
  existing stock/grocery/purchase shapes remain compatible, and contract checks pass.
- [x] **Step 5 - Teach and verify the complete agent flow.** Update shared workflow
  sources, Hermes examples and executable scenarios; regenerate Hermes/OpenClaw
  bundles using the existing generator. Add mixed-request MCP integration coverage
  and complete the direct check below. *Done when:* clear lines apply immediately,
  unresolved lines are held, approval is explicit and bundled, safe retries work,
  no grocery tool is used, and all final gates pass.

## Files / areas

- `src/inventory/types/`, `src/inventory/dto/`, and a focused new
  `src/inventory/stock-product-confirmation.service.ts` with adjacent tests.
- `src/inventory/inventory.module.ts` and, only as needed for transaction reuse,
  `inventory.service.ts` and `stock-ledger.service.ts`.
- `src/product/product.service.ts`, product-name utilities and existing explicit
  creation contracts; preserve grocery confirmation behavior.
- `prisma/schema.prisma` and one additive migration for confirmation receipts.
- `src/mcp/mcp-server.factory.ts`, new stock-confirmation schemas, MCP factory and
  contract tests, and generated release metadata.
- `integrations/shared/home-stock-tracker/`: release contract, workflow, scenarios,
  versioned fixture and platform source overrides where needed.
- Generated `integrations/hermes/home-stock-tracker/` and
  `integrations/openclaw/home-stock-tracker/` bundles and manifests.
- `docs/agent-integrations.md`, scenario runner/tests if necessary, and new
  `test/stock-product-confirmation.e2e-spec.ts` coverage.

## Data / contracts

These are load-bearing implementation choices for review. The approved source
remains authoritative for product behavior.

### Public MCP operation

Add `inventory_confirm_new_product`, accepting one strict object:

```ts
{
  operationId: string; // UUID generated once per approved product/stock decision
  product: {
    canonicalName: string;
    aliases: string[];
    category: string;
    typicalUnit: string | null;
    productType: ProductType;
    isPerishable: boolean;
  };
  stock: {
    quantity: number; // finite and strictly positive
    unit: string; // explicit, trimmed, nonempty
  };
}
```

Reuse existing confirmed-product validation and name normalization. Require an
explicit stock unit for this new operation so approval is not applied with a guessed
unit. If a typical unit is supplied, require it to match the stock unit using the
existing stock-unit normalization; do not invent synonym or conversion rules.
Reject extra fields, including client-supplied source, dates, operation selectors,
product IDs, proposal state, and grocery fields. The operation is implicitly `set`.

Return a strict object containing `operationId`, `productId`,
`productOutcome: 'created' | 'reused'`, and the existing serialized stock mutation
response fields `event` and `stock`. Dates use the existing ISO JSON representation.
Return this exact original response on replay, including the original outcome and
timestamps; do not read fresh stock into a replay result or add a changing replay flag.

Use existing MCP error translation. Expose stable domain codes:

- `STOCK_CONFIRMATION_ID_CONFLICT`: successful operation ID with different payload.
- `STOCK_CONFIRMATION_PRODUCT_CONFLICT`: incompatible existing identity or stock unit.
- Preserve `PRODUCT_NAME_CONFLICT` for conflicting name ownership and existing
  validation conventions for malformed input/invalid stock facts.

Business conflicts require clarification, not automatic payload changes or new IDs.
Retry an uncertain transport outcome with the same ID and payload. A confirmed
rollback or validation failure leaves no success receipt and can be retried after
its cause is addressed; a changed user-approved decision gets a new operation ID.

Annotations: `readOnlyHint: false`, `destructiveHint: true`, `idempotentHint: true`,
`openWorldHint: false`. Existing `update_inventory` remains non-idempotent and accepts
exact IDs only. Do not advertise safe automatic replay for ordinary known-product sets.

### Product reuse and approval boundary

Hermes uses existing read-only resolution first. Exact known matches go through
`update_inventory`; unknowns require approval before this confirmation tool is called.
Ambiguous candidates and uncertain conversions never authorize mutation.

Approval is an agent contract, as with existing grocery confirmation. Do not add a
server-stored proposal token or claim the server can prove that a human approved.
No LLM calls occur inside confirmation or its transaction.

For a product that appears while approval is pending:

- Resolve the approved canonical phrase through the exact normalized name namespace.
  No fuzzy or LLM-selected reuse is allowed.
- Validate proposed alias ownership. Names owned by another product conflict.
- Conservatively treat differing category, product type, or perishability as a
  product-facts conflict requiring clarification; do not overwrite existing metadata.
- Require the existing projection unit, or typical unit when there is no projection,
  to match the approved stock unit. If neither exists, compatibility cannot be
  established and confirmation requires clarification rather than guessing.
- Do not attach new aliases or change catalog facts on reuse. Existing grocery
  confirmation semantics and ordinary known-product unit replacement stay unchanged.

### Durable receipt and transaction

Add `StockProductConfirmation` with:

| Field | Contract |
| --- | --- |
| `operationId` | UUID string primary key, unique across this single-household operation |
| `requestVersion` | Integer, initially `1`, identifies canonical payload format |
| `requestPayload` | JSON of validated approved product/stock values |
| `responsePayload` | JSON snapshot of the original successful public response |
| `createdAt` | Server timestamp |

Use deterministic recursive object-key ordering when encoding/comparing payloads;
retain array order and all validated values. Only existing validation normalization
may collapse spelling/whitespace. Do not use product-name matching as a substitute
for full request equality. Operation ID is the lookup key, not part of payload equality.
No expiry or cleanup job: replay protection survives restarts and later stock changes.
The stored response is a historical result, not a foreign-key-driven live projection.

In one serializable transaction: look up the receipt; return matching replay or
reject changed payload; otherwise resolve/create compatible product, write one
server-timestamped `STOCK_SET` event with source `mcp`, apply the approved absolute
projection, and insert the receipt. Any failure rolls back all effects. Ensure a
reported first success actually applied the stock set; if the ledger rejects stale
state, return a conflict with rollback rather than success with an unapplied event.

A receipt uniqueness collision rolls back the losing transaction, then reads the
winner and compares payloads. Serialization/name races use bounded retries consistent
with existing conventions; never query from an aborted transaction. Different-ID
name races may reuse only after compatibility is rechecked in a fresh transaction.
Replay must run before compatibility checks so later catalog or unit edits do not
invalidate an already-successful operation's replay.

Follow existing post-commit statistics/logging conventions. A post-commit failure
must not erase the durable success receipt or cause a stock replay. Avoid unrelated
refactors or changes to daily estimation.

### Agent workflow and compatibility release

Hermes owns brand removal and explicit conversions. For example, two branded
one-liter milk cartons become generic `3% milk`, quantity `2`, unit liters; keep
lactose-free milk separate. Ask when facts are insufficient. Known rice can be set
immediately while unknown milk awaits approval and ambiguous yogurt awaits clarification.
Each approved new-product line has its own operation ID and atomic confirmation.
A bundled question does not promise an atomic multi-product batch. Declining a line
causes no mutation; report partial failures accurately and resume only pending work.

Publish an additive MCP contract `1.4.0`, skill version `1.14.0`, capability
`stock-product-confirmation`, and require the new tool. Set the updated skill's
compatible MCP range to `>=1.4.0 <2.0.0` so older servers cannot falsely pass the new
workflow's installation checks. Preserve historical fixtures and service version.
Use existing capture/generation commands; regenerate both platform bundles from
shared sources, preserving platform-specific installation instructions.

## Testing

No browser UI is involved. Use the existing Jest, Supertest/MCP and PostgreSQL
harnesses; no new runner or CI setup. Use an isolated test database and test-owned
fixtures. Never apply test cleanup to household production data.

Each logic-bearing step includes focused tests. Cover:

- Request validation, strict extra-field rejection, deterministic payload equality,
  positive-only sets, explicit units, and product compatibility decisions.
- Atomic new creation/set and exact compatible reuse, including aliases and
  conflicts in identity facts or units without metadata/list changes.
- Rollback after product creation, event creation, projection writing and receipt
  insertion failures; no orphan product, event, receipt or projection.
- Sequential/concurrent identical confirmation, different-payload ID collision,
  distinct-ID concurrent name creation, restart replay, and replay after later
  stock quantity/unit changes. Assert event counts and timestamps, not just quantity.
- Existing known-product sets/decrements/mark-out and purchase/grocery behavior
  remain unchanged. Include a matching pending grocery row and compare its entire
  state before and after confirmation.
- Mixed known/unknown/ambiguous requests, refusal to auto-confirm, declines,
  explicit conversion versus uncertainty, lost responses and resumed partial work.
- MCP schemas, annotations, errors, transport provenance, generated tool fixture,
  skill/manifest compatibility, and executable safety scenarios.

Final gates after implementation:

1. `npm run verify` (configured unit tests then production build).
2. `npm run test:e2e -- --runInBand` against the isolated migrated PostgreSQL database.
3. `npm run contract:check` and `git diff --check`.
4. `graphify update .` after source changes, per repository instructions.

Direct Check: seed known rice and a matching pending grocery row; leave milk unknown;
supply an ambiguous yogurt phrase. Set rice, observe no milk/yogurt writes, approve
milk with explicit facts and units, confirm once, then change milk stock and replay
the confirmation. Verify original replay response, preserved newer stock, one
confirmation event and unchanged grocery rows. Inspect refusal/conflict and mixed
status scenarios through the existing MCP harness; mock external inference where
needed and do not send real WhatsApp messages.

## Notes for the AI

- This is one cohesive fix with five reviewed steps, not a new build-plan feature.
  Keep all approved decisions in the source document; do not revive deferred imports.
- NestJS owns business rules and persistence; Hermes owns interpretation, questions,
  brand information and explicit conversions. Keep handlers thin and source server-owned.
- The service is private and single-household. Reuse existing authentication; do
  not invent user IDs or multi-tenant tables from generic template guidance.
- Reuse transaction-aware product/ledger helpers, not public methods that open
  separate transactions. Do not modify grocery helpers' behavior to implement this fix.
- Generated bundle and release files must come from their authoritative sources.
- No code, migrations, branch switching, deployment or commits during this spec pass.

## Spec critique

The critique made these requirements explicit: a durable response receipt instead
of replaying absolute sets; receipt lookup before current-state checks; conservative
identity/unit compatibility instead of blindly reusing the grocery helper; rollback
on an unapplied stale stock set; per-line rather than batch atomicity; and a raised
skill compatibility minimum for the new tool. It split internal implementation and
concurrency proof from public MCP exposure, and retained purchase/date work outside
this fix. The existing source approval pattern remains unchanged.

## Verification evidence

- Step 1: `npm run verify` passed (936 tests, build). Prisma client generated; all
  migrations applied to isolated local database `home_stock_confirmation_test_20260907`.
- Initial sandboxed Verify failed on denied local port binding; rerun with approved
  escalation passed. Household database was not migrated.
- Step 2: `npm run verify` passed (943 tests, build); isolated PostgreSQL
  confirmation suite passed (9 tests), including rollback and unchanged groceries.
- Step 3: `npm run verify` passed (945 tests, build); isolated PostgreSQL suite
  passed (14 tests), including five concurrent identical calls and durable replay.
  Corrected a test assertion to compare JSON values rather than JSONB key order.
- Step 4: MCP fixture capture and `npm run contract:check` passed; `npm run verify`
  passed (947 tests, build). Updated controller mocks/discovery for the new dependency.
  Contract capture now bootstraps runtime metadata before reading a new fixture;
  regression coverage proves generation works when that version has no fixture yet.
- Step 5: `npm run verify` passed (951 tests across 69 suites, production build).
  Full isolated `npm run test:e2e -- --runInBand` passed (283 tests across 33 suites).
  The affected stock-confirmation suite passed again after self-review (16 tests).
- `npm run contract:check` passed: 112 executable scenarios and 64 contract tests.
  The previous blanket no-retry assertion was updated to verify the narrow,
  approved stock-confirmation exception while preserving ordinary tool protections.
- Focused ESLint passed for the new service/contracts after removing one unused
  destructured variable. `git diff --check` passed.
- MCP runtime evidence covers known rice set, unknown milk held then confirmed,
  ambiguous yogurt held, matching pending groceries unchanged, and replay after
  a newer milk balance without another confirmation event or timestamp refresh.
- `graphify update .` refreshed the AST graph. Existing tool/skill version drift
  and missing `tree_sitter_sql` were reported; SQL contents are not represented
  in the graph. Migration correctness was verified directly in PostgreSQL.

## Autopilot review packet

**Target:** resumed this approved fix on `fix/confirmed-stock-product-creation`.
All five steps are verified. No completion/archive, merge, push, deployment, or
real agent messages were performed. The household database was not migrated.

| Changed area | Why |
| --- | --- |
| Inventory confirmation service, response type, validation and tests | Atomic product/stock writes, compatible reuse, durable replay and bounded race recovery |
| Prisma schema and additive migration | Store successful approved payloads and original responses per operation UUID |
| Shared product schema and grocery schema import | Reuse existing approval validation without changing grocery behavior |
| Inventory module and MCP factory/controller tests | Register the domain service and strict new confirmation tool |
| Release contract, fixture, generated runtime and both bundles | Additive MCP contract and minimum compatible agent version |
| Capture command and generator regression test | Bootstrap metadata before a new immutable fixture exists |
| Shared workflow/scenarios, scenario validator/tests, integration guide | Explicit approval, generic products, partial progress and restricted safe replay |
| PostgreSQL/MCP integration suite | Rollback, conflicts, concurrency, mixed requests, unchanged groceries and newer-stock preservation |
| Overview and activity state | Refresh completed feature-33 progress/fingerprint and record this run's verification |
| graphify outputs | Refresh repository-required code relationships |

Effective regular gates: Check, Audit and Try are `manual` and were not invoked.
Independent review is not configured and no independent review was requested;
there is no reviewer adapter/model selection or review receipt for this run.
Mandatory Verify, integration coverage and contract checks ran as recorded above.
No findings are open or fixed in `findings.md`; no formal audit findings were
created. Self-review fixed the unused variable and found no remaining application
issue in the changed scope. The spec critique's receipt, compatibility and
per-line atomicity decisions were retained.

The overview refresh used the existing plans: feature 33/33e completion and its
archive link had changed after its previous fingerprint. No user-owned plan was
edited; the overview remains below 20,000 bytes.

Checkpoints: `20545fb` (contracts/receipts), `defc360` (atomic setting), `747e368`
(replay), `9f206da` (MCP release), plus the final workflow/verification checkpoint
listed in git history. Generated versioned fixtures and graph artifacts account
for most of the diff volume.

Remaining practical limits: explicit human approval is enforced by the agent
workflow, as agreed, not a server-stored approval token. Live Hermes/WhatsApp was
not exercised; MCP calls and scenario contracts provide the runtime evidence.
The additive migration must be applied to a deployment database during a separately
authorized release. The isolated local test database was retained for review.

**Next action:** review the branch diff and use the Direct Check path above (or
request `$try` for a walkthrough), then `$complete` when satisfied. Autopilot stops
before completion and all external actions.
