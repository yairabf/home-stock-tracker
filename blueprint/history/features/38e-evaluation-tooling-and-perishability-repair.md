# Feature: Evaluation tooling and perishability repair

**From build-plan:** feature 38e, under 38, JEV-first application inference
**Status:** verified
**Branch when implementing:** `feature/jev-application-evaluation-rollout`
**Current review target:** Revised 38e verified; completion handoff
**Approach reference:** [JEV Stock Tracker Fix Approach](../../docs/JEV_Stock_Tracker_Fix_Approach.md)

The user approved this scope split on 2026-10-06. Feature 38e delivers the
implemented evaluation tooling and versioned perishability repair, including the
completed diagnostic comparisons. Broader qualifying evidence moves to 38f;
operator-approved runtime enablement and rollback verification move to 38g.
All existing evidence and launch requirements are retained. Historical notes
below describe the original scope; their references to pending Steps 8 and 9
now refer to deferred 38f and 38g, not unfinished requirements of 38e.

## Goal

Deliver reproducible private evaluation tooling for the shipped JEV routes and
repair excessive perishability abstention with a precise, versioned question.
Preserve actual adapter acceptance, supplied metadata, independent task routing
and private diagnostic evidence. Completion establishes the implementation and
its observed diagnostic behavior; it does not establish rollout eligibility.

Follow the approved [detailed plan](feature-plans/jev-first-application-inference.md).
Existing 37c matching, 37e stock and all per-task launch gates remain prerequisites
for the separately tracked 38f evidence and 38g enablement work.

## In scope

- A focused, versioned perishability question, explicit three-choice definitions,
  target-free evidence and unchanged runtime acceptance; evaluate whether the
  request repair improves correct raw classifications before claiming usefulness.
- Private diagnostic request capture and paired baseline/revised metrics for
  perishability, including small option-order and language controls. Reuse the
  current transport and actual runtime adapter; no production experimentation.
- Private CLI evaluation for product category, type, unit, perishability and shelf-life policy selection using the actual 38b/38c adapters and application acceptance rules.
- Versioned authored safety fixtures, independent label-review instructions, frozen tuning/held-out datasets, validated offline recordings and bounded opt-in live execution.
- Per-field accuracy, acceptance, abstention, coverage, routing correctness, latency, provider failures and observed usage; separate deterministic, JEV and generation contributions.
- Cutoff-safe evaluation of final materialized stock recommendations alongside the existing 37e advisor metrics, using the 38d application workflow and recommendation filters.
- Per-task evidence assessment, configuration/restart/check documentation and local dual-provider and rollback verification. Runtime enablement is deferred to 38g.
- Documentation of unsupported required generation, safe failure behavior and retained historical provenance.

## Out of scope

- Broader independently reviewed qualifying live evidence (38f), runtime enablement, deployment and operator rollback verification (38g). Small catalog diagnostics do not replace these requirements.

- Changing acceptance thresholds, expanding category/unit vocabularies or shelf-life identities/durations. The explicit Step 7a-7e perishability request repair is the sole scoped exception to leaving decision definitions unchanged; it invalidates earlier understanding evidence and requires fresh evaluation. Threshold calibration is deferred, not implemented by this amendment.
- Catalog reclassification, alias generation, policy backfill, automatic grocery writes or WhatsApp notifications.
- A new dashboard, public evaluation/configuration endpoints, schema migration, generic evaluation framework, new provider or statistical engine.
- Unbounded paid calls, production data extraction, automatic deployment, remote configuration edits, push or publishing without separate authorization.
- Claiming savings from missing usage, vendor benchmarks or assumed prices; a monetary report needs an explicitly versioned price table and measured usage.

## Build loop

1. Lay out one step before editing code.
2. Implement that step with tests for its logic.
3. Show its diff and observable done-when evidence.
4. Wait for review before the next step; checkpoints require permission and passing checks.

Use `/complete` after the revised implementation steps and final local checks pass. The user explicitly approved the scope split; completion of 38e does not complete 38f/38g or authorize any provider call, configuration change or deployment. Preserve inconclusive reports and all deferred launch prerequisites.

## Build steps

- [x] **Step 1 - Freeze evaluation contracts and authored cases.** Add strict version-1 task datasets and recorded/report schemas, proposed launch policy and reviewer instructions. *Done when:* invalid/oversized input, duplicate cases, overlapping semantic groups, invalid labels and inconsistent review timestamps are rejected; the corpus covers the scenario matrix below; authored evidence is always launch-inconclusive. Schema/partition logic ships focused tests.
- [x] **Step 2 - Product-understanding replay.** Run the actual JEV understanding adapter through injected validated recorded transport; collect supplied versus inferred per-field outcomes without catalog writes. *Done when:* Hebrew/English/mixed and ambiguity cases reproduce runtime choices and acceptance; supplied fields issue no corresponding call, names stay unchanged, unknown perishability stays null, and all attempts are counted even when another field fails. Mapping and runner tests pass.
- [x] **Step 3 - Shelf-life replay and generation routing.** Run the actual policy adapter with recorded JEV and generation boundaries, plus isolated application bypass checks. *Done when:* reviewed applicable policy IDs supply their own durations; ambiguous/missing storage abstains; only locally established required finite-policy gaps generate once; explicit dates and stored policies bypass inference; low confidence/failure never generates. Scoring distinguishes selection from applied policy and tests these paths.
- [x] **Step 4 - Metrics and independently validated reports.** Score accepted metadata fields and policy identities, abstention, errors, safety violations and usage; recompute summaries and verdicts from bound observations and datasets. *Done when:* edited summaries, mismatched hashes, missing/duplicate observations, model/version mismatch and forged denominator values fail validation; zero denominators yield null; incomplete/offline/unreviewed evidence cannot qualify. Unknown generation tokens/model resolution stay explicitly unknown.
- [x] **Step 5 - Bounded private CLI.** Add `eval:application-inference` using the existing CLI conventions with `--task product_understanding|shelf_life_policy`, dataset/split/output, exclusive recorded or live mode, and mandatory live request limits. *Done when:* offline mode makes zero network calls; all inputs, credentials and budgets validate before networking; cancellation preserves a partial inconclusive report, request limits include per-field calls and generation retries, output uses exclusive creation and mode 0600, and stdout contains only safe aggregate counts. CLI tests demonstrate exhausted budgets and failed provider requests.
- [x] **Step 6a - Workflow evidence contracts and scoring.** Add a versioned extension to the existing cutoff-safe stock dataset for cutoff-known projection/policy/pending-list facts. *Done when:* future or contradictory snapshots fail validation; final surfaced-recommendation precision/recall and paired baseline metrics preserve censored/unscored denominators; 37e semantics remain unchanged; focused contract/scoring tests and Verify pass.
- [x] **Step 6b - Real runtime workflow replay.** Add a bounded private workflow CLI that runs actual Nest daily materialization, guarded advice publication and recommendation selection against an empty isolated migrated PostgreSQL database. *Done when:* the database guard rejects production/nonempty targets; input/recording bindings validate before provider calls; output distinguishes baseline, accepted advice, publication and final recommendation; inference is absent on reads and repeat unchanged evaluation; budget/cancellation and private outputs follow the application CLI contract. No production persistence or automatic data deletion.
- [x] **Step 6c - PostgreSQL workflow evidence.** Exercise the evaluator with recorded transports and retain reproducible reports. *Done when:* pending groceries, confidence threshold, direct signals, expiration, zero history, stale revisions and repeat evaluation behave exactly as runtime; future confirmations are excluded from provider input; focused E2E checks and Verify pass. Authored reports remain inconclusive; live historical evaluation is deferred to 38f.
- [x] **Step 7 - Local dual-provider and rollback proof.** Exercise real Nest DI/configuration with mocked transports and isolated PostgreSQL fixtures. *Done when:* each task selector can switch independently; OpenAI generation remains configured; disabled stock workflow advice followed by evaluation restores deterministic projections; rollback preserves events, policies, predictions and attempt logs; reads and readiness issue zero inference. Verify, contract checks and affected REST/MCP E2E suites pass.
- [x] **Step 7a - Freeze the diagnostic and baseline contract.** Define product-level perishability, verify the recorded pilot's bindings and reconstruct a few baseline requests from revision `21a7a6d` before any code change. *Done when:* an immutable private baseline bundle matches recorded request hashes and selected IDs/order; known facts, label review scope and ambiguous cases are explicit; a versioned comparison schema and mocked validation tests reject changed inputs/versions/order, missing rows and fabricated review. Existing private 49-case evidence remains tuning-only and is not overwritten.
- [x] **Step 7b - Dedicated perishability evidence and question.** Add a focused evidence/question helper, explicit criteria and a dedicated instruction used only for `isPerishable`. *Done when:* neither the target key nor its null/hidden value reaches model evidence; only genuinely supplied supporting fields are included; ordinary product knowledge may interpret Hebrew names, but household conditions cannot be invented. Tests capture the dispatched request, verify balanced definitions and show category/type/unit evidence, choices and instructions unchanged. Supplied true and false still bypass inference; thresholds remain 0.90. Adapter/question version bump and a newly mocked fixture accompany the changed request atomically; preserve the v1 fixture.
- [x] **Step 7c - Version binding and runtime regression proof.** Prove the versioned adapter from Step 7b preserves ports, result shapes and persistence behavior. *Done when:* request and attempt provenance identify the revised definition; old records fail current-version binding rather than being relabeled; the newly mocked v2 authored fixture replays through the revised request while the preserved v1 fixture fails current binding. Unknown, low confidence, provider failure, malformed output and required-generation routing stay distinct. Focused unit and isolated PostgreSQL preservation/read/confirmation checks, Verify and contract checks pass.
- [x] **Step 7d - Private comparison capture and metrics.** Add focused evaluator capture/comparison helpers and a thin bounded command. *Done when:* exact normalized requests and ordered choices are bound to validated responses, models, code and dataset; raw substantive correct/wrong choices and unknowns are separate from accepted precision/coverage and failure counts. Null denominators remain null. Offline tampering, unequal case pairing, model/input mismatch, duplicate variants and deadline/budget exhaustion tests pass; representative offline output is private and inconclusive.
- [x] **Step 7e - Controlled diagnostic comparison and decision.** Prepare the concrete paid-run packet and run only separately authorized comparisons. *Done when:* a private per-case report pairs the frozen 49-case baseline and revised production request, plus a reviewed small clear/ambiguous diagnostic set with option rotations and equivalent-language controls; the same pin, supporting evidence, labels and 0.90 gates apply. Each variant's requests/retries fit the approved global budget. Report gains, errors, incorrect acceptance, ambiguous-case abstention and order/language disagreements without selecting a launch winner from tuning data. If authorization or reviewed diagnostic labels are missing, this step remains pending. No automatic rollout or further tuning loop.

- [x] **Step 8 - Finalize the approved scope split and local handoff.** Align the build plan, detailed plan, overview and rollout guide; retain diagnostic reports and deferred prerequisites. *Done when:* 38f/38g are separately tracked, no broader gate is marked passed, Verify and contract checks pass, the findings/review ledgers are checked and the final review packet records manual quality-gate policies.

## Deferred follow-up requirements

The following original requirements remain unmet and are retained for follow-up
specs, rather than being checked off or removed from the product plan:

- **38f (original Step 8) - Collect and review qualifying evidence.** Freeze independently reviewed datasets and exact source/model/policy versions, then run separately authorized bounded live evaluations. *Done when:* a private evidence packet records datasets, review references, complete reports, denominators, slices, failures, baseline comparisons and per-task eligible/failed/inconclusive decisions. Matching reuses 37c; stock requires both 37e and final-recommendation evidence. Retain failed/inconclusive reports; neither permits enablement. If qualifying evidence is unavailable, this step remains pending.
- **38g (original Step 9) - Enable validated tasks and verify rollback readiness.** Present the exact task configuration diff and approved runtime target for separate operator approval, then apply only authorized qualifying routes and restart through the existing deployment process. *Done when:* readiness and approved representative flows pass, observed provenance matches reviewed pins, deterministic/read bypasses remain intact, and each task has a recorded rollback procedure and previous configuration. Paid post-restart flows need their own bounded authorization; production writes require explicit authorization. Record tasks left disabled with reasons. No deployment occurs merely because this spec is approved.

## Files / areas

| Area | Intended change |
| --- | --- |
| `src/evaluation/application-inference/` | Focused task schemas, observations, runners, scoring, launch assessment, CLI and colocated Jest tests |
| `scripts/evaluate-application-inference.ts`, focused perishability comparison entry, `package.json` | Thin private CLI entry points, shared budgets and npm command |
| `evaluation/application-inference/` | Authored safety/recorded fixtures and label-review/operation guides; actual household datasets/reports remain private |
| `src/evaluation/stock-prediction/`, `evaluation/stock-prediction/` | Versioned workflow evaluation extension and final-recommendation metrics; preserve existing evaluator/report parsing |
| `src/product/`, `src/inventory/` | Reuse current ports and acceptance; add a focused perishability evidence/question helper and versioned dispatch only in product understanding; inventory behavior remains intact |
| `src/config/`, `test/model-configuration.e2e-spec.ts`, affected E2E fixtures | Independent selector, rollback and real DI verification |
| `docs/jev-integration.md`, `docs/deployment.md`, `.env.example` | Evidence prerequisites, precise enablement/rollback matrix and safe configuration examples; compatibility defaults remain unchanged |

Exact helper names are implementation choices. Avoid extending giant files or introducing a cross-task framework merely to share a few functions.

## Data / contracts

### Perishability repair contract (load-bearing amendment)

**Meaning:** classify the identified product in its normal purchased form, not a
particular package's condition, remaining life or safety. `perishable` means the
identified form ordinarily spoils over a short household storage period.
`nonperishable` means an identified shelf-stable product or durable household
consumable, not indefinite safety. `unknown` means unidentified/conflicting facts
or an unresolved product-form distinction that changes the answer. Missing exact
expiry, opening time or a stored classification alone is not grounds for unknown.

**Evidence:** for the perishability question only, construct
`{ evidence: { rawName, knownMetadata } }`. Include non-null supplied category,
product type and unit where relevant. Exclude `isPerishable` entirely, not only
its value. The name may express fresh/dried/canned/frozen/shelf-stable form;
respect that evidence without inventing another field or assuming opening,
storage temperature, freshness or package condition. No new REST/MCP input,
product schema field, migration or guessed household fact. Other field evidence
builders retain their current behavior. Never use approved expected answers as
supporting input.

**Instruction and criteria:** implement the dedicated instruction in Section 6
of the approach document, including ordinary product knowledge, Hebrew names,
explicit form precedence, conflict/ambiguity abstention and treating text as
untrusted data. Give every answer the matching full definition above. Preserve
IDs `unknown`, `perishable`, `nonperishable` and their value mapping to
`null`, `true`, `false`. Keep the current production option order for the first
comparison; evaluation-only rotations vary order without changing definitions.
The existing transport validator and both 0.90 acceptance checks remain intact.

**Versions:** bump the understanding adapter to `jev-product-understanding-v2`
and bind the new perishability vocabulary/instruction as
`perishability-question-v2`. Category/unit/type vocabularies keep their semantics.
Actual runtime requests, attempt logs and new diagnostic reports identify the
revised definition. Do not rewrite historical provenance. Preserve immutable v1
baseline artifacts; replay them only with their matching baseline request/version.
Current adapter validation must reject v1 request hashes. The baseline can be
reconstructed from an isolated read-only copy of revision `21a7a6d`, verifying its
request hashes against the private pilot; never silently replay old responses
through revised instructions. Changes to global understanding version invalidate
understanding launch evidence, including evidence for unchanged fields.

**Diagnostic schema:** use a separate `perishability-comparison-v1` private
artifact, not a silent change to the strict v1 application report. Bind case IDs,
dataset/input hashes, expected-label snapshot and review scope, baseline/revised
revisions, adapter/question versions, configured/resolved pin, variant ID,
normalized `JevChoiceRequest`, ordered candidate IDs and criteria, request hash,
validated transport/choice/distribution/confidence/usage, normalized outcome and
rejection reason. Explicit ordered criteria arrays are part of comparison hashes;
canonical object hashing alone must not erase the order under test. Capture the
normalized dispatched JSON body where available, excluding headers/credentials;
label reconstructed baseline payloads as reconstructed rather than captured.
Private reports retain all selected/not-run cases and physical retry counts.
No raw HTTP error bodies, unrelated data or full household records in artifacts.

**Baseline:** existing pilot revision `21a7a6d`, pin `jev-1.13.0`, 49 cases,
48 unknown, one substantive choice below the gate, zero accepted, 92 TypeSafe
requests, no OpenAI calls. Its dataset hash and private paths are recorded below.
Preserve the original report and source revision. The approach document's claim
that exact pilot provenance is unavailable is historical; these artifacts now
supply bounded evidence. They contain request hashes, not original wire captures.

**Evaluation:** the 49 products remain development/tuning cases. Preserve frozen
labels and supporting metadata for paired comparisons; user-confirmed purchase
facts absent from the runtime input cannot be smuggled into only the revised
variant. If the agreed definition reveals ambiguous/inconsistent labels, create
and review a new dataset version before calls, retain the original, and do not
claim direct comparison against its baseline without explicit comparable rows.
Add around 12 separately reviewed authored clear/ambiguous examples and selected
translation/rotation controls. Authored safety fixtures need no invented reviewer
attestation. Mask only the target in evaluation copies; never backfill products.

**Metrics:** count raw correct/wrong substantive choices, raw unknown on clear
versus must-abstain cases, rejected substantive choices, accepted correct/wrong,
accepted precision and coverage, failures, model mismatches, not-run cases and
physical requests. Report paired counts/deltas and denominators. Wrong accepted
nonperishable answers on expected-perishable cases are explicitly visible as
safety-relevant errors; do not hide them behind generic zero publication violations.
No selected or accepted values means undefined precision, never zero accuracy.
Order/translation disagreements are diagnostic findings, not proof of a cause.
A gain in acceptance alone does not qualify the change.

**Bounded execution:** reuse the shared request budget/deadline and private
exclusive output mode. Use a perishability-only evaluator call path so the
experiment does not spend on unscored type/unit fields. Reuse a focused method
or helper called by the actual runtime adapter for evidence, question, validation
and acceptance; do not implement a parallel acceptance policy. Production
still evaluates its normal missing-field set. The paid packet names every variant,
case/hash, model, maximum physical retries and global deadline, including any
baseline repetition, order rotation or language control. Reusing the existing
baseline costs no provider calls. One-factor controls are explicitly selected,
not an unbounded automatic matrix. Existing one-run approval is consumed.

**Acceptance boundary:** Steps 7a-7d can be implemented and proven offline.
Step 7e needs new paid authorization. Independent held-out validation and all
per-field understanding gates remain deferred to 38f; evidence/deployment review
remains deferred to 38g. No claim of rollout readiness follows the 49-case comparison.

### Frozen task datasets (load-bearing, version 1)

- Envelope: schemaVersion, immutable datasetVersion, frozenAt, cases. Maximum 200 cases and 5 MiB per file, matching existing evaluation limits.
- Case: opaque caseId and semanticGroupId; split (`tuning` or `held_out`); source (`authored` or `observed`); language (`he`, `en`, `mixed`); scenario tags; exact runtime-shaped minimized input; independently authored expected outputs and expected routing; opaque review identity/time/evidence reference.
- Understanding input uses `ProductUnderstandingInput`, including supplied nullable metadata and exact categories/units. Labels distinguish acceptable values, must-abstain fields and unscorable fields; supplied metadata is scored for preservation separately from inferred accuracy. Reviewer-defined equivalence sets are frozen before responses and cannot be widened afterward.
- Policy input uses `ShelfLifePolicyInput`, including explicit storage context. Labels identify acceptable registry IDs, must-abstain cases or required-generation cases with independently reviewed duration bounds and rationale evidence. Explicit-date/stored-policy bypass cases are application fixtures, not adapter calls. A registry entry's own days are not independent evidence of its safety.
- Semantic/product groups never cross splits. Review must include semantic duplicates and actual provenance, not merely opaque IDs. Freeze review and labels before held-out calls; no invented reviewer attestations. Held-out responses cannot tune the same evaluation.
- Remove real product/household IDs, conversations, unrelated preferences and secrets. Relevant product names/context are private input evidence, excluded from stdout. Authored examples may be committed; real evidence and complete provider recordings may not.

### Recorded observations and reports (load-bearing)

- Bind dataset hash, exact provider input hash, selected case IDs/split, task/adapter/vocabulary/registry/acceptance versions, configured and actually resolved model identities, start/end times, source revision and relevant dirty paths.
- Per-case results retain field-level supplied/accepted/unresolved outcomes and distinct unknown, low-confidence, unavailable, malformed, unsupported, budget-exhausted and not-run reasons. Store validated normalized transports and attempts, not raw HTTP bodies/errors.
- Reports include all selected cases in coverage, including unfinished ones. Count provider requests separately from logical operations; product understanding may call once per missing field. Retry attempts count toward the authorized request ceiling. Live generation must disable hidden retries or explicitly account for their maximum before dispatch.
- Preserve current runtime 0.90 acceptance gates. Offline response injection still executes actual adapters and validation; never trust predeclared accepted values in a recording.
- Usage: validated observed input/output tokens per provider, call counts, missing-usage counts, latency p50/p95 and failures. Current OpenAI result envelopes do not expose validated usage/resolved identity, so show these as unknown and distinguish configured identity. A narrow evaluator transport observer may capture validated successful response metadata without changing public contracts; do not fabricate telemetry or require a generic provider refactor.
- CLI live preflight displays/plans worst-case call count and requires explicit positive `--max-requests` (bounded at 1000) and `--max-duration-ms` (bounded at 1800000). Refuse a selected batch whose worst-case requests exceed its ceiling. All calls share the overall deadline as well as existing task deadlines. Tuning/live/offline are explicit modes; there is no automatic production shadow comparison.
- Launch status is `eligible`, `failed` or `inconclusive` with reasons. Validate by recomputing from bound data and observations; hashes are consistency checks, not proof that a call or review actually occurred.

### Proposed launch policy for review

These are proposed initial service gates, not measured accuracy or statistical guarantees. Freeze their version before collecting live held-out evidence. Policy changes invalidate the earlier launch decision.

| Route | Minimum qualifying evidence and proposed target |
| --- | --- |
| Product matching | Existing independently reviewed live 37c gate, including >=100 labeled cases, >=30 Hebrew/mixed cases and >=98% accepted-match precision; use its current validator unchanged |
| Product understanding | >=100 independently reviewed observed held-out cases, >=30 Hebrew/mixed; >=50 scored accepted inferred values per field and >=95% precision for each of category/type/unit/perishability; all four fields must qualify for the shared selector |
| Shelf-life policy | >=50 scored accepted held-out policy selections, >=98% correct applicable-policy identity, independently reviewed duration/storage assumptions and zero unsafe policy applications; required-generation safety fixtures and live generation review reported separately |
| Stock advisor | Existing 37e gate: >=50 scored accepted low/out outcomes, >=95% precision and its historical/review/model prerequisites unchanged |
| Workflow advice | Additionally >=50 scored surfaced low-stock recommendations with >=95% need precision, no precision regression against deterministic baseline on paired scored episodes, zero unsafe publications, and reviewed recall/coverage/slices; threshold/pending-list/expiration filters must be represented |

- Eligible requires complete live held-out evidence, independent review frozen before the run, clean relevant sources, pinned JEV matching its actual resolved model, sufficient denominators and zero operational provider failures in the qualifying run. Missing prerequisites produce inconclusive; qualified target misses or safety violations produce failed. Injected failure fixtures are a separate robustness run, not live launch evidence.
- Report accepted precision, accepted-value recall, abstention correctness, uncertainty, per-field acceptance, model-call coverage and language/scenario slices with numerator/denominator and descriptive Wilson 95% intervals. Zero denominator means null. Aggregate results do not establish slice accuracy or universal household generalization.
- Report low-stock need recall, false prompts, baseline versus final confusion and unscored/censored reasons. Stock truth follows the existing independently confirmed, next-24-hour, cutoff-safe and uncensored episode rules. Extend stock fixture input with cutoff-known projection facts, revisions, pending groceries and recommendation threshold; label/outcome facts never reach model inputs. Final recommendations require actual workflow replay, not rebranding advisor acceptance as application output.
- Zero safety violations: overwriting supplied metadata/names, adding unconfirmed aliases, promoting must-abstain evidence, unsafe duration/nonperishable decisions, forbidden generation, overriding direct stock/expiration facts, stale publication or model calls on reads. Review low coverage and concentration explicitly before accepting eligible evidence.

### Enablement and rollback matrix

| Task | Enable only after its evidence qualifies | Independent rollback |
| --- | --- | --- |
| Nonexact resolution | `PRODUCT_RESOLUTION_PROVIDER=typesafe` | Set only this selector to `openai` |
| Understanding | `PRODUCT_UNDERSTANDING_PROVIDER=typesafe` | Set only this selector to `openai`; document restored legacy assisted behavior |
| Shelf-life | `SHELF_LIFE_POLICY_PROVIDER=typesafe` | Set only this selector to `openai`; stored policies remain authoritative |
| Internal stock advisor | `STOCK_PREDICTION_PROVIDER=typesafe` | Set to `openai`; workflow advice then remains inactive |
| Daily/manual stock advice | TypeSafe stock selector plus `STOCK_WORKFLOW_ADVICE_ENABLED=true` | Set advice flag to `false`, restart, then separately authorized reevaluation restores deterministic estimates |

Keep `LLM_PROVIDER=openai` and private OpenAI credentials for generation; preserve independent selectors, private TypeSafe key and exact reviewed JEV pin. No global switch and no changed defaults. Changing the shared JEV pin invalidates all affected task evidence. Disabling stock advice does not retroactively alter saved estimates before reevaluation. Rollback never deletes provenance, events, policies or predictions.

## Testing

### Additional perishability repair checks

- Colocated Jest tests cover target omission, null supporting fields, supplied
  true/false bypass, explicit definitions/instruction dispatch, untrusted product
  text, version/provenance binding, unchanged other-field requests, rejected
  unknown/low-confidence/malformed/unavailable outcomes and no OpenAI fallback.
- Add meaningful comparison-schema/scoring tests for raw choice versus accepted
  outcome, wrong accepted classifications, zero denominators, partial cases,
  ordered-choice tampering, mismatched case pairs/models/versions and bounded
  physical retries. Mocked responses prove behavior, not model quality.
- Run `npm run test -- --runInBand` with affected Jest paths during each step;
  `npm run verify` is the exact checkpoint/final gate. Run `npm run contract:check`
  for the final local repair. PostgreSQL E2E uses existing migrated isolated
  product-understanding/enrichment/configuration fixtures; do not mutate production
  or weaken database guards. No browser-facing flow or Browser tests command.
- Real classification quality, rotated-option stability and Hebrew/English
  controls are Step 7e observations after separate bounded approval, not assertions
  manufactured by mocks. Missing live evidence leaves verification incomplete.

- Each logic-bearing step includes focused colocated Jest tests through `npm run test -- --runInBand`. Include empty/malformed input, split leakage, unsupported/ambiguous variants, must-abstain labels, deadline/request-budget exhaustion, usage absence, partial runs and report tampering.
- Scenario matrix: Hebrew, English, mixed, typos, brands/sizes, catalog and empty vocabulary, unknown categories/units, supplied fields including false perishability, contradictory identity, missing storage, reviewed/unsupported policies, provider refusal/failure/invalid output, deterministic bypass, zero history, direct stock signal, pending grocery, expiration precedence, stale publication and duplicate evaluation.
- Final automated gate: `npm run verify`, followed by `npm run contract:check`. No public REST/MCP shape change is intended; any discovered public change must follow the versioned contract and generated-bundle workflow before proceeding.
- Run affected PostgreSQL suites with `npm run test:e2e -- --runInBand` against an isolated migrated database: product understanding, shelf-life policy, model configuration, stock-advice storage/workflow/publication, daily-stock workflow, JEV matching/stock and recommendation REST/MCP regression suites. Use the existing fixture conventions and confirm database isolation before mutation. Add focused workflow evaluator fixtures, never target production for E2E tests.
- No Browser tests command or browser-facing UI is declared. `/check` uses CLI report validation, authenticated REST/MCP evidence and real Nest/PostgreSQL fixtures. Live accuracy is separate from mocked wiring verification.
- Deferred 38f needs a concrete paid-run authorization packet: dataset hash/split, tasks/models, worst-case per-provider requests/retries, timeout and output path; include any generation/comparison calls. Existing two-case smoke permission is insufficient. This skill invocation authorizes spec writing only.
- Deferred 38g needs evidence review and separate runtime/deployment authorization with a named target. Readiness checks are read-only and never invoke models. Controlled mutating flows and billable calls need explicit bounded scope.

## Notes for the AI

- This review drafts a repair within active 38e; do not reset its completed steps,
  discard evidence or start another feature. The user-approved split permits
  38e completion after final local verification. Qualifying evidence and fresh
  live authorization remain prerequisites of 38f; operator approval remains
  necessary for 38g. Keep a focused helper rather than a
  cross-task prompt framework, and use existing Nest/provider boundaries.
- Do not extend ordinary-product-knowledge permission to stock history, quantities
  or household conditions. Do not lower gates, remove unknown, add automatic
  OpenAI escalation or change defaults to make this diagnostic look successful.

- Backend-only NestJS: thin CLI entry points, injected transport/domain boundaries, strict DTO/schema validation and focused modules. Reuse shipped adapters, generation eligibility, stock race protection and recommendation logic; do not maintain parallel rules in the evaluator.
- Single-household private service today; follow authenticated scope conventions if an owned query is introduced. Keep evaluation isolated from production persistence and private data out of terminal output.
- Do not read or print credential values. Provider/model configuration validation is separate from verified model availability. No external provider claims or prices are needed for implementing this spec.
- Update graphify after code edits during implementation. No graph update is needed for this spec-only change.
- Existing safety fixtures and prior smoke calls establish harness/transport behavior only. Current live historical evidence remains insufficient until reviewed reports demonstrate otherwise.

## Critique incorporated

- Narrowed the document to one perishability repair within 38e; deferred other
  tasks, batching, threshold calibration, catalog cleanup and runtime enablement.
- Separated offline implementation from separately authorized live comparison.
- Added explicit baseline preservation/version rejection because request changes
  otherwise make existing recorded replay fail or invite relabeling old evidence.
- Added ordered-choice hashes and actual-versus-reconstructed capture provenance.
- Added raw-choice metrics, wrong accepted nonperishable errors and null precision;
  coverage gains alone cannot establish quality or safety.
- Kept the private 49 products as tuning cases and prevented user-only clarifications
  or expected labels from leaking into variant inputs. Require new reviewed labels
  and a new version if the definition changes the reference answers.

- Separated final surfaced recommendation accuracy from advisor acceptance, and added pending-list, confidence, expiration and publication effects to workflow evidence.
- Added per-field denominators and required all understanding fields to qualify because the current selector is task-wide.
- Kept authored fixtures, robustness injections and partial/offline runs out of launch eligibility; required frozen independent review, clean sources and exact model/version bindings.
- Made generation telemetry absence explicit and bounded worst-case field calls/retries before live dispatch.
- Preserved existing matching/stock gates and independent rollback; documented that advice rollback needs reevaluation to replace saved estimates.
- Kept evidence collection and actual enablement unchecked until their separate authorization and prerequisites exist. Defaults and private runtime configuration are not changed by spec approval.

## Autopilot review packet (2026-10-06)

Resumed this spec on `feature/jev-application-evaluation-rollout`. Steps 1 through
7 are locally implemented and verified. Steps 8 and 9 remain pending; this feature
is not ready for `/complete`. No paid provider requests, runtime selector changes,
production writes, merge, push or deployment occurred.

### Changes and critique

- Added private application schemas, actual adapter replay, bounded live/offline
  CLI, field/policy scoring and recomputed reports in
  `src/evaluation/application-inference/`, with authored fixtures and review guides.
- Extended stock evaluation with cutoff-known snapshots and actual Nest /
  isolated PostgreSQL replay in `src/evaluation/stock-prediction/workflow-*`.
  Advisor acceptance, publication and surfaced recommendations are distinct;
  existing 37e truth and eligibility rules remain intact.
- Added CLI scripts/npm commands and configuration/workflow E2E proof. Added
  `docs/jev-application-rollout.md`, deployment/integration links and environment
  comments. Defaults and public contracts remain unchanged. Updated graphify
  with AST-only analysis.
- Split Step 6 into contracts/scoring, runtime replay and PostgreSQL evidence.
  Counted missing usage, unfinished cases and final recommendation denominators.
  Authored/offline runs cannot qualify for enablement.

### Verification

| Gate / command | Result |
| --- | --- |
| `npm run verify` | Passed at each checkpoint; final: 123 suites, 1914 tests and production build |
| `npm run contract:check` | Passed release/documentation contracts, 124 executable agent scenarios, 6 suites / 79 tests |
| `npm run test:e2e -- --runInBand test/task-rollout.e2e-spec.ts` | Passed 16 tests across eight provider/advice configurations; OpenAI generation retained; startup/readiness invoke no models |
| `npm run test:e2e -- --runInBand test/workflow-evaluation.e2e-spec.ts` | Passed 2 PostgreSQL tests covering eight scenarios, stale publication, cutoff isolation, repeat deduplication and replay |
| Affected PostgreSQL REST/MCP/application regression suites | Passed 12 suites / 96 tests on `home_stock_eval_38e_regression_test` |
| `npm run test:e2e -- --runInBand test/shelf-life-policy.e2e-spec.ts` | Passed 20 tests separately on required `home_stock_38c_test` |
| Offline application CLI, both tasks | 9/9 authored held-out cases each; zero safety violations; inconclusive |
| Compiled workflow CLI, authored safety corpus | 8/8 cases; surfaced need precision 3/3; zero safety violations; inconclusive |
| `graphify update .`, `git diff --check` | Passed; no paid semantic calls |

The first combined regression invocation failed the legacy shelf-life suite's
exact database-name guard. Its 20 tests then passed separately on the required
empty dedicated target with current migrations. No guard was weakened.
Evaluation databases and fixture records were retained; none were reset.

Private local outputs: `/private/tmp/38e-understanding-review-1.json`,
`/private/tmp/38e-policy-review-1.json`,
`/private/tmp/38e-workflow-proof-report.json`,
`/private/tmp/38e-workflow-cli-review.json` and
`/private/tmp/38e-workflow-safety-review.json`. These are authored/offline evidence,
not measured live accuracy.

### Review and remaining gates

Regular Check, Audit, Try-guide and default Independent-review policies are manual;
automatic gates were skipped. No independent reviewer/model/receipt was selected
and no formal audit ran. Self-review found no remaining blocking defect. The
findings ledger has no open/fixed P0/P1 entries. No browser evidence is required.

Checkpoint commits before Step 7: `ac98b49`, `198f432`, `3ba2be2`, `9ac567f`,
`f054b47`, `d494b9d`, `ff2ad33`, `6d53a36`. The checkpoint containing this packet
records Step 7. Each checkpoint followed passing Verify and focused checks.

Try the tools through `evaluation/application-inference/README.md` and
`evaluation/stock-prediction/workflow-review-guide.md`. Workflow execution needs
an explicitly named empty, migrated loopback `home_stock_eval_*_test` database;
build first for its compiled CLI. Offline runs make no provider calls.

Next: supply independently reviewed frozen held-out dataset paths and provenance,
then review the Step 8 packet with hashes/splits, model pins, per-provider maximum
requests, deadline and private output paths. Resume with `/autopilot resume` after
these prerequisites and bounded paid-run authorization exist. Step 9 requires
qualifying reports and separate named runtime/deployment approval. No current
report permits enablement; no live accuracy or savings claim is supported.

## Authorized exploratory live pilot (2026-10-06)

The user supplied 49 minimized product observations, approved perishability labels
in two batches and clarified four product identity/purchase-storage facts. Labels
were frozen before responses. Other fields remain unscored. Input copies mask
perishability as null; no stored product was changed. This is a constructed tuning
pilot, not independently reviewed historical held-out launch evidence.

The user explicitly approved one run on `jev-1.13.0`, capped at 184 TypeSafe
requests, zero OpenAI calls and 600000 ms. Dataset hash:
`762aec03590b66dd3c10be18d062178c5157b606077b959a32def0072acdd28c`.
Private dataset/report/approval artifacts reside under
`/private/tmp/38e-household-review/`; no household product names or recordings
are added to the repository. Source revision was clean
`21a7a6d050fe17fd456acabb6a1cac44d1842ec6`.

Run completed 49/49 cases in about 27 seconds with 92 TypeSafe HTTP requests,
zero OpenAI requests and resolved pin `jev-1.13.0`. Perishability accepted 0/49:
48 unknown and one low-confidence outcome. Accepted precision is undefined,
coverage is zero. One additional product-type response failed validation.
Validated usage totals were 43133 input tokens and 5206 output tokens, with
one call missing validated usage. Supplied metadata was preserved and no
publication/production mutation occurred. Launch assessment is inconclusive.

Step 8 remains pending and Step 9 is not authorized. This result does not support
enabling understanding. Inspect the existing task request/option wording and
Hebrew handling from recordings before proposing a repair; cause is not yet
established. Keep the 0.90 acceptance threshold. A code/rule change requires a
reviewed scope change and invalidates earlier evidence. This one-run paid
authorization is consumed; any further live experiment needs its own concrete
bounded approval.


## Step 7a implementation evidence (2026-10-06)

- Before product edits, verified the production adapter/transport sources matched
  `21a7a6d`. Replayed all 49 pilot cases with recorded transports and checked each
  reconstructed perishability request hash plus normalized metadata outcomes.
- Read-only private baseline copies are at
  `/private/tmp/38e-household-review/baseline-v1/`: `dataset.json`, `report.json`,
  `requests.json`, `definition.json` and `comparison.json`. Files are mode 0400,
  folder mode 0700. Original file hashes match. These are local private artifacts;
  retain them separately before clearing temporary storage. Requests are explicitly
  reconstructed, not original wire captures; zero network/provider calls ran.
- Added the product-level definition constants, request capture validation and a
  separate comparison contract. Dataset/label/definition bindings, resolved pins,
  completeness and ordered choices are checked. No independent review claim is
  created, and diagnostic launch status is always inconclusive. Runtime replay
  and recomputed new comparison metrics remain Step 7d.
- Added 12 authored tuning fixtures (six clear, six ambiguous), with no reviewer
  attestation, plus a contract/baseline review guide. The private user catalog and
  responses are not committed or included in graphify sources.
- `npm run test -- --runInBand src/evaluation/application-inference/perishability-comparison-contract.spec.ts`
  initially passed nine tests; the final expanded suite has 11 tests.
- Final `npm run verify` passed 124 suites / 1925 tests and the production build.
  The first Verify's build caught a union-type narrowing error after tests passed;
  an explicit product-understanding type guard fixed it, and full Verify passed.
- The compiled contract independently validated 49/49 preserved baseline rows;
  original byte hashes were unchanged and no network calls ran.
- `graphify update .` and `git diff --check` passed. Regular Check is manual and
  was not invoked. No public endpoint, persistence or production selector changed.
- Self-review found no remaining blocking defect. No commit was made; Step 7b's
  production question/criteria change waits for review under `stepReview: every`.


## Step 7b implementation evidence (2026-10-06)

- Added `src/product/perishability-question.ts`, using the reviewed definitions,
  full dedicated instruction and explicit unknown/perishable/nonperishable
  descriptions. Original production option order is preserved for the initial
  comparison. Evidence contains the name and only non-null supplied category,
  type and unit; the target key/value is omitted entirely.
- Routed only the perishability field to that builder/instruction. Other fields'
  evidence, choices and instructions are unchanged. Known true/false bypasses,
  unknown/null behavior, the two 0.90 gates and TypeSafe-only inference remain.
- Moved the adapter/question version bump and authored mocked fixture refresh
  from Step 7c into Step 7b so changed requests are never labeled v1. Adapter is
  `jev-product-understanding-v2`; per-field provenance uses
  `perishability-question-v2`. Step 7c remains the integration/regression proof.
- Preserved the old committed v1 fixture unchanged. Newly generated
  `product_understanding-recorded.v2.json` contains nine authored cases / 31
  mocked transport calls, replayed through the actual revised adapter. The guide
  uses v2 and explains v1 rejection. No historical live response was relabeled.
- Four focused suites initially passed 41 tests; a further v1 binding rejection
  assertion is included in final Verify. Wire-request tests exercise the real
  client with injected mock fetch, input preservation, supplied true/false bypass,
  separate confidence/probability rejection, unknown, untrusted text and bounds.
- Final `npm run verify` passed 125 suites / 1937 tests and production build.
- Actual offline CLI command:
  `npm run eval:application-inference -- --task product_understanding --dataset evaluation/application-inference/safety-cases.v1.json --recorded evaluation/application-inference/product_understanding-recorded.v2.json --output /private/tmp/38e-understanding-v2-step7b-review.json`.
  Result: 9/9 authored cases, zero safety violations, inconclusive; no networking.
- All 49 frozen baseline captures still validate with their original definitions;
  original dataset/report byte hashes and the committed v1 fixture are unchanged.
- `graphify update .` and `git diff --check` passed. Regular Check remains manual.
  No paid calls, production data/config changes or commit occurred. Model quality
  and live classification improvement are not established by these mocks.

## Step 7c implementation evidence (2026-10-06)

- Added REST integration assertions in
  `test/product-enrichment.rest.e2e-spec.ts` that real TypeSafe adapter attempts
  persist `jev-product-understanding-v2` and `perishability-question-v2` with
  accepted/applied perishability provenance. Both provider routes preserve
  supplied true/false while enriching missing product type; TypeSafe makes no
  perishability request for these supplied values. No production source change.
- Focused request, adapter, replay and comparison-contract command:
  `npm run test -- --runInBand src/product/perishability-question.spec.ts src/product/jev-product-understanding.service.spec.ts src/evaluation/application-inference/understanding-runner.spec.ts src/evaluation/application-inference/perishability-comparison-contract.spec.ts`.
  Passed four suites / 42 tests, including preserved v1 binding rejection,
  distinct unknown/low-confidence/malformed/provider-failure outcomes and v2
  request/attempt provenance.
- Created and migrated fresh isolated PostgreSQL database
  `home_stock_eval_38e_v2_regression_test` using all 16 existing migrations.
  Ran `npm run test:e2e -- --runInBand` with product-understanding service,
  product-enrichment REST, model-configuration, task-rollout,
  stock-product-confirmation and policy-aware-grocery service/REST/MCP files.
  Passed eight suites / 107 tests covering persistence, names/aliases and
  supplied metadata preservation, zero inference on reads, confirmation and
  independent routing. All provider calls were mocked.
- Ran `npm run test:e2e -- --runInBand test/shelf-life-policy.e2e-spec.ts`
  against its guarded local `home_stock_38c_test` database: 20 tests passed,
  including required-generation policy routing. No guard was weakened.
- Actual offline v2 CLI replay passed nine/nine authored cases, zero safety
  violations; launch remains inconclusive. Command:
  `npm run eval:application-inference -- --task product_understanding --dataset evaluation/application-inference/safety-cases.v1.json --recorded evaluation/application-inference/product_understanding-recorded.v2.json --output /private/tmp/38e-understanding-v2-step7c-review.json`.
- Final `npm run verify`: 125 suites / 1937 tests and production build passed.
  `npm run contract:check`: six suites / 79 tests, 124 executable scenarios,
  generated bundle and documentation checks passed.
- `graphify update .` completed AST-only (6249 nodes / 10735 edges); its existing
  community labels may need a separately requested semantic refresh.
  `git diff --check` passed. Check/audit/try gates remain manual.
- No paid calls, production data/config changes, relabeling of historical
  records or commit. These regression mocks do not establish live accuracy.
  Step 7d comparison capture and metrics remains pending review approval.

## Step 7d implementation evidence (2026-10-06)

- Added frozen request plans and validation in
  `perishability-comparison-plan.ts`. Exact normalized requests, ordered criteria,
  inputs, labels, model pins, definitions and complete case pairing are checked.
  Current v2 requests must match the actual production request builder; only
  option order may vary. Baseline definitions and external frozen plans retain
  their original versions and request provenance.
- Added `perishability-replay.ts` and `perishability-comparison-runner.ts`.
  Acceptance is replayed through the actual product-understanding service,
  not a parallel threshold implementation. Historical captures remain unchanged;
  replay rechecks the unchanged acceptance policy without claiming a historical
  v1 request was dispatched by v2. Live capture uses the shipped client and a
  single RequestBudget across all variants/retries, with zero generation calls.
- Added `perishability-comparison-metrics.ts` and strict report validation in
  `perishability-comparison-report.ts`. Raw substantive correct/wrong choices,
  unknowns, unscored choices, low-confidence rejection, accepted precision and
  coverage, incorrect acceptance on must-abstain labels and provider failures
  remain separate. Zero denominators remain null. Paired gains/losses and
  disagreements retain paired/unpaired and both-successful denominators.
  Parsing a report independently recomputes metrics and rejects edited claims.
- Added `perishability-comparison-cli.ts`, a thin script entry, npm command and
  operation guide. Dataset/plan/recording/model/budget checks precede networking.
  Outputs are exclusively created with mode 0600; stdout is aggregate only.
  Runtime source revision, dirty paths and before/after content hashes bind the
  capture/replay code. Deadline/cancellation produces an incomplete inconclusive
  report; the final completion flag also checks elapsed deadline directly.
  Complete frozen baseline variants may be reused without calls; partial
  nonempty baseline variants cannot be mixed with fresh live evidence.
- New focused suite passed all 13 tests: fabricated outcomes/metrics, rehashed
  request tampering, unequal planned pairing, duplicate variants, input/model
  mismatch, planned/unplanned rotations, null denominators, paired gains/losses,
  physical retry ceilings, malformed/provider failures, in-flight deadline,
  cancellation, private exclusive output and baseline reuse. The deadline test
  initially depended on timer callback order; replaced wall timing with fake
  timers before the final gate. No production acceptance logic changed.
- Representative actual offline command:
  `npm run eval:perishability-comparison -- --dataset /private/tmp/38e-household-review/step7d-offline/dataset.json --split tuning --plan /private/tmp/38e-household-review/step7d-offline/plan.json --recorded /private/tmp/38e-household-review/step7d-offline/comparison.json --output /private/tmp/38e-household-review/step7d-offline/report-final.json`.
  Result: two complete variants, 49/49 paired cases, private mode-0600 report,
  inconclusive. It combines the frozen original pilot with explicitly offline
  mocked revised responses; the latter are reporting fixtures, not accuracy
  evidence. Original baseline dataset/report byte hashes still match their
  recorded originals and all five frozen baseline files remain read-only.
- Final `npm run verify` passed 126 suites / 1950 tests and production build.
  `npm run contract:check` passed six suites / 79 tests, 124 executable scenarios
  and generated-bundle/documentation checks. No production service changes in
  this step required repeating the Step 7c PostgreSQL matrix.
- `graphify update .` completed AST-only (6286 nodes / 10922 edges) and
  `git diff --check` passed. Regular Check/audit/try remain manual.
- No paid calls, production data/config changes or commit. Step 7e must prepare
  reviewed diagnostic labels and a concrete globally bounded paid-run packet;
  step continuation alone does not authorize live provider calls. Steps 8 and 9
  remain pending, and this feature is not verified or ready for completion.

## Step 7e prepared diagnostic packet (2026-10-06, not executed)

- Prepared private immutable artifacts at
  `/private/tmp/38e-household-review/step7e-proposal-v1/`: household dataset,
  frozen baseline plus empty revised placeholder, exact household request plan,
  proposed bilingual diagnostic dataset/request plan, explicit language pairs,
  label-review proposal, review guide and paid-run proposal. All proposal files
  are mode 0400 inside a mode-0700 directory. Original baseline stays unchanged.
- Household job reuses all 49 frozen live baseline rows and makes 49 new revised
  perishability decisions, preserving supporting evidence and approved labels.
- Diagnostic proposal has the 12 authored concepts in Hebrew and English (24
  cases), each under three cyclic orders of the same criteria (72 decisions).
  Six clear concepts: fresh banana/milk/raw chicken perishable; dry rice/toilet
  paper/sealed canned beans nonperishable. Six must-abstain concepts: brand-only,
  explicitly unresolved cheese form, unspecified milk form, conflicting milk
  alternatives, unidentified code and unidentified product.
- Clarified the proposed ambiguous-cheese input as chilled cheese versus dry
  cheese powder. Merely unspecified cheese type was insufficient to justify
  mandatory abstention under the normal purchased-form definition. The committed
  v1 diagnostic fixture is preserved; this is a new private v2 proposal. Hebrew/
  English translations and labels require user review. Acme/SKU-123 are identical
  tokens and serve as repetition controls, not translation robustness evidence.
- One proposed run: exact `jev-1.13.0`, both 0.90 gates unchanged, 121 new
  decisions, <=242 physical JEV requests including retries, zero OpenAI calls,
  600000 ms shared global deadline. Household sub-ceiling 98; diagnostic 144.
  No estimated dollar cost is asserted and no additional baseline call is needed.
- Concrete private runner:
  `/private/tmp/38e-household-review/step7e-run-packet.cjs`.
  Uses an outer shared RequestBudget across both shipped comparison commands,
  validates all byte/canonical artifact hashes and current source/revision plus
  runner hash, requires a matching explicit approval sidecar for labels AND paid
  execution, exclusively creates a single-use execution ledger and fresh reports,
  and retains partial failures without an automatic retry. Summarizes per-order
  language-pair disagreements with missing/both-successful denominators.
- `node /private/tmp/38e-household-review/step7e-run-packet.cjs --check` passed
  offline preflight for both plans and frozen baseline. No provider calls,
  credential reads, production mutations or commits occurred. This preparation
  only changes private artifacts and workflow evidence, not repository source;
  Step 7d's final Verify/contract evidence remains applicable.
- No approval sidecar or live output exists. Step 7e remains unchecked and
  incomplete until labels/translation review and separate paid authorization,
  execution and actual diagnostic decision are recorded. All evidence remains
  tuning-only and launch-inconclusive; Steps 8/9 remain pending.

## Step 7e authorized execution and decision (2026-10-06)

- User explicitly approved the proposed diagnostic labels/translations AND the
  bounded paid packet in this chat. Recorded a private approval sidecar bound to
  proposal byte hash
  `58f66640fc03dca113370add9b749fa29bfa18a79452fe8f20c787c593c7fd1a`.
  The immutable proposal retains its original awaiting-approval status; the
  matching approval sidecar and completed execution ledger are the actual state.
- Executed the exact private runner once with private environment loading.
  Both jobs completed: 49 household decisions and 72 diagnostic decisions,
  121 physical TypeSafe requests, zero OpenAI requests, no retries. All requests
  stayed within the approved 242-request shared ceiling and 600000 ms deadline.
  Resolved pin `jev-1.13.0`; supporting evidence and both 0.90 gates unchanged.
- Household baseline: 48 unknown and one low-confidence substantive correct
  choice; zero accepted cases, accepted precision undefined, coverage zero.
  Revised: 44/49 raw substantive choices correct, five raw wrong, zero unknown,
  18 low-confidence rejections, 31/49 accepted (63.27% coverage), 31/31 accepted
  correct against approved tuning labels, zero accepted wrong and no provider
  failures. Every one of the five raw errors was rejected by the unchanged
  gates. All 49 cases were paired, with 31 accepted-correct gains and no losses.
- Each of three diagnostic option orders: all 12 value-labeled language cases
  accepted correctly and all 12 must-abstain language cases returned unknown.
  No raw or accepted disagreement across orders. Each order had all 12 explicit
  language/repetition pairs present, with zero raw/accepted pair disagreement.
  Two identical-token pairs are repeated-decision controls, not translation
  evidence; the other ten pairs have equivalent Hebrew/English product text.
- Actual comparison reports, private summary and `decision.json` retained under
  `/private/tmp/38e-household-review/step7e-proposal-v1/` as mode-0600 files.
  Independently reparsed both reports through actual acceptance replay and
  recomputed metrics, checked exact approved source hashes and counts, and
  recorded completed-artifact byte hashes. Frozen proposal/input plans remain
  read-only, and original baseline dataset/report byte hashes remain unchanged.
- Decision: retain the revised question and unchanged 0.90 gates for further
  evaluation. This one diagnostic fixes the observed excessive abstention on
  these tuning labels; 31 correct accepted cases do not establish generalization
  or authorize runtime enablement. No launch winner, automatic tuning loop,
  further paid call, production mutation, commit or rollout is authorized.
- Final `npm run verify` passed 126 suites / 1950 tests and production build.
  Final `npm run contract:check` passed six suites / 79 tests, 124 executable
  scenarios and generated-bundle/documentation checks. `git diff --check` passed.
  No repository source change in this step required an additional graph update.
  Regular Check/audit/try remain manual.
- Step 7e is complete, but Feature 38e remains in progress: Step 8 requires
  independently reviewed frozen held-out observations and clean source/model/
  policy bindings with separate bounded live authorization. Step 9 enablement
  requires qualifying evidence and separate operator approval. This tuning-only,
  dirty-source diagnostic remains launch-inconclusive and cannot complete either
  remaining gate.

## Step 8 evidence intake readiness (2026-10-06, pending data)

- Inspected the committed evaluation corpus, known local reports and 37c/37e
  archives. Existing matching report is offline/unreviewed; existing stock report
  is offline/non-historical/unreviewed; workflow proof is offline with no qualifying
  37e report. No qualifying live held-out corpus was found in the inspected
  project artifacts or task-related private reports. The 49-case revised live
  comparison remains tuning-only, targets one field and uses dirty sources.
- Prepared private readiness inventory and actionable source/reviewer checklist
  under `/private/tmp/38e-household-review/step8-preparation/` as mode-0600 files
  in a mode-0700 directory. Covers exact route minima, source provenance,
  four-field labels, semantic-group exclusion of tuning, independent reviewer
  records, freeze order, clean source checkpoint and fresh paid-run packet.
  No case, observation, review identity or historical outcome was invented.
- First source needed: 100-200 new real product-understanding observations with
  >=30 Hebrew/mixed cases, disjoint from the 49 tuning products and their semantic
  equivalents. Preserve actual pre-inference supplied metadata and known category/
  unit vocabulary, minimize identifiers, and separately review category/type/unit/
  perishability labels. All four fields must reach >=50 scored accepted inferred
  values with >=95% precision; 100 inputs do not guarantee enough accepted values.
- Asked the user for the local file, database or connected source containing these
  observations. Existing exported cases cannot be reused as held-out after prompt
  tuning. The private checklist can be handed to a source/reviewer without asking
  them to run a model or invent review attestations.
- Shelf-life additionally needs independent duration/storage facts. Stock/workflow
  require cutoff-safe historical observations and confirmed outcomes; a current
  product catalog cannot replace that history. These separate evidence sources
  also remain missing in the inspected material.
- Step 8 remains unchecked; no qualifying run or deployment was attempted. New
  paid authorization, clean-source checkpoint approval and runtime enablement
  approval are still separate later gates. No new provider call, production data
  read/write or commit occurred; source remained unchanged and Step 7e's final
  Verify/contract proof remains current. `git diff --check` passed.

## Step 8 household catalog intake (2026-10-06)

- User supplied `docs/household-products-export.json`. Parsed 63 actual catalog
  rows (not 65), 49 normalized-name overlaps with the original tuning export,
  and 14 additional names. The export note claiming exclusion of the original
  list does not match its full products array; actual contents determine overlap.
- All 63 rows have `fact_origin: stored_catalog_values_only`, no manually
  confirmed fields and no purchase-form facts. Stored metadata are supporting
  catalog values, not independently verified accuracy labels. Source references
  are preserved privately; no operational/history evidence was asserted.
- Conservatively set aside four additional names from a held-out claim: probable
  duplicate/flavor sibling PRO-20 yogurts and related onion/pastrami variants.
  These semantic exclusions require review; ten remaining catalog candidates
  are not yet independently reviewed held-out observations. Apple color variants
  remain in one semantic group and one split.
- Prepared minimized review proposals and a private source copy under
  `/private/tmp/38e-household-review/step8-catalog-intake-v1/` (folder 0700, files
  0600). Eight clear proposed perishability labels and two purchase-form questions
  (harissa and dough) await actual review. Category/type/unit remain unreviewed;
  the small proposed check would score perishability only, not qualify the shared
  four-field selector. No labels were marked approved and no dataset or paid
  packet was frozen yet.
- Preserved the supplied export unchanged and added its exact path to
  `.gitignore` to prevent private household data being accidentally committed.
  `git diff --check` passed. No runtime source changed, so no additional unit/
  build/graph gate was needed; Step 7e final verification remains current.
- Providing a file does not authorize a further paid run. After label/form review,
  a separate bounded packet can test these ten real candidates (at most 20 JEV
  requests including retries, zero OpenAI); the 100-case independent four-field
  rollout gate and the historical policy/stock gates remain pending. No model
  call, production read/write, fake case or commit occurred during this intake.

## Step 8 small catalog packet prepared (2026-10-06, not executed)

- User supplied purchase-form clarifications: harissa was sold shelf-stable;
  dough was frozen. Recorded actual statements privately, without inferring that
  the user approved all other proposed labels or further provider calls.
- Proposed complete ten-case label set: seven perishable, three nonperishable.
  Frozen dough is proposed perishable as a product needing cold storage; user
  label approval remains necessary. Harissa is proposed nonperishable in its
  confirmed shelf-stable purchased form. These label-only facts are not silently
  added to the exact exported catalog name/metadata used by the model.
- Prepared and validated private dataset, exact request plan, label-review sheet,
  proposal and single-use guarded runner under
  `/private/tmp/38e-household-review/small-catalog-proposal-v1/`.
  Existing related/tuned groups are excluded conservatively; apple variants share
  one group. Only perishability is scored; other supplied catalog fields are
  preserved as input facts and remain unverified/unscored accuracy labels.
- The dataset uses fresh pre-response held_out candidates, but no independent
  reviewer claim. Actual user approval, if given, will be recorded in a private
  sidecar. Insufficient ten-case, single-field, dirty-source evidence remains
  launch-inconclusive regardless of measured accuracy; Step 8 stays unchecked.
- Concrete proposal: one run, exact `jev-1.13.0`, unchanged 0.90 gates, ten new
  decisions, <=20 physical JEV requests including retries, zero OpenAI, 120000 ms
  shared deadline, new private report, no automatic repeat or production write.
  Packet/source/runner hashes and explicit label+paid approval are checked before
  execution; a single-use execution ledger prevents accidental repeat.
- `node /private/tmp/38e-household-review/run-small-catalog-check.cjs --check`
  passed offline preflight. Proposal artifacts are read-only in a mode-0700
  directory. No approval sidecar, execution ledger, provider request or commit.
  No repository source changed; existing Verify/contract evidence remains current.

## Step 8 supplementary catalog diagnostic executed (2026-10-06)

- User explicitly approved all ten proposed labels AND the separate bounded
  packet in this chat. Recorded exact proposal-hash approval privately and
  executed the single-use guarded runner once with private environment loading.
- Completed ten/ten candidate cases using ten physical TypeSafe requests, zero
  OpenAI and no retries, within the approved twenty-request ceiling and 120000 ms
  deadline. Exact resolved pin `jev-1.13.0`; both 0.90 gates unchanged. Purchase-
  form clarifications remained label-only evidence, not additional request facts.
- Results: nine/ten raw substantive choices matched approved labels; zero unknown;
  seven accepted, all seven matched labels; three low-confidence rejections;
  zero accepted errors and zero provider failures. Coverage 70%, accepted precision
  7/7 within this small user-reviewed sample. The one wrong raw carrot-snack choice
  was rejected. Sweet potato and frozen dough raw choices matched labels but were
  also rejected, preserving unresolved outcomes rather than assigning false.
- Actual full report, execution ledger, private per-product results sheet and
  decision retained under
  `/private/tmp/38e-household-review/small-catalog-proposal-v1/` as mode-0600
  files. Reparsing independently replays shipped acceptance and recomputes metrics;
  verified approved source/model/packet bindings and recorded output byte hashes.
- Decision: retain the revised question and unchanged gates for further evaluation.
  This available-catalog diagnostic is complete; the existing rollout gate remains
  inconclusive because only ten fresh catalog candidates/nine groups and one
  scored field were available, with user review and dirty source rather than
  independently reviewed operational history. No evidence was fabricated, no
  minimum or acceptance gate was lowered, and Step 8 remains unchecked.
- No further provider calls, production changes, commits or enablement were
  authorized. No source was changed by execution; the final Step 7e automated
  Verify/contract evidence remains current. `git diff --check` passed. Step 9 and
  full feature completion require separate qualifying evidence/operator review.

## Approved scope split (2026-10-06)

- User approved finishing 38e as evaluation tooling plus the perishability repair,
  keeping results and current thresholds, and deferring broader validation and
  runtime enablement. This supersedes prior notes requiring original Steps 8/9
  before 38e completion; those requirements remain unmet in 38f/38g.
- Build plan and detailed plan now track 38f qualifying evidence and 38g validated
  dual-provider rollout. Parent 38 and these follow-ups remain unchecked.
- The 49-case revised diagnostic accepted 31 correct cases; the supplementary
  ten-case diagnostic accepted seven correct cases. Rejected and raw errors stay
  recorded privately. These small/user-reviewed/dirty-source observations remain
  launch-inconclusive. No acceptance threshold, denominator, label or gate changed.
- No runtime code, private environment, selector, production catalog, paid-run
  approval or deployment changed as part of this amendment.

## Revised 38e final review packet (2026-10-06)

- Branch: `feature/jev-application-evaluation-rollout`.
- Delivered: application and workflow evaluation contracts, actual-adapter/runtime
  replay, bounded private CLIs, recomputed metrics, authored safety fixtures,
  local routing/rollback proof, versioned perishability repair and controlled
  diagnostic reports. Latest amendment changes five planning/documentation files;
  runtime source and acceptance gates did not change in this final step.
- Updated `blueprint/build-plan.md`, the detailed feature plan, this spec, generated
  project overview and `docs/jev-application-rollout.md`. Project direction is
  unchanged; existing project-plan/build-plan summary differences remain listed
  in the overview. Overview fingerprint matches both plans and is 18,464 bytes.
- Final `npm run verify`: 126 suites / 1950 tests passed and production build
  passed. Final `npm run contract:check`: six suites / 79 tests, 124 executable
  agent scenarios and release/documentation/generated-bundle checks passed.
  `git diff --check` passed. Prior isolated PostgreSQL regression evidence remains
  recorded above; documentation-only scope changes required no new database run
  or AST graph update.
- Privately rechecked all six Step 7e output hashes and all five supplementary
  catalog diagnostic output hashes. Both reports and decisions are retained;
  no new paid/provider calls occurred. Real household inputs stay excluded from
  Git; authored fixtures are separate from observed accuracy evidence.
- Manual try path: inspect the retained private per-product results at
  `/private/tmp/38e-household-review/small-catalog-proposal-v1/results.md`.
  For a reproducible zero-network CLI walkthrough use the recorded v2 command
  documented in Step 7c, choosing a new exclusive output filename.
- Findings ledger: no recorded findings, no open/fixed P0/P1 blockers. Independent
  review: none requested. Effective regular audit, Check and Try-guide policies
  are all manual; no independent review is configured as an automatic gate.
- Limit: current real diagnostic results are tuning/small-catalog evidence only,
  not qualifying launch accuracy. All wider evidence minima, clean-source/model/
  review bindings and per-task enablement conditions remain unmet in 38f/38g.
  Parent 38 and 38e/38f/38g build-plan checkboxes remain unchecked until their
  respective completion workflows. No selector, private environment or deployment
  changed; no commit, merge or push occurred.
- Next action: `/complete` for revised 38e. It runs the final safety pass, archives
  this spec, updates the plan/overview and creates the work-level commit. Merging
  requires approval; pushing and runtime deployment remain separately authorized.

## Completion safety pass (2026-10-06)

Final `npm run verify` passed 126 suites / 1950 tests and the production build.
Final `npm run contract:check` passed six suites / 79 tests and 124 executable
agent scenarios plus bundle/release/documentation checks. `git diff --check`
passed. Regular Check, audit and Try-guide policies remain manual; independent
review was not requested. No recorded findings block completion. All pending
files belong to this scope, including the user-supplied approach reference and
expected incremental graph artifacts. The household export remains ignored.
Feature 38e is archived under its approved narrowed scope; 38f, 38g and parent 38
remain pending. This completion creates a local work commit and awaits separate
merge approval; no paid call or runtime/deployment change is included.
