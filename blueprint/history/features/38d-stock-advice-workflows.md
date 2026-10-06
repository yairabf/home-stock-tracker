# Feature: Stock predictions in application workflows

**From build-plan:** feature 38d, under JEV-first application inference
**Status:** verified

## Goal

Connect bounded JEV stock advice to scheduled and manual daily evaluation so accepted eligible advice reaches saved inventory state and recommendation selection. Deterministic calculations remain the source of quantities and authoritative facts. This is integration capability; live accuracy review and enablement belong to 38e.

## In scope

- An explicit stock-advice phase after each product's successful deterministic materialization, shared by scheduled and manual workflow runs.
- Shared cutoff-aware evidence construction and existing JEV eligibility/acceptance logic, without calling the saving on-demand prediction engine.
- Conservative composition, atomic Prediction/projection publication, safe accepted/rejected/unavailable provenance and stale-result rejection.
- Durable duplicate-call claims, bounded work, per-product failure isolation, and reuse of unchanged validated advice.
- Opt-in private configuration, deterministic rollback, real Nest/PostgreSQL/REST/MCP verification and documentation.

## Out of scope

- 38e accuracy evaluation, confidence calibration, changing provider defaults, live rollout, deployment or private runtime changes.
- OpenAI stock generation in the new workflow phase, automatic fallback or normal dual-provider comparisons. Existing on-demand OpenAI behavior stays compatible.
- Model-generated quantities, expiration arithmetic, recommendation thresholds, grocery mutations, WhatsApp messages, Redis/workers or new public endpoints.
- Product classification, shelf-life policy redesign, advanced prediction strategies or catalog reprocessing.

## Build loop

1. Plan the next unchecked step before coding.
2. Implement only that step with its focused logic tests.
3. Show the diff and observable done-when evidence for review.
4. Wait for step approval before continuing; checkpoints are optional and require permission. `/complete` handles archival and final feature completion.

## Build steps

- [x] **Step 1 - Durable concurrency and attempt contracts.** Add a monotonic projection revision and a focused stock-advice attempt model through an additive Prisma migration. Increment revision in every projection mutation, including daily estimation, qualitative observations and same-timestamp corrections. Implement unique attempt reservation and adjacent repository tests. *Done when:* migrated existing rows work without advice enabled; concurrent reservations have one winner; every existing stock write invalidates a captured revision, including observations that leave `recordedEventId` unchanged.

- [x] **Step 2 - Shared cutoff-aware evidence.** Extract the non-saving evidence builder used by `EstimationService`; add an explicit evaluation cutoff and retain on-demand compatibility. Read event history with the cutoff in the query before the 20-event limit, stable timestamp/id ordering, learned statistics and minimized household context. Define the daily candidate overlay, relevant-evidence fingerprint and bypass decisions as pure helpers. *Done when:* zero/future-only history, disabled products, direct signals, expired/depleted quantities, high-confidence state and insufficient cold-start evidence make zero advisor calls; representative eligible uncertain evidence produces a stable fingerprint; legacy on-demand tests remain green.

- [x] **Step 3 - Bounded advice execution and composition.** Build an injected workflow advice service using the existing stock advisor port and JEV adapter. Reserve attempts before network calls; compose or reuse schema-valid advice with the shared acceptance policy and the daily baseline. Add private opt-in settings and strict startup validation. Do not wire the phase into the workflow yet. *Done when:* 0.90 acceptance, immediately lower confidence, uncertain, malformed, unavailable and thrown results have explicit outcomes; no outcome calls OpenAI; quantities stay identical; confidence never exceeds either deterministic bound; duplicate/in-flight claims issue no second call.

- [x] **Step 4 - Atomic publication and provenance.** Publish accepted composed state as a new Prediction and update the captured projection in one short transaction guarded by revision and deterministic prediction ID. Persist attempt acceptance separately from application status, with linked inference evidence. Recheck eligibility and evidence under the transaction before publication. *Done when:* accepted Prediction and projection agree; purchase, set, consume, low/out observation, disablement, changed evidence and competing evaluation during inference prevent application; publication failure leaves the deterministic projection intact with no orphan accepted Prediction.

- [x] **Step 5 - Workflow integration and budgets.** Wire the advice service after successful per-product deterministic materialization in the existing workflow. Apply stable bounded selection for advice, per-run call/product budgets and failure isolation without restricting existing deterministic evaluation. Keep the public summary shape. *Done when:* scheduled and manual paths call the same phase; disabled/openai settings retain deterministic daily behavior; one failure does not prevent later products; budget exhaustion leaves remaining products deterministic; repeated unchanged evaluation reuses valid cached advice without another provider call.

- [x] **Step 6 - Application evidence and rollback documentation.** Add focused PostgreSQL/Supertest/MCP flows and documentation for configuration, bounds, provenance and rollback. Preserve public contracts and recommendation filters. *Done when:* eligible accepted low/out advice is saved and selected when the existing household threshold permits it; uncertain/low-confidence results and pending grocery products stay suppressed; inventory/recommendation reads make zero inference calls; expiration suggestions remain separate; all required gates pass.

## Files / areas

| Area | Intended changes |
| --- | --- |
| `prisma/schema.prisma`, additive migration | Projection revision and durable advice attempt claim/result storage |
| `src/inventory/stock-ledger.service.ts`, projection writers | Revision increments on all estimate/fact writes |
| `src/estimation/estimation.service.ts`, shared evidence builder and tests | Extract non-saving input assembly with cutoff support |
| `src/estimation/stock-prediction-policy.ts`, `hybrid-calculation.ts` | Reuse guards/composition; keep on-demand compatibility |
| New focused `src/inventory/stock-advice-*` providers/types/tests | Eligibility, fingerprint, claims, execution and publication |
| `src/inventory/daily-stock-materialization.service.ts`, `daily-stock-workflow.service.ts`, module wiring | Capture deterministic snapshot and add explicit advice phase |
| `src/config/application-config.ts`, config tests, `.env.example` | Opt-in switch and bounded call limit |
| `src/estimation/estimation.module.ts` | Export the advisor/evidence boundary through DI |
| Existing daily workflow, materialized reads and recommendation e2e suites; new stock-advice e2e suite | Real application routing, races and recommendation selection |
| `src/inventory/dto/inventory-read-response.dto.ts` and tests | Map stored daily/advice evidence to the existing public signal contract |
| `docs/jev-integration.md` | Capability, limitations, settings, attempts and deterministic rollback |

## Data / contracts

### Daily baseline and eligibility (load-bearing)

- The deterministic phase commits first and supplies `{ productId, projectionId, revision, predictionId, evaluatedAt, estimatedQuantity, estimatedState, confidence, reason }`. The advice service must never use a stale pre-materialization quantity.
- Reuse `calculateCandidate`, history guards, `advisorBypassReason`, `hasSufficientColdStartEvidence` and `composeJevStockAdvice`. Share helper logic rather than duplicating thresholds or saving a detached on-demand prediction.
- Build daily advice candidate signals from valid history at the explicit workflow cutoff. Overlay candidate state with the deterministic daily state and confidence with `min(daily.confidence, historyCandidate.confidenceScore)`.
- Authority is the union of current direct stock evidence and deterministic explicit low/out, expired or depleted results. A recent authoritative confirmation also bypasses advice. Non-uncertain candidates with confidence at least 0.8 bypass advice. Products disabled for prediction or lacking valid relevant events bypass advice; cold-start candidates must satisfy the existing sufficiency predicate before spending a call.
- Accept only validated JEV stock responses with confidence at least 0.90 and state other than `uncertain`. Only a non-authoritative uncertain daily state may change state; non-uncertain deterministic states remain intact. No relaxation of 37d safety policy.
- Final confidence is `min(daily.confidence, historyCandidate.confidenceScore, advice.confidence)`. Reasons describe the final saved state using bounded application templates. `recommendedAction` remains null. Acceptance does not guarantee recommendation eligibility; the existing household threshold still applies.
- Advice never changes estimated quantity, unit, recorded fields, events, policies or grocery items. A null deterministic quantity stays null even if advice supplies a qualitative state.

### Race protection (load-bearing)

- Add `StockProjection.revision Int @default(0)`. All projection updates increment it atomically; new rows start at zero. Inventory mutation semantics otherwise remain unchanged.
- Capture the post-deterministic revision and prediction ID. Provider calls happen outside database transactions. Publication uses a conditional update on projection ID, revision and prediction ID and increments revision; no match means stale and no publication.
- In the short publication transaction, acquire the product/projection locks in the established writer order, re-read `predictionEnabled` and the relevant evidence fingerprint, and abort if changed. Product metadata updates must serialize with this recheck. Tests must cover simultaneous changes, not only updates completed before recheck.
- Create the composed Prediction and projection link atomically; throw on failed compare-and-swap so its Prediction rolls back. Retain the deterministic Prediction as history. Never apply a stale cached result to a newer snapshot without fresh eligibility/composition checks.

### Durable attempts and duplicate-call policy (load-bearing)

- Add internal `StockAdviceAttempt`: UUID `id`, product FK, `fingerprint` string, `taskVersion`, configured model, `status` (`reserved | completed | unavailable | abandoned`), `applicationStatus` (`not_applied | applied | stale | persistence_failed`), nullable validated response JSON, nullable resolved model/confidence, safe reason code, creation/completion timestamps, nullable applied Prediction FK. Unique `(productId, fingerprint)` plus product/time index; product deletion cascades, Prediction deletion sets the link null.
- Fingerprint a versioned canonical JSON payload with SHA-256: relevant event identities/values, learned-statistic values, supplied product metadata/prediction-enabled flag, minimized household counts, recorded fact identity/quantity/unit, deterministic baseline state/quantity/confidence, applicable shelf-life evidence, UTC evaluation day and configured model/task version. Exclude derived revision, prediction IDs, log IDs and exact wall-clock evaluation timestamps so unchanged same-day runs deduplicate. A new UTC day intentionally changes time-dependent evidence.
- Reserve with a database unique constraint before inference. An existing reserved attempt makes no call. Reservations older than the existing transport's maximum operation budget are marked abandoned and suppressed for that fingerprint, never retried automatically. Completed validated results may be recomposed against a fresh matching baseline; rejected/unavailable/abandoned attempts make no new call for the same fingerprint. Changed evidence or a later evaluation day permits a new attempt.
- Fail closed on attempt-store failure before inference. Persist completed response before publication so a later database failure cannot silently repeat spending. No unbounded automatic retry or crash-driven re-reservation.
- Preserve existing historical `LlmInferenceLog` formats. New workflow logs use a separately discriminated versioned JSON envelope containing task, operation/attempt ID, acceptance, application outcome, safe local reason, actual model and validated value when available. Unavailable responses use configured model in the required DB column and explicitly identify that it is configured, with no claimed resolved model.
- Accepted applied advice populates `Prediction.llmResult` and `modelProviderVersion=typesafe/resolvedModel`. Rejected/stale/unavailable advice contributes no model metadata to the deterministic Prediction. Keep attempts durable even when their separate inference log fails; emit a sanitized operational diagnostic. No raw envelopes, errors, credentials, age groups or preferences.

### Routing and bounds

- `STOCK_WORKFLOW_ADVICE_ENABLED`: boolean, default false. New workflow advice runs only when enabled and `STOCK_PREDICTION_PROVIDER=typesafe`. Selecting `openai` retains deterministic daily evaluation; it continues to select legacy OpenAI only for the existing on-demand engine. No automatic stock generation fallback.
- `STOCK_WORKFLOW_ADVICE_MAX_PRODUCTS`: positive integer from 1 to 100, default 20. Per run, examine at most that many advice snapshots and make at most one logical provider call per examined product. Stable product-ID ordering makes selection reproducible. Deterministic evaluation still processes all selected projections.
- Reuse existing JEV transport byte/options bounds, retry count and operation deadline. Document the resulting maximum physical HTTP attempts per run from the actual transport constants; the logical product cap must not be represented as a physical-request cap.
- Preserve public `DailyStockWorkflowSummary` and recommendation/REST/MCP shapes. Advice failures do not turn successful deterministic materialization into a failed evaluation; separate sanitized operational events/attempts report them. No startup, health, GET or recommendation-tool inference.
- Rollback disables the advice flag or selects `openai`, then restarts and runs deterministic evaluation to replace previously applied estimates. Disabling future calls alone does not erase already saved advice. Retain historical provenance.

## Testing

Jest is configured and every logic-bearing step ships adjacent `.spec.ts` coverage. No Browser tests command or UI target applies. Real application evidence uses the existing Supertest/MCP and isolated migrated PostgreSQL harness, with mocked provider HTTP; it proves integration and safety, not live model accuracy.

| Behavior | Required evidence |
| --- | --- |
| Cutoff and eligibility | Zero/future-only history; events filtered before limit; stable ties; disabled/authoritative/high-confidence/cold-start bypass; 20-event bound |
| Composition | 0.90 and below, uncertain/malformed/failure, final-state explanations, quantity equality, conservative confidence, no OpenAI call |
| Duplicate spending | Same-day repeat, cached acceptance reapplication, rejected/unavailable suppression, later-day/evidence change, simultaneous reservation and interrupted reservation |
| Concurrency | Deferred provider answer overlapped by purchase, absolute set, consume, low/out observation, same timestamp update, disablement, metadata change and another evaluation |
| Persistence | Atomic Prediction/projection link, failed compare-and-swap rollback, response/attempt persistence failure, independent log failure and resolved-model provenance |
| Workflow bounds | Off/openai compatibility, stable cap selection, configured limit validation, failed product followed by successful product, no-call reads |
| Recommendations | Accepted low/out with threshold allowing conservative confidence; same advice below threshold suppressed; pending item suppression; uncertain suppression; no automatic groceries/messages |
| Expiration and contracts | Expired/depleted baseline cannot be reversed; separate expiration recommendations; unchanged public fixtures and summary |

Implementation verification:

- Focused unit tests: `npm run test -- --runInBand src/estimation src/inventory src/config/application-config.spec.ts`.
- Isolated PostgreSQL evidence: `npm run test:e2e -- --runInBand test/stock-advice-workflow.e2e-spec.ts test/daily-stock-workflow.e2e-spec.ts test/materialized-inventory-reads.e2e-spec.ts test/low-stock-recommendations.e2e-spec.ts test/jev-stock-prediction.e2e-spec.ts test/model-configuration.e2e-spec.ts`.
- Final automated gate: `npm run verify` (unit tests, then production build).
- Public compatibility gate: `npm run contract:check`, without recapturing unchanged fixtures.
- Direct Check/Try path: use an isolated database and mocked accepted advice, run manual evaluation and the scheduled callback, inspect linked Prediction/projection/attempt, read REST/MCP recommendations, repeat unchanged evaluation, and release a delayed response after a concurrent stock correction. Assert zero read-time calls and unchanged recorded facts/event/grocery counts. Missing infrastructure is a reported gap, not a pass.

## Notes for the AI

- Server-only Nest services, injected ports, explicit internal types and validated boundaries. Use application config providers, not independent environment reads.
- Follow existing Prisma migrations and writer lock order. The schema/source is authoritative where coding standards retain scaffold-era persistence TODOs.
- Existing StockProjection quantities and consumption arithmetic remain authoritative. Do not substitute the legacy time-decay candidate's state for the daily baseline.
- This is one reviewable feature with six bounded steps; split an individual step further if its actual diff exceeds review size. No user-owned plan change is needed.
- No UI/design reference or prototype token work applies.
- Keep runtime defaults and private environment unchanged. Evaluation and enablement remain 38e; do not infer rollout authorization from tests passing.
- After implementation code changes run `graphify update .`; this spec-only run changes no application code.
- Stop after this spec for review, as required by the invoked feature skill. No branch creation, implementation, commits or deployment in this run.

## Critique applied

- Separated the daily deterministic baseline from legacy prediction heuristics so shared code cannot overwrite quantity or expiration evidence.
- Replaced timestamp-only race protection with a monotonic revision covering qualitative observations and same-timestamp writes.
- Added durable pre-call reservations, explicit crash/failure behavior and cached-result reuse so repeated evaluation does not either repeat spending or silently erase accepted advice.
- Distinguished response acceptance from atomic application and preserved provenance for stale results.
- Made the new phase opt-in, capped its work independently of deterministic evaluation and specified rollback of already saved estimates.
- Made recommendation evidence conditional on the existing threshold rather than promising confidence uplift or relaxed filters.


## Implementation self-review adjustments

- Application evidence found that saved daily provenance does not match the MCP public signal schema. Added explicit daily/advice DTO mapping and tests so accepted advice remains readable, while internal attempt metadata stays private. Historical rows are not rewritten.
- Sequentialized queries sharing a transaction connection after the PostgreSQL driver warned about overlapping calls. Outside provider transport remains bounded and no inference runs inside a transaction.
- Canonical fingerprint ordering uses code-point comparison so machine locale does not change duplicate-call identities.
- Corrected the expiration test to its existing `expiringSoon`/`possiblyExpired` contract. No expiration response schema was changed.


## Autopilot review packet (2026-10-06)

**Target/branch:** resumed the reviewed 38d spec on `feature/stock-advice-workflows`. All six steps are implemented and verified. Planning fingerprints were current; no plan/overview regeneration was needed. Build-plan 38d remains unchecked until `/complete`.

The spec critique separated daily quantities from legacy candidate heuristics, added revision-based concurrency, durable pre-call reservations and cached-result reuse, distinguished acceptance from application, bounded opt-in execution and made recommendation eligibility conditional on unchanged household thresholds.

| Changed areas | Purpose |
| --- | --- |
| Prisma schema/additive migration, all projection writers | Durable attempts and revision invalidation, including same-timestamp qualitative observations |
| Shared stock evidence and existing estimation engine | Cutoff-before-limit history and reusable non-saving candidate construction |
| Stock advice policy, snapshot, executor and writer | Conservative JEV decisions, duplicate suppression, atomic publication and provenance |
| Daily workflow, module/config wiring, sanitized operational phase | Same manual/scheduled phase, bounded products and isolated advice failures |
| Inventory signal DTO/tests | Valid existing REST/MCP signal shape without exposing internal daily/advice metadata |
| Unit and three new PostgreSQL suites | Eligibility, acceptance, claims, interruption, races, rollback, recommendations and read-time no-call behavior |
| `.env.example`, `docs/jev-integration.md` | Disabled default, limits, outcomes, review prerequisites and deterministic rollback |
| Activity/spec and generated graph outputs | Durable progress, evidence and refreshed AST relationships |

| Gate | Final evidence |
| --- | --- |
| `npm run verify` | Passed: 116 suites, 1,885 tests, production build; final log `/private/tmp/hst-38d-review-verify.log` |
| `npm run contract:check` | Passed: 124 scenarios, generated/documentation checks, 6 suites and 79 tests; no fixture recapture; `/private/tmp/hst-38d-final-contract.log` |
| Isolated PostgreSQL/API selection below | Passed: 10 suites and 72 tests; `/private/tmp/hst-38d-final-e2e.log` |
| Affected new suites after final lint/type fixes | Passed: 3 suites and 29 tests; `/private/tmp/hst-38d-review-e2e.log` |
| Targeted ESLint, without autofix on final check | Passed with zero errors/warnings; `/private/tmp/hst-38d-review-lint.log` |
| `git diff --check` | Passed |
| `graphify update .` | Passed: 5,985 nodes and 9,839 edges; AST-only, no model/API cost |

The PostgreSQL selection ran `npm run test:e2e -- --runInBand` with:

- `test/stock-advice-storage.e2e-spec.ts`
- `test/stock-advice-publication.e2e-spec.ts`
- `test/stock-advice-workflow.e2e-spec.ts`
- `test/daily-stock-workflow.e2e-spec.ts`
- `test/materialized-inventory-reads.e2e-spec.ts`
- `test/low-stock-recommendations.e2e-spec.ts`
- `test/jev-stock-prediction.e2e-spec.ts`
- `test/model-configuration.e2e-spec.ts`
- `test/estimation-response.e2e-spec.ts`
- `test/expiration-recommendations.e2e-spec.ts`

It used fresh local database `hst_38d_test_20261006` on the existing dedicated test container at port 55438. All 16 migrations were applied there, with provider HTTP mocked and fixtures cleaned. The temporary runner `/private/tmp/hst-38d-test.mjs` scopes connection and migrations to that database. No production schema, private runtime, remote service or live model was changed.

**Observed flows:** actual Nest/JEV adapter routing with resolved model `jev-1.14.0` differing from the pin; manual and registered scheduled callback; accepted low/out advice visible through authenticated REST/MCP; unchanged threshold/pending-grocery suppression; uncertain and low-confidence rejection; invalid provider response without generation fallback; zero-history/expired bypass; stable product cap; cached reuse after deterministic reset; simultaneous reservations/evaluations; abandoned interrupted claims; next-day new attempts; delayed provider answer after authenticated stock correction; same-timestamp ledger updates; metadata/statistics/disablement/competing evaluation invalidation; real transaction rollback of a newly created Prediction on a lost compare-and-swap; disabled deterministic reevaluation removing saved advice while retaining history.

**Self-review repairs:** corrected the public signal mapping revealed by MCP verification, retained explicit internal provenance, sequentialized transaction-connection queries, made canonical JSON key ordering locale-independent, and fixed test mock types/formatting. Corrected a test expectation to the existing expiration recommendation shape. Final Verify and affected e2e/lint checks were rerun after these repairs. No unresolved defect was found.

**Gate policies:** regular Check, Audit and Try are manual and were not automatically invoked. Independent review is omitted in config; no independent review request, reviewer/model or receipt is pending. Direct PostgreSQL/API evidence supplies behavioral verification without invoking the manual Check skill. No targeted audit ran, no audit repairs were made and the findings ledger remains empty with no blocking open or fixed P0/P1 entries.

**Checkpoints:** `da196a3` durable storage/revisions; `1fd956b` shared evidence; `441b92d` bounded execution; `8ecca4e` atomic publication; `9be2831` daily workflow wiring. The final checkpoint `feat: checkpoint stock advice application verification` includes Step 6, this packet and generated graph outputs. All checkpoints were authorized by explicit Autopilot with checkpoints enabled and passed Verify first.

**Manual review/try:** inspect `git diff main...HEAD -- src prisma test .env.example docs/jev-integration.md`. Run `node /private/tmp/hst-38d-test.mjs test/stock-advice-workflow.e2e-spec.ts` for the reproducible local manual/scheduled/REST/MCP sequence with mocked inference. `/try` remains available for a fuller guide; no human walkthrough is claimed.

**Limits:** mocked evidence proves wiring/safety, not live accuracy or calibrated probabilities. The advice flag stays false by default and both provider defaults stay OpenAI. The cap examines the first configured number of successfully materialized products in stable ID order; later IDs need a scoped run when the catalog exceeds it. Historical on-demand rows and interfaces are preserved; new daily responses normalize signals to the existing public contract. Graphify refreshed AST relationships and automatically renamed changed communities by their hubs; semantic document extraction and label review were not run.

**Next action:** review the branch diff, then invoke `/complete` when accepted. This Autopilot run stops before archival, feature completion, merge, push, deployment or rollout.


## Completion safety pass (2026-10-06)

- `npm run verify` passed in this Complete session: 116 suites, 1,885 unit tests and production build (`/private/tmp/hst-38d-complete-verify.log`).
- `npm run contract:check` passed: 124 executable scenarios, generated/documentation checks, 6 suites and 79 tests (`/private/tmp/hst-38d-complete-contract.log`).
- Reused current implementation evidence: 10 isolated PostgreSQL/API suites and 72 tests, plus the final affected-suite and targeted ESLint passes documented above. No application code changed after those checks.
- Feature branch and six checkpoints match 38d; no unrelated dirty work, workflow adapter changes or consumed prototypes. Findings and independent review are empty canonical stubs. Configured Check, Audit and Try policies are manual; no independent review is requested. No blocking finding or required evidence gap remains.
- Archived as `38d-stock-advice-workflows.md`; only leaf 38d is marked complete. Parent 38 and rollout/evaluation 38e remain pending. Completion is prepared locally; squash merge requires explicit approval and push requires a separate approval.
- How to try: run `/try latest` for the archived workflow, or rerun the isolated mocked manual/scheduled REST/MCP sequence using the temporary test runner documented above. Advice remains disabled by default; live accuracy is not established.
