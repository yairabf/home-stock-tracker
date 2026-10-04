# Feature: Stock-prediction evaluation

**From build-plan:** 37e (Jev bounded-decision integration)
**Status:** verified
**Size:** one backend evaluation feature, nine reviewable steps

## Goal

Provide a bounded local evaluator that reconstructs stock evidence at a past
prediction time, runs the shipped Jev advisor and composition rules, and scores
final outcomes against later independent stock confirmations. Produce auditable
metrics and rollout guidance without changing runtime routing or household data.

37d made the stock advisor available to the internal on-demand engine. Daily
materialization and REST/MCP inventory reads remain deterministic. This feature
must evaluate the on-demand engine rather than imply it powers those other paths.
Tooling completion is possible without a qualifying historical corpus; accuracy
and rollout eligibility remain inconclusive until reviewed live evidence exists.

## In scope

- Strict versioned, minimized local historical fixtures, independent label review,
  product/episode grouping, tuning/held-out separation and leakage checks.
- Reusable pure statistics, deterministic candidate and hybrid-policy functions
  extracted narrowly from existing services, with compatibility evidence.
- Offline recorded replay and explicit live Jev runs through the shipped adapter,
  plus a separate synthetic connectivity smoke case.
- Deterministic baseline, accepted-advice final outcomes, raw decision diagnostics,
  uncertainty, coverage, false-prompt proxies, cold-start/history slices and
  provider latency/failure/token metrics with denominators.
- Reproducible private reports, conservative launch assessment and stock-specific
  setup, evidence review and rollback instructions.

## Out of scope

- Production DB access/export, new HTTP/MCP endpoints, persisted shadow results,
  schema migrations, new schedulers or changes to daily stock materialization.
- New forecasting algorithms, threshold tuning, relaxation of 37d cold-start
  rules, changes to relevant-event semantics or recommendation eligibility.
- Matching evaluation changes, live OpenAI comparisons, classification or
  shelf-life generation changes, automatic prompts, notifications or purchases.
- Fabricating historical observations/reviewer identities, requiring real
  household data to finish the harness, or claiming synthetic accuracy as evidence.
- Runtime selector changes, remote configuration, deploy, commit, merge or push.

## Build loop

Build one step at a time: plan it, implement its small diff and focused tests,
show the diff and observable evidence, then stop for user review before advancing.
Checkpoints need permission and passing checks. `/complete` owns final archival.

## Build steps

- [x] **Step 1 - Dataset and label contract.** Add strict local dataset schemas,
  validation, hashing and tiny authored safety fixtures. *Done when:* malformed
  dates/numbers/enums, duplicate IDs/episodes, cross-split product groups, missing
  snapshot provenance, invalid outcome windows and label-review identities fail;
  valid unreviewed/synthetic cases remain usable but cannot qualify for rollout.
- [x] **Step 2 - Pure historical statistics.** Extract existing statistics
  arithmetic into a pure helper used by `StatisticsService` and replay. Preserve
  existing service persistence and formulas. *Done when:* golden regression tests
  retain interval limits, quantity median, household-size behavior and observation
  counts; replay computes only from validated pre-cutoff events, never today's
  `ProductStatistics` row, and appending future evidence changes no input.
- [x] **Step 3 - Shared deterministic candidates.** Extract candidate construction
  and date calculations into pure helpers with an explicit evaluation clock.
  Keep fetching and persistence in `EstimationService`. *Done when:* golden tests
  retain latest-20 history behavior, date boundaries, direct-signal precedence,
  cold-start classification and confidence; replay constructs the same candidate
  without Prisma or a Nest app.
- [x] **Step 4 - Shared hybrid policy.** Extract advisor eligibility and final
  composition into a dependency-injected calculation used by runtime and replay.
  *Done when:* disabled/zero-history guards, OpenAI behavior and Jev
  0.9/min-confidence/cold-start rules pass runtime regression tests; bypasses make
  no calls and exceptions preserve deterministic fallback without persistence.
- [x] **Step 5 - Recorded and live observations.** Run selected cases sequentially
  through reconstructed candidates, the real Jev adapter and shared composition;
  record validated transport outcomes and final results. *Done when:* offline
  runs make zero network calls, invalid replay hashes/versions/case sets fail,
  bypass cases make zero advisor calls, failures retain the deterministic result,
  cancellation yields an incomplete report, and injected live transport proves
  actual model/usage metadata is retained without database writes.
- [x] **Step 6 - Outcome metrics and slices.** Add strict metric validation,
  ratios, confidence intervals, deterministic and raw-advice comparisons, provider
  diagnostics and slices. *Done when:* hand-counted tests distinguish raw advice
  from final states, rejected advice from bypasses, correct low/out outcomes from
  available confirmations, missing labels from failures and zero denominators
  from zero accuracy; partial runs retain selected-case coverage denominators.
- [x] **Step 7 - Report and launch assessment.** Add strict versioned report
  validation, execution/dataset provenance checks and launch reasons. *Done when:*
  the launch conditions below cannot be satisfied by smoke, authored, offline,
  partial, unreviewed, undersampled or inconsistent evidence; qualifying historical
  evidence distinguishes failed criteria from inconclusive prerequisites.
- [x] **Step 8 - Bounded CLI and safety corpus.** Add `eval:stock-prediction`,
  argument/file bounds, exclusive private output and authored safety/recorded
  smoke fixtures. *Done when:* a documented offline command emits a valid report;
  bad arguments, oversize files, existing output paths and missing live credentials
  fail before requests; connectivity smoke is visibly excluded from launch scoring;
  interruption is reported and no credential/raw error appears in output.
- [x] **Step 9 - Evidence review and rollback guide.** Document case preparation,
  independent review, freeze/version rules, metrics, limitations and controlled
  rollout/rollback. *Done when:* `/check` reproduces offline metrics and failure,
  bypass and leakage evidence; final Verify and contract checks pass; docs state
  whether historical/live evidence exists and keep runtime stock routing unchanged.

## Files / areas

| Area | Intended change |
| --- | --- |
| `src/evaluation/stock-prediction/` and adjacent `.spec.ts` | Dataset, historical replay, observations, runner, scoring, report contract and CLI |
| `src/statistics/statistics.service.ts`, new pure helper and tests | Extract formulas without changing persisted results |
| `src/estimation/estimation.service.ts`, focused calculation helpers and tests | Share candidate and hybrid calculation with explicit time, preserve runtime behavior |
| Existing stock advisor, serialization and policy modules | Reuse shipped 37d rules; do not duplicate evaluator-only approximations |
| `scripts/evaluate-stock-prediction.ts`, `package.json` | Thin local command, analogous to product-matching evaluation |
| `evaluation/stock-prediction/` | Authored safety fixtures, recorded smoke and independent-review instructions |
| `docs/jev-integration.md` | Stock evaluation, launch review and stock-only rollback |
| Existing estimation/statistics and `test/jev-stock-prediction.e2e-spec.ts` | Runtime compatibility evidence for the narrow extraction |

No public DTO or database shape changes are planned. Share small existing
utilities when appropriate; do not build a generic evaluation framework or
refactor the completed product-matching evaluator.

## Data / contracts

### Historical dataset (load-bearing)

- Strict `schemaVersion: 1`, dataset version, replay-policy version and cases.
  Bound files to 5 MiB, selected runs to 1-200 cases and each history to 1,000
  events. Reject rather than silently truncate oversized histories/files.
- Each case has opaque `id`, `productGroupId`, `episodeId`, `split` (`tuning` or
  `held_out`), `source` (`authored` or `historical`), scenario tags, `asOf`,
  minimized product and household snapshots with `knownAt <= asOf`, a historical
  event timeline, and an optional separately stored outcome. No real IDs, raw
  event metadata, conversations, preferences, child ages or secrets.
- Product snapshot supplies fields actually read by the on-demand engine:
  prediction-enabled flag, product type, perishable flag and prediction strategy.
  Household context supplies counts; optional fields are empty/null. Do not
  substitute current catalog or household values without historical attestation.
- Timeline rows have opaque IDs, event type, occurred-at and known-at timestamps,
  quantity/unit where needed. An event is an input only if both timestamps are
  <= `asOf`; known-at cannot precede occurred-at. Later rows are outcome-side
  evidence only. Equal-time inputs use a documented stable local ordering.
- Recompute learned statistics from the eligible prefix using shared formulas.
  Retain the runtime candidate history's latest-20 relevant-event window and
  existing separate statistics limits. Record the reconstruction policy; this
  measures reconstructed evidence, not the exact historical cache contents.
- Keep all cases for a product/semantic group in one split. At most one scored
  case per stock episode/confirmation; reject duplicate confirmation references.
  Reviewers must check semantic duplicates that schema validation cannot detect.
- Labels carry author, review status, distinct reviewer and review time when
  reviewed; historical labels also require a non-sensitive evidence reference.
  Never invent reviewers. Freeze labels before exposing held-out responses.

### Ground truth and cutoff safety

- Ground truth is an explicit independently recorded human stock observation:
  `available`, `low` or `out`, with `confirmedAt`, opaque evidence reference and
  source type. Map `STOCK_CONFIRMED` to available, `STOCK_LOW` to low and
  `STOCK_OUT` to out only when the reviewer attests they represent direct facts.
  Corrections require an explicit independently supported state label.
- Proposed v1 observation window: first unambiguous confirmation strictly after
  `asOf` and within 24 hours. Freeze this policy before held-out evaluation.
  Report confirmation lag; it is a near-term outcome proxy, not proof of exact
  stock state at `asOf`. Missing/late/conflicting confirmations are unscored.
- Any intervening purchase, restock, explicit set/decrement or other balance
  mutation invalidates the outcome comparison. Retain unscored cases with a
  reason; never classify a missing confirmation as available or out. Complete
  episode evidence and lack of intervening mutation require reviewer attestation.
- Do not send the confirmation, post-cutoff rows, labels, review information or
  grouping IDs to Jev. Hash full dataset separately from reconstructed provider
  inputs; changing only future outcomes must not change the latter.

### Execution and observations

- Require exactly one of `--recorded <file>` or `--live`; default split is
  held-out. Support `--dataset`, `--split`, `--output` and separate `--live --smoke`.
  Reuse validated private TypeSafe key/model configuration and current bounded
  transport. No hidden OpenAI fallback, wrapper retries or runtime-env edits.
- Baseline uses the same deterministic result including disabled/zero-history
  policy. Run Jev only where the shipped policy permits. Record raw choice and
  confidence, validated advice/acceptance, final state/confidence, contribution,
  bypass/rejection/failure reason, resolved model/version, elapsed time and usage.
  Final low/out after accepted advice can still preserve the baseline state;
  report state-change/disagreement counts to avoid claiming model uplift.
- Recorded files bind dataset/input hashes, case IDs, split, configured model,
  task/replay versions and validated transport outcomes. Use recorded answers
  through the real adapter and shared composition, not precomputed final results.
  Unknown/missing/duplicate rows or incompatible versions fail closed.
- Offline and synthetic runs are always non-launch evidence. Live runs capture
  revision, dirty status for relevant source/config/scripts, hashes, model pin,
  resolved models and start/end timestamps. Sanitize errors to reason codes;
  omit raw envelopes, provider errors, labels and household data from stdout.
- Output uses exclusive creation and owner-only permissions (0600). Sequential
  calls and transport deadlines bound work; abort stops scheduling further cases,
  preserves completed observations and marks the report incomplete. Never load
  production services or write predictions, inference logs, events or statistics.

### Metrics and launch gate (load-bearing)

| Metric | Definition |
| --- | --- |
| Accepted final low/out precision | Correct low/out confirmations / scored cases with accepted Jev advice and final low/out; binary low-or-out primary target, exact low vs out secondary |
| Final low/out precision | Same binary metric over all scored final low/out, including deterministic bypass/fallback; report deterministic baseline separately |
| Coverage | Accepted advice / all selected cases; also report acceptance / advisor-eligible cases and scored / selected cases |
| Uncertainty | Final uncertain / completed cases, with baseline comparison |
| False-prompt proxy | Final low/out with available confirmation, count and rate among scored final low/out; accepted-advice subset separately; no real prompts are sent |
| Need recall | Final low/out / all scored low/out confirmations |
| Provider diagnostics | Calls, bypasses, validated rejections, failures by reason, failure rate per call, p50/p95 call latency and input/output tokens with missing-usage count |
| Slices | Split, cold-start, learned-statistics present/absent, scenario and product type; overlapping slices need explicit denominators |

All ratios carry numerator, denominator and nullable value for zero denominators.
Show a Wilson 95% interval for precision, with a warning about clustered household
observations. Include unscored reasons and exact-state confusion counts.

`launchEvidence` is `eligible`, `failed` or `inconclusive`, never an automatic
selector change. Proposed initial gate from the PRD: >=95% accepted-final-low/out
precision with >=50 scored accepted low/out outcomes from distinct episodes.
Eligibility additionally requires complete live held-out historical evidence,
independently reviewed frozen labels/snapshots, valid revision and clean relevant
code, one resolved model matching the pin, zero provider failures and zero safety
invariant violations. Too few outcomes, absent review, missing provenance or
non-live evidence is inconclusive; sufficient qualifying evidence below precision
or with a safety violation fails. Failures never vanish from denominators.

Report cold-start/learned-history slice counts and limitations for human review;
passing the aggregate gate does not establish slice accuracy or benefit over the
baseline. The 0.9 gate and cold-start predicate stay fixed. Rollout requires a
separate explicit user decision after reviewing the report and coverage.

## Testing

Jest is configured and every logic-bearing step includes adjacent tests. There is
no browser-test command or visual target. No paid/live provider call runs in CI.

- Dataset tests: strict boundaries, empty/malformed input, groups/episodes,
  timestamp ordering, review provenance, missing/late/conflicting confirmations.
- Leakage tests: future purchases, feedback, confirmation and statistics changes
  leave pre-cutoff candidates/provider inputs unchanged; post-cutoff mutations
  invalidate labels; backdated but later-known evidence stays excluded.
- Runtime parity: golden candidate/statistics cases, disabled/zero history,
  authoritative/high-confidence bypasses, OpenAI composition compatibility,
  Jev confidence boundaries, disagreement and sufficient/insufficient cold starts.
- Runner/report tests: real adapter with injected transport, no-call guards,
  unavailable/malformed answers, resolved model mismatch, offline zero-network,
  hash tampering, cancellation, denominator arithmetic, intervals and gate edges.
- CLI tests: mutually exclusive modes, bounds, private/exclusive output, sanitized
  failures, explicit smoke mode and relevant-code revision/dirty detection.
- Focused command: `npm run test -- --runInBand src/evaluation/stock-prediction
  src/estimation src/statistics`.
- Runtime extraction evidence: `npm run test:e2e -- --runInBand
  test/jev-stock-prediction.e2e-spec.ts test/estimation.e2e-spec.ts
  test/estimation-response.e2e-spec.ts` using the existing isolated migrated test
  database. Report infrastructure gaps rather than claim a pass.
- Final gates: `npm run verify` and `npm run contract:check`.
- `/check`: demonstrate the authored offline report, leakage invariance, accepted
  and rejected advice, bypass/failure fallback and unchanged runtime contracts.
  State explicitly that this verifies the harness, not Jev historical accuracy.

## Notes for the AI

- Server/local tooling only. Respect Nest DI, existing Prisma boundaries and Zod
  validation. Keep fetching/persistence out of reusable calculation helpers.
- Use 37d's archived contract, shipped policy and PRD section 10 as references.
  Existing implementation takes precedence over scaffold-era persistence TODOs.
- Historical data availability is unknown. Ship an honest small authored safety
  corpus and preparation instructions; do not label it historical or inflate it
  to satisfy a launch denominator. Reports can remain inconclusive after completion.
- Do not import Nest startup/config factories that require production services.
  Do not read historical inference logs as ground truth or assume rejected Jev
  attempts were prediction contributions. New evaluation uses the shipped adapter.
- Rollout affects only `STOCK_PREDICTION_PROVIDER`; matching is independent and
  generation remains OpenAI. Rollback sets stock to `openai`, restarts through an
  explicitly authorized operator action, and retains all historical provenance.
- Run `graphify update .` after implementation code changes. No code is changed
  during this spec. No subagents are needed. Stop for spec review.

## Critique applied

- Replaced replay of today's materialized statistics with cutoff-safe shared
  calculations and historical snapshot/known-at provenance.
- Defined a fixed confirmation window, mutation censoring and missing-label
  handling instead of treating arbitrary later stock events as timeless truth.
- Separated raw choices, accepted advice, final preserved states and baseline
  outcomes so deterministic accuracy cannot be attributed to Jev.
- Made authored safety evidence and tool completion independent of real-data
  availability; held-out live historical evidence is still required for rollout.
- Split deterministic candidate extraction from hybrid-policy extraction to keep
  both runtime changes independently reviewable.
- Locked denominators, small-sample limitations and explicit launch failure versus
  inconclusive states; kept threshold changes and runtime rollout outside this spec.

## Step 5 verification (2026-10-02)

- `npm run verify` passed: 91 suites, 1,517 tests and production build.
- Recorded choices use the actual Jev adapter and shared hybrid composition;
  offline replay makes zero network calls. Live transport evidence used an
  injected mock HTTP provider, not paid model calls or real accuracy evidence.
- Inputs exclude future/later-known events and labels. Reconstructed statistics
  are absent when the eligible prefix contains no statistical observations;
  otherwise they are recomputed from that prefix, not a historical cache row.
- Stable object-key hashing, probability validation, model/version/case binding,
  final-state/confidence checks, all no-call guards, failure fallback and partial
  cancellation passed focused tests. Derived arithmetic is validated before any
  live requests. Equal-time evidence orders opaque IDs lexically; confirmation
  conflicts compare instants across UTC offsets.
- `graphify update .` completed. Metrics, launch assessment and CLI remain the
  next unchecked steps. Step 5 was approved to continue and remains uncommitted.

## Step-size adjustment (2026-10-02)

Split the original Step 6 into metric/slice calculations and report/launch
validation before implementation. The feature scope and acceptance policy are
unchanged; each diff now has a separate observable review boundary. There are
nine build steps in total.

## Step 6 verification (2026-10-02)

- `npm run verify` passed: 92 suites, 1,528 tests and production build.
- Hand-counted outcome fixtures prove binary/exact low-out precision, raw-advice
  versus final/baseline attribution, false-prompt proxies, recall, uncertainty,
  missing/censored labels, and coverage denominators on partial runs.
- Provider diagnostics retain failure, rejection and bypass counts; call latency
  excludes bypasses. Token totals report unavailable usage separately.
- Wilson intervals, nullable zero denominators, exact-state confusion and
  overlapping slices passed tests. Input bindings and deterministic baseline
  validation reject foreign, duplicate and altered observations.
- `graphify update .` completed. Report/launch validation is now Step 7; no launch
  assessment is implemented or claimed in this metric-only review. Step 6 is
  uncommitted and was approved to continue.


## Step 7 verification (2026-10-02)

- `npm run verify` passed: 93 suites, 1,542 tests and production build.
- Reports bind selected cases, cutoff inputs, dataset hash/version, recorded
  transport, task/replay versions, model pins and code provenance. Dataset-bound
  parsing recalculates all metrics/slices and rejects altered labels or counts.
- Mock-provider tests prove the inclusive 95% / 50 scored accepted episode gate,
  provider failure classification, model mismatch, missing labels, offline/smoke,
  authored/tuning evidence, frozen-review timing and cancelled partial runs.
- Historical/reviewer fields in unit tests are synthetic fixtures, not independent
  review attestations or real launch evidence. No paid requests were made.
- `graphify update .` and `git diff --check` passed. Step 7 was approved to continue and remains uncommitted; bounded CLI and final evidence documentation remain Steps 8–9.


## Step 8 verification (2026-10-02)

- `npm run verify` passed: 94 suites, 1,562 tests and production build; the
  20 focused CLI tests also passed after test-type formatting adjustments.
- Actual `npm run eval:stock-prediction -- --recorded
  evaluation/stock-prediction/recorded-safety.v1.json --output
  /private/tmp/37e-step8-first-report.json` completed with exit 0: 13/13 cases,
  accepted coverage 5/13, accepted low/out precision 2/3, inconclusive evidence.
- Authored corpus covers all four bypasses, three advice rejections, provider
  failure, missing and mutation-censored labels, and future/later-known inputs.
  Its recorded transports are fabricated safety fixtures, not captured model
  responses or real launch evidence; connectivity smoke is separate and unscored.
- Tests prove exclusive 0600 output, existing-file/symlink refusal, 5 MiB input
  bounds, no-request invalid arguments/configuration/replay, private failure
  summaries, partial interruption and signal-listener cleanup. Relevant source
  state is checked before and after execution; missing git state fails closed.
- `graphify update .` and `git diff --check` passed. Step 8 was approved to continue and remains uncommitted; Step 9 contains evidence/rollback guidance and final gates.


## Step 9 and final verification (2026-10-02)

- Added historical preparation, independent review, freeze/version and group
  isolation guidance, report interpretation and limitations, plus separately
  authorized stock-only rollout/rollback. Existing runtime defaults and settings
  were not changed. No historical corpus or paid live evaluation was collected.
- `npm run verify` passed: 94 suites, 1,562 tests and production build.
- `npm run contract:check` passed: 124 executable scenarios, documentation and
  generated-skill checks, 6 suites and 79 tests. No fixture recapture occurred.
- Isolated runtime compatibility passed: 5 PostgreSQL/Nest suites, 39 tests via
  `node /private/tmp/hst-37d-test.mjs test/jev-stock-prediction.e2e-spec.ts
  test/model-configuration.e2e-spec.ts test/estimation.e2e-spec.ts
  test/estimation-response.e2e-spec.ts test/daily-stock-workflow.e2e-spec.ts`.
  The existing migrated local database `hst_37d_test_20261001` on port 5433 was
  used, never the household database; provider credentials were disabled and
  all model responses mocked. Checks cover selection, persisted provenance,
  zero-history safety, public REST/MCP reads and deterministic daily workflow.
- `/check` used the actual npm CLI with fetch blocked. It observed a new 0600
  report, 13/13 cases, 5/13 acceptance, 2/3 accepted binary precision, all four
  bypasses, one provider failure and both missing/mutation-censored labels.
  Existing output was preserved; bad arguments, missing live configuration and
  oversized input exited 1. Removing future/later-known events changed full
  dataset hash but retained provider input hash. Evidence:
  `/private/tmp/37e-final-check.json`; private report:
  `/private/tmp/37e-acceptance-XSnkyX/report.json`.
- All nine steps are built and the spec is verified on
  `feature/stock-prediction-evaluation`. Changes after the two early checkpoints
  remain uncommitted. Step 9 awaits final review before `/complete`.
- Findings ledger: no open or fixed findings. Independent review: none requested.
  Effective regular Audit, Check and Try policies are manual; independent review
  is not configured. Check ran explicitly as required by this spec; no Audit or
  Try gate is claimed. Graph was updated after the last code change in Step 8;
  Step 9 adds documentation only. `git diff --check` passed.
- Launch evidence remains inconclusive: authored fixtures validate the harness,
  not accuracy. Historical-data review, clean-source live held-out collection and
  a separate operator rollout decision remain external follow-up work.

## Completion safety pass (2026-10-02)

- `/complete` reran `npm run verify`: 94 suites, 1,562 unit tests and production
  build passed. `npm run contract:check` passed 124 executable scenarios,
  documentation/generated-skill checks, 6 suites and 79 tests; no recapture.
- Reused this work item's observed CLI evidence and isolated PostgreSQL/Nest
  compatibility results (5 suites, 39 tests) recorded above. No paid calls or
  historical launch evaluation was performed.
- The feature branch and all tracked/untracked product changes match 37e scope;
  graph artifacts are expected updates from the required AST refresh. No shared
  workflow adapters changed. Findings and independent-review files are canonical
  empty stubs: no open/fixed blockers or pending/stale receipt.
- Regular Audit, Check and Try policies are manual; independent review is not
  configured. Required behavior evidence was collected in Step 9. The offline
  CLI and README provide a repeatable manual try path.
- Archived all nine verified steps, checked 37e and parent 37 off, synchronized
  overview progress/evaluation availability and its source-plan fingerprint,
  and reset current-feature.md to the canonical stub.
- Implementation checkpoints are 91b4ec7 and 105972d. Local main/base is
  86fcb5b62ef987e8a3baf09039547c95043c4458. Completion creates the work commit on
  feature/stock-prediction-evaluation; squash merge awaits explicit approval and
  push requires separate approval.
- Both runtime defaults remain OpenAI. Live historical evidence and rollout
  approval remain follow-up work, not a claim of demonstrated model accuracy.
