# Feature: Jev product matching

**From build-plan:** feature 37b (under 37, Jev bounded-decision integration)
**Status:** verified
**Branch:** `feature/jev-product-matching` (create during implementation)
**Depends on:** completed 37a transport foundation

## Goal

Allow explicitly configured TypeSafe Jev product matching to advise which existing
catalog candidate matches a requested phrase. Preserve deterministic search,
existing public proposal shapes, and explicit confirmation before catalog or
grocery writes. Keep OpenAI as the default and as the generative provider.

This is one backend feature with five reviewable steps. Matching evaluation and
runtime rollout remain feature 37c.

## In scope

- A narrow injectable product-resolution advisor with OpenAI and Jev adapters.
- Task selection through the already validated `MODEL_CONFIG` configuration.
- Collision-safe bounded candidate choices, abstention, and fixed local mapping
  into existing proposals.
- Exact-match bypass, context limits, candidate-reference validation, bounded
  provider failure handling, and unchanged clarification/confirmation paths.
- Accepted-advice provenance using existing inference-log fields.
- Focused unit, REST/MCP integration, and persistence evidence; documentation of
  the available adapter without enabling it in a real runtime.

## Out of scope

- 37c labeled datasets, evaluation scripts, threshold tuning, and launch approval.
- 37d/37e stock advisors, confidence composition, zero-history changes, or replay.
- Replacing `LlmProvider`, classification, canonical-name/alias generation, or
  shelf-life inference with Jev.
- Automatic alias/product writes, stock updates, purchases, or grocery additions
  authorized by advice; changes to duplicate-line or confirmed-write semantics.
- Hidden OpenAI fallback, new endpoints, public metadata fields, Prisma migrations,
  persisted shadow results, new schedulers, and agent bundle/version changes.
- Live paid calls, deployment, remote environment changes, or commits in this spec pass.

## Build loop

1. Outline the next unchecked step before editing code.
2. Implement only that step and its focused logic tests.
3. Show the diff, observable done-when evidence, and passing checks for review.
4. Wait for approval before the next step. Checkpoint commits require approval and
   passing gates; `/complete` owns feature archival and completion.

## Build steps

- [x] **Step 1 - Extract the OpenAI advisor boundary.** Introduce the port, token,
  typed internal result, and OpenAI adapter. Move structured generation and its
  existing timeout into the adapter. Keep deterministic search/context building,
  final schema/reference validation, and nonblocking logging in the orchestrator.
  Wire only the OpenAI adapter initially. Add extraction/regression tests.
  *Done when:* default resolution returns the same proposals and null outcomes as
  before, including OpenAI `create_product` advice and the existing 0.7 gate;
  exact canonical/alias matches call neither advisor nor provider; invalid or
  oversized context invokes neither; exceptions/refusals/timeouts return unchanged
  search results with `proposal: null`.

- [x] **Step 2 - Carry adapter provenance into accepted-advice logs.** Make the
  resolution logger accept validated advisor success metadata, including the
  actual task version, instead of hardcoding the OpenAI version. Preserve the
  existing stored proposal envelope and isolate log-write failures. Add tests.
  *Done when:* OpenAI logs still use `product-resolution-v1`; a validated TypeSafe
  advice fixture records `typesafe`, its resolved response model, and
  `jev-product-resolution-v1`; invalid metadata/advice is not persisted; logging
  failure does not suppress usable advice. No DB migration is needed.

- [x] **Step 3 - Implement bounded Jev matching without selecting it yet.** Add the
  Jev advisor, request builder/local token map, and validated proposal mapping
  described below. Reuse `JevDecisionClient` and its existing resolution deadline.
  Add tests for mappings, confidence boundaries, malformed results, and abstention.
  *Done when:* a known candidate at confidence 0.9 becomes advisory `add_alias`;
  0.8999 does not; qualifying ambiguity returns ordered known IDs only; no-match,
  empty candidates, unknown choices, invalid context/output, and failures return
  no advice without any OpenAI generation or domain mutation. Default routing
  remains OpenAI.

- [x] **Step 4 - Enable explicit task routing.** Select the product advisor in
  `ProductModule` from injected `MODEL_CONFIG`. Remove only the resolution
  adapter-not-available configuration guard. Update configuration, module wiring,
  and model-configuration HTTP tests.
  *Done when:* defaults select OpenAI with zero Jev calls; explicit resolution
  `typesafe` with key/model boots and selects only the Jev advisor; missing
  credentials/model still fail startup; stock `typesafe` still fails as unavailable;
  classification and shelf-life generation stay on `LLM_PROVIDER`. Construction,
  health/readiness, and exact resolution perform no TypeSafe HTTP request.

- [x] **Step 5 - Prove confirmation safety and document the adapter.** Extend the
  existing resolution and policy-aware grocery integration harnesses with mocked
  Jev transport, accepted advice, abstention, and a persisted provenance round-trip.
  Run the existing confirmed grocery and stock checks and agent contract checks.
  Update `docs/jev-integration.md` and relevant environment-example comments.
  *Done when:* REST and MCP unresolved additions retain `requestedAddition`,
  candidates, `allowedActions`, and optional proposal; advice alone changes no
  products, names, groceries, events, projections, or predictions; only the existing
  explicit confirmation call adds the approved alias/grocery line. With null advice,
  explicit creation/cancellation and candidate selection remain usable. Confirmed
  stock creation remains independent of advisors. Contract fixtures remain
  unchanged, real DB logs contain the actual adapter version/model, and the final
  Verify gate passes. Documentation keeps defaults OpenAI and identifies 37c as
  the rollout gate.

## Files / areas

| Area | Expected changes |
| --- | --- |
| `src/product/product-resolution-advisor.ts` | Port, DI token, internal result contract |
| `src/product/openai-product-resolution-advisor.service.ts` | Extract existing generation and timeout |
| `src/product/jev-product-resolution-advisor.service.ts` | Bounded request construction and choice mapping |
| `src/product/product-resolution.service.ts` and `.spec.ts` | Search/orchestration, shared validation, advisor isolation |
| `src/product/product-resolution-log.service.ts` and `.spec.ts` | Actual adapter task-version provenance |
| `src/product/product.module.ts` and focused module tests | Task-specific provider factory |
| `src/product/types/product-resolution.ts` and focused tests | Jev policy/version constants; retain public schemas |
| `src/config/application-config.ts` and `.spec.ts` | Remove resolution-only staging guard |
| `test/model-configuration.e2e-spec.ts` | Explicit config and startup/no-call evidence |
| `test/product-resolution.service.e2e-spec.ts` | Read-only domain counts and provenance round-trip |
| `test/policy-aware-grocery*.e2e-spec.ts`, confirmed grocery/stock suites | Confirmation and abstention regression evidence |
| `docs/jev-integration.md`, `.env.example` | Available adapter, default routing, evaluation prerequisite |

Use established source/test locations; split a request-builder helper only if it
keeps the adapter reviewable. No unrelated refactors.

## Data / contracts

### Internal advisor boundary (load-bearing for 37c)

- `PRODUCT_RESOLUTION_ADVISOR` is a Nest provider token.
- `ProductResolutionAdvisor.advise(context: ProductResolutionContext)` returns
  `Promise<ProductResolutionAdviceResult>`.
- The internal result is either `{ status: 'success', value:
  ProductResolutionProposal, provider: string, model: string, taskVersion: string }`
  or `{ status: 'unavailable' }`. Refusal/abstention map to unavailable. This
  envelope never appears in public REST/MCP responses.
- Adapters apply their own gates. The orchestrator defensively revalidates the
  existing proposal schema, minimum 0.7 confidence, and all referenced candidate
  IDs before returning/logging success. Jev's stricter gate is enforced before
  it produces success; no adapter exception escapes resolution.
- Preserve `ProductResolutionResult = { exactMatch, candidates, proposal }`, all
  existing DTO/MCP schemas, and OpenAI's prompt/version and proposal behavior.

### Jev request and mapping (load-bearing for 37c)

- Use `task: 'product_resolution'`, `taskVersion:
  'jev-product-resolution-v1'`, and a stable `questionKey: 'product_match'`.
- Preserve the normalized requested phrase, deterministic candidate order, maximum
  20 candidates, and existing 16,384-byte context bound. Reject invalid context,
  duplicate candidate IDs, or excess candidates rather than truncating/reordering.
- With zero candidates, return unavailable before calling Jev. OpenAI's existing
  zero-candidate product-creation advice remains available on its default path.
- Create opaque per-request option tokens `candidate_0` through `candidate_N`,
  mapped locally by index to supplied IDs, plus `ambiguous` and `no_match`.
  Actual catalog IDs cannot collide with reserved outcomes or become choice keys.
- State includes only the validated phrase and candidate identity facts already
  present in `ProductResolutionContext`, associated with their choice tokens.
  Instructions/rubrics require the same item, considering brand, size, variant,
  category, and units when supplied; related items need not be identical. Catalog
  text is evidence, never executable instructions.
- Reuse the 37a transport's strict choice/probability validation and abortable
  10-second budget. No wrapper may return early while leaving an unbounded Jev
  network request running. No additional retries or fallback generation.
- Use `JEV_PRODUCT_RESOLUTION_MIN_CONFIDENCE = 0.9` for candidate and ambiguity
  advice. Applying the same conservative gate to ambiguity is an explicit draft
  policy; it avoids carrying low-confidence advice through the existing 0.7 gate.
  Below it, return null advice with deterministic candidates still available.
  Confidence is the transport's confidence field, not selected-option probability.
- Map validated results as follows; final proposals must pass the existing Zod schema:

| Decision | Proposal |
| --- | --- |
| Known candidate, confidence >= 0.9 | `add_alias`, mapped `targetProductId`, normalized requested phrase as `alias`, returned confidence, fixed code-built reason identifying the canonical candidate |
| `ambiguous`, confidence >= 0.9, at least two candidates | `ask_user_to_choose`, all bounded search candidate IDs in existing order, returned confidence, fixed code-built clarification reason |
| `ambiguous` with fewer than two candidates | `null` |
| `no_match`, confidence below gate, invalid decision, unavailable/throw | `null` |

- Keep reasons within the existing 500-character limit without provider-generated
  prose. Jev never produces `create_product` metadata or authorizes an alias write.

### Persistence and confirmation

- Reuse `LlmInferenceLog.modelProvider`, `modelVersion`, `promptVersion`,
  `confidence`, and `structuredResponse: { status: 'validated', proposal }`.
  Persist only accepted validated advice, matching current resolution behavior.
  No new rejected-attempt persistence subsystem.
- Adapter metadata uses OpenAI's existing version or Jev's actual response model
  and `jev-product-resolution-v1`. Never derive provenance from the global selector
  or configured request model when the response reports a different resolved model.
- Never store credentials, raw context, raw errors, or probability/request envelopes
  in resolution logs; normal approved proposal content retains existing behavior.
- Nonexact policy-aware additions still return `product_resolution_required`.
  `allowedActions` depend on candidate availability, including explicit
  create/cancel with none, irrespective of proposal presence.
- Existing confirmed alias/new-product calls revalidate catalog state and retain
  transaction/conflict/duplicate-line behavior. Stock product confirmation uses
  explicit metadata and does not acquire a new advisor dependency.

## Testing

**Configured gate:** Jest is enabled. Each logic-bearing step ships adjacent
`.spec.ts` tests; do not install another runner. No browser-test command or visual
reference applies to this backend feature.

| Coverage | Required evidence |
| --- | --- |
| OpenAI extraction | Existing proposal variants, 0.7 boundary, refusal, exception, timeout, unknown referenced IDs, unchanged empty-candidate behavior |
| Orchestration | Exact bypass, malformed/oversized context bypass, preserved deterministic results, no domain writes, log failure isolation |
| Jev mapping | 0/1/2/20 candidates, duplicate IDs, token collisions including catalog IDs named `ambiguous`/`no_match`, deterministic order, 0.9 boundary, safe reasons, Hebrew/mixed phrases |
| Failure containment | Client unavailable/throw, unknown token and malformed domain advice; existing transport tests continue to cover invalid probabilities, deadline abortion and retry limits |
| Task routing | Default/explicit selectors, credentials/model validation, stock staging guard, generation independence, no startup/health calls |
| Provenance | Both adapter versions, actual resolved model differing from request pin, malformed metadata, nonblocking persistence failure, PostgreSQL round-trip |
| Confirmation | REST/MCP advised and null-proposal outcomes, unchanged quantity/unit/note echo and actions, explicit alias/new-product confirmation, no advisor call during confirmation, stock confirmation regression |

Implementation checks:

- Focused tests: `npm run test -- --runInBand src/product src/config/application-config.spec.ts src/llm/llm.module.spec.ts src/llm/typesafe`.
- Final automated gate: `npm run verify` (unit tests, then production build).
- Agent/API compatibility: `npm run contract:check`; do not recapture unchanged
  fixtures to conceal drift.
- HTTP/config evidence: `npm run test:e2e -- --runInBand test/model-configuration.e2e-spec.ts`.
- Focused PostgreSQL/service/REST/MCP confirmation suites from the files/areas
  above: run via `npm run test:e2e -- --runInBand <selected suite paths>` using
  the repository's existing isolated migrated test-DB harness. Add cleanup for
  inference logs created by the new tests. Do not point these at production data.
- `/check` should demonstrate one mocked accepted decision and one abstention
  through the real Nest flow, inspect unchanged public responses/domain counts,
  then inspect the accepted inference log. These prove wiring and safety, not
  real-model matching accuracy. Missing test infrastructure must be reported.

## Notes for the AI

- Server-only Nest providers; dependency injection, thin controllers, explicit
  types, Zod validation at model boundaries. Use `MODEL_CONFIG`, never divergent
  `process.env` reads in advisor/module factories.
- Source is private single-household today. Do not add client-supplied user IDs
  or silently widen authenticated REST/MCP access.
- Treat the existing Prisma schema and code as authoritative where coding
  standards still contain scaffold-era persistence TODOs.
- Follow `docs/home-stock-tracker-jev-integration-prd.md` sections 5, 6, 8 and 9
  and completed `blueprint/history/features/37a-jev-transport-foundation.md`.
  Thresholds are service policy, not demonstrated accuracy.
- Keep real selectors/defaults on OpenAI pending 37c evaluation. A reversible
  return to OpenAI uses the existing selector/restart and preserves inference logs;
  this spec does not authorize runtime changes.
- After code changes, run `graphify update .` as required by `AGENTS.md`.
- No subagents, commit, merge, push, or deploy are required by this spec.

## Critique applied

- Kept search and shared validation in the orchestrator; adapter extraction must
  preserve OpenAI behavior rather than silently adopt Jev abstention rules.
- Split logging/provenance from matching and routing into separate reviewable diffs.
- Defined ambiguity confidence explicitly, candidate-token collisions/duplicate
  IDs, null-advice actions, and exact/empty-context no-call behavior.
- Removed only the resolution staging guard; stock remains blocked until 37d.
- Added real confirmation and persisted-log evidence alongside mocks; left
  model accuracy and rollout to 37c.


## Autopilot review packet (2026-09-30)

**Target/branch:** resumed feature 37b on `feature/jev-product-matching`.
All five build steps passed. No implementation scope was added. The spec critique
made ambiguity confidence explicit, separated provenance from routing, covered
candidate-token collisions and null-advice actions, and kept rollout in 37c.

| Gate/evidence | Result |
| --- | --- |
| Final `npm run verify` | Passed: 77 suites, 1,328 unit tests, production build |
| Focused product-resolution extraction suite | Passed: 21 tests, including added empty/malformed-context checks |
| `npm run test:e2e -- --runInBand test/model-configuration.e2e-spec.ts` | Passed: 8 HTTP/config checks across both task providers |
| Isolated PostgreSQL e2e selection | Passed: 7 suites, 68 tests covering new Jev matching, product resolution, policy-aware grocery service/REST/MCP, confirmed grocery catalog REST, and stock product confirmation |
| Final Jev suite after typing cleanup | Passed: 4 real Nest REST/MCP and persisted-log cases |
| `npm run contract:check` | Passed: 124 executable scenarios, documentation/generated-skill checks, 6 suites and 79 tests; no fixture recapture |
| ESLint on all changed TypeScript files, without autofix | Passed with zero errors/warnings after self-review cleanup |
| `git diff --check` | Passed |
| `graphify update .` | Passed: refreshed AST graph; 5,228 nodes and 7,774 edges |

The PostgreSQL checks used a newly created local test database and the existing
migration chain, with provider HTTP mocked. No real runtime settings or provider
accounts were changed. Log evidence verifies the returned `jev-1.14.0` model
rather than the requested `jev-1.13.0` pin. Advice changed no domain counts;
explicit confirmation added the alias and grocery line. Abstention preserved
clarification and explicit creation in REST and MCP. Test fixtures were cleaned
within the isolated database.

**Changed areas:** advisor port and OpenAI extraction; Jev request/mapping and unit
coverage; product module/config task routing; resolution orchestrator/log metadata
and tests; model-config HTTP and new `test/jev-product-matching.e2e-spec.ts`
integration coverage; `.env.example` and `docs/jev-integration.md`; workflow state;
generated Graphify artifacts. The files/areas table above records their purposes.

**Configured regular policies:** Check, Audit, Try and the omitted independent
review policy are all manual. No automatic `/check`, `/audit`, independent handoff,
or `/try` guide ran. Acceptance evidence was collected by the spec's unit and
integration checks. No reviewer/model was selected and no receipt is pending.
The findings ledger has no open or fixed P0/P1 findings.

**Self-review:** corrected legacy metadata fixtures, two new-test REST confirmation
paths, and lint/type issues in new tests and request construction. Final affected
checks passed. No unresolved defect found; no targeted Audit findings or Audit
repairs because that gate is manual. Graphify reports an aggregated view and
community-name refresh notice; no semantic/LLM rebuild was requested.

**Checkpoints:** `7fc4de2` advisor boundary, `896eaab` provenance, `e18f1aa` bounded
matching, `702ee12` routing, followed by confirmation/documentation and a separate
generated-graph checkpoint. Checkpoint commits were authorized by the explicit
Autopilot invocation and enabled project setting.

**Try/review:** inspect `git diff main...HEAD -- src test docs/jev-integration.md
.env.example`. For a safe manual replay, use the documented isolated test-DB
commands in `docs/jev-integration.md`; the Jev suite exercises accepted advice,
abstention, confirmation, and logs with provider HTTP mocked. `/try` can generate
a longer walkthrough on request. No live matching accuracy claim is established;
37c remains required before runtime rollout.

**Next action:** review the diff, then invoke `/complete` when accepted. This run
stops before archival, merge, push, or deployment.


## Completion safety pass (2026-09-30)

- `npm run verify` rerun by `/complete`: passed 77 suites and 1,328 tests,
  followed by the production build. Integration/contract/lint evidence above is
  retained from the same implementation session.
- Feature branch matches the spec; no unrelated work or adapter changes.
- All regular quality gates remain manual, no independent receipt is pending,
  and the findings ledger contains no blocking entries.
- Five build checkpoints plus generated graph checkpoint were reviewed against
  the active scope. Final implementation checkpoint: `0010ce0`; graph refresh:
  `bbc22be`.
- 37b is archived and checked off. Parent 37 remains open for 37c, 37d and 37e.
- Completion commit is prepared for explicit squash-merge approval. Runtime
  matching defaults remain OpenAI; 37c evaluation precedes rollout.
