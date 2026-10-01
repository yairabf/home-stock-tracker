# Feature: Product-matching evaluation

**From build-plan:** feature 37c (under 37, Jev bounded-decision integration)
**Status:** verified
**Branch:** `feature/jev-product-matching-evaluation`
**Depends on:** completed 37a transport and 37b product-matching contracts

## Goal

Provide a bounded, read-only local evaluation of the shipped Jev product advisor,
with independently labeled cases, product-group holdout separation, reproducible
metrics, and an operator checklist for matching rollout and rollback. Distinguish
tooling correctness from live model accuracy; retain OpenAI runtime defaults.

One backend/tooling feature with six reviewable steps. No visual target applies.
37c is built on `feature/jev-product-matching-evaluation`, based on the completed
37b branch. The user authorized continuing despite the merge permission block.
The approved 37b merge remains pending; preserve that dependency when completing
37c. This implementation does not bypass Git filesystem restrictions.

## In scope

- Versioned fixture, recorded-result, and report contracts with strict validation.
- At least 100 labeled cases, including at least 30 Hebrew/mixed-language cases,
  typos, nonexact aliases, brand/size/variant distinctions, ambiguity, related
  products, and missing/empty candidates.
- Fixed tuning/held-out splits with disjoint catalog-product groups, label
  provenance, independent review status, and explicit evidence limitations.
- A local CLI using the existing advisor and transport, offline by default and
  live only through an explicit flag; separate connectivity smoke cases.
- Held-out precision, coverage, clarification/abstention, language and scenario
  slices, latency, failures, tokens, and actual model/task-version provenance.
- Private credential setup and an evidence-based operator rollout/rollback guide.

## Out of scope

- Changing the production 0.9 confidence gate, Jev prompt/mapping, search ranking,
  provider defaults, or any REST/MCP/agent contracts.
- Stock prediction/replay (37d/37e), OpenAI benchmarking, new model providers,
  automatic threshold tuning, provider fallback, schedulers, or dashboards.
- Database access/export, inference-log writes, catalog/alias/grocery/stock writes,
  new migrations, or persistent shadow-evaluation infrastructure.
- Inventing confirmed household labels or claiming generated cases are real
  observations. Fixture authorship alone is not independent label review.
- Live paid calls in this planning pass or automatic checks; runtime environment
  changes, deploy, push, and commits. Live evaluation and rollout require explicit
  operator action; implementing this spec does not authorize them automatically.

## Build loop

1. Outline the next unchecked step before editing code.
2. Implement only that step with its focused logic tests.
3. Show the diff, observable done-when evidence, and passing checks for review.
4. Wait for approval before moving to the next step. Checkpoint commits require
   approval and passing gates; `/complete` owns archival and completion.

## Build steps

- [x] **Step 1 - Lock and validate the dataset contract.** Add typed/Zod fixture
  schemas, dataset validation, and adjacent Jest tests.
  Reuse production context normalization and bounds. *Done when:* duplicate IDs,
  invalid labels/references, malformed contexts, duplicate candidate IDs, byte
  overflow, and cross-split product leakage are rejected before any provider call;
  valid empty-candidate no-match cases remain legal. Counts, tags, hashes and
  review completeness are inspectable without credentials or a database.

- [x] **Step 2 - Lock recorded decisions, observations and report contracts.**
  Add strict schemas, dataset-bound replay validation and focused Jest tests.
  *Done when:* unknown fields, invalid probability maps, missing/duplicate/foreign
  replay rows, mismatched hashes and invalid skipped calls are rejected; safe
  observations omit phrase/reason text; ratios preserve counts and null values
  for zero denominators. Reuse the production transport response validator.

- [x] **Step 3 - Add the labeled corpus and frozen split.** Author at least 100
  distinct, realistic cases with explicit expected decisions/rationales, at least
  30 Hebrew/mixed-language cases, and at least 60 held-out cases. Include the
  scenario families listed below in both splits. Record provenance and label
  review honestly; supply a label-review checklist. *Done when:* validation proves
  required counts and product-group separation, each label can be assessed from
  its supplied facts, and every unreviewed label remains visibly unreviewed.
  Do not derive labels from Jev responses or pad counts with trivial duplicates.

- [x] **Step 4 - Implement scoring and reports.** Score recorded observations
  with pure functions and write versioned JSON plus a concise text summary.
  Add tests with hand-calculated correct/wrong/ambiguous/no-match/failed cases.
  *Done when:* a wrong accepted brand/size match reduces precision; zero accepted
  matches reports null precision and an inconclusive gate; errors remain in the
  coverage denominator; mock, incomplete, unreviewed or mixed-model evidence
  cannot pass the launch evidence gate. All slices show counts and denominators.

- [x] **Step 5 - Add bounded offline and explicit live execution.** Add the CLI
  and a thin launcher/package script. Invoke the production Jev advisor directly,
  with a recording client that delegates to the real `JevDecisionClient` in live
  mode and replays validated recorded decisions offline. Do not bootstrap
  `AppModule`, Prisma, controllers, logging services, or scheduled workflows.
  *Done when:* offline execution makes zero network calls even when credentials
  exist; live requires an explicit flag and valid private key/model; labels and
  split metadata never enter provider requests; smoke calls are excluded from
  scored evidence; bad arguments and invalid input fail before calls. Runs are
  serial, bounded to 200 cases, with no retries beyond the existing transport;
  interruption emits an incomplete report and does not claim a passing gate.

- [x] **Step 6 - Document setup and prove the operator workflow.** Extend Jev
  documentation with label review, offline replay, synthetic live smoke, frozen
  held-out execution, report interpretation, and rollout/rollback instructions.
  Add ignored local report output and run the offline CLI through subprocess
  evidence plus the final gates. *Done when:* a clean local offline run needs no
  secrets/DB, a deliberate false match produces the documented failing report,
  and the guide clearly separates tooling completion from live evidence review.
  It retains both default selectors on OpenAI and describes reverting matching
  without deleting existing provenance. Record actual evidence, including any
  live run not performed, in the review packet.

## Files / areas

| Area | Expected changes |
| --- | --- |
| `src/evaluation/product-matching/` | Schemas, dataset validation, scorer/report functions, runner and adjacent `.spec.ts` tests; no app-module registration |
| `scripts/evaluate-product-matching.ts` | Thin CLI entry point using existing TypeScript tooling |
| `evaluation/product-matching/cases.v1.json` | Versioned case corpus, frozen split and review metadata |
| `evaluation/product-matching/recorded-smoke.v1.json` | Clearly mocked observations for reproducible offline verification |
| `package.json` | `eval:product-matching` launcher; preserve existing Verify and scripts |
| `docs/jev-integration.md` | Dataset review, execution, metrics, launch and rollback guidance |
| `.gitignore` | Ignore `evaluation/product-matching/reports/` local outputs |

Production advisor/transport files are dependencies to reuse, not planned edits.
Use the existing `ts-node` dependency for the launcher; do not install a runner.

## Data / contracts

### Dataset (load-bearing evaluation contract)

- Envelope: `schemaVersion: 1`, `datasetVersion`, `cases`. Canonical hashing of
  validated content produces `datasetHash`; reports also hash selected inputs.
- Case: unique `id`, `split: tuning | held_out`, `productGroupIds: string[]`,
  `language: hebrew | mixed | other`, `tags: string[]`, `context:
  ProductResolutionContext`, `expected`, and `label` metadata.
- `expected` is a discriminated union: `{ kind: 'match', productId }`,
  `{ kind: 'ambiguous', plausibleProductIds }`, or `{ kind: 'no_match' }`.
  Match references one supplied candidate. Ambiguity references at least two
  distinct supplied candidates. Zero candidates requires no-match.
- `label`: `source: authored | confirmed`, `rationale`, `author`,
  `reviewStatus: pending | reviewed`, optional distinct `reviewer` and `reviewedAt`,
  and a non-sensitive source reference when genuinely confirmed. Never fabricate
  reviewer identities or confirmations. Authored cases can be independently
  reviewed, but reports retain their synthetic/authored provenance.
- Product groups cover all identities represented in a case, including intended
  products absent from candidates and related brand/variant families. No group
  or candidate product ID may occur across splits; spelling variants/near
  duplicates stay together. Review checks semantic leakage beyond IDs.
- Corpus eligibility requires at least 100 cases, 30 Hebrew/mixed cases, 60
  held-out cases, and representation of typo/alias, brand/size/variant confusion,
  ambiguous, related-but-distinct, and missing-candidate families in both splits.
  Empty-candidate cases are included and measured as no-call bypasses.
- Matching accuracy evaluates the supplied bounded candidate context, not search
  recall or exact-match bypass. Keep exact aliases/canonical matches in existing
  resolution regression tests; do not inflate advisor precision with them.

### Execution and observations

- Proposed command: `npm run eval:product-matching -- --dataset <path>
  --split held_out --recorded <path> --output <new-report.json>` for offline;
  replace `--recorded` with `--live` for explicit provider execution. `--smoke`
  selects only separate synthetic connectivity inputs. Validate incompatible
  flags, unknown options, case limit and output overwrite before calls.
- Offline recorded envelopes include `schemaVersion`, matching dataset/input
  hashes, case IDs and transport results. Reject duplicate, foreign, missing or
  mismatched observations for a claimed complete run. No silent live fallback.
- Live configuration reads only trimmed `TYPESAFE_API_KEY` and pinned-syntax
  `JEV_MODEL` from the private process environment, applying the same validation
  rules as 37a. No command-line key, implicit dotenv loading, app config rewrite,
  OpenAI credential, database URL or service token is needed for this CLI.
- Recording occurs around `choose()` and `advise()`, preserving actual adapter
  behavior and the 10-second transport budget. Each row contains case ID,
  adapter proposal projection/null (kind, target/candidate IDs and confidence only;
  omit alias and reason text), `callStatus: success | unavailable | skipped`, validated
  decision/confidence when present, safe unavailable reason, elapsed milliseconds,
  validated usage or null, configured model, actual resolved model or null, and
  task version `jev-product-resolution-v1`. Empty candidates are skipped;
  provider failure, low confidence and `no_match` remain distinct observations.
- Persist only whitelisted observations; no raw HTTP bodies, error text,
  credentials, prompts, phrases or full candidate objects in reports. Fixture
  facts necessarily go to the selected provider only in explicit live mode.
- Outcomes use the real gate `JEV_PRODUCT_RESOLUTION_MIN_CONFIDENCE = 0.9` and
  production mapping: accepted candidate -> `add_alias`; accepted ambiguity ->
  `ask_user_to_choose` with all bounded candidates; other decisions -> null.
  Do not require an ambiguity proposal to contain only the labeled plausible
  subset, since the shipped contract deliberately returns all search candidates.
- Offline/mocked runs always identify `evidenceMode: offline`; they verify the
  harness and never establish model accuracy. Live reports identify timestamps,
  code revision and source-dirty flag, configured/resolved models, task version, dataset hashes, split,
  fixed gate and completeness. Keep tuning and held-out reports separate.

### Metrics and launch evidence

| Metric | Definition |
| --- | --- |
| Accepted-match precision | Correct `add_alias` target / all accepted `add_alias` proposals; accepting a candidate on ambiguous/no-match truth is wrong |
| Candidate coverage | Accepted `add_alias` proposals / all evaluated cases, including skipped and failed cases |
| Match recall | Correct accepted targets / truth-match cases |
| Clarification and abstention | Counts by truth label and final proposal kind; ambiguity clarification rate, no-match null rate, and unsafe candidate selections on each |
| Transport health | Success/unavailable/skipped counts and safe failure-reason breakdown; unavailable / attempted calls |
| Latency and usage | p50/p95 end-to-end attempted-call latency, input/output token totals on validated successes, missing-usage counts; do not invent cost or failed-attempt tokens |
| Slices | Same counts/denominators for split, language and scenario tags; overlapping tags do not sum to a corpus total |

- Zero denominators yield null metrics, never 100%. Include a 95% Wilson interval
  for accepted-match precision and warn that the sample does not establish a
  universal error rate. Confidence is service policy, not calibrated accuracy.
- Report `launchEvidence: eligible | failed | inconclusive` plus explicit reasons.
  Eligibility is evidence for human review, never permission to switch routing.
- Require live, complete held-out execution, corpus eligibility, independently
  reviewed labels, a single resolved model matching the requested pin, and
  precision >=98%. Proposed additional sample safeguard: at least 50 accepted
  held-out candidate matches; smaller samples are inconclusive even if perfect.
  This is an initial assessment policy added here, not an existing PRD guarantee.
- Any wrong accepted candidate on ambiguous/no-match cases fails the safety
  gate. Provider failures make evidence inconclusive rather than silently
  reducing the scored sample; report a failed accuracy/safety gate if also present.
  Empty-candidate no-call bypasses are valid, not failures.
- The 0.9 gate stays fixed. Tuning cases can guide a later separately reviewed
  prompt/gate change; held-out results must not be used to select that change.
  Any changed model, prompt, mapping or gate requires new frozen held-out evidence.

## Testing

**Configured gate:** Jest via `npm run test`; final `npm run verify` runs unit
tests then production build. No browser-test command applies to this CLI feature.
Each logic-bearing step includes adjacent `.spec.ts` coverage.

| Coverage | Required evidence |
| --- | --- |
| Contracts/splits | Malformed data, normalization/byte bounds, bad references, duplicates, empty candidates, cross-split groups and candidate IDs, provenance/review validation, stable hashes |
| Scoring | Hand-computed precision/coverage/recall and Wilson interval, zero denominators, wrong variants, ambiguity/no-match false selections, slices, missing usage, failures, incomplete/mock/mixed-model gate outcomes |
| Runner | Offline zero-fetch, missing live credentials, malformed arguments, label exclusion from requests, no DB bootstrap, bounded serial calls, deadlines/retries through existing client, interruption/incomplete output |
| Mapping parity | Replay below/at 0.9, ambiguity, no-match, empty candidates, invalid transport results; invoke production advisor instead of duplicating its policy |
| CLI | Offline subprocess succeeds without DB/keys, bad/mismatched input fails before calls, report overwrite rejected, failing evidence reported clearly |

- Focused: `npm run test -- --runInBand src/evaluation/product-matching
  src/product/jev-product-resolution-advisor.service.spec.ts src/llm/typesafe`.
- Final: `npm run verify`; `git diff --check`; lint affected TypeScript without
  automatic unrelated fixes. Run `npm run contract:check` as a compatibility
  regression; do not recapture unchanged fixtures.
- `/check`: validate corpus counts/splits, run offline known-good and deliberately
  wrong observations, inspect reports, and prove zero provider calls/DB access.
- Actual live smoke/evaluation occurs only after explicit authorization and key
  setup. Record whether it ran and its limitations. Tooling can complete with
  unreviewed labels/no live key, but matching rollout remains blocked until
  eligible live held-out evidence and operator review exist.

## Notes for the AI

- Follow server-only TypeScript, explicit types, strict boundary validation, small
  functions and existing Jest conventions. No generic evaluation framework.
- Reuse 37a/37b contracts and PRD section 10. Do not alter shipped advisor behavior
  to make fixture results improve, or label provider answers as ground truth.
- Verify current official TypeSafe model/account setup documentation when writing
  the implementation guide; a syntactically pinned model is not proof of access.
- Operator rollout sets only `PRODUCT_RESOLUTION_PROVIDER=typesafe` after evidence
  review, retains `STOCK_PREDICTION_PROVIDER=openai` and OpenAI generation, restarts
  through the normal approved deployment process, then checks readiness and a
  read-only clarification request. Existing explicit confirmation remains required.
- Rollback sets matching back to `openai` and restarts; preserve TypeSafe logs and
  domain data. No migration or historical reclassification is needed.
- After implementation code changes, run `graphify update .`. No subagents or
  runtime changes are required by this spec pass.

## Critique applied

- Separated offline harness evidence from live accuracy and independent label
  review, with no invented confirmed examples or reviewers.
- Defined product-group leakage rules, zero-denominator metrics, minimum accepted
  sample size, and failure handling so sparse or failed runs cannot imply rollout.
- Kept the shipped gate/mapping fixed; clarified that ambiguity returns every
  bounded candidate and that exact-match bypass is outside advisor accuracy.
- Captured validated transport observations before the advisor collapses them to
  unavailable, while reusing production code and avoiding DB/app bootstrap.
- Split dataset validation from recorded/report contracts to keep the first diff
  reviewable, then keep corpus, scoring, execution and operator guidance in separate
  diffs; recorded the pending 37b merge and deferred all runtime switching.


## Step 1 implementation evidence (2026-10-01)

- Dataset validation and adjacent tests are implemented on the 37c branch, based
  on completed 37b. Dataset schemas retain production normalization/bounds,
  reference validation, independent label-review metadata, split-leakage checks,
  canonical hashes and corpus/review summaries. No provider or DB is invoked.
- `npm run test -- --runInBand src/evaluation/product-matching`: passed 17 tests.
- `npx eslint src/evaluation/product-matching/*.ts`: passed.
- `npm run build`: passed.
- `graphify update .`: passed, refreshed the AST graph (5,265 nodes/7,822 edges).
- `npm run verify`: failed in three existing HTTP/socket test suites because
  this restricted session denies local listening (`listen EPERM`). A separate
  `127.0.0.1` listener probe also returned EPERM. The failure is not a dataset
  assertion; do not weaken, skip or reconfigure the existing test gate.
- Step 1 stays unchecked and status stays in progress until the exact Verify
  command passes and per-step review is approved. Resume by rerunning that gate
  in an environment permitting local listeners, not by rebuilding this step.
- No 37c commit, merge, push or live evaluation occurred. The earlier approved
  37b merge remains pending due the `.git/ORIG_HEAD.lock` permission block.


### Requested verification rerun

- `npm run test -- --runInBand src/evaluation/product-matching`: 17 passed.
- `npx eslint src/evaluation/product-matching/*.ts`: passed.
- `git diff --check`: passed.
- `npm run build`: passed.
- Exact `npm run verify`: 75 suites passed, 3 failed; 1,326 tests passed,
  19 failed. Existing installation-probe, MCP controller and health controller
  suites fail with local listener EPERM. Output: `/private/tmp/hst-37c-verify.log`.
- No product edits or weakened checks. Step 1 remains pending the full gate.


### User-authorized continuation

The user requested continuation after the exact Verify rerun failed solely on
existing socket tests. Step 1 implementation and review are accepted; its
focused tests, lint and build passed. Proceed with Step 2 while retaining the
full Verify failure as an outstanding feature-level gate. This supersedes the
earlier instruction to leave Step 1 unchecked. No test is removed or disabled,
and feature verification, commit and completion still require full gates.


## Step 2 review packet (2026-10-01)

- Implemented strict recorded-decision and safe-observation schemas in
  `src/evaluation/product-matching/observations.ts`, with dataset/hash/split/row
  binding and production probability validation. Unknown fields, missing rows,
  foreign/duplicate IDs, invalid skipped calls and padded choice tokens fail.
- `report-contract.ts` locks report/metric shapes, exact ratio denominators,
  provenance/count consistency and live held-out eligibility prerequisites.
  No scoring engine, CLI, corpus or live call is part of this step.
- Adjacent `observations.spec.ts` and `report-contract.spec.ts` exercise malformed
  recordings, safe projections, confidence consistency, interrupted reports and
  forbidden offline eligibility.
- Focused command: `npm run test -- --runInBand src/evaluation/product-matching
  src/product/jev-product-resolution-advisor.service.spec.ts src/llm/typesafe`:
  6 suites and 277 tests passed.
- `npx eslint src/evaluation/product-matching/*.ts`, `npm run build`,
  `git diff --check` and `graphify update .` passed.
- Exact `npm run verify` was attempted: 77 suites passed, 3 existing socket suites
  failed with EPERM (log `/private/tmp/hst-37c-step2-verify.log`). The subsequent
  padded-token regression test and final lint/build/focused checks passed. The
  full environment-dependent gate remains outstanding under the user's explicit
  continuation instruction. Do not claim the feature verified or commit it.
- Check, Audit, independent review and Try policies are manual; none was invoked.
  No provider/DB writes, live evaluations or commits. Step 2 awaits per-step
  review; on acceptance mark it done and proceed to the labeled corpus (Step 3).


## Autopilot review packet (2026-10-01)

**Target:** resumed feature 37c on `feature/jev-product-matching-evaluation`, based
on completed 37b. The overview source fingerprint is current. The prior user
instruction to continue despite socket restrictions remains in effect; this
bounded Autopilot pass implemented the remaining work without per-step pauses.
Full feature verification and completion remain blocked. The unchecked Steps
2-6 are implemented; their checkboxes are held until full verification succeeds.
On resume inspect the evidence and rerun gates, rather than rebuilding them.

**Critique/refinements:** split dataset validation from replay/report contracts;
separate authored labels and mocked outcomes from reviewed live accuracy; preserve
product groups across splits; pin model/gate/task version; reject padded choice
keys; bind replays to validated dataset/input hashes; keep only safe report
projections. Added source-dirty provenance so a recorded HEAD cannot imply that
uncommitted evaluator/adapter code was assessed. This is internal evaluation
metadata, not a public API or production behavior change.

| Step/area | Delivered and why |
| --- | --- |
| Dataset and replay/report contracts | Strict Zod schemas, production context/transport validation, label/source/review checks, split separation, canonical hashes and metrics/provenance consistency |
| Corpus | `evaluation/product-matching/cases.v1.json`: 168 authored cases, 48 tuning/120 held out, 28 groups, 112 Hebrew/mixed cases, all labels pending independent review |
| Offline and connectivity fixtures | Explicitly mocked full held-out replay and separate one-case live connectivity input; neither can approve launch |
| Scoring | `scoring.ts`: precision/coverage/recall, ambiguity/null advice, unsafe matches, failures, language/tag slices, nearest-rank latency, validated usage, Wilson interval and reasoned launch gate |
| Execution | `runner.ts`: production advisor and bounded client, serial execution, explicit live config, validated replay, safe observations and interruption/incomplete reports |
| CLI | `cli.ts`, `scripts/evaluate-product-matching.ts`, package launcher: strict arguments, no implicit dotenv/DB/bootstrap, exclusive private report creation, safe errors and meaningful exits |
| Guidance | Corpus README and `docs/jev-integration.md`: independent review, frozen holdout, private setup, interpretation, operator rollout and rollback; official TypeSafe model/API docs checked on 2026-10-01 |
| Tests and generated graph | Adjacent Jest tests cover contracts, counts, scoring/gates, replay parity, failure containment, zero-fetch offline behavior and real no-credential CLI subprocess; AST graph refreshed |
| Output hygiene | `.gitignore` excludes private local reports; no raw prompts/errors/keys in report projections |

| Command/evidence | Result |
| --- | --- |
| `npm run test -- --runInBand src/evaluation/product-matching src/product/jev-product-resolution-advisor.service.spec.ts src/llm/typesafe` | Passed: 10 suites, 304 tests (69 evaluation tests) |
| `npx eslint src/evaluation/product-matching/*.ts scripts/evaluate-product-matching.ts` | Passed after formatting-only fixes restricted to changed files |
| `npm run build` | Passed |
| `git diff --check` | Passed |
| `graphify update .` | Passed: 5,347 nodes, 8,062 edges; AST only, no semantic/model rebuild |
| Exact `npm run verify` | Failed: 81 suites/1,378 tests passed; 3 existing socket suites/19 tests failed with listener EPERM; log `/private/tmp/hst-37c-final-verify.log` |
| `npm run contract:check` | 124 executable scenarios and preceding contract/doc/bundle checks passed; 5 suites/70 tests passed, installation-probe suite/9 tests failed with loopback EPERM; log `/private/tmp/hst-37c-contract-check.log` |
| Real CLI without provider/DB/service credentials | Exit 0, 120/120 offline cases, 60/60 mocked accepted matches, launch inconclusive |
| Deliberately unsafe related-product replay through the real CLI | Exit 2, one unsafe no-match candidate selection, launch failed even at 98.36% mocked precision |

**Output artifacts:** ignored `evaluation/product-matching/reports/review-offline.json`
and `review-wrong.json`. The latter uses `/private/tmp/hst-37c-wrong-replay.json`.
Reports contain code/source-dirty metadata and clearly identify offline evidence.
Their timings, tokens and outcomes are mocks, not live measurements.

**Self-review:** corrected the report literal-type boundary, rejected padded choice
keys without trimming them, added confidence/decision consistency, code-dirty
eligibility, provenance/count checks, and fixed Jest's empty-argument table case
that was mistakenly interpreted as a done callback. Final focused tests and
build/lint passed. No production advisor, transport, routing, public contract or
confidence threshold was changed. A live key was neither read nor used for
requests. No actual live smoke/evaluation or runtime configuration change ran.

**Effective gates:** regular Check, Audit, independent review (omitted, default
manual), and Try guide are manual. None ran automatically. The findings ledger
has no open/fixed P0/P1 entries; independent-review state is none, with no target,
reviewer/model selection or receipt pending. Self-review is not an independent
audit. No checkpoint commits were created because full required gates failed,
despite checkpoint permission from Autopilot. No merge, push or deployment.

**Risks/limits:** full Verify and contract gates need a session that permits
loopback listeners. Independent label review and complete live held-out evidence
are still required before runtime matching rollout; tooling completion alone
cannot supply them. The earlier approved 37b merge remains pending, and this
branch preserves that dependency. The authored corpus is bounded and structured;
operator review must assess semantic leakage and household representativeness.

**Try:** follow the offline command in `docs/jev-integration.md`, using a new output
filename. A valid offline replay should be complete and inconclusive. Read the
corpus README before any label changes or explicitly authorized paid live run.

**Exact next action:** rerun `npm run verify` and `npm run contract:check` in an
environment allowing local listeners, then `/autopilot resume` to reconcile
checkboxes/status and prepare the final passing review packet. `/complete`
remains blocked and requires its own completion/merge approvals. Do not hide or
skip the failing socket suites and do not infer rollout authorization.


## Autopilot resume verification

Both exact gates were rerun without changing product code. `npm run verify`
again passed 81 suites/1,378 tests and failed the same 3 socket suites/19 tests
with listener EPERM. `npm run contract:check` again passed 5 suites/70 tests and
failed installation-probe/9 tests with loopback EPERM. Logs are
`/private/tmp/hst-37c-resume-verify.log` and
`/private/tmp/hst-37c-resume-contract.log`. The environment restriction persists;
feature status and pending checkboxes stay unchanged. No checkpoint commit or
completion occurred. Resuming again requires a session allowing local listeners.


## Session permission recovery

The project is already trusted in the user Codex configuration. The active
session enforces workspace-write, restricted network, and approval policy never.
This blocks HTTP listener tests and prevents requesting approval for protected
Git writes. It cannot be repaired by application code or chmod.

Supported recovery: the operator opens macOS Terminal and launches a new session:

```sh
codex -C /Users/yairabramovitch/Documents/workspace/home-stock-tracker \
  --sandbox workspace-write --ask-for-approval on-request \
  -c sandbox_workspace_write.network_access=true \
  'Read AGENTS.md and blueprint/context/current-feature.md. Resume Autopilot for 37c on the existing feature branch. Implementation is already present. Run npm run verify and npm run contract:check, investigate actual failures, and reconcile the verification state. Do not merge, push, deploy, or make live paid evaluation requests.'
```

This enables command network access for the new session (including outbound
access); workspace filesystem restrictions remain. Protected Git operations can
request approval. Managed requirements can override these options; if rejected,
the controlling app/admin must change the effective session policy. Do not
launch this command from the restricted agent as a sandbox workaround.

Reference: https://learn.chatgpt.com/docs/agent-approvals-security


## Passing Autopilot resume verification (2026-10-01)

The user requested a verification-only resume of the existing 37c implementation
on `feature/jev-product-matching-evaluation`. Both exact required gates now pass;
the previous listener EPERM blocker is resolved in this session. Historical
failure notes above remain as prior-run evidence and no longer describe the
current verification state. Steps 2-6 are now checked and status is `verified`,
using the existing implementation/offline evidence and the passing final gates.

| Command | Current result |
| --- | --- |
| `npm run verify` | Passed, exit 0: 84 suites, 1,397 tests, then production build |
| `npm run contract:check` | Passed, exit 0: release/documentation/generator checks, 124 executable scenarios, 6 suites and 79 tests |
| `./node_modules/.bin/eslint src/evaluation/product-matching/*.ts scripts/evaluate-product-matching.ts` | Passed, exit 0; no automatic fixes |
| `git diff --check` | Passed, exit 0 |

Exact gate logs: `/private/tmp/hst-37c-recovery-verify.log` and
`/private/tmp/hst-37c-recovery-contract.log`. The Verify log includes expected
mocked failure-path logger output; every test passed. No actual failing test or
build required a repair. No source code, test, fixture or runtime configuration
was changed, and no graph refresh was needed for this documentation-only resume.

Regular Check, Audit, independent review (default manual), and Try remain manual;
none was invoked. The findings ledger has no open/fixed P0/P1 entries and no
independent reviewer/model or receipt is pending. This resume updates only the
spec and dashboard activity state; no checkpoint commit was created during the
verification-only pass. Existing source changes remain available for review.

No merge, push, deploy, paid evaluation or live connectivity smoke ran. Authored
labels remain pending independent review; offline results establish harness
correctness only. Matching rollout still requires separately authorized complete
live held-out evidence and operator review. Verification does not authorize it.

Next action: review the existing diff, then explicitly request `/complete` when
ready to archive and commit this work. Any merge still needs its own approval.
The build-plan item stays unchecked until completion.


## Completion safety pass (2026-10-01)

- `npm run verify`: passed, exit 0, 84 suites and 1,397 tests plus production build.
- `npm run contract:check`: passed, exit 0, 124 scenarios and 6 suites/79 tests.
- Logs: `/private/tmp/hst-37c-complete-verify.log` and
  `/private/tmp/hst-37c-complete-contract.log`.
- `git diff --check`: passed. All dirty work belongs to 37c or its generated graph.
- Regular Check, Audit, independent review and Try policies are manual; no gate
  was separately requested. Findings are empty and independent review is none.
- Archive and build-plan completion cover tooling only. Independent label review
  and separately authorized live held-out evidence remain prerequisites to rollout.
- Local main is still at 37a; this branch includes completed 37b commit `8a90354`.
  Merge 37b separately before merging 37c to preserve one work item per history unit.
- No merge, push, deployment or paid evaluation is part of this completion pass.
- Manual try path: the offline command in `docs/jev-integration.md`, with a fresh
  report output path; use `/try latest` for the full archived walkthrough.


## Approved local merge verification (2026-10-01)

The user explicitly approved separate local squash merges, 37b then 37c.
37b landed as `1dfdd14` after Verify passed 77 suites/1,328 tests and build.
Squash-history conflicts in shared documentation and generated graphs were
resolved to the verified 37c branch after confirming main exactly matched the
37b tree. The resolved staged tree exactly matched the 37c branch.
`npm run verify` then passed 84 suites/1,397 tests and build;
`npm run contract:check` passed 124 scenarios and 6 suites/79 tests.
Logs: `/private/tmp/hst-37b-merge-verify.log`,
`/private/tmp/hst-37c-merge-verify.log`, `/private/tmp/hst-37c-merge-contract.log`.
The earlier pending-37b notes are historical; that dependency is now on main.
No push, deploy or live paid evaluation was authorized or performed.
