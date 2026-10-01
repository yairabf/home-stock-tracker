# Feature: Jev stock prediction

**From build-plan:** 37d (Jev bounded-decision integration)
**Status:** verified
**Size:** one backend feature, six reviewable steps

## Goal

Route bounded stock-state advice independently through OpenAI or Jev while
preserving deterministic evidence, recorded stock facts, and public REST/MCP
contracts. Jev must abstain safely, never increase deterministic confidence, and
retain the actual provider, resolved model, and adapter version.

37a transport, 37b matching, and 37c matching evaluation are complete. Their
completion does not establish stock-prediction accuracy; stock evaluation and
runtime rollout remain 37e.

## In scope

- Introduce `StockPredictionAdvisor` and extract the existing OpenAI reasoner
  behind it without changing eligible OpenAI reasoning behavior.
- Implement Jev stock choices with validated, bounded, minimized evidence and
  code-built explanations, reusing the 37a transport.
- Zero-history guard, Jev authoritative bypass, explicit cold-start evidence
  requirements, deterministic state precedence, and conservative confidence.
- Independently select the stock advisor with `STOCK_PREDICTION_PROVIDER` and
  remove its staging rejection only once the adapter and safety rules work.
- Persist accepted and rejected validated attempts with accurate provenance.
- Focused unit, Nest HTTP/MCP, PostgreSQL, and daily-workflow regression evidence;
  update setup documentation while leaving configured defaults on OpenAI.

## Out of scope

- 37e historical replay, accuracy metrics, threshold tuning, and runtime rollout.
- Changes to matching decisions, OpenAI classification or shelf-life generation.
- New schema columns, model-generated quantities, ledger/event semantics,
  expiration arithmetic, recommendation eligibility, grocery mutations,
  notifications, schedulers, Python services, or persisted shadow results.
- Live provider calls during tests, startup, readiness, or health checks.
- Deployment, remote configuration, commits, merges, or pushes.

## Build loop

Build one step at a time. Plan the step, implement its small diff and focused
tests, show the diff and observable evidence, then stop for the user's review
before advancing. Checkpoints are optional and require permission after passing
checks. `/complete` owns final archival and the feature commit.

## Build steps

- [x] **Step 1 - Stock advisor boundary and OpenAI compatibility.** Add the
  advisor token/result contract; retain `PredictionReasoner` as the OpenAI
  implementation or a compatible facade. Centralize candidate-to-input
  serialization/validation and inject the advisor into estimation, initially
  binding OpenAI only. *Done when:* existing eligible OpenAI inputs, output,
  refusal/unavailable behavior, 0.65 acceptance, 0.8 bypass, and 70/30 confidence
  composition pass regression tests; generation and matching routing are unchanged.
- [x] **Step 2 - Zero-history safety.** Add the shared zero-event guard before
  any advisor call. Preserve prediction-disabled behavior and existing event
  filtering/date calculations. *Done when:* enabled products with zero valid
  relevant events, including future-only histories and stale statistics, return
  `uncertain`, confidence `0`, action `null`, no attempt/contribution, and make
  zero advisor calls under either provider. Nonzero OpenAI history remains compatible.
- [x] **Step 3 - Bounded Jev adapter.** Build explicit enum-derived choices,
  minimized evidence, strict mapping and code-built text; preserve validated
  low-confidence/uncertain answers for the service's rejection/logging policy.
  Keep runtime selection blocked. *Done when:* unit tests demonstrate all four
  choices, exact confidence boundaries, minimized input, invalid/oversized input
  abstention, actual resolved model/version, and safe unavailable/exception
  handling; the existing 15-second transport deadline and retry rules are reused.
- [x] **Step 4 - Jev composition and evidence policy.** Apply the Jev-specific
  bypass, cold-start, acceptance, precedence, confidence and final-text rules
  below in estimation. *Done when:* adversarial state disagreements never replace
  a non-uncertain deterministic result; authoritative candidates never call Jev;
  insufficient cold starts remain uncertain; accepted Jev confidence never
  exceeds deterministic confidence; uncertain/rejected/failure results preserve
  the deterministic fallback and return no model-generated action.
- [x] **Step 5 - Attempt provenance.** Carry adapter version through internal
  attempts; persist validated accepted/rejected Jev attempts using the existing
  inference log and actual resolved model. *Done when:* tests and PostgreSQL
  round-trips distinguish accepted, low-confidence, uncertain and cold-start
  rejections; prediction contribution metadata is set only for accepted advice;
  OpenAI retains its own version and historical logs remain readable; logging
  failures do not alter the calculated prediction or lose an already saved ID.
- [x] **Step 6 - Enable explicit routing and prove compatibility.** Bind the
  stock advisor through `MODEL_CONFIG`, remove the stock staging rejection,
  update `.env.example` and setup guidance, and add real Nest/DB regression
  coverage. *Done when:* defaults and all four matching/stock selector
  combinations resolve the intended adapters; TypeSafe credentials/model pins
  remain validated; REST/MCP shapes and recorded facts remain unchanged;
  generation stays on OpenAI; daily estimation retains its existing cadence and
  one-evaluation-per-product behavior; final Verify and contract checks pass.

## Files / areas

| Area | Intended change |
| --- | --- |
| `src/estimation/stock-prediction-advisor.ts` (new) | Advisor token and typed result metadata |
| `src/estimation/prediction-reasoner.service.ts` and adjacent tests | OpenAI adapter compatibility |
| `src/estimation/jev-stock-prediction-advisor.service.ts` and tests (new) | Request/mapping and minimized Jev evidence |
| `src/estimation/types/prediction-reasoning.ts`, `prediction-result.ts` | Shared input validation and internal versioned attempts |
| `src/estimation/estimation.service.ts` and tests | Safety guards, composition, final text, persistence |
| `src/estimation/estimation.module.ts`, `src/config/application-config.ts` and tests | Independent DI routing and staging-guard removal |
| `test/model-configuration.e2e-spec.ts`, new `test/jev-stock-prediction.e2e-spec.ts` | Config, real Nest REST/MCP and persisted provenance |
| Existing estimation, daily-stock-workflow and feedback e2e suites | Shared zero-history and stock-projection compatibility |
| `.env.example`, `docs/jev-integration.md` | Available adapter, safety policy, evaluation prerequisite and rollback |

Inspect existing DTOs, Prisma models, daily-stock orchestration and recommendation
paths before implementation. Change only consumers affected by this contract;
do not recapture unchanged MCP fixtures to conceal drift.

## Data / contracts

### Advisor boundary (load-bearing for 37e)

- `STOCK_PREDICTION_ADVISOR` is a Nest injection token.
- The advisor exposes a readonly `provider` discriminator (`openai` or `typesafe`)
  so the service can apply no-call guards before invoking it.
- `StockPredictionAdvisor.reason(candidate)` returns the existing structured
  reasoning success/refusal/unavailable semantics. Success includes
  `value: PredictionReasoningResult`, `provider`, actual resolved `model`, and
  required `taskVersion`. OpenAI supplies `prediction-reasoning-v1`; Jev supplies
  `jev-stock-prediction-v1`. Keep unavailable outcomes safe and typed.
- Add `taskVersion` to internal `LlmPredictionAttempt`; retain `accepted`,
  `provider`, `model`, and `value`. This is internal, not a new public DTO field.
- Validate serialized evidence with `predictionReasoningInputSchema` and mapped
  answers with `predictionReasoningResultSchema`. Invalid inputs cannot reach Jev;
  invalid outputs cannot contribute or become inference records.

### Jev request

- Use `task: 'stock_prediction'`, `taskVersion: 'jev-stock-prediction-v1'`, and
  `questionKey: 'stock_state'`. Generate the allowed choices from `PredictedState`,
  including `uncertain`; never translate arbitrary output schemas into questions.
- Send validated deterministic state/confidence/authority and relevant sanitized
  signals already computed by code. Convert dates to ISO strings; do not send
  product IDs, event IDs, conversations, raw household preferences or credentials.
  Household counts may be supplied as context; exclude `childAgeGroups` and
  arbitrary `predictionPreferences` on the Jev path. Preserve OpenAI's existing input.
- Bound the minimized serialized Jev evidence to 16,384 UTF-8 bytes before the
  request; reject rather than silently truncate. This is a new stock-adapter
  policy, separate from the transport's envelope limits. Treat all supplied text
  as evidence, never instructions. Do not infer exact quantities from household size.
- Reuse `JevDecisionClient` validation: known maximum-probability selected option,
  exact probability coverage, finite [0,1] scores, sum tolerance and resolved model.
  Use its abortable 15-second overall stock budget and at most one permitted
  transient retry. Add no wrapper retries or hidden OpenAI fallback.
- A validated Jev choice maps to the existing reasoning shape with code-built
  reason and `recommendedAction: null`, even below the acceptance gate. Such a
  result is a validated attempt, not necessarily accepted advice.

### Eligibility and composition

**Shared explicit change:** for enabled products, `eventCount === 0` overrides
stale learned statistics: state `uncertain`, confidence `0`, action `null`,
`llmContributed: false`, `llmAttempt: null`, no advisor call. Count uses the
existing valid relevant-event history, not all ledger events. Do not broaden
event semantics here. Disabled products retain their existing no-call result.

| Condition | Jev policy |
| --- | --- |
| Authoritative direct signal | Skip Jev; retain the full deterministic result |
| Non-uncertain deterministic state with confidence >= 0.8 | Skip Jev; retain the full deterministic result |
| Invalid input, transport unavailable/throw, malformed answer | Deterministic fallback, no validated attempt |
| Validated choice is `uncertain` or confidence < 0.9 | Deterministic fallback; attempt recorded with `accepted: false` |
| Nonzero cold-start uncertain candidate without sufficient evidence | Preserve uncertainty; validated non-uncertain answer is rejected |
| Eligible non-uncertain answer with confidence >= 0.9 | Accept subject to the cold-start rule; preserve existing non-uncertain deterministic state |

**Draft cold-start policy, deliberately conservative:** an uncertain cold-start
candidate may acquire a non-uncertain Jev state only when `eventCount >= 2`,
`hasLearnedStatistics === true`, `observationCount >= 2`, at least one finite
positive learned purchase/need/consumption interval exists, and
`daysSinceLastPurchase` is finite and nonnegative. A statistics row alone,
household composition, zero/negative intervals, or one event is insufficient.
These checks use existing sanitized signals. Authoritative signals bypass the
advisor rather than serving as an exception to this rule. 37e must evaluate
this provisional predicate before any relaxation.

- For accepted Jev advice use `min(candidate.confidenceScore, advice.confidence)`.
  No uplift, 70/30 blend, or use of selected-option probability on this path.
- Only a non-authoritative `uncertain` deterministic state may adopt Jev's state.
  If a non-uncertain deterministic state is preserved despite disagreement,
  rebuild the final reason from that final state and actual deterministic
  signals; never display a reason for the rejected state.
- Construct bounded static text in code, optionally including finite elapsed
  days/intervals. Accepted Jev results always have action `null`; rejected ones
  keep the deterministic result, whose action is already `null`.
- Eligible nonzero OpenAI behavior keeps its existing 0.65 acceptance and 70/30
  blend. The authoritative no-call change is specific to Jev. Neither provider's
  confidence is claimed to be a calibrated stock-availability probability.

### Persistence and downstream safety

- Reuse `Prediction` and `LlmInferenceLog`; no migration is planned. Accepted
  contributions populate existing `Prediction.llmResult` and
  `modelProviderVersion = provider/resolvedModel`. Rejected attempts do not.
- Record all schema-valid Jev answers, including rejected ones, in the linked
  inference log with `modelProvider: 'typesafe'`, actual response `modelVersion`,
  `promptVersion: 'jev-stock-prediction-v1'`, and returned confidence.
  Define Jev `structuredResponse` as
  `{ status: 'validated', accepted: boolean, value: PredictionReasoningResult }`.
  Keep OpenAI's existing structured response shape and version. 37e readers must
  discriminate these shapes explicitly. Never rewrite historical rows.
- Do not persist raw request/probability envelopes, secrets, full household
  preferences or raw provider errors. No new rejected transport-attempt store.
- New Jev prediction snapshots minimize `deterministicSignals.householdContext`
  to counts with `childAgeGroups: []` and `predictionPreferences: null`; keep the
  existing stored shape and OpenAI/historical behavior.
- If prediction persistence fails, preserve existing safe null-ID behavior;
  if only inference logging fails, retain the saved prediction ID and result.
- Existing daily estimation may update estimate fields through its established
  workflow. Jev cannot alter recorded quantities/facts, expiration arithmetic,
  events, grocery lines, or prediction-enabled flags. Model advice supplies no
  quantity. REST/MCP schemas, recommendation thresholds and confirmation stay intact.

## Testing

**Configured gate:** Jest is enabled; logic-bearing steps ship adjacent
`.spec.ts` tests. No browser-test command or visual reference applies to this
backend feature. Use the existing Supertest/MCP and isolated migrated PostgreSQL
harness for integration evidence; no new runner or production database access.

| Coverage | Required evidence |
| --- | --- |
| OpenAI compatibility | Input/prompt, success/refusal/unavailable, 0.65 acceptance, 0.8 bypass, 70/30 blend; explicit shared zero-history exception |
| Zero history | No events, future-only valid-event filtering, stale learned stats and populated household; both providers, zero calls, persisted uncertain/0/null |
| Jev mapping | All enum options, 0.9 and immediately below, invalid state/result, minimized fields, UTF-8 byte bound, malformed/oversized evidence, resolved model differing from pin |
| Safety/composition | Authoritative low/out/confirmed signals; non-uncertain disagreement below 0.8; confident bypass; uncertain abstention; no confidence uplift or wrong-state explanation |
| Cold-start policy | One event, absent stats, low observation count, missing/zero interval or purchase timing; qualifying two-event evidence; non-cold-start history |
| Failures | Transport unavailable/throw, existing abort/retry validation coverage, prediction-save failure, nonblocking inference-log failure |
| Provenance | Accepted/rejected Jev and OpenAI versions; real PostgreSQL linked-log round-trip; contribution metadata absent on rejection |
| Real flows | Nest REST/MCP prediction and recommendation reads; daily evaluation with mixed task providers; recorded balance/event/grocery counts unchanged by advice |
| Configuration | Default and explicit provider combinations, missing TypeSafe key/model pin, unsupported values, unchanged OpenAI generation, no health/startup provider calls |

Implementation commands:

- Focused unit checks: `npm run test -- --runInBand src/estimation
  src/config/application-config.spec.ts src/llm/llm.module.spec.ts src/llm/typesafe`.
- Configuration/API evidence: `npm run test:e2e -- --runInBand
  test/model-configuration.e2e-spec.ts`.
- PostgreSQL and real-flow checks: `npm run test:e2e -- --runInBand
  test/jev-stock-prediction.e2e-spec.ts test/estimation.e2e-spec.ts
  test/estimation-response.e2e-spec.ts test/daily-stock-workflow.e2e-spec.ts`.
  Reuse the documented isolated test DB environment and cleanup inference logs.
- Final automated gate: `npm run verify` (unit tests, then production build).
- Public compatibility gate: `npm run contract:check`; preserve unchanged fixtures.
- `/check` should demonstrate mocked accepted and rejected Jev answers through
  real Nest flows, a zero-history no-call result, persisted provenance, and
  unchanged recorded facts/domain counts. This proves wiring/safety, not live
  model accuracy. Report missing infrastructure rather than claiming a pass.

## Notes for the AI

- Server-only Nest providers, dependency injection, explicit boundary types and
  Zod validation. Use `MODEL_CONFIG`, not new independent `process.env` reads.
- Reference `docs/home-stock-tracker-jev-integration-prd.md` sections 7-9 and
  completed 37a/37b contracts. Existing Prisma/code is authoritative where
  coding standards still contain scaffold-era persistence TODOs.
- No design reference is needed: this feature has no UI or replication target.
- Confirmed during implementation: this advisor serves the existing internal
  on-demand `PredictionEngine`. REST/MCP inventory reads and the separate daily
  materialization workflow remain deterministic; integration tests prove those
  paths stay unchanged rather than adding new model calls or public endpoints.
- Selector support is implementation capability, not rollout authorization.
  Keep both default selectors OpenAI and document stock rollout as blocked on
  reviewed 37e evidence. Rollback selects OpenAI and restarts, retaining logs.
- After code changes run `graphify update .`. No code is changed during this spec.
- No subagents are needed. Stop after presenting this draft for review.

## Critique applied

- Made the zero-history change explicitly shared across both providers while
  preserving OpenAI behavior for eligible nonzero histories.
- Replaced vague cold-start sufficiency with a concrete provisional predicate
  and tests; separated deterministic evidence from model confidence.
- Kept low-confidence/uncertain validated answers available for rejected-attempt
  provenance rather than discarding them in the adapter.
- Split mapping, composition, provenance and routing into reviewable steps;
  runtime selection remains blocked until all safety pieces exist.
- Defined final-state explanations, minimized preference exposure, and log-only
  failure isolation. Kept stock evaluation and runtime rollout in 37e.

## Autopilot review packet (2026-10-01)

**Target/branch:** resumed 37d on `feature/jev-stock-prediction`.
All six steps are verified. The overview fingerprint was current; no plan or
overview regeneration was needed. Build-plan 37d remains unchecked until
`/complete`. No runtime selectors, remote systems or production data were changed.

The original critique made zero-history behavior shared, specified the
provisional cold-start predicate, separated rejected-attempt provenance from
adapter failure, and split mapping/composition/logging/routing. Implementation
inspection confirmed that the advisor serves the internal on-demand engine;
inventory reads and daily materialization must remain separate deterministic
paths. Self-review also minimized new Jev persisted household snapshots while
preserving OpenAI behavior and historical rows.

| Changed files/areas | Purpose |
| --- | --- |
| `stock-prediction-advisor.ts`, `prediction-reasoning-input.ts`, `types/prediction-result.ts` | Explicit injected port, shared validated serialization, versioned internal attempts |
| `prediction-reasoner.service.ts` and tests | Preserve OpenAI generation inputs/output and add its actual adapter version |
| `jev-stock-prediction-advisor.service.ts` and tests | Enum-derived bounded choices, minimized evidence, mapping and resolved provenance |
| `stock-prediction-policy.ts` and tests, `stock-prediction.fixture.ts` | Conservative composition, sufficient cold-start evidence and reusable test evidence |
| `estimation.service.ts` and tests | Zero-history/authoritative guards, provider-specific composition, minimized Jev snapshots and isolated inference-log failure |
| `estimation.module.ts`, `application-config.ts` and tests | Independent stock DI routing and removal of the staging rejection after safety implementation |
| `test/jev-stock-prediction.e2e-spec.ts` | Real Nest selection, PostgreSQL logs, accepted/rejected/zero-history outcomes, REST/MCP and daily-workflow safety |
| `test/model-configuration.e2e-spec.ts`, `test/estimation-response.e2e-spec.ts` | Four provider combinations, no startup/health calls and unchanged public response boundary |
| `.env.example`, `docs/jev-integration.md` | Available adapter, default OpenAI policy, evaluation prerequisite and rollback |
| Active spec, activity state, generated Graphify outputs | Progress, final evidence and updated AST relationships |

| Gate/evidence | Final result |
| --- | --- |
| `npm run verify` after final source/test fixes | Passed: 86 suites, 1,455 unit tests and production build |
| `npm run contract:check` | Passed: 124 executable scenarios, documentation/generated-skill checks, 6 suites and 79 tests; no fixture recapture |
| Isolated PostgreSQL e2e selection below | Passed: 5 suites and 39 tests |
| ESLint on estimation, changed config and selected e2e files, without autofix | Passed with zero errors/warnings after mock-typing fixes |
| `git diff --check` | Passed |
| `graphify update .` | Passed: AST refreshed, 5,400 nodes and 8,210 edges |

The PostgreSQL selection was:
`npm run test:e2e -- --runInBand test/jev-stock-prediction.e2e-spec.ts
test/model-configuration.e2e-spec.ts test/estimation.e2e-spec.ts
test/estimation-response.e2e-spec.ts test/daily-stock-workflow.e2e-spec.ts`.
It ran in newly created local database `hst_37d_test_20261001` on port 5433 with
the existing 14 migrations, provider HTTP mocked and test fixtures cleaned.
The temporary runner `/private/tmp/hst-37d-test.mjs` derives credentials privately
from `.env`, checks the local host/port and changes only the database name before
invoking npm. No new application migration or dependency was introduced.

Evidence includes actual response model `jev-1.14.0` differing from request pin
`jev-1.13.0`, accepted and low-confidence/uncertain/cold-start rejected logs,
zero-event predictions with stale statistics, unchanged recorded projection
fields, no model calls during REST/MCP reads, and one deterministic daily
evaluation with OpenAI shelf-life generation under either stock selector.
OpenAI 0.65 acceptance and 70/30 composition remain intact for eligible histories.

**Regular policies:** Check, Audit and Try are manual and were not automatically
invoked. Independent-review policy is omitted; no independent handoff was
selected, no reviewer/model was chosen and no receipt is pending. Integration
evidence above supplies direct acceptance checks independently of the manual
`/check` skill. No targeted Audit ran and no audit repairs were made. The findings
ledger remains empty, with no blocking open or fixed P0/P1 entries.

**Self-review fixes:** corrected test mock typing and matcher assertions so the
selected ESLint check passes; removed private age/preference fields from new Jev
prediction snapshots, alongside request minimization. Final Verify and affected
PostgreSQL/API evidence were rerun and passed. No unresolved defect was found.

**Implementation checkpoints:** `d42fe92` advisor boundary; `5dbfe18` zero-history
guard; `f1276dc` bounded Jev mapping; `896522b` conservative composition;
`43c44f5` provenance; `4a949f6` routing, compatibility, documentation and final
self-review fixes. A separate generated-graph/evidence checkpoint follows this
record. All were authorized by explicit Autopilot with checkpoints enabled.

**Review/try path:** inspect `git diff main...HEAD -- src test .env.example
docs/jev-integration.md`. Re-run the focused stock suite against an isolated test
database using the documented npm command (the temporary runner is available in
this workspace). Its assertions demonstrate advice, abstention, logs and
read-only stock behavior. `/try` remains available for a fuller walkthrough.

**Limits/next action:** real stock accuracy and confidence calibration are not
established. Runtime stock rollout stays deferred to reviewed 37e evidence; both
defaults stay OpenAI. Review the branch diff, then invoke `/complete` when
accepted. This run stops before archival, merge, push or deployment.

## Completion safety pass (2026-10-01)

- `/complete` reran `npm run verify`: passed 86 suites and 1,455 unit tests,
  followed by the production build.
- `/complete` reran `npm run contract:check`: passed 124 executable scenarios,
  documentation/generated-skill checks, 6 suites and 79 tests. Fixtures were
  not recaptured. Prior PostgreSQL/API and ESLint evidence remains recorded above.
- The active spec was verified with six checked steps on
  `feature/jev-stock-prediction`; changed files match its scope. No workflow
  adapter changes or unrelated dirty files were present.
- Check, Audit and Try policies are manual; no independent review was requested
  or pending. Findings and independent-review files match their canonical empty
  stubs. There are no blocking open or fixed P0/P1 entries.
- Implementation checkpoints through `4a949f6` and graph/evidence checkpoint
  `fa5d048` passed review. Local main and the merge base are
  `d376545e9beb78740161788757bc61870826fa09`.
- Archived 37d and checked its leaf off. Parent 37 remains open for 37e.
  Synchronized overview progress, advisor availability and its plan fingerprint.
- Both runtime defaults remain OpenAI; no runtime rollout or real-provider
  accuracy claim is established. 37e evidence must precede stock rollout.
- Completion commit is prepared on the feature branch. Squash merge awaits the
  user's explicit approval; push requires a separate later approval.
