# Jev transport, product matching and stock advice

Feature 37a exports an injectable `JevDecisionClient` from `LlmModule` for
bounded decisions. Feature 37b adds task-specific product-resolution advisors.
Feature 37d adds independently selected stock-prediction advice. Generation, including classification and shelf life, continues
through the OpenAI `LlmProvider`. There are no new REST/MCP endpoints or database
fields in this feature.

## Private configuration

Use [`.env.example`](../.env.example) and the existing
[deployment setup](deployment.md#configure-the-environment). Keep both task
selectors on `openai`, or omit them to use their defaults:

```dotenv
# These selectors are optional; both default to openai.
# PRODUCT_RESOLUTION_PROVIDER=openai
# STOCK_PREDICTION_PROVIDER=openai
# Optional transport setup, stored only in your private runtime environment.
# TYPESAFE_API_KEY="replace-with-a-typesafe-api-key"
# JEV_MODEL=jev-1.13.0
```

| Setting                       | Behavior                                                                      |
| ----------------------------- | ----------------------------------------------------------------------------- |
| `LLM_PROVIDER`                | Defaults to `openai`; generation currently supports only OpenAI.              |
| `OPENAI_API_KEY`              | Required by production bootstrap, including when Jev credentials are present. |
| `LLM_MODEL`                   | Existing OpenAI model override; unrelated to `JEV_MODEL`.                     |
| `PRODUCT_RESOLUTION_PROVIDER` | Accepts `openai` or `typesafe`; defaults to `openai`.                         |
| `STOCK_PREDICTION_PROVIDER`   | Accepts `openai` or `typesafe`; defaults to `openai`.                         |
| `TYPESAFE_API_KEY`            | Optional private credential; missing credentials disable the transport.       |
| `JEV_MODEL`                   | Optional pinned `jev-<major>.<minor>.<patch>` ID; no default or moving alias. |

Provided optional values are trimmed and must be nonblank. Omit an optional
setting instead of assigning an empty value. A malformed provided model is
rejected even with OpenAI task selectors. A versioned ID passes syntax validation;
availability for your account is determined by the provider at call time. The
example pin is `jev-1.13.0`, checked against the
[TypeSafe model documentation](https://docs.typesafe.ai/models) on 2026-09-30.

Selecting `PRODUCT_RESOLUTION_PROVIDER=typesafe` requires the private key and
pinned model and selects the Jev matching advisor. Selecting
`STOCK_PREDICTION_PROVIDER=typesafe` selects the Jev stock advisor with the same
key/model requirements. Supplying Jev credentials while both selectors remain OpenAI configures
the transport but does not route domain calls to it. Keep runtime matching on
OpenAI until reviewed 37c evidence, and stock on OpenAI until reviewed 37e
stock evaluation. Selector support alone does not authorize runtime rollout.

Bootstrap calls `loadApplicationConfig()` once and passes its result to
`AppModule.register(config)`. Nested LLM factories consume `MODEL_CONFIG` rather
than reinterpreting environment variables. Tests use explicit configuration
fixtures; the production OpenAI credential requirement remains enforced.

## Internal Choice contract

Inject `JevDecisionClient` through `LlmModule`. Its `configured` getter is true
only when both transport settings exist. Construction, startup, health/readiness
checks and OpenAI generation issue no TypeSafe requests. An explicit `choose()`
call on a configured client performs provider HTTP work; verification below uses
mocked responses instead.

[`JevChoiceRequest`](../src/llm/typesafe/jev-decision.types.ts) contains `task`,
`taskVersion`, `questionKey`, `state`, `instructions` and `criteria`. Tasks are
`product_resolution`, `product_understanding`, `shelf_life_policy` or
`stock_prediction`. Product-understanding and shelf-life choices have foundational
transport support from 38a; their domain adapters ship in
38b and 38c. Version, question and instructions
must be nonblank; state is a finite JSON object. Criteria contain 2-255 nonblank
option tokens with string, JSON object/array, or null rubrics. Validation rejects
cycles and non-JSON values before networking.

The client posts one question to `https://api.typesafe.ai/v1/systemone` using
Bearer authentication, JSON content type and `redirect: 'error'`:

```text
{ model, state, questions: { [questionKey]: { type: 'choice', instructions, criteria } } }
```

Task and adapter version are local provenance; they are not vendor request
fields. The [TypeSafe API](https://docs.typesafe.ai/api) defines the vendor protocol.

Success requires exactly the requested Choice answer, a selected requested
option, finite confidence/probabilities in `[0,1]`, exact probability option
coverage, a sum within `0.001` of one, and a maximum-probability selected option
(ties allowed). Resolved model must be versioned; input/output token usage must
be nonnegative safe integers. Extra envelope metadata is ignored.

The result is either `status: 'success'` with actual resolved model, task/version,
choice, confidence, probabilities and usage, or `status: 'unavailable'` with
requested model when configured, task/version and a safe reason. Provider errors,
headers, credentials and raw payloads are not included in results. Transport
validation does not apply a domain confidence threshold or persist provenance.
Task adapters own acceptance policies; confidence differs from the selected
option probability and does not establish household outcome accuracy.

## Deadline and failures

The single monotonic budget is 10,000 ms for product resolution and product
understanding, and 15,000 ms for stock prediction and shelf-life policy choices,
including preparation, fetch, body consumption and retry delay.
AbortController cancels fetch/body work on expiry. Timers are cleared on exit,
and late promise rejections are contained.

Only HTTP 429, 529, 500, 502, 503 and 504 permit one retry, for at most two
attempts. Backoff is 250 ms plus 0-250 ms jitter. Valid `Retry-After` delta seconds
or HTTP dates increase the delay when longer; malformed values are ignored.
If the required delay consumes the remaining budget, the client immediately
returns `deadline_exceeded` without another request. Attempt two reuses the
original deadline. The first transient response body is canceled before retry;
that cancellation also shares the budget. There is no OpenAI fallback call.

| Condition                                             | Safe reason            |
| ----------------------------------------------------- | ---------------------- |
| Missing transport key or model                        | `not_configured`       |
| Invalid request                                       | `invalid_request`      |
| Overall deadline exhausted or insufficient retry time | `deadline_exceeded`    |
| HTTP 401/403                                          | `authentication_error` |
| Other non-retryable 4xx                               | `request_rejected`     |
| Exhausted HTTP 429                                    | `rate_limited`         |
| Other failed HTTP statuses                            | `provider_error`       |
| Fetch/body/cancellation exception                     | `network_error`        |
| Invalid success JSON or schema                        | `invalid_response`     |

Deadline expiry takes precedence over another failure. Network exceptions,
authentication, validation, malformed success and cancellation do not trigger
retries. Deadlines, retry limits and probability tolerances are service policies,
not vendor performance guarantees.

## Verify without paid calls

From a checkout with dependencies and generated Prisma client already installed:

```bash
npm run test -- --runInBand src/config/application-config.spec.ts src/llm/llm.module.spec.ts src/llm/typesafe
npm run verify
npm run contract:check
npm run test:e2e -- --runInBand test/app.e2e-spec.ts test/service-auth.e2e-spec.ts test/model-configuration.e2e-spec.ts
```

The focused unit suites mock provider HTTP and cover staged selection errors,
explicit injection, response validation, both deadlines, retries and cleanup.
The selected HTTP suites start Nest with stubbed persistence and private test
credentials; they require no running database. They verify liveness, readiness,
service authentication and grocery reads, and assert zero provider fetches with
configured Jev credentials. Contract checks cover the existing REST/MCP agent
contracts. Other PostgreSQL end-to-end suites require an isolated migrated test
database; see their repository harness before running the full suite.

Live paid connectivity, task evaluation and rollout are outside 37b. Matching
evaluation is 37c; prediction evaluation is 37e.


## Product matching policy (37b)

`ProductResolutionService` runs the existing deterministic search first. Exact
canonical/alias matches bypass both advisors. It retains the maximum 20 candidates
and complete normalized context limit of 16,384 UTF-8 bytes. Invalid or oversized
context preserves search results with null advice. The injectable
`PRODUCT_RESOLUTION_ADVISOR` port selects OpenAI by default through `MODEL_CONFIG`;
OpenAI keeps its existing 0.7 proposal gate and product-creation advice.

The Jev adapter makes one bounded `product_resolution` Choice request, with version
`jev-product-resolution-v1` and question `product_match`. Candidate tokens are
`candidate_0`, `candidate_1`, etc., independent of catalog IDs; `ambiguous` and
`no_match` are separate options. Only validated candidate identity facts and the
requested phrase are sent. Brand, size, variant, category and units matter when
provided. Related products need not be the same item. Text is evidence rather
than instructions.

| Validated decision | Advisory result |
| --- | --- |
| Known candidate, confidence >= 0.9 | `add_alias` for its supplied ID and the normalized requested phrase |
| `ambiguous`, confidence >= 0.9, at least two candidates | `ask_user_to_choose` with all bounded candidates in search order |
| `no_match`, lower confidence, insufficient candidates, invalid data or failure | Null proposal, original search results preserved |

Zero candidates bypass Jev entirely. Duplicate candidate IDs and invalid context
also bypass it. Reasons are fixed local text, not generated metadata. The 0.9 gate
applies to matching and ambiguity; it is provisional service policy, not calibrated
accuracy. The adapter reuses transport deadlines/retries and never falls back to
an implicit OpenAI call or manufactures a `create_product` proposal.

All proposals remain advice. Nonexact grocery additions return
`product_resolution_required`, the original quantity/unit/note request echo,
candidates and existing `allowedActions`. With no candidates, explicit
create/cancel remains available; with candidates, selection and alias confirmation
also remain available. Explicit grocery catalog confirmation and stock product
confirmation retain their existing validation, transactions and conflict behavior.
A Jev decision does not authorize a catalog, grocery, stock or purchase write.

Accepted advice uses existing inference-log fields: provider `typesafe`, actual
resolved response model, prompt version `jev-product-resolution-v1`, confidence,
and `{ status: 'validated', proposal }`. OpenAI retains `product-resolution-v1`.
No migration is required. No raw context, credentials, provider errors, or probability
maps are persisted; log failures do not block advisory resolution.

For focused verification, use the repository's isolated migrated PostgreSQL test
setup with `DATABASE_URL` pointing only to that test database:

```bash
npm run test -- --runInBand src/product src/config/application-config.spec.ts src/llm/llm.module.spec.ts src/llm/typesafe
npm run test:e2e -- --runInBand test/jev-product-matching.e2e-spec.ts test/model-configuration.e2e-spec.ts test/product-resolution.service.e2e-spec.ts test/policy-aware-grocery.service.e2e-spec.ts test/policy-aware-grocery.rest.e2e-spec.ts test/policy-aware-grocery.mcp.e2e-spec.ts test/confirmed-grocery-catalog.rest.e2e-spec.ts test/stock-product-confirmation.e2e-spec.ts
npm run verify
npm run contract:check
```

The Jev integration suite mocks provider HTTP while exercising real Nest routing,
REST/MCP requests, confirmation, domain-state counts, and persisted provenance.
This proves wiring and safety, not live model matching accuracy. Configuration
HTTP tests cover both selectors without provider requests during startup,
health/readiness or exact-match resolution. No public REST/MCP shape or agent
bundle version changes in 37b.

If explicitly selected matching needs reverting, set
`PRODUCT_RESOLUTION_PROVIDER=openai` and restart the backend. Preserve existing
TypeSafe logs; no data deletion or reclassification is needed. Enabling matching
in a real runtime remains a separate operator action after 37c evaluation.

## Product-matching evaluation

Feature 37c adds a local CLI. It never bootstraps the application, connects to
PostgreSQL, writes inference logs or changes runtime provider selectors. The
default mode requires an explicit offline replay file. Live requests require
`--live`; credentials alone never trigger a provider request.

Install the project's existing dependencies and generate Prisma types through
the normal project setup. No new package or database is required for evaluation.
From the repository root:

```bash
mkdir -p evaluation/product-matching/reports
npm run eval:product-matching -- --recorded evaluation/product-matching/recorded-smoke.v1.json --output evaluation/product-matching/reports/offline.json
```

Output paths must be new; the CLI creates reports with mode 0600 and refuses
overwriting an existing file. Local reports are ignored by Git. The supplied
replay deliberately contains synthetic perfect answers: its 60/60 matching
precision is harness evidence, not live model accuracy. Output is explicitly
`offline`, with launch evidence `inconclusive`.

Review [the corpus and label-review checklist](../evaluation/product-matching/README.md)
before live evaluation. All initial labels are authored and unreviewed; do not
mark them reviewed without a separate person's actual review. Dataset and
selected-input hashes bind replay files and reports to the frozen inputs.

### Private live setup

Obtain a TypeSafe credential through your private account setup and store it as
`TYPESAFE_API_KEY` in the invoking process environment. Set `JEV_MODEL` to a pinned
version your account supports. The CLI accepts only `jev-<major>.<minor>.<patch>`;
it deliberately rejects moving aliases. On 2026-10-01 the official documentation
lists `jev-1.13.0`, and describes resolved response model IDs and account model
listing. Check support for your account before using that pin.
[TypeSafe models](https://docs.typesafe.ai/models).

The CLI uses the shipped client and its Bearer-authenticated decision endpoint.
It does not accept keys in command-line arguments, implicitly load `.env`, or
require an OpenAI key, database URL or service auth token.
[TypeSafe API](https://docs.typesafe.ai/api).

After explicit operator authorization for paid provider requests, test one
separate synthetic connectivity case:

```bash
npm run eval:product-matching -- --live --smoke --output evaluation/product-matching/reports/live-connectivity.json
```

This report always remains ineligible for launch. Then, after label review,
freeze the corpus and evaluate tuning and held-out cases separately:

```bash
npm run eval:product-matching -- --live --split tuning --output evaluation/product-matching/reports/live-tuning.json
npm run eval:product-matching -- --live --split held_out --output evaluation/product-matching/reports/live-held-out.json
```

Only context phrase and candidate identity facts enter the provider request.
Labels, review metadata, split names and group IDs stay local. The runner is
serial with at most 200 cases, uses the existing 10-second per-case deadline and
at-most-one transport retry, and adds no wrapper retries or OpenAI fallback.
On SIGINT/SIGTERM it stops after the bounded active call and writes an incomplete
report (exit 130). Invalid input exits 1; failed accuracy/safety evidence exits 2;
a completed inconclusive run exits 0. Exit 0 does not approve rollout.

### Reading evidence and deciding rollout

Reports retain safe decision summaries, IDs, confidence, elapsed time, validated
token usage, model/version provenance, code revision and whether evaluation or
adapter sources are dirty. They omit phrases, alias/reason text, catalog objects,
raw responses/errors and credentials. Finish committing verified source changes
before collecting launch evidence; dirty source or unknown revision blocks eligibility.

Precision counts correct accepted targets divided by all accepted targets.
Selecting a candidate on ambiguous/no-match truth is wrong. Coverage includes
failed and skipped evaluated cases in its denominator; an interrupted run also
shows the selected-case count and is incomplete. No accepted targets means null
precision, not 100%. Reports include recall, clarification, null advice, unsafe
selections, transport failures and p50/p95 attempted-call latency (nearest rank).
Tokens sum validated successful calls only; failed-call usage is unknown, not
estimated. Offline timing/token figures are fixture values; only live runs
measure actual provider operation. Slice tags overlap and must not be added as a corpus total.

Launch evidence requires reviewed complete live held-out inputs, eligible corpus
counts, at least 50 accepted matches, precision >=98%, no unsafe ambiguous/no-match
selections or provider failures, and a single resolved model equal to the pin.
Review language slices, coverage, confidence intervals and authored-data limits
even when the result says `eligible`. Eligibility is an operator review input.
It never changes configuration. A model/prompt/mapping/gate change invalidates
the preceding assessment and requires fresh frozen held-out evidence.

After evidence review and separate deployment approval, set only
`PRODUCT_RESOLUTION_PROVIDER=typesafe`, retain `STOCK_PREDICTION_PROVIDER=openai`
and OpenAI generation, and restart through the existing deployment process.
Check `/ready` and a read-only unresolved-product clarification response;
proposals still require explicit catalog/grocery confirmation. Do not use an
unconfirmed alias write as a health check.

Rollback matching by setting `PRODUCT_RESOLUTION_PROVIDER=openai` and restarting.
Preserve TypeSafe inference provenance and all domain data. No migration, deletion
or historical reclassification is needed. Stock rollout requires reviewed 37e evidence.

### Verification

```bash
npm run test -- --runInBand src/evaluation/product-matching src/product/jev-product-resolution-advisor.service.spec.ts src/llm/typesafe
npm run verify
npm run contract:check
```

The evaluation tests mock provider HTTP and include a real offline subprocess
without DB/provider credentials, deliberate wrong-match evidence and overwrite
rejection. They do not establish live matching accuracy. If a restricted session
cannot run existing socket-based checks, retain that failure and rerun the full
gates in an environment allowing loopback listeners before completion.

## Stock advice (37d)

`StockPredictionAdvisor` is selected independently by
`STOCK_PREDICTION_PROVIDER`. OpenAI remains the default. Jev uses task
`stock_prediction`, question `stock_state`, version `jev-stock-prediction-v1`,
and the four `PredictedState` choices including `uncertain`. It reuses the shared
transport's abortable 15-second budget and bounded transient retry.

The advisor belongs to `PredictionEngine.predictProduct`, the existing internal
on-demand prediction capability. Inventory REST/MCP reads remain reads of
materialized stock; they do not recalculate or call advisors. Daily stock
materialization remains a separate deterministic workflow. Selecting Jev does
not introduce a new endpoint, attach AI to reads, or change daily quantity math.
Shelf-life inference and product classification continue through OpenAI generation.

| Evidence/result | Behavior |
| --- | --- |
| Disabled prediction | Existing disabled result; no advisor call |
| Zero valid relevant history events | Both providers return uncertain, confidence 0, action null, no advisor call, even with stale learned statistics |
| Authoritative direct signal | Jev bypass; preserve deterministic result |
| Non-uncertain deterministic confidence >= 0.8 | Existing bypass for both providers |
| Jev confidence < 0.9 or choice uncertain | Preserve deterministic fallback; log validated rejected attempt |
| Jev failure or malformed input/output | Preserve deterministic fallback; no validated attempt log |
| Accepted Jev choice | Preserve any non-uncertain deterministic state; confidence is min(deterministic, Jev); code explains final state; action null |

An uncertain nonzero cold start can adopt a Jev state only with at least two
valid relevant events, a learned-statistics row with at least two observations,
a finite positive purchase/need/consumption interval, and finite nonnegative
elapsed purchase/restock time. Otherwise it stays uncertain. This predicate and
the 0.9 gate are provisional service policies, not demonstrated accuracy.
OpenAI keeps its existing 0.65 acceptance gate and 70/30 blend for eligible
nonzero histories. Neither resulting confidence is a calibrated probability.

Jev evidence contains validated deterministic facts and relevant signals, with
ISO dates and household counts only. Child age groups and arbitrary household
preferences are excluded. Minimized evidence is limited to 16,384 UTF-8 bytes;
oversized evidence is rejected rather than truncated. Jev does not generate
explanations, actions, quantities, or authorize grocery/event/recorded-stock writes.

Accepted and rejected schema-valid answers use existing `LlmInferenceLog` fields:
`modelProvider=typesafe`, actual resolved `modelVersion`,
`promptVersion=jev-stock-prediction-v1`, returned confidence, and
`structuredResponse={ status: 'validated', accepted, value }`, where `value` has
the existing prediction-reasoning shape. Only accepted contributions populate
`Prediction.llmResult` and `modelProviderVersion`. OpenAI retains its historical
response shape and `prediction-reasoning-v1` version. No migration or historical
rewrite is needed. A log failure does not discard an already saved prediction ID.
No raw request/probability envelope, secrets or provider errors are persisted.
New Jev prediction snapshots also retain household counts with empty age groups
and null preferences; OpenAI's existing snapshots and historical rows stay intact.

Use an isolated migrated local test database, never the household database:

```bash
npm run test:e2e -- --runInBand test/jev-stock-prediction.e2e-spec.ts test/model-configuration.e2e-spec.ts test/estimation.e2e-spec.ts test/estimation-response.e2e-spec.ts test/daily-stock-workflow.e2e-spec.ts
npm run verify
npm run contract:check
```

The stock suite mocks HTTP while testing real Nest advisor selection, persisted
accepted/rejected provenance, zero-history behavior, unchanged REST/MCP reads,
and deterministic daily materialization with OpenAI shelf-life generation.
This establishes wiring and safety, not live stock accuracy. Feature 37e must
replay evidence without future leakage and review outcomes before changing the
runtime stock selector. Rollback selects `STOCK_PREDICTION_PROVIDER=openai` and
restarts the service, retaining all provenance and domain data.

## Stock evaluation (37e)

The local `eval:stock-prediction` command replays cutoff-safe historical inputs
through shared statistics, candidate and hybrid calculations and the shipped
Jev adapter. It never starts Nest or writes predictions, inference logs, events
or statistics. Daily materialization and public REST/MCP reads retain their
existing behavior. The fixed 0.9 acceptance gate, conservative confidence and
cold-start evidence predicate remain unchanged.

Start with the [authored offline safety corpus](../evaluation/stock-prediction/README.md):

```sh
npm run eval:stock-prediction -- --recorded evaluation/stock-prediction/recorded-safety.v1.json --output /private/tmp/stock-safety-report.json
```

This corpus intentionally includes failures and censored/missing outcomes. Its
13-case result is inconclusive launch evidence, not real stock accuracy. No
independently reviewed historical corpus or paid live held-out evidence has been
collected for this feature. Both runtime selector defaults remain OpenAI.

Follow the [historical review and stock-only rollout/rollback guide](../evaluation/stock-prediction/review-guide.md)
to attest cutoff snapshots, freeze independently reviewed labels, preserve
product groups/episodes across splits, collect private live evidence and inspect
coverage and slices. The versioned 24-hour confirmation policy is a near-term
proxy, with intervening balance mutations censored. Recomputed statistics measure
historical evidence, not exact cache fidelity.

Launch eligibility requires at least 95% binary accepted-final-low/out precision
on at least 50 scored accepted episodes, complete live held-out historical data,
frozen independent review, clean revision/model provenance and no provider
failures or invalid safety states. Missing prerequisites are inconclusive. Report
eligibility does not change configuration or authorize deployment. Only a separate
operator decision may change `STOCK_PREDICTION_PROVIDER`; rollback restores it to
`openai` and restarts while preserving matching configuration and historical data.

## JEV-first routing foundation (38a)

38a adds internal policy, choice vocabulary and provenance contracts. It does
not wire new adapters into application writes, schedule extra inference, change
provider defaults or enable JEV-driven recommendations. The existing generation
and decision selectors above retain their behavior. See the
[approved feature 38 plan](../blueprint/context/feature-plans/jev-first-application-inference.md)
for the domain adapters, stock projection integration and evaluated rollout.

### Capability routing

`decideModelRoute` validates a task, enabled flag, generation-attempt count and
unique per-field outcomes. Adapters retain domain values separately; routing
does not replace supplied values or accept provider-generated field names.

| Evidence | Policy |
| --- | --- |
| Supplied, deterministic or accepted validated value | No model call for that field |
| Required unresolved field with supported choices | JEV before eligible generation |
| Required information outside supported choices, explicitly suitable for generation | OpenAI for only those unresolved fields |
| Unknown, low confidence, ambiguity, rejected schema or provider failure | Unresolved; no automatic OpenAI escalation |
| Optional missing field or disabled task | No model call |
| A generation attempt already used | No further OpenAI generation for the operation |

JEV choices are allowed for product matching, category, typical unit, product
type, perishability, shelf-life policy and stock state. Unsupported required
generation is allowed only for category, typical unit and shelf-life policy.
Canonical names and aliases are excluded from both choice and generation in
the product-understanding policy: keep the entered name and use explicit alias
confirmation. Existing application behavior changes with the later adapters,
not merely by importing this policy.

`unknown` does not establish that no allowed category fits. The domain adapter
must distinguish insufficient evidence from a supported determination that the
needed value cannot be represented by its choices. It must not turn every
abstention into `unsupported`. Accepted/supplied fields are never included in
OpenAI generation. Logical attempt limits do not override provider SDK retries;
integrated adapters must bound those HTTP attempts and the overall deadline.

### Versioned choice vocabulary

`buildChoiceVocabulary` accepts category/unit labels and a finite JSON context.
It returns a complete vocabulary or an explicit unsupported reason, never a
truncated subset. Existing labels retain their exact display spelling. Exact
duplicates collapse; distinct labels with the same NFKC/lowercase/whitespace
normalization return `ambiguous_labels` for review. Ordering is locale-independent.

Empty inputs use `product-category-v1` (12 household category seeds) or
`product-unit-v1` (`item`, `pack`, `kg`, `g`, `liter`, `ml`). Nonempty inputs use
only the supplied labels. These manifests are choice options, not database
enums, category migrations or restrictions on explicit legacy units. Changing
the seed definitions requires a vocabulary version change and fresh evaluation.

Domain labels map to opaque `choice_N` tokens. The separate `unknown` token maps
to null; a real stored label such as `unknown` or `__proto__` still gets its own
opaque domain token. `resolveVocabularyChoice` returns a resolved exact label,
unknown, or invalid choice; it never accepts an unrequested answer token.

The limit is 254 domain options plus unknown. Prepared `{ state, criteria }`
must fit 16,384 UTF-8 bytes, including option labels. Oversized options/context,
normalization collisions and malformed input return explicit unsupported results.
Adapters must recheck their complete prepared context if they add evidence or
criteria. Returned evidence is detached from caller mutation. Builders do not
query or modify the database or call either provider.

### Safe attempt provenance

`validateDecisionAttemptProvenance` validates operation/field identities, local
routing reason, task/vocabulary version, status, provider/model, elapsed time and
optional validated token usage. It rejects unrelated/raw payload fields, duplicate
or wrong-task fields, nonfinite numbers, invalid token counts, accessors and
non-JSON values. Accepted/rejected TypeSafe answers require a pinned resolved
model and validated usage. Unavailable attempts require a safe reason and omit
resolved model/usage; failed-call usage remains unknown. OpenAI usage may be
omitted because the current generation interface does not expose token counts.
Persistence adapters must use the validated shape; 38a adds no database logging
or migration. No monetary savings are inferred without an explicit price table.

### Future selectors and rollback

38b will introduce `PRODUCT_UNDERSTANDING_PROVIDER`; 38c will introduce
`SHELF_LIFE_POLICY_PROVIDER`. Both are planned to accept `openai|typesafe`, default
to `openai`, and enforce private TypeSafe credentials plus a pinned model when
selected. They are not parsed or active in 38a. Keep them out of runtime setup
until the matching adapters are available. `LLM_PROVIDER=openai` and the private
OpenAI key remain required for generation fallback. Feature 38e reviews and
enables validated task-specific JEV routing, with independent rollback controls.

### Verify the foundation without paid calls

```sh
npm run test -- --runInBand src/llm/decision-routing src/llm/typesafe src/product
npm run verify
npm run contract:check
npm run test:e2e -- --runInBand test/model-configuration.e2e-spec.ts
```

The dispatch regression harness verifies policy-selected provider call counts
and field scopes using stubs. It does not claim integrated application routing
or model accuracy. Real resolver tests prove exact matches bypass OpenAI and
JEV advice. The configuration HTTP suite uses stubbed persistence and tests
unchanged defaults, selectors and no-call bootstrap/read behavior.
