# Feature: JEV product understanding

**From build-plan:** feature 38b
**Status:** verified
**Approved parent plan:** [JEV-first application inference](feature-plans/jev-first-application-inference.md)

## Goal

Enrich product category, type, typical unit and perishability through a task-specific port, using deterministic existing values before bounded JEV decisions. Preserve entered names and explicit aliases. Keep unknown metadata nullable and make enrichment a deliberate write operation, never a side effect of reads.

This is one reviewable sub-feature with nine small build steps. Provider defaults stay OpenAI until the evaluation and rollout in 38e.

## In scope

- A typed product-understanding port with independent outcomes and confidence for four metadata fields.
- JEV adapter using the 38a vocabulary, transport, routing policy and safe provenance.
- OpenAI metadata adapter for the independent rollback setting; neither adapter generates names or aliases.
- Integration of the internal assisted new-product flow and a deliberate authenticated REST enrichment action for an existing incomplete product.
- Startup validation for `PRODUCT_UNDERSTANDING_PROVIDER=openai|typesafe`, default `openai`.
- Accepted/rejected/unavailable attempt logs, null-safe persistence, namespace races and concurrent metadata protection.
- Focused unit, isolated PostgreSQL and REST regression evidence; additive endpoint documentation and existing contract checks.

## Out of scope

- Shelf-life policies (38c), stock workflow inference (38d), paid accuracy evaluations and enabling JEV by default (38e).
- Catalog backfills, reclassification on reads, generated aliases, synonym learning without confirmation, category relabeling, unit conversion or ledger changes.
- New MCP enrichment tool, WhatsApp conversation changes, queues, frontend, deployment or private runtime changes.
- Required new-category/unit generation in JEV mode: current product metadata fields are optional. Vocabulary gaps remain unresolved; no current operation requires a generated value. The 38a capability contract remains available for a later genuinely required-field flow.

## Build loop

Build on `feature/jev-product-understanding`, one reviewed step at a time.

1. Lay out the next step before coding.
2. Implement only that step, including tests for its logic.
3. Show its diff and evidence for the done-when.
4. Wait for step approval before continuing; checkpoint commits are optional and require permission after passing gates.

Run `npm run verify` before checkpoints/completion. If a step cannot fit a readable diff, split that step without extending product scope.

## Build steps

- [x] **Step 1 - Domain contract and merge policy.** Define the port, schemas, per-field results, supplied/stored-value precedence and a pure accepted-metadata merge helper. *Done when:* tests distinguish false from null, accept valid partial results, reject invalid inputs, preserve every populated stored field, and exclude canonical names/aliases from inference and merge results. Existing application wiring still works.
- [x] **Step 2 - Nullable perishability and contracts.** Make the stored field nullable with no default, preserving existing values; propagate null through response/candidate/prediction inputs, retain explicit confirmed creation booleans, and version the MCP contract. *Done when:* generated client/build and null-consumer tests pass, existing booleans remain compatible, and isolated migration evidence proves existing false stays false and omitted new values become null.
- [x] **Step 3 - Shared operation deadline.** Let the JEV client accept an optional remaining budget capped by its existing task budget; preserve default behavior for existing callers. *Done when:* fake-clock/transport tests prove timeout cancels fetch and retry waits, later calls cannot reset the operation deadline, exhausted budgets make zero requests, and resolution/stock/shelf-life defaults remain unchanged.
- [x] **Step 4 - JEV metadata adapter.** Build complete category/unit vocabularies from distinct nonblank catalog labels, plus versioned type/perishability options. Classify only missing fields, with safe token mapping and independent acceptance. *Done when:* mocked Hebrew/English cases map to exact allowed labels, empty catalogs use seeds, unknown and low confidence retain null, false can be accepted, one failed field leaves other accepted fields usable, and overflow/collision/malformed context never causes truncated choices, arbitrary stored values or OpenAI calls. Four field calls share the Step 3 budget.
- [x] **Step 5 - OpenAI adapter and configuration.** Add the metadata-only OpenAI implementation, independent selector and DI binding. *Done when:* one structured generation receives only missing fields and necessary context, supplied fields and names cannot be overwritten, per-field rejected values remain null, default/rollback OpenAI configuration works, and selecting TypeSafe without its private key or pinned model fails startup with a safe error. Other selectors keep their defaults.
- [x] **Step 6 - Vocabulary collection and attempt logging.** Add focused orchestration and diagnostic providers without changing product writes. *Done when:* distinct nonblank catalog labels feed the port without truncation; failures preserve supplied values; logs validate provenance, omit raw context and unknown usage, distinguish applied versus stale values, and cannot block operations.
- [x] **Step 7 - Persistence and safe assisted creation.** Wire the port into `findOrCreateByExactOrAliasMatch`, replace inferred-name matching/alias writes with entered-name creation, add guarded internal enrichment and versioned attempt logging. *Done when:* exact matches invoke neither provider, new products preserve display spelling with no inferred aliases, partial metadata saves safely, provider/log failures leave a usable product, and PostgreSQL races prove namespace uniqueness and preservation of concurrently populated metadata or changed product identity. No inference happens inside an open DB transaction.
- [x] **Step 8 - Deliberate REST enrichment.** Expose the Step 7 operation as authenticated `POST /products/:id/enrich`; document it using existing OpenAPI/documentation conventions. *Done when:* an explicitly created incomplete product can be enriched, full products make zero model calls, missing IDs return the existing not-found error, unauthenticated calls are rejected, unknown/provider failures return the current product without changing names, and GET/list/grocery/confirmed-alias flows retain their contracts and no new inference calls.
- [x] **Step 9 - Regression and review evidence.** Add focused cross-flow fixtures and finish the existing documentation/contract workflow. *Done when:* REST and isolated PostgreSQL evidence covers partial unknowns, both provider modes, concurrent writes and explicit confirmation; final Verify and contract checks pass; all done-whens have reproducible evidence without paid calls or runtime enablement.

## Files / areas

- New `src/product/product-understanding.ts`, focused types/merge helpers, JEV/OpenAI adapter services and colocated tests. Follow established injected advisor patterns.
- `src/product/product.service.ts`, `product.module.ts`, `product.controller.ts` and classification logging. Remove or retire the legacy classifier/schema only after callers and tests move; keep old persisted logs readable.
- `src/product/choice-vocabulary.ts` and manifests, reused without changing legacy labels.
- `src/llm/typesafe/jev-decision.client.ts` and deadline tests; existing callers must remain compatible.
- `src/config/application-config.ts`, configuration tests and `.env.example` for the new independent selector.
- `src/product/dto/` only if endpoint response documentation needs an explicit DTO; reuse `ProductResponseDto`.
- Focused new product-understanding/enrichment tests under `test/`, existing name-write, configuration, grocery confirmation and MCP regression suites.
- `docs/jev-integration.md`, product API documentation and the established contract fixture/generated bundle process where affected.
- Approved schema work: nullable `Product.isPerishable` with no default, preservation migration and MCP 2.0.0 output/bundle contracts. `LlmInferenceLog.structuredResponse` supports versioned JSON.

## Data / contracts

### Internal port (load-bearing)

`ProductUnderstandingInput` contains `rawName` (nonblank entered display name), a snapshot of category/unit/type/perishability, and complete category/unit label inputs. Provider context is restricted to the product and relevant metadata/choices, without household conversations or unrelated catalog records.

`ProductUnderstandingResult` contains four typed field results and validated attempt provenance. Reuse 38a outcome semantics, adding values without weakening discrimination:

| Field | Accepted value | Unresolved persisted value |
| --- | --- | --- |
| category | Exact JEV vocabulary label, or validated generated label in selected OpenAI mode | null |
| typicalUnit | Exact JEV vocabulary unit label, or validated generated label in selected OpenAI mode | null |
| productType | Existing Prisma enum | null |
| isPerishable | true or false | null |

Each outcome is resolved (with source and value), uncertain (unknown/low confidence/ambiguous/schema rejected), unsupported coverage, or unavailable. Confidence is per field; do not invent one aggregate confidence. Supplied/stored non-null values resolve deterministically and do not need model confidence. Existing nonblank legacy category/unit values remain valid and unchanged. Explicit creation continues to store only supplied metadata and explicit names, with zero model calls.

### JEV choice contract and limits

- Task `product_understanding`, task version `jev-product-understanding-v1`; independent question keys for category, unit, type and perishability.
- Category/unit choices come from the existing 38a builders: exact nonblank catalog values, seeds only when empty, stable token maps, 254 domain options plus unknown, and 16,384 UTF-8 bytes of prepared choice context. Do not silently filter collisions or truncate options.
- Type choices are the four existing Prisma values plus unknown. Perishability choices are perishable, nonperishable and unknown; map unknown to null, never false. Version these fixed manifests.
- Provisional per-field acceptance requires validated non-unknown choice, JEV confidence >= 0.90 and selected-option probability >= 0.90. These are conservative policy gates, not measured accuracy; 38e evaluates them independently.
- At most four logical JEV decisions in fixed field order (category, type, unit, perishability), only for unresolved fields. All share one 10,000 ms monotonic provider-phase deadline. The current client allows at most two HTTP attempts per decision, so the absolute ceiling is eight requests within that shared deadline. Retain already accepted fields when time expires; mark remaining fields unavailable.
- Unknown/low confidence/schema rejection/provider failure never escalates to OpenAI. Incomplete optional vocabulary leaves that field unsupported; other fields may still be classified. Unknown alone is not proof that a new category is required.

### OpenAI compatibility and fallback

`PRODUCT_UNDERSTANDING_PROVIDER=openai` selects one metadata-only structured generation for missing fields, with independent nullable values and per-field confidence. Use the current 0.80 classification confidence gate per field provisionally. Reuse `LlmProvider`, validate output and omit any unrequested fields from accepted writes. No canonical name or alias generation, matching or writes in either provider mode.

This selected OpenAI mode is distinct from fallback. In TypeSafe mode the four metadata fields are optional, so 38b issues zero OpenAI calls. Do not add a required-field flag or automatic fallback merely to exercise the 38a generation capability. Metadata generation sets a 10,000 ms provider-phase budget through the existing provider boundary, disables SDK retries for this bounded request, and cancels hanging fetch/body/parse work. Other generation tasks retain existing request options. No adapter-level retries.

### Persistence and concurrency

- The entered name uses existing display-name normalization; only the lookup key uses NFKC/lowercase normalization. Assisted creation no longer uses model names to discover existing products or silently attach aliases. An exact concurrent namespace match returns its owner without enrichment or alias mutation.
- Alias additions keep the existing explicit alias/confirmed grocery transaction. Metadata confidence never authorizes identity changes.
- Enrichment loads a product snapshot, performs inference outside transactions, then uses a short transaction with conditional field updates. Fill only fields still null; preserve explicit false and every non-null value. If product identity or the inference-relevant metadata snapshot changed, discard stale inferred values and return the current product without automatic retry. If deleted, return not found. Prove the guard with a concurrent writer test, not a read-then-write assertion.
- Never change stock units/balances or policies while enriching `typicalUnit`; existing ledger conflict behavior stays authoritative.
- Log provider attempts into existing inference JSON using a discriminator/version (for example `product-understanding-v1`), operation ID, field identity, vocabulary/task version, accepted/rejected/unavailable status, safe routing reason, provider and configured/resolved model, elapsed time, per-field confidence, selected-option probability when available and validated usage. Separate inference acceptance from whether a guarded write applied it.
- Top-level model version is the resolved model where available, otherwise the configured model explicitly identified as unresolved in JSON. Do not invent a resolved version. Omit unavailable confidence/usage rather than inventing zero; deterministic bypass makes no provider attempt log. Diagnostic logging failure must not block product writes.
- Logs contain safe outcome metadata, not raw prompts, catalog contents, credentials or raw provider errors. Legacy classification log records remain readable.

### REST action (additive contract for review)

`POST /products/:id/enrich`, under existing service bearer authentication, takes no metadata or force-overwrite fields and returns the existing `ProductResponseDto` with HTTP 200. Use an empty body or no body; reject unsupported nonempty input through the established validation/error contract. Only currently missing fields are eligible. Missing products return the existing product-not-found response. Provider abstention/failure returns the product with remaining nullable fields, not a new provider-error response.

There is no new MCP tool in this spec. Public response enums remain unchanged; approved nullable perishability widens output values and requires a major MCP contract version. Document the new REST action and run the existing contract-version/fixture workflow where the additive surface affects published contracts; do not manually change generated bundles or claim unchanged behavior for legacy automatic-alias tests.

## Testing

- Each logic-bearing step includes Jest tests through `npm run test -- --runInBand` with focused paths.
- Pure contract/merge tests: missing/blank/malformed names, false/null, invalid enum/label/token, supplied values, independent confidence gates and partial acceptance.
- Mocked adapter tests: Hebrew, English and mixed names; ambiguous inputs; unknown; selected probability versus confidence; complete/empty/colliding/oversized vocabularies; invalid envelopes; deadline and retry ceilings; per-field provider failures and exact OpenAI/JEV call counts.
- Configuration/DI tests: default OpenAI, independent TypeSafe selection, unsupported selector, missing key/model, unchanged resolution/stock selectors and required OpenAI setup.
- Isolated migrated PostgreSQL evidence: null-safe partial persistence, stale inference rejected after explicit metadata/identity updates, concurrent new-name ownership, no generated aliases, logging failure and product deletion. Follow existing test database safeguards and fixtures; never use household production data.
- REST/Supertest evidence: explicit create then deliberate enrich; not found/auth/malformed body; repeat enrich for a complete product makes no call; unknown returns null; GET/list and exact-name lookup make no provider calls. Existing grocery additions and alias confirmation still require their original policies/confirmation.
- Run affected PostgreSQL product-name writes, confirmed-grocery REST and alias MCP suites with the documented isolated DB configuration. Add a focused enrichment suite rather than extending unrelated stock tests.
- Configuration HTTP regression: `npm run test:e2e -- --runInBand test/model-configuration.e2e-spec.ts` with its stubbed persistence harness.
- Final gates: `npm run verify`, `npm run contract:check`, `git diff --check`; record affected end-to-end suite results separately.
- No Browser tests command or browser-facing UI exists. API and persistence evidence cover this backend feature; representative mocked names prove mapping behavior, not live accuracy. Paid held-out evaluation belongs to 38e.

## Notes for the AI

- All work is server-side. Keep orchestration, adapter validation, persistence and logging in focused injected services; avoid a growing provider-switch controller/service.
- No reference image or prototype is required for this backend feature.
- Graph evidence locates `ProductService`, `ProductClassifier`, classification logging and the confirmed grocery paths; inspect current source before implementation because graph spec nodes can reference archived content.
- Run `graphify update .` after source edits. This planning pass changes no application source.
- Autopilot authorizes configured checkpoint commits after passing gates. Do not enable selectors in private environments, invoke paid providers, merge, push or deploy.
- The user invoked Autopilot and approved the nullable correction; this spec is approved for bounded implementation. The additional REST action is the proposed deliberate enrichment entry point; the existing assisted creator currently has no public route.

## Critique incorporated

- Removed automatic inferred-name matching and alias insertion from both provider modes; a provider swap alone would retain the identity risk.
- Added an explicit enrichment action because the legacy assisted service has no public entry point for incomplete products.
- Defined per-field null/confidence semantics and separate selected probability gates, including explicit false preservation.
- Bounded four decisions by one deadline and included the small client budget change as its own reviewable step.
- Added stale-snapshot guards and real concurrent-write evidence so inference cannot overwrite newer explicit metadata.
- Kept optional unsupported metadata unresolved instead of adding unnecessary generation fallback; default/rollback OpenAI remains a separate selected mode.
- Included rejection/unavailable logs and additive REST contract documentation with the approved nullable migration and no new MCP tool.

## Autopilot checkpoint and hard stop (2026-10-05)

- Branch: `feature/jev-product-understanding`. Resumed the reviewed draft through explicit `$autopilot` invocation.
- Step 1 implemented the isolated port, validated metadata/input schemas, independent field outcomes and accepted-metadata merge helper. No runtime wiring, provider requests or product writes changed.
- `npm run verify` passed: 99 suites, 1,710 tests and production build. Focused contract suite: 8 tests passed. Graph refresh and diff check accompany the checkpoint.
- Regular Check, Audit and Try policies are manual. No independent review was requested or configured. These gates have not run; feature acceptance is incomplete.
- Blocking evidence: `prisma/schema.prisma` defines `isPerishable Boolean @default(false)`. Product response/search DTOs and resolution context schemas also require booleans. The overview's nullable-field description and this draft's no-migration assumption were incorrect.
- Proposed correction for approval: make `Product.isPerishable` nullable with no default through an additive migration; retain every existing true/false value (no backfill guesses), and persist new unresolved perishability as null. Update REST/MCP product/search/resolution schemas and fixtures to permit null, use the repository's versioned contract release process, and explicitly review downstream expiration/prediction handling of unknown. Retain explicit confirmed creation's required boolean. Add migration/API/null-consumer coverage as reviewable build steps before persistence wiring.
- This proposal expands the planned files and changes a public value contract. It has not been implemented. Do not pretend a default false is a supplied fact or store unknown as false to bypass the decision.
- Next action: approve or adjust the schema/public-contract correction, then `$autopilot resume`. Remaining six steps are unchecked; do not run `/complete`.

## Approved correction

User approved the nullable schema/public-contract correction on 2026-10-05 and authorized resuming Autopilot. Add Step 2 before transport/adapters; preserve all stored boolean values, introduce no catalog backfill, and retain explicit confirmed creation booleans. Autopilot continues through passing steps with configured checkpoint commits.

## Step 2 verification

Nullable schema/client, output contracts and null-consumer tests implemented. Verify: 99 suites / 1,712 tests and production build passed. Contract checks: 124 scenarios / 79 tests passed. Isolated migration test passed; preserves old booleans and omits new unknown values as null. Scoped ESLint and diff check passed. MCP 2.0.0 fixtures and complete bundles generated through the repository workflow. Local dedicated PostgreSQL container: `home-stock-38b-tests`, port 55438. No household data or runtime configuration changed.

## Step 3 verification

Shared remaining-budget support implemented. Focused client tests: 102 passed. Verify: 99 suites / 1,719 tests and build passed. Existing unsupported-task behavior preserved; nonfinite/exhausted budgets issue no requests. Graph refreshed; diff check passed.

## Step 4 verification

JEV adapter and complete token maps implemented. Focused multilingual/boundary/failure/deadline cases: 15 passed. Verify: 100 suites / 1,734 tests and build passed. After a small provenance-helper split, focused cases and build passed again. Scoped ESLint, graph refresh and diff check passed. No paid calls or runtime wiring changes.

## Step 5 verification

Metadata-only OpenAI adapter, independent configuration and DI binding implemented. Focused adapter/configuration tests: 66 passed. Verify: 101 suites / 1,748 tests and build passed. Configuration HTTP/DI regressions: 20 passed. Scoped ESLint, graph refresh and diff check passed. No names/aliases generated by the new adapter; defaults remain OpenAI.

Persistence step split during implementation into vocabulary/logging and write integration to keep each checkpoint reviewable.

## Step 6 verification

Complete distinct catalog vocabulary collection, supplied-value bypass, failure isolation and validated diagnostic logs implemented. Focused runner/log cases: 7 passed. Verify: 103 suites / 1,756 tests and build passed, including exact legacy-label preservation. Scoped ESLint, graph refresh and diff check passed. Persistence wiring remains the next step.

## Step 7 verification

Assisted creation now preserves entered names with no inferred-name matching or alias writes. Guarded enrichment runs outside transactions and rejects stale metadata/name snapshots. Focused ProductService cases: 30 passed. Isolated PostgreSQL cases: 7 passed, including metadata/name races, deletion, namespace ownership and logging failure. Verify: 103 suites / 1,755 tests and build passed. Scoped lint and diff check passed; graph refreshed.

## Step 8 verification

Authenticated POST /products/:id/enrich and empty-body validation implemented and documented. Real REST/PostgreSQL flows across both provider modes: 8 passed. Verify: 104 suites / 1,764 tests and build passed. Scoped lint and diff check passed. No new MCP tool; GET/list and complete enrichment bypass inference.

Final review added validated per-field confidence/probability to safe attempt provenance and a ten-second OpenAI metadata budget (SDK retries disabled for that task only). Both changes stay within the approved bounded inference scope and have focused tests.

## Step 9 verification

All final verification passed after deadline, provenance and null-consumer repairs. See the final review packet below.

## Final Autopilot review packet

- Target: 38b, JEV product understanding. Branch: `feature/jev-product-understanding`; resumed the reviewed spec after user approval of nullable perishability. All nine steps are checked and the spec is verified.
- Critique changes: preserve entered names and explicit aliases; add deliberate enrichment instead of read-side inference; distinguish null from false; require independent per-field confidence/probability gates; bound provider work; guard against concurrent identity/metadata changes. The approved schema correction preserves stored booleans and versions nullable MCP outputs as 2.0.0.
- Changed areas and purpose: `src/product/` adds the metadata contract, provider adapters, complete vocabulary collection, safe logging, guarded persistence and authenticated REST action. `src/llm/` adds remaining-budget transport and validated attempt metrics. `src/config/` and `.env.example` add the independent default-OpenAI selector. `prisma/` removes the perishability default/non-null constraint. Product, inventory, estimation and evaluation contracts preserve unknown as null. `src/mcp/` and generated `integrations/` fixtures/bundles publish the compatible major-version contract. Unit and `test/` suites prove mapping, failures, migration, writes and HTTP behavior. `docs/` documents contracts and provider limits; graph outputs were refreshed.
- Final `npm run verify`: PASS, 104 suites / 1,771 tests and production build. Output: `/private/tmp/38b-final-verify-repaired.log`.
- Final `npm run contract:check`: PASS, 124 executable scenarios and 6 suites / 79 tests; release, generated bundles and documentation checks passed. Output: `/private/tmp/38b-final-contract-repaired.log`.
- Isolated PostgreSQL regression command: `DATABASE_URL=<dedicated-test-url> npm run test:e2e -- --runInBand test/product-perishability-migration.e2e-spec.ts test/product-understanding.service.e2e-spec.ts test/product-enrichment.rest.e2e-spec.ts test/model-configuration.e2e-spec.ts test/product-name-writes.e2e-spec.ts test/product-search.e2e-spec.ts test/product-search.service.e2e-spec.ts test/product-search-mcp.e2e-spec.ts test/product-alias.mcp.e2e-spec.ts test/confirmed-grocery-catalog.rest.e2e-spec.ts test/policy-aware-grocery.rest.e2e-spec.ts test/policy-aware-grocery.mcp.e2e-spec.ts`: PASS, 12 suites / 111 tests. Output: `/private/tmp/38b-final-e2e.log`.
- After final deadline/null fixes, affected suites were rerun: `DATABASE_URL=<dedicated-test-url> npm run test:e2e -- --runInBand test/product-enrichment.rest.e2e-spec.ts test/product-understanding.service.e2e-spec.ts test/model-configuration.e2e-spec.ts test/estimation-response.e2e-spec.ts test/daily-stock-workflow.e2e-spec.ts`: PASS, 5 suites / 39 tests. Output: `/private/tmp/38b-final-bounded-e2e-repaired.log`. Counts overlap the earlier run.
- Changed-file ESLint: PASS for 58 TypeScript files, without auto-fix. `git diff --check`: PASS. `graphify update .`: PASS. Full repository lint was not a gate; an unchanged legacy classifier test has a pre-existing unbound-method lint error outside this scope.
- Test database: dedicated local container `home-stock-38b-tests`, port 55438, database `home_stock_38b_test`. No household data was used. All provider responses were mocked; no paid provider requests ran.
- Effective regular gates: Check, Audit and Try are manual and were skipped. Independent review is effectively manual; target would be 38b, reviewer/model none selected, no request or receipt. No automatic independent review or targeted audit ran. No open or fixed P0/P1 findings are recorded.
- Self-review repairs: corrected nullable schema/public outputs with approval, retained exact catalog labels, guarded stale writes and namespace races, validated confidence/probability provenance, bounded OpenAI metadata requests to ten seconds with SDK retries disabled, and corrected disabled/untracked prediction signals to null. Required verification and affected regressions passed after repairs.
- Manual review: in a disposable migrated environment with configured credentials, POST `/products/:id/enrich` with service bearer authentication and an empty body for an incomplete product, then GET it. Existing values and identity must remain unchanged. Repeating for complete metadata makes no provider call. Use the isolated REST E2E suite above for reproducible mocked review, or request `$try` for a full guide. No browser-facing UI is involved.
- Checkpoints: `07e508e`, `193c0bf`, `8841c6e`, `cd19d68`, `18afadc`, `2f65320`, `913fcb5`, `ac66c55`, followed by the final `feat: checkpoint product understanding verification` checkpoint.
- Remaining limits: apply the nullable migration and MCP 2.0.0 client/bundle update together when deploying later. Existing false values stay false; no backfill guesses are made. Live accuracy and default-JEV rollout remain 38e; the selector defaults to OpenAI. No private runtime configuration, merge, push or deployment changed.
- Next action: review the diff and this evidence, optionally request `$try` or independent review, then invoke `$complete`. Build-plan completion and archival remain pending.

## Completion safety pass (2026-10-05)

- `$complete` reran `npm run verify`: 104 suites / 1,771 tests and production build passed. Output: `/private/tmp/38b-complete-verify.log`.
- `npm run contract:check` passed: 124 executable scenarios and 6 suites / 79 tests, including release, generated-bundle and documentation checks. Output: `/private/tmp/38b-complete-contract.log`.
- Reused the current feature's isolated PostgreSQL/HTTP evidence recorded above; no application source changed after those passing runs. `git diff --check` passed. All branch changes are tied to 38b and its approved nullable correction. No shared workflow adapters changed.
- Regular Check, Audit, independent review and Try remain manual. Findings and independent-review files are canonical empty stubs. No P0/P1 blockers exist. Manual review uses the mocked REST E2E suite or authenticated POST `/products/:id/enrich` with an empty body in a disposable migrated environment.
- Archived the verified spec, checked off only 38b, synchronized overview progress/source hash and reset the active spec. Parent 38 remains open for 38c through 38e.
- Work commit: `feat: add bounded JEV product understanding`. The prepared local squash merge includes all nine passing checkpoints and completion documentation. Merge requires explicit approval; push requires separate approval.
- OpenAI remains the default. The nullable migration and MCP 2.0.0 bundle/client upgrade must be coordinated when deploying later. No paid calls, production migration, private runtime change or deployment ran.
