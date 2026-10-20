# Feature: AI-driven catalog normalization and enrichment

**From build-plan:** feature 39
**Status:** verified
**Depends on:** shipped catalog namespace, product understanding, grocery and stock ledger services, and agent contract tooling
**Prior work:** [unfinished feature 38f](../../context/feature-plans/38f-qualifying-evidence-paused.md) is preserved verbatim, not completed or archived. Its build-plan boxes remain unchecked.

## Goal

A household member can add groceries or report several stock items in one action,
even when names are absent from the catalog. The backend uses AI to choose useful
generic product names and infer metadata, then resolves or creates products and
applies the requested action without routine catalog-confirmation exchanges.

The user explicitly clarified that generic naming is an AI judgment. The milk
example guides the provider; this is not a hardcoded brand/percentage stripping
algorithm. One MCP request may involve several bounded internal provider calls.

## In scope

- AI chooses canonical names for previously unresolved inputs, reusing existing
  matching products and preserving each supplied product phrase as an alias.
- Infer category, product type, typical unit and perishability through existing
  provider boundaries. Preserve explicit metadata and non-null stored values.
- Single and batch grocery additions, absolute stock sets and purchase/restock
  recording through one new assisted API/tool, using the same domain rules as
  existing operations. A one-item array handles a single addition or stock set.
- English, Hebrew and mixed-language names; reuse existing identities across
  languages when supported by the model and catalog evidence.
- Atomic catalog/action writes, bounded inference, durable replay protection,
  typed exceptional outcomes and updated Hermes/OpenClaw integration contracts.

## Out of scope

- Renaming or merging existing products, migrating historic events or relabeling
  the entire catalog. Exact existing identities remain authoritative.
- Retailer catalogs/carts, receipt OCR, barcode ingestion, a frontend, new model
  vendors, training, and generic bulk-edit infrastructure.
- AI-invented quantities, purchase dates, expiration dates, unit conversion,
  prediction settings, or stock actions inferred by the backend from prose.
- Decrement and mark-out batch actions; existing exact-ID tools still handle
  those. This feature handles positive stock sets and purchases, the flows that
  can introduce unknown products.
- Changing existing explicit creation/confirmation APIs or provider rollout gates
  in 38f/38g. Deployment and paid evaluations are not part of this planning pass.

## Build loop

1. Present the next small step before coding.
2. Implement only that step and its focused tests.
3. Show the diff and observable done-when evidence for review.
4. Obtain step approval before continuing; checkpoints remain optional.

Use branch `feature/ai-catalog-enrichment`. Split a step further if its diff is
not reviewable in one sitting. Keep new code disconnected from public routes
until transaction behavior and replay protection are tested.

## Build steps

- [x] **Step 1 - Assisted-action contracts and replay storage.** Define the
  request/result schemas, strict validation, internal resolution outcomes and
  durable operation receipt model/migration. Done when malformed, oversized,
  mixed-operation, repeated-key/different-payload and operation-incompatible
  inputs are rejected by tests; existing contracts still pass unchanged.
- [x] **Step 2 - AI identity preparation.** Add a narrow injectable identity
  normalizer using the configured structured-generation boundary, versioned
  generic-name guidance and bounded catalog candidates. Reuse understanding
  routing for missing metadata. Done when mocked provider tests demonstrate
  milk normalization, original alias retention, existing-product selection,
  multilingual inputs, meaningful distinctions, abstention, supplied-field
  precedence and bounded calls. No product writes occur in preparation.
- [x] **Step 3 - Transactional catalog application.** Apply prepared identity and
  accepted metadata inside a caller-owned transaction; recheck namespace and
  supplied snapshots under concurrency. Done when integration tests prove one
  identity per normalized name, safe concurrent reuse, alias collision rejection,
  preservation of stored metadata and rollback on downstream failure.
- [x] **Step 4 - Assisted grocery action.** Add homogeneous batch grocery
  orchestration and durable replay around existing grocery semantics. Done when
  unknown and known products complete in one service call, pending-line policy
  is respected, a failing item leaves no catalog/list mutations and replay
  returns the original receipt without duplicate lines or events.
- [x] **Step 5 - Assisted stock and purchase actions.** Reuse the same preparation
  and transaction machinery for absolute stock sets and purchases. Extract only
  the transaction-aware domain helpers needed from existing services. Done when
  mixed known/new products produce correct events/projections atomically,
  duplicate resolved products are rejected, units remain consistent, retries do
  not duplicate events and statistics update only after successful commit.
- [x] **Step 6 - REST and MCP exposure.** Add the route/tool below with thin
  adapters, server-owned provenance and shared validation. Done when authenticated
  API/MCP tests show one-request success and typed no-write exception responses;
  existing tools and auth behavior remain compatible.
- [x] **Step 7 - Agent guidance and release contracts.** Teach Hermes/OpenClaw to
  use the assisted action for grocery additions, named stock sets and purchases,
  pass original item phrases, retain the request ID on retry and summarize
  receipts without routine confirmation. Update contract version, fixtures,
  generated bundles, manifests and executable scenarios through repository
  tooling. Done when contract checks pass and scenarios prove no follow-up
  confirmation call on ordinary success and no invented success after failure.
- [x] **Step 8 - End-to-end verification.** Run the final gates and direct local
  API/MCP flow checks with controlled provider responses and PostgreSQL. Done when
  the acceptance matrix below has evidence, including concurrent requests and
  replay after a simulated lost response. Do not claim mock responses establish
  real-model semantic accuracy.

## Files / areas

- `src/product/`: new identity-normalization boundary and catalog preparation /
  transaction application helpers; reuse `product-understanding-runner.service.ts`,
  namespace utilities and existing metadata validators.
- `src/llm/`: existing structured generation and task routing; narrowly add task
  registration if required, without changing unrelated routing decisions.
- `src/grocery/`, `src/inventory/`: transaction-aware domain helpers and orchestration.
- A focused assisted-action module for shared DTOs, orchestration and receipts;
  do not grow the MCP factory into a business-logic layer.
- `prisma/schema.prisma`, migration and generated client for durable receipts.
- `src/mcp/`, `integrations/`, contract sources/generators and API documentation.
- Colocated unit tests and focused PostgreSQL/API integration tests under `test/`.

## Data / contracts

### Load-bearing public assisted-action contract

Add `POST /inventory/assisted-actions` and MCP `apply_household_items`, backed by
one service. Existing routes/tools retain their schemas and behavior.

Request:

- `requestId`: caller-generated UUID, reused only for retrying the same action.
- `operation`: `grocery_add | stock_set | purchase`; one operation per request.
- `items`: ordered array of 1 to 100 entries.
- Each entry has exactly one of `productId` (UUID) or `productName` (trimmed,
  nonblank, maximum 300 characters). Names are original phrases, not agent-made
  guesses at a canonical name. IDs bypass identity inference.
- Optional `metadata`: category, typicalUnit, productType and isPerishable using
  the current metadata schema. Supplied values are preserved; explicit false
  is not missing. Conflicts with existing stored metadata require resolution,
  not an overwrite. Omitted/null values are eligible for inference.
- Grocery entries: optional positive finite `quantity`, optional `unit`, optional
  `note`, and `ifPendingExists: return_existing | create_separate`, defaulting
  to `return_existing`. Omitted quantity follows the existing new-line default
  of 1. Return existing pending lines without changing their quantities.
- Stock-set and purchase entries: required positive finite `quantity` and
  optional `unit`. Purchases may include per-item `purchasedAt`, validated with
  existing timestamp rules. Reject fields belonging to other operations.
- Reject unknown fields. Transport sets `source`; clients cannot supply it.

Response is a discriminated union:

- `outcome: applied`: requestId, operation and ordered receipts. Each receipt
  contains inputIndex, suppliedName (null for ID input), productId,
  canonicalName, catalogAction (`existing | alias_added | created`),
  unresolvedMetadata (field names), and the existing grocery item or inventory
  event/stock response DTO. Grocery receipts also distinguish newly created
  versus returned existing pending lines. No provider internals are public.
- `outcome: needs_input`: requestId and indexed issues with stable codes
  (`ambiguous_product`, `missing_unit`, `metadata_conflict`, `alias_conflict`,
  `duplicate_product`). Include bounded existing candidates where applicable.
- `outcome: unavailable`: requestId, retryable boolean and a stable service code
  for provider deadline/failure or retryable concurrency exhaustion.
- Ordinary schema/auth errors use existing HTTP/MCP error conventions;
  reusing a requestId for different normalized request content is a conflict.

`needs_input` and `unavailable` perform no product, alias, grocery, event or stock
writes. Optional diagnostic logs may record failures without raw conversation
content or secrets. Corrected payloads get a new requestId; retryable failures
can reuse the unchanged requestId. No success is reported before commit.

### AI identity and metadata rules

1. Resolve IDs and exact canonical/alias namespace matches deterministically.
   Complete metadata means no inference is necessary for an existing match.
2. For unresolved names, call the structured-generation provider to choose an
   existing candidate ID, a new generic canonical name, or unknown. Supply at
   most 20 existing candidates from current deterministic discovery, with their
   actual IDs/names and relevant metadata. The model cannot invent an existing ID.
3. Prompt guidance: prefer the ordinary generic household product name; brand,
   marketing text, pack size and fat percentage normally do not define catalog
   identity. Example: `3% milk by Nestle` becomes `milk`. Preserve distinctions
   that alter the actual product or intended use, such as oat milk, infant
   formula and laundry versus dish detergent. These are examples for AI judgment,
   not substring rules. Preserve useful input language when creating a name;
   reuse existing catalog spelling when choosing an existing identity.
4. Validate strict result shape, nonblank bounded names, candidate membership
   and confidence. New automatic identity decisions require confidence >= 0.90;
   this is a proposed acceptance policy, not a claim of measured accuracy.
   Unknown, invalid or low-confidence identity returns `needs_input`; provider
   failure returns `unavailable`. Never silently create the raw brand-heavy name
   as a fallback.
5. Normalize lookup keys only with the existing Unicode/case/space utility.
   Recheck the AI-proposed canonical name against the namespace before creation.
   Preserve the submitted trimmed phrase as an alias unless it has the same
   normalized key as the canonical name. Do not generate speculative aliases.
6. Fill missing metadata through the existing understanding runner and configured
   task adapters, passing both the chosen identity and original phrase as
   evidence through a versioned input extension if needed. JEV remains suitable
   for bounded classifications; generation uses LLM_PROVIDER. Do not change
   global selectors or invoke a generative fallback simply because JEV abstains.
7. Nullable metadata may remain unknown and be listed in unresolvedMetadata.
   Missing category/type/perishability must not trigger routine questions.
   Stock operations require a usable unit under existing ledger rules: explicit
   unit wins; stored projection/canonical unit follows existing compatibility
   checks. An inferred unit is usable only when accepted. Never infer a count
   or silently convert packages into liters. Missing required unit returns one
   consolidated `needs_input` response for the request.

Bound work to 100 distinct input identities per request, one identity-generation
attempt and one understanding-runner invocation per distinct unresolved item,
with at most four concurrently prepared items and a 60-second overall preparation
deadline. Existing bounded adapter retry policies still apply; no outer retry
loop issues more model calls. Timeouts abort before domain writes. These internal
calls are not additional MCP conversations.

### Atomicity, concurrency and replay

Preparation happens outside the database transaction. Revalidate selected IDs,
namespace ownership and metadata snapshots inside one serializable transaction.
Create products/aliases, apply grocery or stock writes and save the successful
receipt together. Reuse existing ledger and event semantics rather than emulating
them in controllers. Transaction retries reuse prepared results, never rerun AI.

If two inputs resolve to the same product, reject the entire request with indexed
`duplicate_product` issues before mutation; do not guess whether quantities should
be summed or the last stock set should win. Concurrent identical canonical
creations reuse the winning compatible product after revalidation; conflicting
alias ownership never transfers an alias between products. Existing exact matches
are not renamed by this feature.

Add `AssistedActionReceipt` with requestId (UUID primary key), requestHash (SHA-256
of validated normalized payload excluding transport provenance), operation,
response (JSON), createdAt. Scope is the existing private single-household service.
The successful receipt is persisted only in the same transaction as its action.
A unique requestId serializes concurrent submissions; the loser returns the
committed receipt for matching content, or conflict for different content. Check
receipts before inference and again in the write transaction. No automatic receipt
expiry in this feature; replay protection must survive process restarts. Concurrent
preparation can duplicate bounded inference, but never domain mutations.

## Testing

Use Jest and existing PostgreSQL/Supertest tooling. Each logic-bearing step ships
focused tests, including schema, decision acceptance, namespace collision, replay,
metadata precedence and transaction rollback. Mock external providers for repeatable
verification; no paid calls are required to implement this feature.

| Scenario | Observable result |
| --- | --- |
| Unknown `3% milk by Nestle`, provider chooses milk | One milk product, original alias, inferred metadata, requested action committed in one call |
| Milk already exists, new brand phrase | Same product ID reused, supplied phrase added as alias, no duplicate product |
| Complete exact alias/ID match | Existing identity used, no AI call |
| Hebrew/mixed phrase | Validated AI identity reused/created; original spelling retained as alias |
| Oat milk versus dairy milk | Distinct mocked AI identities remain distinct; no hardcoded collapse |
| Explicit false and supplied metadata | Supplied values survive enrichment; stored conflicts are reported |
| Optional metadata unknown | Action succeeds where valid, nulls listed, no follow-up confirmation |
| Unknown identity or required unit | Consolidated indexed needs_input; no domain writes |
| Failure on item N / alias race / invalid provider output | Entire action leaves catalog and stock/list state unchanged |
| Two names resolve to same product | Indexed duplicate_product, no guessed quantity aggregation |
| Lost response followed by same requestId | Same receipt and event IDs returned, no duplicate purchase |
| Concurrent same ID / same canonical name | One committed action per requestId and one canonical identity |
| Grocery repeated intent with existing pending line | Return existing by default; explicit create_separate remains available |
| Stock set versus purchase | Existing operation-specific event and projection semantics preserved |
| Malformed, empty, >100 items, deadline, prompt injection | Bounded validated failure without unauthorized writes |

Final gates: `npm run verify`, `npm run contract:check`, focused
`npm run test:e2e -- --runInBand <relevant-suite-pattern>`, and `git diff --check`.
After source edits run `graphify update .`. Direct Check evidence should exercise
single grocery, batch stock set and batch purchase through REST/MCP against an
isolated database with controlled provider responses. Record database-dependent
checks as blocked if unavailable; do not substitute unit tests for transaction
proof. No browser harness is declared or needed for this backend feature.

## Notes for the AI

- Server owns semantic decisions and persistence; agents pass intent and original
  phrases. Never teach agents to strip brand names or invent classification fields.
- This is one feature with a shared preparation/write pipeline and small build
  steps, not separate classification implementations for each transport/action.
- Keep explicit existing confirmation flows compatible, while the new assisted
  flow is the documented routine agent path. Exceptional uncertainty may need
  clarification; ordinary successful classification must not need confirmation.
- Treat all names and hints as untrusted data in provider prompts. Validate every
  provider result; AI cannot directly write to the database or choose operations.
- Preserve server-owned provenance, service authentication, global namespace
  uniqueness, nullable unknown metadata and existing single-household scope.
- No source, schema, deployment or paid provider actions occur during this spec.

## Critique applied

- Made AI semantic naming explicit and separated it from mechanical lookup-key
  normalization; retained original phrases instead of asking agents to normalize.
- Added a name-based batch path because existing bulk purchases require IDs.
- Locked atomic failure, post-resolution duplicates, alias races and retry receipts
  before implementation; an interrupted batch cannot leave orphan catalog rows.
- Distinguished optional metadata from required action fields so missing category
  does not recreate the confirmation loop, while units/counts are not fabricated.
- Kept current task routing and unfinished 38f evidence intact; new generic-name
  generation does not silently enable JEV rollout or rewrite existing catalog names.

### Step 1 verification (2026-10-20)

- Added strict request, AI identity and wire-result schemas, canonical request
  fingerprints, replay mismatch errors and AssistedActionReceipt schema/migration.
- Shared existing MCP response schemas without changing published contracts.
- `npm run verify`: 130 suites / 2024 tests and production build passed.
- `npm run contract:check`: 6 suites / 79 tests, 124 agent scenarios passed.
- Focused contracts: 36 tests passed; targeted ESLint passed after removing an
  unused binding (no behavioral change). Prisma validate and generate passed.
- Sandbox attempts failed to bind local test servers; unrestricted reruns above
  passed. Migration is not applied; runtime transaction/replay evidence belongs
  to Steps 3-5. No new public route or AI call is enabled.
- Review diff: `/private/tmp/feature39-step1.patch`. No commit made. Regular
  Check/Audit/Try policies are manual and were not invoked.

### Step 2 verification (2026-10-20)

- Added injectable generic identity normalization and read-only catalog preparation,
  registered/exported through ProductModule. Exact IDs/names bypass naming; new
  names get one structured generation call with at most 20 catalog candidates,
  a 0.90 confidence gate and no automatic fallback. Generated canonical names
  are checked against the namespace before any later write.
- Metadata uses the existing configured understanding runner with a versioned
  JSON evidence envelope in its rawName field containing chosen canonical name
  and original phrase. Existing adapters, global routing and evaluation versions
  remain unchanged. Supplied/stored values win; optional unknowns remain null.
- Preparation returns the original alias, existing catalog snapshot, accepted
  metadata and inference provenance for the transaction step. No product writes.
  Deadline checks prevent later work after expiration; in-flight metadata
  adapters retain their existing bounded transport budgets. Batch concurrency
  and per-request deduplication will wrap this one-item boundary in Step 4.
- `npm run verify` passed 132 suites / 2056 tests and production build. Focused
  assisted-action tests passed 68 tests, including 32 new Step 2 tests.
- `npm run contract:check` passed 6 suites / 79 tests and 124 agent scenarios.
- Targeted ESLint and `git diff --check` passed. A TypeScript narrowing error
  and test-double lint issues found during iteration were corrected; focused
  tests and production build passed again after those corrections.
- Mocked provider tests cover provider-compatible schema, prompt/data separation,
  ambiguity, membership, failures, deadlines, multilingual aliases, existing
  matches, meaningful distinctions, metadata precedence and bounded calls.
  No paid provider calls or real-model accuracy claim.
- Review diff: `/private/tmp/feature39-step2.patch`. No commit made. Regular
  Check/Audit/Try remain manual; no new public endpoint exists yet.

### Step 3 verification (2026-10-20)

- Added AssistedCatalogWriter for a caller-owned Serializable transaction. It
  rechecks selected identity/name snapshots, namespace ownership and metadata;
  fills only null fields; preserves supplied aliases and existing facts; returns
  created/existing/alias_added. It performs no model calls or independent commit.
- Typed catalog conflicts distinguish alias, identity and metadata changes. Raw
  Prisma uniqueness/serialization races remain available to the caller for
  bounded whole-transaction retries with the same prepared input.
- Ten policy tests passed. Eleven real PostgreSQL integration tests passed,
  including deliberately synchronized concurrent creation, competing aliases,
  stale/deleted identity, metadata protection and rollback of new products,
  aliases, enrichment, grocery writes and receipts after downstream failure.
- Created isolated temporary PostgreSQL at localhost:55439/feature39_test, applied
  all 17 migrations (including Step 1 receipt storage), ran the focused suite,
  then stopped/removed the temporary container. Existing databases untouched.
- `npm run verify`: 133 suites / 2066 tests and production build passed.
- `npm run contract:check`: 6 suites / 79 tests, 124 scenarios passed.
- Targeted ESLint, graphify AST update and `git diff --check` passed.
- Integration command: set ASSISTED_CATALOG_TEST_DATABASE_URL to an isolated
  migrated database ending in _test, then run `npm run test:e2e -- --runInBand
  assisted-catalog-writer.e2e-spec.ts`. The suite only removes its own fixtures.
- Review diff: `/private/tmp/feature39-step3.patch`. No commit, public endpoint,
  deployment or paid AI calls. Regular Check/Audit/Try remain manual.

### Step 4 verification (2026-10-20)

- Added a four-worker, shared-60-second-deadline preparation stage with duplicate
  input and resolved-product checks. Every input is processed at most once;
  repeated exact identities are rejected before AI. Typed failures prevent all
  domain writes and preserve input indices.
- Added shared Serializable action/receipt transactions with three bounded
  retries, JSON wire-response validation, same-request replay before inference
  and in the transaction, and different-payload requestId conflict handling.
  Concurrent losers roll back before reading the winning receipt. No AI inside
  transaction retries. Failures do not consume the request ID.
- Added assisted grocery orchestration using the existing grocery transaction
  helper through one public wrapper. Default returns the latest existing pending
  line without changing its quantity; create_separate explicitly creates another.
  Catalog application and post-resolution duplicate checks precede grocery
  writes; receipts are ordered by input even though grocery locks use ID order.
- Registered the internal assisted module; no new route or MCP tool yet.
- `npm run verify`: 135 suites / 2077 tests and production build passed.
- `npm run contract:check`: 6 suites / 79 tests, 124 agent scenarios passed.
- Focused PostgreSQL validation: 3 suites / 35 tests passed, covering new grocery
  orchestration, prior catalog writer and existing policy-aware grocery behavior.
  Proven paths include mixed existing/new items, unchanged pending quantity,
  explicit separate lines, unknown/duplicate products, later-item rollback, lost
  response replay, fresh service instance replay, conflicting request reuse,
  concurrent same-request retries and distinct requests for the same product.
- Targeted ESLint and diff checks passed. Test-double typing/import lint issues
  were corrected; final database suites passed after those corrections.
- Tests used isolated localhost:55439/feature39_test with all migrations and
  controlled provider responses; existing databases were not used. No paid calls.
- Review diff: `/private/tmp/feature39-step4.patch`. No commit made. Regular
  Check/Audit/Try remain manual. Next step is stock/purchase integration.


### Step 5 verification (2026-10-20)

- Added assisted stock-set and purchase orchestration using the shared AI
  preparation, catalog batch writer and Serializable receipt transaction.
  Extracted existing inventory transaction bodies without changing ledger rules.
- Units resolve from explicit input, existing projection, then accepted catalog
  metadata. Missing units and incompatible purchase units produce indexed
  needs_input with full rollback. Purchases reset rather than add quantities;
  historical purchases preserve newer recorded stock. Input receipt order is
  preserved while domain writes use product-ID order.
- Statistics run only after a newly committed receipt, never during retries or
  replay; failures remain logged and do not undo committed actions.
- Extracted common catalog application/duplicate checks for grocery and stock.
  Registered InventoryModule and the internal stock service; no public route yet.
- npm run verify passed 136 suites / 2083 tests and production build.
- npm run contract:check passed 6 suites / 79 tests and 124 agent scenarios.
- Isolated PostgreSQL passed 4 suites / 41 tests (assisted stock, grocery,
  catalog writer and existing stock ledger). Nine new stock tests cover mixed
  products, units, historical purchases, duplicate identities, rollback,
  concurrent replay, post-commit statistics and statistics failure recovery.
- Targeted ESLint passed for assisted-action and integration tests. Including
  inventory.service.ts reports two pre-existing unbound-method errors at lines
  171-172, outside this diff. No lint rules were suppressed. Initial integration
  assertions used incorrect DTO keys; corrected to eventType and timestamp.
- graphify update . and git diff --check passed. All 17 migrations were applied
  to temporary localhost:55439/feature39_test; the container was then removed.
  Existing databases untouched; external AI was mocked with no paid calls.
- Review diff: /private/tmp/feature39-step5.patch. No commit made.
  Regular Check/Audit/Try remain manual. Next is Step 6 REST/MCP exposure.


### Step 6 verification (2026-10-21)

- Added POST /api/v1/inventory/assisted-actions and MCP apply_household_items,
  both dispatching through AssistedActionService with shared strict validation.
  REST returns HTTP 200 for typed outcomes, 400 for invalid input and 409 for
  changed replay payloads. Existing service authentication protects both routes.
  Source is server-owned (api or mcp); client source fields are rejected.
- Added MCP-compatible object-root schemas that revalidate against the shared
  operation/result unions. Stock/purchase requests do not acquire grocery defaults.
  Future purchase dates become transport-safe domain errors before inference.
- MCP publication requires a matching release contract to keep Verify green,
  so the additive 2.1.0 snapshot and generated bundle manifests moved forward
  from Step 7. Prior snapshots remain intact; a regression test proves every
  2.0.0 tool definition is unchanged. Agent workflow/scenario changes remain
  Step 7; skill workflow version remains 2.0.0 until that step.
- npm run verify passed 137 suites / 2092 tests and production build.
- npm run contract:check passed 6 suites / 80 tests and 124 agent scenarios.
- Authenticated real HTTP/MCP PostgreSQL integration passed 11 tests: grocery
  success, stock/purchase batches, cross-transport replay, conflicting replay,
  auth rejection before inference, uncertainty, unavailable provider, missing
  units, malformed inputs, spoofed source and future timestamps.
- Focused MCP/schema regression passed 3 suites / 144 tests. All new and changed
  production files and transport tests pass targeted ESLint. Expanding lint to
  the existing mcp-server.factory.spec.ts reports five pre-existing formatting
  errors on untouched lines; those were confirmed against HEAD and left intact.
- Initial iteration corrected MCP grocery-default leakage, an async declaration
  and syntax error in the dispatcher, and expected discovery lists. Final gates
  above passed after these corrections. No rules suppressed or tests skipped.
- graphify update . and git diff --check passed. Tests used an isolated migrated
  feature39_test database with mocked providers; the temporary container was
  removed after passing. No deployment, commit, push or paid model calls.
- Review diff: /private/tmp/feature39-step6.patch. Generated 2.1.0 tool snapshots
  are separate artifacts under integrations/{shared,hermes,openclaw}/
  home-stock-tracker/contracts/2.1.0/tools-list.json.
- Try on a configured local instance: POST /api/v1/inventory/assisted-actions
  with bearer authentication and body containing a fresh UUID requestId,
  operation grocery_add and items [{"productName":"3% milk by Nestle"}].
  An applied result includes the canonical identity and grocery receipt; reuse
  the identical requestId and payload to retrieve that receipt without a write.
  This performs a real action and may call the configured model.
- Regular Check/Audit/Try remain manual. Next: Step 7 agent guidance/scenarios.


### Step 7 verification (2026-10-21)

- Updated shared Hermes/OpenClaw guidance to use apply_household_items for
  ordinary named grocery additions, positive stock sets and measured purchases.
  Agents preserve original phrases; server AI chooses identities and metadata.
  Removed agent-side brand stripping/package conversion guidance and documented
  atomic batches, unchanged pending lines, optional unknown metadata, indexed
  needs_input and safe unchanged requestId retries. Legacy confirmation paths
  remain explicitly scoped to chosen legacy tools or pending decisions.
- Updated installation smoke checks, integration guide and API reference.
  Bumped skill to 2.1.0 with compatible MCP range >=2.1.0 <3.0.0. Regenerated both
  bundles and manifests through npm run skills:generate; MCP fixture remains the
  additive 2.1.0 published in Step 6 with existing tool schemas unchanged.
- Added 12 assisted scenarios (136 total). Validator checks operation/schema
  paths including union variants, required replay identity, server-owned naming,
  no follow-up confirmation tools, bounded retries and no success claims on
  exceptional outcomes. Added regression tests that deliberately violate these
  invariants. Prior tool scenarios are retained and labeled as legacy where
  applicable; dedicated read, feedback and completion flows remain intact.
- npm run verify passed 137 suites / 2100 tests and production build.
- npm run contract:check passed 6 suites / 86 tests and all 136 scenarios.
- Focused workflow/scenario checks passed 2 suites / 98 tests. skills:check,
  targeted ESLint for changed tests, graphify update . and git diff --check passed.
- Iteration corrected old literal expectations, empty-call replay matching and
  replaced an illustrative UUID with the bundle-required placeholder. Final
  gates passed without weakening assertions or suppressing rules.
- Review diff: /private/tmp/feature39-step7.patch contains authored changes;
  generated SKILL.md, scenarios.md and manifests mirror the reviewed sources.
  Try by reviewing the Routine named-item actions section in either generated
  bundle and running npm run contract:check. No live agent installation, model
  evaluation, deployment, paid call or commit was performed. These are scripted
  contract assertions, not evidence of real-model semantic accuracy.
- Regular Check/Audit/Try remain manual. Next is Step 8 final end-to-end evidence.


### Step 8 verification (2026-10-21)

- Final acceptance evidence is recorded in
  [feature-plans/39-acceptance-evidence.md](../../context/feature-plans/39-acceptance-evidence.md),
  with each spec scenario mapped to observable tests and explicit limitations.
- Added two authenticated transport cases: stock with omitted metadata/unit is
  classified through the configured provider boundary and persisted with generic
  name plus original alias; grocery with unknown optional metadata commits without
  confirmation. Both use controlled responses, not real-model accuracy evidence.
- npm run verify passed 137 suites / 2100 tests and production build.
  npm run contract:check passed 6 suites / 86 tests and 136 scenarios.
- Final real PostgreSQL and HTTP/MCP checks passed 8 suites / 90 tests: 54 assisted
  and stock-ledger tests plus 36 existing policy-aware grocery regression tests.
  All 17 migrations applied to isolated feature39_test; temporary container removed.
- Targeted ESLint, graphify AST update and git diff --check passed.
- Step-only test diff: /private/tmp/feature39-step8.patch. No production changes
  were needed during this step. All eight implementation steps are complete.
- Findings ledger has no open/fixed P0/P1 IDs; its previous audit is unrelated.
  Independent review: none. Regular Audit/Check/Try policies remain manual.
  No paid model calls, commit, merge, push, install or deployment performed.
- Ready for reviewed /complete, which owns final gates, archive and work commit;
  merge and push retain their separate approval requirements.


## Completion safety pass (2026-10-21)

- npm run verify: 137 suites / 2100 tests and production build passed again.
- npm run contract:check: 6 suites / 86 tests, 136 scenarios passed again.
- Final Step 8 PostgreSQL and authenticated HTTP/MCP evidence covers 90 tests;
  see the linked acceptance evidence. No product code changed after that run.
- No blocking findings or independent review receipt. Regular audit/check/try
  policies are manual. Provider behavior was mocked; real-model accuracy untested.
- Prior 38f spec is preserved verbatim in context/feature-plans; 38f remains open.
- Completion creates the feature work commit. Merge and push need separate approval.
