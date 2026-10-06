# Feature: JEV shelf-life policies

**From build-plan:** feature 38c
**Status:** verified
**Approved parent plan:** [JEV-first application inference](../../context/feature-plans/jev-first-application-inference.md)

## Goal

Resolve missing product shelf-life policies through an independent, deterministic-first port. JEV selects a reviewed applicable policy identity; application code supplies its duration and rationale. Generate a missing finite policy only when evidence is sufficient and the supported registry cannot express the required answer.

This is one bounded sub-feature with seven reviewed steps. OpenAI remains the default selector until 38e evaluation and rollout.

## In scope

- Versioned, small policy registry with exact durations, applicability requirements, storage assumptions, source references and local rationales.
- Typed shelf-life port and independent JEV/OpenAI implementations, reusing 38a routing, transport and attempt provenance.
- A strict internal storage-context contract in the existing product configuration JSON, without inventing storage facts from category or nullable perishability.
- Missing-policy integration in the existing daily/manual workflow, safe persistence and attempt logging.
- Independent `SHELF_LIFE_POLICY_PROVIDER=openai|typesafe` configuration, default `openai`.
- Focused unit and isolated PostgreSQL regression evidence, configuration and integration documentation.

## Out of scope

- Stock advice and recommendation integration (38d), paid evaluation/default enablement (38e).
- Policy editing endpoints, batch-specific inferred policies, catalog backfills, refreshing existing policies, new household automation settings, queues or scheduled retries.
- New REST/MCP tools or response fields, schema migration, generic registry management, runtime/private environment changes, deploy or push.
- Food-consumption safety advice. Stored durations support inventory estimation under documented assumptions.

## Build loop

Built on `feature/jev-shelf-life-policies`. The explicit Autopilot request authorized this run without individual step approvals and with configured verified checkpoints.

1. Lay out the next step before coding.
2. Implement only that step with its focused logic tests.
3. Show the diff and observable done-when evidence.
4. Wait for step approval before continuing. Checkpoints require permission and passing Verify.

Run `npm run verify` before checkpoint/completion. Split any step that exceeds a readable diff without extending scope.

## Build steps

- [x] **Step 1 - Policy registry and applicability contract.** Add versioned registry, strict input/outcome schemas, context parser and pure eligibility helpers. Document each seed's source, exact duration and required facts. *Done when:* tests reject duplicate IDs, malformed policy pairs and invalid context, preserve null as unknown, exclude incompatible/insufficiently supported policies, and expose the complete applicable set plus unknown without numeric buckets. No runtime routing changes yet.
- [x] **Step 2 - JEV selection adapter.** Add the task-specific port and bounded adapter, versioned policy tokens and provisional acceptance gate. *Done when:* mocked Hebrew/English product cases return only supplied applicable IDs, code supplies exact registry values, out-of-set/unknown/low-confidence/malformed/provider failures remain unresolved with validated provenance, and no OpenAI call occurs for an accepted selection or uncertainty.
- [x] **Step 3 - Required generation and OpenAI rollback adapter.** Add evidence-gated unsupported-policy fallback and independently selectable legacy OpenAI adapter. *Done when:* a sufficiently identified unsupported finite policy calls generation once within the remaining deadline; missing storage, ambiguous identity, provider failure and unknown-without-coverage-evidence make zero fallback calls; refusal/invalid/nonperishable fallback output leaves policy missing. OpenAI-selected mode retains existing supported output shape and behavior with a bounded request.
- [x] **Step 4 - Independent configuration and DI.** Bind the port in InventoryModule and add selector validation/documentation. *Done when:* default/OpenAI and explicitly selected TypeSafe modules resolve the correct implementation, TypeSafe selection without key or pinned model fails startup safely, and product/stock/resolution selectors remain independent. Existing tests explicitly bind the new port where required.
- [x] **Step 5 - Workflow eligibility and guarded persistence.** Supply minimal product/config context, resolve only missing policies, and conditionally create accepted policies after rechecking the evidence snapshot. *Done when:* stored policies make zero provider calls; unresolved results remain missing; concurrent policy creation is reused/skipped rather than overwritten or reported as a generic failure; changed product identity/metadata/context discards stale results; one product's failure does not stop later products or stock materialization. All model calls happen outside transactions.
- [x] **Step 6 - Attempt logging and provenance.** Persist versioned safe attempt records using LlmInferenceLog and distinguish selection acceptance from actual application. *Done when:* tests cover accepted/rejected/unavailable, generated fallback, stale/reused writes and logging failure; stored policy provenance uses the actual supplying provider/model/task version; JEV policy ID and registry version remain traceable; logs contain no raw product context, keys or provider errors. Logging failure cannot block the workflow.
- [x] **Step 7 - Cross-flow regression and review packet.** Add isolated PostgreSQL workflow/concurrency fixtures and finish documentation. *Done when:* both selectors work through real Nest workflow wiring with mocked providers; repeat evaluation reuses policies; explicit batch dates still determine batch expiry and reads make zero inference calls; missing-policy estimation remains usable; Verify, contract checks and affected E2E suites pass with reproducible evidence. No paid calls or default rollout.

## Files / areas

- New focused shelf-life policy port, registry/applicability helpers, JEV adapter and logging provider under `src/inventory/`, with colocated tests.
- `src/inventory/types/shelf-life-inference.ts`, `shelf-life-reasoner.service.ts`, `shelf-life-inference.service.ts`, `inventory.module.ts` and relevant tests. Preserve legacy generation behind the OpenAI adapter rather than duplicating it.
- `src/config/application-config.ts`, configuration/DI tests and `.env.example`.
- Reuse `src/llm/decision-routing/`, `typesafe/jev-decision.client.ts` and OpenAI's existing `budgetMs` support. No generic transport rewrite.
- `test/daily-stock-workflow.e2e-spec.ts`, focused new policy/concurrency suite, existing expiration-status/recommendation regression suites.
- `docs/jev-integration.md` and relevant environment/workflow documentation.
- Existing `Product.config`, ProductShelfLifePolicy and LlmInferenceLog tables. No schema or public contract changes are planned.

## Data / contracts

### Internal policy port (load-bearing)

Input contains validated product ID, canonical display name, nullable category/unit/type/perishability, and normalized optional storage context. Existing stored policy is checked before invoking the port. Output contains a discriminated resolved/uncertain/unsupported/unavailable outcome, optional accepted policy value, validated attempts and supplying task version. Reuse 38a reasons rather than collapsing low confidence, unsupported coverage and transport failures into unknown.

Accepted policy retains the current shape: `kind`, positive finite `shelfLifeDays` for finite or null for nonperishable, confidence in [0,1], nonblank rationale. JEV also returns internal `policyId` and `registryVersion`; these belong in versioned diagnostic JSON, not public responses. No adapter writes to the database.

### Storage evidence and seed registry

Reserve `Product.config.shelfLifeContext` as an optional internal JSON object:

`{ version: 1, storage: 'refrigerated'|'ambient'|'frozen'|'unknown', maxTemperatureC: number|null, preparation: 'raw'|'cooked'|'unknown', form: 'shell'|'whole_or_pieces'|'unknown' }`.

Parse strictly with finite numeric temperatures. Missing, malformed or unsupported versions produce unknown context, never assumed refrigeration. Preserve unrelated config keys. This feature reads the namespace; it adds no public configuration writer or automatic population. Disposable fixtures can set it directly. Product identity comes from existing names/metadata; context cannot assert a different product identity.

Proposed registry `shelf-life-policies-v1`:

| Policy ID | Stored value | Applicability and assumptions |
| --- | --- | --- |
| raw-shell-eggs-refrigerated | finite, 21 days | Identifiable raw eggs; explicit raw/shell context; refrigerated with supplied maximum temperature >0 and <=4 C; normal refrigerated storage from purchase |
| raw-poultry-refrigerated | finite, 1 day | Identifiable chicken/turkey; explicit raw/whole_or_pieces context; refrigerated with supplied maximum temperature >0 and <=4 C; normal refrigerated storage from purchase |
| stable-household-paper-plastic | nonperishable, null | Identifiable plain toilet paper or empty plastic refuse bags; household-consumable evidence; no conflicting perishable/chemical/food evidence; normal dry storage |

Finite seeds conservatively use the lower end of the published ranges (eggs 3-5 weeks, fresh poultry 1-2 days) from [FoodSafety.gov's Cold Food Storage Chart](https://www.foodsafety.gov/food-safety-charts/cold-food-storage-charts), checked 2026-10-05. The nonperishable seed is an application inventory policy limited to those durable nonfood goods, not a claim about all household products. Final registry entries and local rationale templates are part of Step 1 review. Do not round generated durations into these policies or use category/productType/isPerishable=false alone as proof.

The initial applicability implementation uses a conservative exact normalized Hebrew/English identity allowlist, including raw salmon/cod/trout as identifiable unsupported finite-policy examples. Broader names abstain until reviewed in 38e. This prevents model-selected identity from overriding contradictory local evidence.

Applicability has two gates: code excludes policies whose required storage/preparation/form facts are absent or conflicting; JEV selects product identity only within that eligible set. Revalidate the selected entry against all facts before accepting. Unknown remains an explicit option. A single plausible candidate still requires selection unless exact reviewed identity evidence resolves it deterministically; do not force a choice.

### Routing, acceptance and budgets

- Task `shelf_life_policy`; selection version `jev-shelf-life-policy-v1`; question key `shelfLifePolicy`; distinct generation version `shelf-life-policy-generation-v2`.
- Send only required product evidence and the complete eligible registry entries with opaque policy tokens plus unknown. Preserve existing transport limits (including bounded option count and UTF-8 context); overflow is unresolved, never truncated coverage.
- Provisional acceptance: valid non-unknown applicable ID, confidence >=0.90 and selected probability >=0.90. Persist confidence conservatively as the lower of these two scores. These gates are policy, not demonstrated accuracy; 38e evaluates them.
- One selection and at most one generation call share a 10,000 ms monotonic provider-phase deadline per product. JEV permits at most two HTTP attempts; bounded OpenAI requests disable SDK retries. An exhausted budget issues no further requests.
- Unknown does not establish unsupported coverage. Generation eligibility requires locally established registry noncoverage for an identifiable finite/degrading product, sufficient storage/variant facts and a workflow requiring that missing policy. An excluded known policy with missing facts is uncertainty, not noncoverage. If evidence cannot establish the distinction, leave the policy missing.
- Fallback invokes `decideModelRoute` with unsupported/required/generationApplicable evidence. Supply only the unresolved policy and necessary product/storage context. Validate the existing result schema plus finite-kind, >=0.90 confidence and consistency with supplied evidence. Generated nonperishable claims cannot bypass the reviewed nonperishable entry in TypeSafe mode. Do not regenerate product metadata or add a policy to the registry.
- Selected OpenAI mode is an independent compatibility/rollback path through the existing reasoner, with the same schema and bounded request. TypeSafe-mode applicability/fallback restrictions do not silently rewrite legacy policy rows or require storage context for every existing OpenAI-only operation.

### Explicit dates, persistence and concurrency

Expiration dates belong to batches, while ProductShelfLifePolicy describes a product-level estimate. Batch expiry resolution uses an explicit date first and invokes neither model. Never derive a global product duration from one batch date or overwrite that date. A dated batch does not resolve the policy need for unrelated undated stock projections; keep that distinction in tests and documentation.

Persist only accepted results, preserving the supplying provider, resolved model and actual task version instead of the current hardcoded generation prompt version. Before creation, use a short transaction/guard to compare canonical identity, relevant metadata and config context with the pre-inference snapshot. Coordinate with product writes using the existing database concurrency conventions. Create-only semantics and the unique productId prevent replacing another policy; handle uniqueness races outside a failed transaction. Stale/reused results count as skipped. Existing summary keys remain processed/succeeded/skipped/failed.

Attempt JSON includes registry version, selected policy ID where applicable, routing reason, acceptance, write outcome and validated 38a provenance. Record validated JEV usage; do not fabricate missing OpenAI usage or resolved-model evidence. Existing OpenAI provider returns configured model identity, so mark that distinction. Any generic provider-envelope improvement needed for validated usage belongs to a separately reviewed focused change or 38e, not an unrelated transport refactor here.

## Testing

- Test gate is on: Jest through `npm run test`. Every logic step includes focused tests in its reviewable diff.
- Registry/schema tests: blank identity, nullable metadata, unknown false distinction, invalid kind/days pairs, duplicate IDs, contradictory storage, missing context, unsupported context versions, registry bounds and complete option mapping.
- Adapter/routing tests: known finite/nonperishable selection; supplied values; unsupported finite fallback; unknown ambiguity; low confidence/probability; out-of-set choice; invalid output; refusal/timeout; complete-call counts and shared deadline using fake clocks.
- Persistence/log tests: stored-policy bypass, idempotent repeated runs, concurrent insertion, changed canonical identity/metadata/config, malformed results, per-product isolation and safe logging failures.
- Use an isolated migrated PostgreSQL database with disposable fixtures and mocked providers for real Nest wiring and write races. Never use the household database or private catalog data.
- Final gates: `npm run verify`, `npm run contract:check`, and `npm run test:e2e -- --runInBand` scoped to the policy/workflow, expiration-status and expiration-recommendations suites. Record exact commands, database isolation and results in the spec.
- Direct Check/Try: trigger the existing workflow in the disposable environment, inspect saved policy/provenance and rerun it; known/stored policy reuses values, rejected selection leaves policy absent, explicit batch date wins in existing expiry reads. No browser-facing UI or declared Browser tests command applies.

## Notes for the AI

- Server-only NestJS services and injected boundaries; keep controllers/MCP thin and unchanged.
- No inference on inventory/grocery/recommendation GET or MCP read paths. Daily materialization arithmetic and recommendation rules retain their existing behavior.
- Preserve single-household authentication and do not introduce client-supplied ownership identifiers.
- Keep helpers focused, no unrelated refactor, no raw provider error/context logging and no secrets in fixtures/docs.
- Run `graphify update .` after implementation source changes. Planning alone does not require an AST update.
- This spec was resumed by explicit Autopilot authorization. Stop before completion, merge, push or runtime enablement.

## Critique incorporated

- Added explicit storage evidence because current product metadata cannot prove refrigeration, preparation or packaging; missing context abstains in JEV mode.
- Separated batch-date precedence from a product-level policy requirement so a single explicit date cannot incorrectly suppress all future inference.
- Required locally established noncoverage before generation; JEV unknown, low confidence and failures cannot trigger paid fallback.
- Locked policy identity/version provenance, one operation deadline, create-only writes and stale-evidence rejection.
- Kept compatibility defaults, stock advice, rollout, registry expansion and public configuration editing outside this feature.

## Implementation evidence

- Step 1: `npm run verify` passed (105 suites, 1,776 tests and production build). Output: `/private/tmp/38c-step1-verify.log`.
- Step 2: `npm run verify` passed (106 suites, 1,787 tests and production build). Output: `/private/tmp/38c-step2-verify.log`.
- Step 3: `npm run verify` passed (107 suites, 1,800 tests and production build). Output: `/private/tmp/38c-step3-verify.log`.
- Step 4: `npm run verify` passed (108 suites, 1,807 tests and production build). Output: `/private/tmp/38c-step4-verify.log`.
- Step 5: `npm run verify` passed (109 suites, 1,821 tests and production build). Output: `/private/tmp/38c-step5-verify.log`.
- Step 6: `npm run verify` passed (110 suites, 1,830 tests and production build). Output: `/private/tmp/38c-step6-verify.log`.

## Final Autopilot review packet

- Resumed 38c, completed all seven steps on `feature/jev-shelf-life-policies`. The initial critique required storage evidence, distinguished explicit batch dates from global policy need, gated unsupported generation, and protected concurrent writes. Implementation tightened applicability to the documented exact Hebrew/English identity allowlist.
- Final `npm run verify`: PASS, 110 suites / 1,830 tests and production build. Output: `/private/tmp/38c-final-repaired-verify.log`.
- `npm run contract:check`: PASS, 124 executable agent scenarios and 6 suites / 79 tests. Output: `/private/tmp/38c-final-contract.log`. Public contracts were unchanged by the subsequent internal typing/fixture repair.
- Isolated PostgreSQL command: `DATABASE_URL=<dedicated-local-test-url> STOCK_WORKFLOW_ENABLED=false npm run test:e2e -- --runInBand test/shelf-life-policy.e2e-spec.ts test/daily-stock-workflow.e2e-spec.ts test/expiration-status.e2e-spec.ts test/expiration-recommendations.e2e-spec.ts test/model-configuration.e2e-spec.ts`: PASS, 5 suites / 43 tests. Output: `/private/tmp/38c-final-repaired-e2e.log`. Database `home_stock_38c_test` was newly created in dedicated local container `home-stock-38b-tests` at port 55438 and migrated without resetting any database. All providers were mocked; no household records or paid inference were used.
- Scoped ESLint on all new/changed TypeScript and the new E2E suite: PASS, no errors or warnings. Output: `/private/tmp/38c-final-eslint.log`. `git diff --check`: PASS.
- `graphify update .`: PASS, AST-only update (5,896 nodes / 9,529 edges). Output: `/private/tmp/38c-final-graphify-update.log`. Generated graph, cache and backup changes belong to this update; no semantic/paid labeling ran.
- Self-review repairs: corrected an omitted required `source` in the new expiration fixture (initial E2E run 41 passed / 2 failed), replaced unsafe mock-call inspection/choice-builder typing, and removed an unused destructured context. Reran the affected PostgreSQL suites, scoped lint and full Verify successfully. No failing check was skipped.
- Effective regular gates: Check, Audit and Try are manual and were skipped. Independent review was not requested; its effective policy remains manual, reviewer/model none, request/receipt none. No same-session targeted audit ran. Findings and review files remain empty stubs; no open or fixed P0/P1 findings exist.
- Six passing implementation checkpoints: `0141b01`, `35ea4da`, `62c45a6`, `84878d6`, `f81c695`, `fc7196c`. A final verification checkpoint includes the regression suite, self-review repairs, documentation, graph and this packet.

| Files / area | Result and reason |
| --- | --- |
| `shelf-life-policy.ts`, `shelf-life-policy-registry.ts` and registry tests | Typed input/outcomes, strict optional config context, reviewed seeds and conservative applicability |
| `jev-shelf-life-policy.service.ts` and tests | Bounded policy choices, confidence/probability gates, exact local policy mapping, safe deadline/error outcomes |
| `openai-shelf-life-policy.service.ts` and tests; `shelf-life-reasoner.service.ts` | Evidence-gated required generation and bounded compatible OpenAI rollback |
| `shelf-life-policy.provider.ts` and tests; `inventory.module.ts` | Independent task binding and injected workflow dependencies |
| `shelf-life-policy-writer.service.ts` and tests; `shelf-life-inference.service.ts` and tests | Create-only serializable writes with locked evidence, stale/reused outcomes and per-product isolation |
| `shelf-life-policy-log.service.ts` and tests | Versioned private-safe attempts, usage and applied-versus-selected provenance |
| `application-config.ts` and tests; `.env.example` | Independent selector and safe startup validation, retaining default OpenAI |
| `test/shelf-life-policy.e2e-spec.ts` | Real Nest/PostgreSQL routing, both modes, racing writes, metadata/name/context corrections, failures and authenticated reads |
| `docs/jev-integration.md`, active spec/activity, `graphify-out/` | Operator documentation, durable verification evidence and updated source graph |

Manual review uses the isolated mocked E2E command above: successful policy selection persists exact reviewed values; reruns make zero new calls; rejected/missing-context cases remain missing; concurrent evidence changes skip writes; explicit expiration reads preserve dates and make no calls. Request `$try` for a fuller interactive guide if desired. No browser-facing UI is involved.

Remaining limits: TypeSafe mode requires supplied storage context and an exact reviewed identity; broad variants abstain. OpenAI remains the default and retains its legacy behavior when selected. The registry and generated-duration accuracy need independent 38e evaluation before enabling runtime routing. No new public storage-context writer, schema migration, private configuration change, deploy or provider rollout occurred.

Next action: review the branch diff, optionally request Try or independent review, then invoke `$complete`. This run did not archive the spec, check off the build-plan item, merge or push.

## Completion safety pass (2026-10-06)

- `$complete` reran `npm run verify`: PASS, 110 suites / 1,830 tests and production build. Output: `/private/tmp/38c-complete-verify.log`.
- `npm run contract:check`: PASS, 124 executable scenarios and 6 suites / 79 tests. Output: `/private/tmp/38c-complete-contract.log`.
- Reused the current feature's isolated PostgreSQL/HTTP evidence: 5 suites / 43 tests, `/private/tmp/38c-final-repaired-e2e.log`. Application source is unchanged since the verified `426363a` checkpoint. Scoped lint and AST-only graph evidence remain current. `git diff --check` passed.
- Check, Audit, independent review and Try remain manual; no review was initiated and no P0/P1 blockers exist. No workflow adapters changed. The manual review path remains the mocked isolated PostgreSQL suite or `$try latest`.
- Archived the verified spec, checked off only 38c, synchronized overview progress and source fingerprint, and reset the active spec to the canonical stub. Parent 38 remains open for 38d and 38e.
- Prepared work commit `feat: add JEV shelf-life policies`. Local squash merge requires separate explicit approval; push requires another separate approval. No merge, branch deletion, push, deployment or runtime rollout has occurred.
- OpenAI remains the default. Broader policy identities, live accuracy evaluation and default-JEV enablement remain 38e scope. No production migration or private configuration change is part of completion.
