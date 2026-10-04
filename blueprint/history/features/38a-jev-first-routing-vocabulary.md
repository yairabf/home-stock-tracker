# Feature: JEV-first task routing and choice vocabulary

**From build-plan:** feature 38a
**Status:** verified
**Approved parent plan:** [JEV-first application inference](../../context/feature-plans/jev-first-application-inference.md)

## Goal

Define and test the internal routing policy and category/unit vocabulary that later adapters will share. Prefer deterministic evidence, then JEV for supported choices. Reserve OpenAI for unsupported required generation. Keep current runtime provider defaults until implementation and evaluation of the domain adapters.

## In scope

- Typed capabilities, per-field outcomes, routing reasons, and safe provenance.
- Pure routing policy distinguishing unsupported required generation from uncertainty and provider failure.
- Versioned category/unit builders, explicit unknown choices, and incomplete-coverage handling.
- New local JEV task identifiers for product understanding and shelf-life policy, with explicit transport budgets.
- Document later task-selector contracts and private credential requirements.
- Stubbed call-selection tests and existing exact-match no-call regressions.

## Out of scope

- Domain classification and shelf-life adapters (38b/38c), stock workflow integration (38d), accuracy evaluation and rollout (38e).
- Catalog migrations/backfills, generated aliases, unit conversion, database schema changes, public REST/MCP changes, or queues.
- Paid calls, private environment changes, restarts, commits, or deployment.

## Build loop

Build on `feature/jev-first-routing-vocabulary`, one reviewed step at a time. Each logic-bearing step includes focused tests. Show the diff and observable done-when before continuing. Run `npm run verify` before checkpoint/completion; commits require permission.

## Build steps

- [x] **Step 1 - Routing contract and policy.** Define typed task capabilities, per-field outcomes, pure routing decisions and provenance. *Done when:* tests prove deterministic/supplied values select no model, supported unresolved choices select JEV, accepted JEV answers select no OpenAI, and only unsupported required generation permits OpenAI. Optional missing fields, unknown, ambiguity, low confidence, disabled tasks and transport failure remain distinct.
- [x] **Step 2 - Choice vocabulary.** Add versioned category/unit manifests and pure builders taking validated existing labels. *Done when:* empty-catalog seeds are usable, unknown is available, mixed Hebrew/English labels round-trip, ordering is stable, and duplicate/colliding labels, reserved tokens, invalid inputs, overflow and oversized context never silently omit choices or mutate catalog data.
- [x] **Step 3 - Task and provenance support.** Extend the JEV task union and validation together for `product_understanding` and `shelf_life_policy`. Make deadline selection exhaustive: 10 seconds for product resolution/understanding and 15 seconds for stock/shelf-life. *Done when:* mocked requests validate new tasks and deadlines while preserving envelope/retry/response behavior, unsupported tasks are rejected, and provenance contains safe routing/model/version/usage information.
- [x] **Step 4 - Documentation and regressions.** Document policy, vocabularies and future selectors; use stubbed callbacks to exercise call selection. *Done when:* supported successful JEV choices call OpenAI zero times, unsupported required generation calls OpenAI once logically, rejected/failed JEV attempts call OpenAI zero times, supplied/accepted fields remain unchanged, existing configuration/exact-match tests pass, and final gates pass.

## Files / areas

- New focused contracts/policy and colocated tests under `src/llm/decision-routing/`.
- New category/unit manifests and builders with tests under `src/product/`.
- `src/llm/typesafe/jev-decision.types.ts`, validation/client and their tests for new task identifiers and exhaustive budgets.
- Existing product-resolution/model-configuration tests for no-call and compatibility regressions.
- `docs/jev-integration.md` for routing and future configuration documentation.
- No changes to product writes, daily workflow, schema or public tool behavior in 38a.

## Data / contracts

### Routing

Use discriminated per-field outcomes:

- `resolved`: supplied, deterministic or accepted validated model value.
- `needs_choice`: unresolved field with a complete supported bounded option space.
- `unsupported`: required value cannot be expressed by available choices; identifies whether text/numeric generation can supply it.
- `uncertain`: unknown, low confidence or ambiguous evidence. Unknown alone does not prove unsupported coverage.
- `unavailable`: safe provider/configuration failure; no automatic escalation.

Policy returns `none`, `jev`, `openai_generation` or `unresolved`, a local reason and unresolved field identities. OpenAI receives only unresolved required generation fields. Canonical names, aliases and previously supplied/accepted values are excluded from regeneration. At most one logical generation attempt per operation; integrated adapters enforce actual HTTP retry/deadline budgets in 38b/38c.

Per-field confidence is distinct from selected-option probability. Unknown category/unit/type/perishability uses null internally and in existing nullable fields where applicable; missing boolean evidence must not become false. Existing matching/stock gates remain unchanged. Classification confidence thresholds are defined in 38b and evaluated in 38e.

### Vocabulary

- Stable version plus opaque token-to-exact-value mapping; provider-selected free text is never an unchecked database value.
- Builders accept category labels instead of querying/logging household data. Catalog collection is wired in 38b.
- Proposed category seed v1 for empty catalogs: dairy and eggs, fruit and vegetables, meat and fish, bread and bakery, grains and legumes, canned and pantry goods, frozen foods, snacks and sweets, beverages, cleaning and laundry, personal care, other household supplies.
- Proposed unit seed v1: `item`, `pack`, `kg`, `g`, `liter`, `ml`. Explicit legacy units remain valid; no quantity conversion or change to ledger unit-conflict rules.
- Preserve nonblank existing display labels. Deduplicate exact values; normalized-key collisions between distinct values are explicit ambiguity rather than silently merged identities. Sort independently of locale.
- At most 254 domain options plus `unknown`, within the transport's 255-option limit. Use seeds only for empty input; do not add synonym categories to a nonempty catalog.
- Overflow or more than 16,384 UTF-8 bytes of prepared context returns explicit incomplete/unsupported coverage. Never classify against an arbitrarily truncated list.
- Type/perishability get unknown choices without changing public enum shapes. Shelf-life duration choices are reviewed separately in 38c.

### Configuration and provenance

Keep `LLM_PROVIDER=openai`, existing selector defaults, required OpenAI credentials and pinned JEV setup unchanged. Document future `PRODUCT_UNDERSTANDING_PROVIDER` and `SHELF_LIFE_POLICY_PROVIDER` (`openai|typesafe`, initially `openai`), but do not activate selectors before adapters exist. Their startup validation ships with 38b/38c. Fallback eligibility is a capability decision, not fallback-on-error.

Define safe attempt metadata: operation/field identity, routing reason, task and vocabulary versions, accepted/rejected/unavailable status, provider, configured/resolved model where known, elapsed time and validated token usage. Unavailable usage is unknown, not fabricated zero. No raw context, secrets or provider errors. Persistence integration follows with domain adapters; legacy logs remain readable. Monetary estimates require a versioned price table.

## Testing

- Routing truth table: deterministic bypass, supported choices, selective required generation, optional fields, uncertainty, schema rejection, invalid inputs, provider failures and operation budget.
- Vocabulary boundaries: empty inputs, mixed Hebrew/Latin, whitespace collisions, reserved tokens, duplicates, stable ordering, 254/255 domain-option boundary and UTF-8 limits.
- Stub orchestration proves actual call counts and preservation of supplied/accepted fields; avoid tests that only restate constants.
- Existing transport deadline/retry and exact-match tests remain green. New pure policy needs no live provider, database or browser.
- Focused: `npm run test -- --runInBand src/llm/decision-routing src/llm/typesafe src/product`.
- Final: `npm run verify`, `npm run contract:check`, `git diff --check`.
- Configuration HTTP regression when affected: `npm run test:e2e -- --runInBand test/model-configuration.e2e-spec.ts` with its stubbed persistence harness.

## Notes for the AI

- All work is server-side; retain injected ports and avoid a giant provider-switch service.
- No public endpoint gains inference calls in this foundational feature.
- Inspect every task-dependent branch when extending identifiers and deadlines.
- Run `graphify update .` after source edits; no source changes are part of this planning pass.
- Live smoke demonstrates connectivity only, not accuracy or rollout eligibility.
- Parent scope is approved; `$implement` authorized this spec. Per-step review remains required before proceeding.

## Critique incorporated

- Documented future selectors instead of activating settings without adapters.
- Distinguished unknown from unsupported choice coverage, preventing unnecessary OpenAI escalation.
- Defined seed choices and overflow behavior for empty and large multilingual catalogs.
- Kept stock integration, shelf-life duration policies and classification thresholds in their own sub-features.

## Step 1 verification and review

Implemented on `feature/jev-first-routing-vocabulary`; user approved Step 1 and continuing without a checkpoint commit. Focused routing tests: 45 passed. `npm run verify`: 95 suites, 1,607 tests, production build passed. Scoped ESLint passed; graph refreshed with `graphify update .`. No provider requests or runtime routing changes. Review diff: `/private/tmp/jev-routing-step-1.diff`. No commit created.

## Step 2 verification and review

Implemented; user approved Step 2 and continuing without a checkpoint commit. Added versioned category/unit manifests, bounded vocabulary builder, safe token resolution, and 41 focused tests. `npm run verify`: 96 suites, 1,648 tests and production build passed. Scoped ESLint and diff checks passed; graph refreshed. Input evidence is cloned, exact stored display labels are preserved, and incomplete/ambiguous choice sets return no partial mapping. Review diff: `/private/tmp/jev-routing-step-2.diff`. No provider requests, catalog changes or commits.

## Step 3 verification and review

Implemented; user approved Step 3 and continuing without a checkpoint commit. Shared JEV task allowlist now includes product understanding and shelf-life policy; exhaustive deadlines are 10 seconds for resolution/understanding and 15 seconds for stock/shelf-life. Added safe provenance validation and extended mocked envelope/deadline tests. Focused transport/routing: 301 passed. `npm run verify`: 97 suites, 1,692 tests and build passed. Scoped ESLint and diff checks passed; graph refreshed. A Jest cross-realm test fixture failure was corrected; final checks are green. Review diff: `/private/tmp/jev-routing-step-3.diff`. No provider calls, runtime selector changes or commits.

## Final verification and review packet

- Branch: `feature/jev-first-routing-vocabulary`. All four 38a steps are implemented; the user approved completion by invoking `$complete`.
- Areas: typed routing policy and provenance; versioned category/unit vocabulary; shared JEV task validation and deadlines; stub dispatch and exact-match regressions; integration documentation.
- `npm run verify`: 98 suites, 1,702 tests and production build passed.
- `npm run contract:check`: release/documentation checks, 124 agent scenarios and 79 tests passed.
- `npm run test:e2e -- --runInBand test/model-configuration.e2e-spec.ts`: 16 passed with stubbed persistence.
- Scoped ESLint and `git diff --check` passed; `graphify update .` refreshed the code graph.
- Try: `npm run test -- --runInBand src/llm/decision-routing src/product/choice-vocabulary.spec.ts`. No provider calls or running database required.
- Findings ledger: none. Independent review: none requested. Regular audit/check/try-guide and independent review are manual.
- Limits: domain adapters and stock projection integration belong to 38b/38c/38d; accuracy evaluation and dual-provider enablement belong to 38e. Runtime defaults/selectors are unchanged. No paid calls, deploy, commits or main changes.
- Review diffs: `/private/tmp/jev-routing-step-4.diff` and full product diff `/private/tmp/jev-routing-38a-review.diff`.
- After final review, `$complete` runs final gates, archives this spec, records 38a completion and creates the work-level commit; merge and push require their own approval.

## Completion safety pass (2026-10-04)

- `$complete` reran `npm run verify`: 98 suites, 1,702 tests and production build passed.
- `npm run contract:check` passed: 124 executable agent scenarios, release/documentation/generated-skill checks and 79 tests in 6 suites.
- `npm run test:e2e -- --runInBand test/model-configuration.e2e-spec.ts` passed all 16 tests with stubbed persistence.
- `git diff --check` passed. All changed files match the active scope, including the approved parent plan and required graph updates. Private `.env` is ignored and excluded from the commit. No workflow adapters changed.
- Findings and independent review are canonical empty stubs. Regular audit/check/try gates are manual; no independent review was requested. The focused test command above provides the manual try path.
- Archived the verified spec, checked off only 38a, synchronized overview progress and source hash, and reset the active spec to its canonical stub. Parent 38 remains open for 38b through 38e.
- Completion creates one work commit on `feature/jev-first-routing-vocabulary`. Squash merge requires explicit approval; pushing main requires separate approval.
- No paid provider requests, runtime routing changes, catalog writes or deployment occurred during this feature. Domain integration and provider enablement remain follow-up work.
