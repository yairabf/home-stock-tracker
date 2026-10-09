# Feature: Qualifying JEV evidence

**From build-plan:** feature 38f
**Status:** in progress, exported source inspected; qualifying evidence and independent review pending
**Depends on:** completed 37c, 37e and 38a through 38e

## Goal

Collect independently reviewed, frozen held-out evidence and assess each existing
JEV launch gate against representative observed inputs and historical outcomes.
Deliver a reproducible private evidence packet for the separate 38g rollout
decision. Accuracy targets are policies to evaluate, not promised results.

This is one evidence-focused feature. The existing evaluators supply the tooling;
the reviewable steps divide data preparation, run authorization, collection and
assessment. Missing qualifying data leaves the relevant steps pending.

## In scope

- Source inventory and independent review for matching, all four understanding
  fields, shelf-life policies, historical stock advice and materialized workflow
  recommendations.
- Semantic-group separation from tuning and prior diagnostic inputs, frozen
  labels, cutoff-safe reconstruction and independently supported outcomes.
- Offline preflight, concrete bounded paid-run proposals, separately authorized
  live execution, retained partial/failure reports and validated offline replay.
- Existing per-route launch assessments, denominators, slices, coverage,
  abstention, recall, baseline comparisons, usage and limitations.
- Private artifacts plus a sanitized repository handoff describing what is
  eligible, failed or inconclusive and why.
- User-requested synthetic product-understanding diagnostic (2026-10-07):
  authored references and bounded real-JEV testing to measure behavior on the
  generated set. This diagnostic does not substitute for qualifying household
  evidence, independent review or the unchanged launch gates.
- User-approved follow-up (2026-10-07): define and version the product-type
  question, preserve acceptance thresholds and other field behavior, add focused
  tests, and prepare a paired synthetic comparison with the retained baseline.

## Out of scope

- Runtime selectors, advice flags, deployment, restart, rollback execution and
  production mutations. These belong to 38g with separate authorization.
- New prompts, vocabularies, policies, acceptance thresholds or model tuning;
  default-JEV enablement; automatic comparison or OpenAI fallback on uncertainty.
- Synthetic padding, inferred historical confirmations, generated review
  identities, labeling by model agreement or bulk catalog reclassification.
- A new evaluation platform, public REST/MCP contracts, schema changes, UI,
  background jobs or monetary savings claims without a versioned price table.

## Build loop

1. Plan the next unchecked step before changing its artifacts.
2. Complete only that small step; show its sanitized diff and observable evidence.
3. The user reviews and approves before continuing. Checkpoints are optional and
   need permission plus the documented automated gate.
4. Preserve private evidence separately from repository documentation. Spec or
   step approval alone does not authorize billable requests or runtime changes.

## Build steps

- [x] **Step 1 - Inventory sources and contamination.** Review the existing
  corpora, prior private diagnostic manifests and available authorized source
  descriptions. Record authenticity, missing fields, review ownership and
  semantic exclusions per route without exporting a database by default.
  *Done when:* a private readiness matrix identifies a concrete source and real
  independent reviewer or an explicit missing prerequisite for every route;
  previously tuned groups are listed as excluded from held-out evidence.

- [ ] **Step 2 - Freeze matching and understanding evidence.** Minimize actual
  observations into the existing dataset contracts, independently review labels
  before model exposure, and freeze disjoint tuning/held-out groups and relevant
  vocabularies. *Done when:* schema/group checks pass, review references are real,
  matching meets its corpus requirements, and understanding has at least 100
  observed held-out cases including 30 Hebrew/mixed. All four fields have
  independently supported labels or explicit abstain/unscored labels; supplied
  values and catalog guesses cannot count as accepted inferred answers.

- [ ] **Step 3 - Freeze shelf-life evidence.** Independently review observed
  policy selection inputs, applicability, storage facts and duration evidence.
  Separate required-generation examples and robustness fixtures from qualifying
  selection evidence. *Done when:* the frozen dataset validates, every reviewed
  policy label has an independent source and storage assumption, and the planned
  selection cohort can potentially yield at least 50 scored accepted selections.
  Registry days or generated answers alone are not ground truth.

- [ ] **Step 4 - Freeze historical stock and workflow evidence.** Prepare one
  consistent historical dataset and its workflow extension with cutoff-known
  snapshots, complete episodes and independently reviewed next-24-hour direct
  confirmations. *Done when:* both existing parsers validate; groups, confirmation
  references and episodes are disjoint as required; future facts never enter
  model input; censoring is explicit; workflow snapshots include projection,
  stored policy, pending groceries and threshold facts. The planned cohorts can
  potentially supply 50 scored accepted low/out outcomes and 50 scored surfaced
  recommendations, separately. Missing outcomes remain unscored.

- [ ] **Step 5 - Preflight and present concrete run packets.** Validate all frozen
  inputs without network calls, verify clean relevant sources and pinned versions,
  and prepare one reviewable proposal per run. *Done when:* each packet names
  dataset byte/content hashes and split, selected counts, exact tasks/models,
  revision, worst-case physical calls per provider including retries, timeout,
  command, cancellation procedure and fresh private output path. Workflow packets
  name isolated databases and the required eligible 37e report. No live request
  occurs before explicit approval of its concrete packet.

- [ ] **Step 6 - Collect matching and application evidence.** After the relevant
  paid approvals, run matching, understanding and policy evaluations separately
  with their frozen sources and bounds. *Done when:* authorized attempts retain
  complete or partial reports, failed/rejected outcomes, exact resolved models,
  request accounting and report hashes; matching/application report validators
  recompute metrics and bindings. Interrupted or insufficient runs remain pending
  for qualification; retries or replacement runs need a new concrete approval.

- [ ] **Step 7 - Collect historical stock evidence.** After its paid approval,
  run the existing 37e evaluator on the frozen history. *Done when:* the report
  is retained and reparsed against the same dataset, including baseline/final
  states, accepted low/out denominator, censoring, recall and slice counts. Its
  actual eligible/failed/inconclusive verdict is recorded. Workflow qualifying
  collection cannot proceed without the required eligible report binding.

- [ ] **Step 8 - Collect and replay workflow evidence.** After its paid approval,
  run actual materialization/advice/recommendation replay on a fresh isolated
  migrated database with the eligible stock report. *Done when:* complete live
  workflow evidence is retained; summary validation and independent zero-provider
  replay in another empty database agree exactly; final recommendation and paired
  baseline precision, publication safety, suppression, coverage and failures are
  recorded. Never use a production database or delete retained fixture evidence.

- [ ] **Step 9 - Assess launch gates and hand off.** Independently review validated
  reports and private provenance, then record one decision per route and all
  limitations. *Done when:* the evidence index binds each decision to frozen
  datasets, reviews, source/model/policy versions and reports; the existing gates
  are applied unchanged; failures and inconclusive results remain visible; the
  sanitized 38g handoff and final automated checks are complete. Missing required
  data or unfinished runs keep this feature pending, rather than narrowing scope
  silently or treating tooling completion as qualifying evidence.

## Files / areas

| Area | Purpose |
| --- | --- |
| Private operator-chosen evidence directory | Minimized datasets, original source references, review records, freeze manifests, paid proposals, recordings, reports and decisions; no committed private data |
| `evaluation/product-matching/README.md` and existing evaluator | Matching schema, labels, corpus checks and authoritative 37c report validation |
| `evaluation/application-inference/README.md` and existing evaluator | Understanding and shelf-life dataset contracts, budgets, replay and launch policy |
| `evaluation/stock-prediction/review-guide.md`, `workflow-review-guide.md` and existing evaluators | Historical cutoffs, stock gate, actual workflow validation and independent replay |
| `docs/jev-application-rollout.md` | Sanitized evidence status and prerequisites for 38g, without changing thresholds or enabling routes |
| `blueprint/context/current-feature.md`, `blueprint/.state/run.json` | Step progress and sanitized verification evidence |

No application code change is planned. If preflight exposes an implementation
defect, record it and review a focused repair through the normal workflow. Do not
silently extend this evidence feature into evaluator redesign.

## Data / contracts

### Frozen evidence bindings (load-bearing for 38g)

- Retain existing versioned JSON contracts and their validators. Matching uses
  `label.source=confirmed` only for actual sourced observations; understanding
  and policy use `source=observed`; stock/workflow use `source=historical` only
  with supported cutoff facts and episodes. Do not relabel authored fixtures.
- A private freeze manifest records artifact path, immutable version, raw byte
  SHA-256, evaluator dataset/input hashes, split, semantic-group exclusions,
  source references, label author, distinct actual reviewer, review times and
  freeze time. Review and freeze precede any held-out response exposure. Matching
  lacks a dataset-level freeze field, so preserve its freeze record externally.
- Source and run bindings include clean relevant revision, adapter/task/replay,
  launch-policy, registry and vocabulary versions, configured/resolved model,
  start/end times, completion, authorization reference and provider call counts.
  Hashes prove consistency, not source authenticity or independent review.
- All relevant changes invalidate affected evidence. Exposed held-out responses
  cannot tune a prompt and then qualify that same cohort. Any additional cohort
  or rerun is frozen and reviewed before new separately approved calls.
- Report decisions retain the evaluator's exact verdict/reasons plus independent
  review limitations and prerequisites. Exit 0, high confidence or a perfect
  mocked replay does not mean eligibility.

### Unchanged launch gates

| Route | Required denominator and quality |
| --- | --- |
| Matching, 37c | Corpus >=100 total cases, >=60 held-out, >=30 Hebrew/mixed across corpus, all required scenario tags in both splits; independent review; >=50 accepted held-out matches; >=98% precision; zero unsafe ambiguous/no-match selections |
| Understanding, application-launch-v1 | >=100 observed held-out cases, >=30 Hebrew/mixed; >=50 scored accepted inferred values and >=95% precision separately for category, type, unit and perishability; all four qualify for the shared selector |
| Shelf-life policy, application-launch-v1 | >=50 scored accepted held-out policy selections; >=98% correct applicable identity; independently supported duration/storage assumptions; zero unsafe applications; required-generation correctness/failures reviewed separately |
| Internal stock, 37e | Historical held-out evidence; >=50 scored accepted final low/out episodes; >=95% need precision; conservative confidence and deterministic precedence retained |
| Daily/manual workflow | Eligible 37e report tied to the same history, split, pin and clean revision; >=50 scored surfaced recommendations; >=95% need precision; no paired baseline precision regression; zero unsafe publication |

Every qualifying route additionally requires complete live held-out execution,
independent review frozen before the run, authentic source review, clean relevant
sources, one resolved JEV model matching the approved pin and zero operational
provider failures. Existing evaluator verdict precedence remains authoritative;
surface safety/accuracy failures even when missing prerequisites make a report
inconclusive. Safety fixtures with injected failures are separate robustness
evidence. Low acceptance cannot be repaired by lowering the runtime 0.90 gate.

Review language/scenario/product-type slices, recall, abstention, false positives,
household concentration and descriptive intervals. Slice overlap is not additive;
clustered observations and near-term confirmations limit generalization. A
current catalog export cannot replace observed operations or historical outcomes.

### Bounds and privacy

- Existing case/file caps apply; no silent truncation or unsupported pooling of
  partial cohorts to claim eligibility. Size datasets within existing limits.
- Matching/stock permit at most two TypeSafe HTTP dispatches per model decision;
  their CLIs do not accept global request/deadline flags. Name their exact
  selected-case bound, per-call timeout and supervised cancellation deadline in
  the approval packet. Do not pretend application CLI flags work on these CLIs.
- Application/workflow live CLIs enforce `--max-requests` (1-1000) and
  `--max-duration-ms` (1-1800000). Understanding allows two dispatches per missing
  field; policy selection two per operation; required generation one with SDK
  retries disabled. Include OpenAI calls explicitly; comparisons are not implicit.
- Workflow uses an empty loopback PostgreSQL database named
  `home_stock_eval_<run>_test`, with a separate empty database for independent
  replay. Required shelf-life generation is disabled in this stock-only replay.
- Keep private directories mode 0700 and files 0600; exclusive new output paths,
  no overwrite, no secrets or product names in public summaries. Avoid production
  reads/exports without a concrete authorized source scope. Minimize household
  identifiers, conversations and unrelated metadata. Unknown token usage stays
  unknown; no unverified cost claim.

## Testing

- This skill invocation writes a spec only. During implementation, preflight
  uses existing parsers, recorded fixtures and report validators without spending
  or mutating household data. Mocks prove wiring, not live accuracy.
- Use `npm run test -- --runInBand` for affected existing evaluation suites. Any
  approved logic repair must ship meaningful colocated Jest coverage for malformed
  inputs, split leakage, cutoff/censoring, zero denominators, bounds, partial runs
  and altered report bindings as applicable.
- `/check` reparses retained matching/application/stock reports and independently
  replays workflow observations in isolated PostgreSQL, then inspects exact gate
  counts and private provenance. A reviewer checks semantic independence and
  source authenticity, which validators cannot prove.
- Final gate: `npm run verify`, then `npm run contract:check` for the unchanged
  public contract. Run affected `npm run test:e2e -- --runInBand` suites only if
  a reviewed source repair changes application behavior, using isolated migrated
  test databases. No Browser tests command or browser-facing UI exists.
- Completion requires the private evidence packet and observable assessment,
  not just green automated checks. Failed qualification is reported honestly and
  prohibits that route's rollout; missing qualifying evidence stays pending.

## Notes for the AI

- This is server/operator evidence work. Preserve Nest/provider boundaries and
  existing public contracts; no model writes directly to persistent state.
- The 38e archive records tuning contamination and catalog overlap. Use its
  private manifests to check semantic exclusions rather than printing names.
  Stored catalog values and previous diagnostic permission are insufficient for
  qualifying labels or new paid runs.
- Do useful authorized preparation before requesting missing source/reviewer
  input. Ask for approval only after each paid proposal is concrete and reviewable.
  Do not fabricate data, reviews, success or approval when prerequisites are absent.
- Keep 38f and parent 38 unchecked until their actual completion criteria hold.
  Eligibility hands off to 38g; it never switches a selector automatically.
- Run `graphify update .` after any approved code change; spec-only edits do not
  require a graph rebuild. Never commit, push or deploy from this planning skill.

## Critique incorporated

- Defined acceptance denominators separately from input counts; 100 observations
  cannot guarantee 50 accepted values in each field.
- Bound workflow qualification to the same eligible historical report and added
  independent runtime replay, not only edited-summary validation.
- Added tuning contamination, pre-response freeze records, actual review ownership
  and historical censoring; current catalog metadata cannot stand in for truth.
- Kept existing verdict policies and thresholds intact, and separated injected
  failure fixtures, generation review and operational qualification.
- Made paid proposals a separate concrete approval gate and documented the older
  CLIs' different limits. Missing evidence keeps work pending; no rollout or
  evaluator redesign is folded into this spec.

## Step 1 source inventory evidence (2026-10-06)

- Resumed this spec through explicit Autopilot on
  `feature/38f-qualifying-jev-evidence`. Preparation covers committed corpora,
  the supplied catalog export and named prior task artifacts only. No production
  database was read and no provider request was made.
- Private mode-0700 directory `/private/tmp/38f-evidence-preparation/` contains
  mode-0600 `source-inventory.json`, `contamination-inventory.json` and
  `intake-and-review.md`. The inventory binds inspected artifacts to byte hashes;
  contamination records preserve prior response-exposed groups and catalog
  exclusion statuses for independent semantic review.
- Matching has 168 authored cases with no independent reviews. Application
  safety cases and diagnostic fixtures are authored; stock and workflow cases
  are authored rather than historical. These sources cannot establish live
  observed or historical accuracy.
- The supplied catalog contains 63 rows, including 49 exact overlaps with the
  prior tuning export. Four additional related variants were conservatively
  excluded in the previous intake, leaving ten possible new candidates and zero
  independently confirmed fields. Those candidates still need source/semantic
  review and cannot replace the four-field observed corpus or stock history.
- No qualifying source or actual independent reviewer was identified for any of
  the five routes. The private matrix explicitly records those missing
  prerequisites. The source question received an acknowledgment, not a source
  location, reviewer assignment or authorization for paid calls.
- Corrected the older private readiness note's matching minimum in the new
  inventory and sanitized rollout guide: shipped 37c uses 100 total cases and
  60 held-out, not 100 held-out. No threshold, model or runtime policy changed.
- Steps 2 through 9 remain unchecked. Next: identify authorized observed and
  historical sources and actual independent review ownership; resume dataset
  preparation before proposing any specific paid run.
- Verification: `npm run verify` passed 126 suites / 1950 tests and the production
  build; `npm run contract:check` passed six suites / 79 tests, 124 executable
  scenarios and bundle/documentation checks. Private permissions, artifact
  hashes, five missing source/reviewer assignments, 49 exposed tuning cases and
  14 new-candidate review statuses were checked. An initial intake assertion
  expected all 63 catalog rows; the prior intake actually stores only the 14 new
  candidates. Corrected the assertion against the intake's declared count and
  reran successfully. `git diff --check` passed.
- Effective regular Check, Audit and Try policies are manual, so none ran
  automatically. Independent review is not configured and no request/receipt
  exists. No findings are recorded; self-review found no application behavior
  changes. No code change required a graph rebuild. Autopilot permits the passing
  Step 1 checkpoint because checkpoint commits are enabled.

## Additional source intake (2026-10-07)

- User supplied six local `docs/home-stock-*.json` exports. The manifest identifies
  PostgreSQL as authoritative observed storage and reports no Redis container in
  the application stack. No remote access or source database mutation occurred.
- Declared collection counts agree with the files: 14 product confirmation
  operations, 75 inventory events, 13 grocery rows and 63 shelf-life policies.
  Event and operation IDs are unique and exported operation/event links resolve.
- Product operations are confirmation payloads, not original requests. Original
  entered names, pre-inference metadata, historical choice lists and resolution
  candidates are unavailable. The approval actor is not recorded. Submitted
  metadata is not independently verified truth or a recovered inference input.
- Inventory history contains 61 purchases and 14 stock sets, with no direct
  available/low/out confirmations or correction facts. Separate recording times
  are unavailable; the manifest does not attest that the stored timestamp is an
  occurrence time. Historical product and household configuration is unavailable.
  This cannot supply the required cutoff-safe confirmed-outcome episodes.
- Shelf-life evidence contains 63 OpenAI policies, zero independently verified
  durations, no expiration batches and no recorded storage/purchase-form facts.
  Current grocery/settings rows cannot establish historical cutoff snapshots.
- The manifest also lists `home-stock-stock-projections.json` with 63 current
  rows; that file was not present among the supplied local exports. Even current
  projections would not recover missing historical snapshots or outcome labels.
- Private assessment and a 14-record source-fact review packet are retained under
  `/private/tmp/38f-evidence-preparation/intake-20261007/` (directory 0700, files
  0600). `source-assessment.json` binds each export to its byte SHA-256;
  `product-confirmation-review.json` retains source facts with reviewer/time
  unset and no verified fields. These are intake artifacts, not frozen evaluation
  datasets. Independent review remains pending.
- Added exact private export paths to `.gitignore`, including the manifest-listed
  projection export. No private source contents are staged or committed.
- Steps 2 through 9 remain pending. Genuine source data now exists, but the
  necessary request traces, historical knowledge times, direct outcomes and
  independent duration evidence remain missing. A separate authentic source or
  prospective collection is needed; review cannot reconstruct unrecorded facts.
- Validation for this documentation/intake change: JSON structure, declared
  counts, unique IDs, operation/event links, private permissions, retained hashes,
  ignore rules and `git diff --check`. Application code is unchanged; no additional
  model calls, runtime enablement, tests, checkpoint commit or graph rebuild.

## Synthetic diagnostic preparation (2026-10-07)

- User explicitly requested a large generated classification test. Prepared 240
  authored cases before exposing any responses: 216 language variants of 72
  product families, eight unidentified inputs, eight misleading-instruction
  controls and eight fully supplied preservation controls. Language totals are
  84 English, 84 Hebrew and 72 mixed. Variants are correlated, not independent
  household observations. These are new authored examples, not copied catalog
  values or JEV-generated answer keys.
- Tests cover category, product type, typical unit and perishability. Acceptable
  type alternatives are listed before execution; frozen-food perishability is
  unscored because the definition does not settle prolonged frozen storage.
  Explicit unit clues make references checkable but simplify the unit task.
  Reference labels are author-generated and independent review is pending; a
  diagnostic score is agreement with those references, not verified truth.
- Three immutable 80-case datasets and a reference table are private under
  `/private/tmp/38f-synthetic-diagnostic-v1/`. `review.md` lists all expected
  answers. `paid-run-proposal.json` binds dataset byte/content/input hashes,
  configured JEV pin `jev-1.13.0`, adapter/version, revision, output paths and
  bounds. Only actual runtime-shaped input, never expected labels, reaches JEV.
- Offline validation passed through the existing dataset parser, runtime choice
  builder and worst-case budget calculator. All scored labels are representable
  by runtime choices, IDs are unique, byte hashes match and local private model
  configuration is present. No network requests were made.
- Maximum physical dispatches including retries: 624, 624 and 608 TypeSafe
  requests, 1856 total; zero OpenAI. Each batch has a 15-minute ceiling and fresh
  output path, at most 45 minutes total. The 928 logical classification calls
  exercise four missing fields; eight fully supplied controls should call no
  model. No automatic rerun or model/prompt tuning is included.
- Next: obtain explicit approval of the concrete bounded diagnostic, then run
  actual JEV, retain failures/partial reports and independently reparse outputs.
  Report accepted precision, correct-answer recall, abstention/low confidence,
  provider failures, language/scenario slices and safety controls. Do not let
  high abstention masquerade as classification success. Preserve unknown usage
  and avoid unsupported monetary estimates.
- This diagnostic leaves qualifying Steps 2 through 9 pending and changes no
  selector, threshold, application source or production data. No new checkpoint
  or graph rebuild is needed for this preparation.

## Approved product-type repair

The user approved the documentation-based proposal with "ok do it." This adds
one focused prompt repair to the active feature; it does not relax rollout gates.

- [x] **Repair R1 - Defined product-type question.** Supply natural-language
  definitions, examples and explicit precedence for household, fresh/short-lived,
  discrete portions and pantry foods; permit ordinary product knowledge, preserve
  unknown and avoid invented household facts. Omit the target and null supporting
  metadata from type evidence. Version the adapter and type question. *Done when:*
  transport tests prove revised instructions/criteria reach only the type question,
  supplied type bypasses calls, false supporting evidence is retained, target
  leakage is absent, malformed/failure/low-confidence outcomes stay unresolved,
  0.90 gates and other field payloads remain intact, focused tests and Verify pass.
- [x] **Repair R2 - Comparison proposal.** Bind the existing frozen 240-case
  synthetic inputs and reference labels, retained v2 baseline reports and repaired
  v3 source/request definitions to a new concrete paid proposal. *Done when:*
  hashes, versions, call/retry ceilings, deadlines and fresh outputs are specified;
  no further call occurs before approval of that packet. Compare both accuracy
  and accepted coverage; these exposed synthetic cases are diagnostic/tuning
  evidence rather than independent held-out qualification.

Scope remains one prompt repair. Category threshold tuning, transport validation
changes and multi-question batching are deferred. Keep old recordings/reports
with their original versions; create a newly bound mocked fixture for v3 rather
than rewriting historical evidence.

## Completed live synthetic diagnostic (2026-10-07)

- User approved all prepared bounds with "Do what you need to do." Private
  `approval.json` binds that instruction to the exact proposal byte hash. Ran
  three independent 80-case CLI processes within their separate 15-minute and
  request limits; total authorized maxima stayed 1856 JEV / zero OpenAI and
  45 minutes. No rerun or additional provider request was made.
- Commands used the existing `scripts/evaluate-application-inference.ts` CLI
  through `node --env-file=.env -r ts-node/register`, task `product_understanding`,
  split `held_out`, exact frozen `batch-1.json` through `batch-3.json`, request
  ceilings 624/624/608 and `--max-duration-ms 900000`. New private output paths
  are `batch-1-live-report.json` through `batch-3-live-report.json` in the prepared
  diagnostic directory. Credentials were not printed or copied into artifacts.
- All 240 cases completed. Actual physical TypeSafe requests were 312/312/304,
  928 total, zero OpenAI. Every successful response resolved to `jev-1.13.0`.
  Five `invalid_response` outcomes remain retained, not silently retried or
  excluded from the performance report.
- Accepted correct/scored accepted: category 116/116, type no accepted answers,
  unit 209/209 and perishability 205/205. Correct accepted/answerable targets:
  category 116/224, type 0/224, unit 209/224 and perishability 205/206. High accepted
  precision therefore conceals an important type/coverage problem.
- Type outcomes: 178 unknown, 53 low-confidence and one unavailable. Category
  had 105 low-confidence rejections, eight unknown and three unavailable;
  raw scored category agreement was 227/229 including the unknown controls.
  The diagnostic establishes these behaviors, not why they occur. Do not assert
  that missing type definitions caused them without a separate investigation.
- Eight unidentified controls abstained in all fields. Eight fully supplied
  controls preserved all values and issued no calls. No accepted reference
  disagreement or scored safety violation occurred. Frozen-food perishability
  remains unscored and expected labels remain independently unreviewed.
- `parseReport(report, dataset)` independently replayed actual recorded transports
  through runtime adapters, recomputed counts/slices/verdicts and passed for all
  three reports. Additional raw-choice analysis matches field request hashes to
  the exact runtime-generated requests; it makes zero network calls.
- Private `validated-summary.json` and `results.md` retain aggregate metrics,
  language/scenario slices, all reference disagreements, abstention and failures.
  `completed-artifacts.json` binds reports, approval, references and summaries to
  final byte hashes. Permissions, resolved model, completion, physical bounds,
  failure counts and preservation checks passed. `git diff --check` passed.
- The requested synthetic diagnostic is complete. The qualifying feature remains
  in progress with Steps 2 through 9 pending; no rollout gate is passed. The next
  useful separate repair is to investigate product-type choices and category
  acceptance before proposing a new frozen diagnostic or any threshold change.
  Further paid calls require a new concrete approval. No source change required
  additional unit/build tests, a checkpoint commit or graph rebuild; previous
  Verify and contract evidence covers unchanged application code.


## Product-type repair comparison (2026-10-07)

- Latest user instruction "ok do it" approved the proposed prompt repair and
  comparison. New private proposal and approval bind the unchanged 240 inputs,
  reference labels, baseline and v3 source. Same bounds: 1856 maximum TypeSafe
  requests, zero OpenAI, three 15-minute batches; no automatic reruns.
- Two batches retain validated reports: 160 cases, 616 actual TypeSafe requests,
  zero OpenAI, six provider failures and zero scored safety violations. Offline
  replay and raw request-hash matching passed. On those exact paired cases,
  accepted correct type answers increased from 0/149 targets to 130/149 (87.2%);
  all 130 accepted type answers match authored references. Raw scored type
  agreement is 153/154, including five expected abstentions.
- Batch 1 exited unsuccessfully during report validation and left an empty
  report. Its observations, exact validation cause and actual request count are
  unavailable; its physical bound was 624. Exclude its 80 cases from all paired
  metrics. Do not report the comparison as complete or attribute a specific
  validation cause without retained evidence.
- Comparison and detailed metrics are private at
  `/private/tmp/38f-synthetic-type-repair-v1/comparison.md` and
  `validated-summary.json`. This is synthetic tuning evidence, not independent
  real-world qualification. No acceptance thresholds or rollout settings changed.
- [x] **Repair R3 - Retain failed validation candidates.** Preserve a normalized
  candidate report in the already exclusive private output when post-run
  validation fails, marked `validation: failed`, then rethrow. Successful report
  shape and strict validation remain unchanged. A mocked live CLI regression
  proves retained observations/request counts, private permissions and absence
  of error details. No provider calls are needed for this repair.
- A fresh concrete 80-case rerun proposal is prepared at
  `/private/tmp/38f-synthetic-type-repair-v1/batch-1-rerun-proposal.json`:
  624 maximum TypeSafe requests, zero OpenAI, 15 minutes, unchanged references,
  fresh exclusive output, no automatic reruns. Approval was requested; no rerun
  occurs while that answer is pending.

- Repair validation: `npm run verify` passed 127 suites / 1965 tests and the
  production build; `npm run contract:check` passed six suites / 79 tests and
  124 scenarios. Isolated local product-understanding and enrichment end-to-end
  tests passed two suites / 19 tests. The mocked v3 CLI replay passed nine cases
  with inconclusive launch evidence. Graphify AST update and `git diff --check`
  passed. Manual Check/Audit/Try policies did not trigger automatic gates; prior
  audit evidence does not cover this new repair and no independent review is
  claimed. Qualifying 38f Steps 2 through 9 remain pending.


## Approved missing-batch rerun completed (2026-10-07)

- User explicitly replied "approve" to the bounded 80-case rerun. Private
  `batch-1-rerun-approval.json` binds that instruction to the exact proposal hash;
  source and dataset hashes and fresh output were verified before networking.
- The rerun completed 80/80 cases: 312 actual TypeSafe requests, zero OpenAI,
  resolved model `jev-1.13.0`, within 624 requests / 15 minutes. Its validated
  report is `batch-1-rerun-live-report.json`; initial empty report is preserved.
- All 240 paired cases are now retained and independently replayed offline.
  Accepted correct/answerable targets: category 113/224 (baseline 116/224),
  product type 205/224 (baseline 0/224), unit 211/224 (baseline 209/224),
  perishability 205/206 (baseline 205/206). All scored accepted answers match
  authored labels. Eight unknown controls abstain and eight supplied controls
  preserve values. Six provider failures remain in the reports; zero scored
  safety violations. Other field prompts and acceptance thresholds are unchanged.
- Reports used for scoring total 928 TypeSafe requests and zero OpenAI. The
  initial failed attempt adds an unknown number of requests, at most 624:
  total repair-comparison requests are 928-1552, within the combined authorized
  ceiling of 2480. Do not claim the lost attempt cost zero or an exact total.
- Final artifacts are private `comparison-complete.md`,
  `validated-summary-complete.json`, `paired-comparison-complete.json` and
  `completed-comparison-artifacts.json` under the existing repair directory.
  Partial artifacts remain preserved. The synthetic comparison is complete;
  qualifying feature Steps 2 through 9 and actual independent label review remain
  pending. Category acceptance remains about 50% despite high raw agreement;
  investigate acceptance separately before proposing any threshold change.
- No application source changed during this rerun; prior passing Verify,
  contract, E2E and graph evidence still covers checkpoint `a5bacf2`. No repeated
  paid calls, rollout change, merge, push or deployment occurred.


## Approved category repair and real-request collection package

User requested "Let's do both" after the proposal to improve the category prompt
and prepare collection instructions for the server-side agent. This authorizes
local source, tests and collection artifacts. Production collection changes,
remote messages, fabricated observations/reviews and new paid model calls are
not included. Keep runtime acceptance and launch thresholds unchanged.

- [x] **Repair R4 - Category question.** Add descriptive definitions and boundary
  guidance for exact canonical seed categories, with the established opaque
  token mapping. Preserve all custom labels and use their literal category
  meaning without assigning invented canonical definitions. Remove category
  target/null fields from supporting evidence, preserve explicit false, version
  the question and adapter, and leave unit/type/perishability requests unchanged.
  Done when mocked transport proves the prompt/criteria, target-free context,
  custom vocabulary semantics, supplied bypass, byte/option limits, unknown,
  injection/failure handling and unchanged 0.90 gates; current mocked recording
  is newly bound and old versions remain rejected; Verify and contracts pass.
- [x] **Repair R5 - Real-request collection package.** Provide durable server-agent
  instructions, a strict input snapshot JSON Schema and independent label review
  worksheet. Aim for >=100 fresh original requests, >=30 Hebrew/mixed, with
  pre-inference metadata/options and provenance. Explain that >=50 scored accepted
  answers per field are also required, so input count alone cannot qualify. Mark
  unsupported snapshots missing instead of rebuilding them from confirmations.
  No real reviewer or observed record may be invented. Done when templates are
  usable, reviewed for privacy/label separation and schema-validated locally;
  collection and actual review remain pending external input.
- [x] **Repair R6 - Frozen category comparison proposal.** Prepare exact same
  240 synthetic cases and existing v3 completed baseline, revised v4 code hashes,
  fresh output paths and bounded physical calls. Keep thresholds unchanged and
  mark exposed authored references as tuning diagnostics. Done when offline
  validation/bindings pass and a concrete paid-run packet is presented for new
  explicit approval; no paid request before that approval.


### Category repair and collection package verification

- Revised category question `category-question-v2` integrates into adapter v4.
  Fourteen new category tests cover wire payload, exact seed definitions and
  custom-label preservation, target omission, supplied bypass, false evidence,
  option/byte limits, low-confidence/unknown/invalid/network outcomes and text
  separation. Existing v1/v2/v3 mocked recordings remain immutable and are
  rejected by current bindings; a newly bound mocked v4 fixture replays offline.
- Initial transport tests detected copied state with an incompatible object
  prototype in the Jest runtime. The category helper now returns its own
  validated primitive-only supporting state; strict transport validation remains
  unchanged. Focused five suites / 57 tests passed after the repair.
- `npm run verify` passed 128 suites / 1980 tests and production build.
  `npm run contract:check` passed six suites / 79 tests and 124 scenarios.
  Isolated local understanding/enrichment E2E passed two suites / 19 tests.
  Offline v4 CLI replay completed nine cases with inconclusive launch evidence.
  Graphify AST update and `git diff --check` passed. Manual regular Check/Audit/Try
  policies were not run automatically; no independent review receipt is claimed.
- Durable collection package: `docs/jev-real-request-collection/README.md`,
  server-agent task, request snapshot JSON Schema, explicitly empty scaffold and
  independent review CSV headers. JSON Schema compiles and accepts valid sample
  shape while rejecting post-inference capture, malformed timestamps, prediction
  fields and incomplete metadata. Samples were in memory only; no observed data
  or reviewer was fabricated. Actual export, prospective collection and review
  remain external inputs. Server changes/messages/deployment were not performed.
- New paid-run proposal is private at
  `/private/tmp/38f-synthetic-category-repair-v1/paid-run-proposal.json`.
  Preflight validates all 240 unchanged cases and reference hashes, 84 English /
  84 Hebrew / 72 mixed, v4 question mappings and 624/624/608 worst-case dispatch
  ceilings. Combined maximum is 1856 TypeSafe, zero OpenAI and 45 minutes
  (15 per batch), with exclusive new outputs and no automatic reruns. Completed
  v3 baseline reports/summary match their retained artifact hashes. Source hashes
  are pinned. Preparation and mocked checks made zero provider requests.
- Category improvement is unmeasured until that separately approved comparison
  runs. Canonical descriptions do not define arbitrary custom categories. This
  remains tuning evidence; feature 38f real-data Steps 2 through 9 are pending.


### Approved category comparison completed

- User replied "approve" to the concrete 240-case packet. Private approval binds
  its exact byte hash; source, dataset and completed baseline hashes were checked
  before calls. Three independent capped live CLI batches completed all 240 cases,
  with 312/312/304 actual TypeSafe requests, 928 total and zero OpenAI, within
  624/624/608 dispatch caps and each 15-minute deadline. No retries beyond the
  bounded runtime policy or automatic reruns were launched.
- All successful responses resolved to `jev-1.13.0`. Offline `parseReport`
  replayed all normalized calls against exact v4 requests and recomputed metrics;
  reference datasets and v3 baseline artifact hashes remain unchanged.
- Category accepted correct/answerable improved from 113/224 (50.4%) to 219/224
  (97.8%), with 219/219 scored accepted correct. Raw scored agreement is 230/230,
  including eight unknown controls. English: 75/76 correct accepted; Hebrew:
  72/76; mixed: 72/72. All eight supplied controls preserve their values and issue
  no calls. Three category responses remain low confidence; two category provider
  failures remain retained and counted. Zero scored safety violations.
- Other fields: type 205/224 (unchanged from v3), unit 215/224 (previous 211/224),
  perishability 205/206 (unchanged). All scored accepted answers match authored
  references. Thresholds and non-category prompt semantics were unchanged; any
  other-field variation is not proof that those prompts improved.
- Final private comparison, detailed metrics, paired transitions, language/scenario
  slices and byte-hash manifest are under
  `/private/tmp/38f-synthetic-category-repair-v1/`: `comparison-complete.md`,
  `validated-summary-complete.json`, `paired-comparison-complete.json` and
  `completed-artifacts.json`. No labels, baseline files or failed responses were
  silently rewritten or discarded.
- The exposed synthetic diagnostic is complete and supports the category prompt
  repair; it is not independently reviewed real-world held-out evidence. Real
  server-side request snapshots and actual independent label review are still
  needed from the durable collection package. No server collection, remote
  message, threshold change, merge, push, deployment or rollout occurred.
- Application source remained unchanged after checkpoint `23d32f1`. Prior passing
  Verify (128 suites / 1980 tests and build), contract, E2E and graph checks cover
  that code. No repeated code test run was needed for this data-only evaluation.
  Feature 38f Steps 2 through 9 remain pending.

### Hermes SSH retry and private historical intake

- The user requested another connection attempt. Saved Hermes VM SSH access now
  works. Read-only SQLite inspection found original stock tool arguments nested
  in stored tool-call wrappers; no credentials or conversational messages were
  exported. No server application/configuration/data changes or model calls occurred.
- Private export retains 85 distinct source argument records: 67 grocery-add
  attempts, 17 grocery confirmations and one inventory confirmation. Stored call
  identifiers match 58 execution results: 45 grocery additions and 13 confirmations.
  Unmatched attempts remain explicit and confirmation values are not ground truth.
- Export, SHA-256 source manifest, intake summary and an unscored review worksheet
  are under `/private/tmp/38f-real-source-access-v1/`. They recover original product
  name arguments but do not establish backend request-time category/unit choices
  or complete pre-inference metadata. Zero records qualify as scored snapshots.
- Remaining evidence requirements are contemporaneous backend snapshots, fresh
  held-out requests and actual independent label review. SSH authentication is no
  longer the blocker. Feature 38f Steps 2 through 9 remain pending.

### Authorized prospective capture preparation (2026-10-07)

The user requested “DO IT” after the historical intake identified missing backend
snapshots. Prepare a local, opt-in pre-inference capture patch using the existing
private diagnostic table. This is a scoped exception to runtime-code exclusion
for evidence collection; it does not enable JEV routing or authorize deployment.

- [x] **R7 - Exact prospective understanding capture.** Save the exact adapter
  input before calling the selected provider, with a unique source ID and UTC
  capture time, only when explicitly enabled. Capture failures must preserve
  inference behavior. No inferred metadata, labels or semantic groups. Document
  private export and deployment handoff, prove ordering/failure behavior and run
  Verify. Production installation requires backend administrator access.

R7 implementation evidence: opt-in collector stores exact input in the existing
private LlmInferenceLog table before provider dispatch. Unique UUID/time identifies
the source; supplied false/null and original strings are retained. Capture failures
emit only a fixed warning and classification proceeds. Configuration defaults false;
Compose forwards the flag. Backend-capture.md documents installation and a bounded
read-only PostgreSQL export with UTC window, explicit truncation and no invented
labels/groups. The collector remains disabled until installed and explicitly enabled.

Verify passed (129 suites, 1988 tests, production build); contract check passed
(6 suites, 79 tests, 124 scenarios); database-free app/auth E2E passed (2 suites,
7 tests). Full E2E was attempted but PostgreSQL is unavailable and the workflow
suite lacks EVALUATION_DATABASE_URL, so it was stopped (exit 130), not marked
passing. Graph updated (6462 nodes, 433 communities); diff check passed.

Hermes configuration identifies the live backend. Authenticated /health and /ready
reads returned 200. Existing Hermes root SSH identity was denied by the backend
host. No server change occurred. Private install patch and source hashes are under
`/private/tmp/38f-backend-capture-install-v1/`. Installation awaits a valid
administrator access method requested from the user. Zero production captures,
zero model requests, no rollout or deployment. Feature 38f Steps 2-9 remain pending.

### Product-classification trial deployment handoff (2026-10-09)

The user clarified that more observed requests are unavailable and requested a
complete server-agent guide for a limited classification trial supported by the
synthetic diagnostic. Collection remains optional for that proposed trial; the
formal real-world launch gates remain inconclusive, not silently passed.

`docs/jev-product-classification-trial.md` documents docker-compose.env values,
app.environment forwarding, registry/digest verification, existing-volume and
credential preservation, migrations, recreate/readiness checks, ordinary-use
review and selector rollback. No deployment or paid probe was executed.

GitHub main/publishing inspection found main at
`187f7860e99eaa66c08df27422993fe2fefc14ef`, older than tested repairs a5bacf2 and
23d32f1. The guide explicitly stops enablement unless the pulled image has the
approved published revision and jev-product-understanding-v4. Release Compose
currently omits JEV environment forwarding; the guide supplies the exact block.
Its eight shell blocks pass sh -n; the local built adapter reports v4. No source
changes or repeat unit run were required for this documentation handoff.

### Authorized publication of completed classification repairs

The user explicitly approved finishing wiring, verification, commit, merge, push
and image publication. This delivers the completed synthetic-tested repairs and
optional capture/trial preparation. It does not mark missing independently
reviewed evidence complete or install/restart a production backend. Steps 2-9
and 38f/38g formal launch qualification remain pending.

- [ ] R8: Forward all task selectors, advice flag and optional TypeSafe key/model
  into both Compose app services while preserving default OpenAI startup; verify
  absent/present env-file settings; publish tested repairs to main and verify CI.

Final release preparation verified on 2026-10-09: npm run verify (129 suites,
1988 tests/build), contract check (6 suites, 79 tests, 124 scenarios), app/auth
E2E (2 suites, 7 tests) and both real Compose configuration checks passed.
The completed delivery is recorded in
`blueprint/history/fixes/jev-classification-trial-preparation.md`; formal 38f
evidence is deliberately retained pending rather than archived as achieved.
The user authorized publishing these finished repairs and trial configuration.
