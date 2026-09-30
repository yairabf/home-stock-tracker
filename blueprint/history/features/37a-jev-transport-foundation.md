# Feature: Jev transport foundation

**From build-plan:** feature 37a, under 37 (Jev bounded-decision integration)
**Status:** verified
**Source:** [Jev integration PRD](../../../docs/home-stock-tracker-jev-integration-prd.md), sections 4, 5, 8, and 13.
**Branch when implemented:** `feature/jev-transport-foundation`

## Goal

Provide a tested, injectable TypeSafe Choice client with validated configuration,
strict response checking, bounded cancellation, and explicit failure results.
Establish the transport contract used by product matching in 37b and prediction
in 37d. Existing application defaults remain OpenAI.

## In scope

- Validated model settings through `application-config.ts`, consistently injected
  into affected Nest factories.
- Both task selector names, optional Jev credentials/pinned model, and explicit
  rejection of task adapters that have not been implemented yet.
- Native fetch for one explicitly constructed Choice question per call.
- Unknown-response validation, resolved-model provenance, validated token usage.
- A single deadline covering network, body consumption, and any retry delay.
- At most one eligible retry; safe unavailable results; mocked HTTP tests.
- Export an injectable decision client for future advisors and document setup.

## Out of scope

- Product/prediction advisors, candidate mappings, confidence gates, catalog
  confirmation changes, zero-history guards, and state/confidence composition.
- Classifier/shelf-life generation, REST/MCP DTOs, Hermes, inventory events,
  ledger arithmetic, scheduler timing, and recommendation changes.
- Prisma migrations or persisted inference logs; provenance integration is 37b/37d.
- Live paid calls, evaluation scripts/data, rollout, and deployment (37c/37e).
- OpenAI fallback calls, a configuration framework, vendor SDK, arbitrary schema
  conversion, Score/Noul support, or replacing `LlmProvider` with Jev.

## Build loop

1. Describe one step before implementation.
2. Implement that step and its focused tests on the feature branch.
3. Show the diff and observable done-when evidence.
4. Obtain review before continuing. Checkpoint commits require approval and passing
   checks; `/complete` owns the archive and final feature commit.

## Build steps

- [x] **Step 1 - Validated model configuration.** Add typed selectors and Jev
  settings; preserve production OpenAI requirements. Test defaults, invalid
  settings, conditional credentials, pinned models, and unavailable task selection.
  *Done when:* existing valid env needs no Jev key, selectors default to `openai`,
  malformed/premature selections fail without echoing configuration values.
  *Evidence (2026-09-30):* implementation passes 52 focused config tests and
  `npm run verify` (74 suites, 1,086 tests, production build). Targeted ESLint
  and `git diff --check` pass; `graphify update .` completed. Step 1
  approved by the user with "continue"; no checkpoint commit requested.
- [x] **Step 2 - Consistent injection.** Supply resolved model configuration to
  OpenAI factories and the configured/disabled decision client. Remove separate
  env interpretation from `LlmModule` factories. *Done when:* injected fixtures win
  over conflicting env, OpenAI remains the generation provider, isolated no-key
  provider tests use explicit fixtures, and module compilation makes no Jev call.
  *Evidence (2026-09-30):* 57 focused configuration/module tests pass.
  `npm run verify` passes (74 suites, 1,089 tests, production build).
  `npm run test:e2e -- --runInBand` passes in an isolated temporary database
  (36 suites, 295 tests), which was removed afterward. HTTP startup, health,
  readiness and authenticated grocery reads prove zero provider requests with
  configured Jev settings and mocked persistence. `npm run contract:check`
  passes (124 scenarios; 6 suites, 79 tests). Targeted ESLint and diff checks
  pass; graphify was refreshed. Step 2 approved by the user with "continue". The registered client
  contains configuration only; Choice validation and HTTP follow in Steps 3-4.
- [x] **Step 3 - Choice protocol and validator.** Define the internal contracts
  below; validate requests and unknown responses independently of HTTP. *Done
  when:* valid answers/ties pass and malformed models, keys, options, probabilities,
  confidence, and usage return typed failure without raw payloads.
  *Evidence (2026-09-30):* 124 focused validator tests pass, including JSON
  cycles/non-JSON values, own reserved-looking keys, probability coverage/range/
  sum boundaries/ties, confidence, resolved models, usage and safe failures.
  `npm run verify` passes (75 suites, 1,213 tests, production build); targeted
  ESLint and `git diff --check` pass. `graphify update .` completed.
  Step 3 approved by the user with "continue"; validators are independent of HTTP.
- [x] **Step 4 - Cancellable HTTP.** Implement authenticated JSON fetch to the fixed
  endpoint with redirects disabled and errors contained. *Done when:* mock evidence
  proves endpoint/body/auth/signal, unconfigured calls issue zero requests, hanging
  fetch and response-body reads abort within budget, and successes retain the actual
  response model and task version.
  *Evidence (2026-09-30):* 38 mocked HTTP/deadline tests pass; 167 focused
  client/validator/module tests pass together. Coverage proves endpoint, exact
  body/auth/signal, disabled zero requests, safe HTTP/network/body failures,
  resolved-model/task provenance, hanging fetch/body aborts, a shared monotonic
  budget, late rejection containment and timer cleanup. `npm run verify`
  passes (76 suites, 1,251 tests, production build). Focused HTTP startup suites
  pass (3 suites, 10 tests), including health/readiness/authenticated grocery
  reads without provider traffic. Targeted ESLint and diff checks pass;
  graphify was refreshed. Step 4 approved by the user with "continue";
  no checkpoint commit requested.
- [x] **Step 5 - Retry within one budget.** Add one retry for eligible transient
  statuses with jitter/backoff and bounded Retry-After. *Done when:* tests prove at
  most two attempts, no retry on auth/validation/malformed success, no deadline reset,
  no request after cancellation, and timer cleanup on every exit.
  *Evidence (2026-09-30):* 88 mocked HTTP/deadline tests pass; 217 focused
  client/validator/module tests pass together. Coverage proves the six eligible
  statuses, the two-attempt limit, 250-500 ms jitter, Retry-After seconds and all
  three UTC HTTP-date formats, malformed/excessive values, safe second failures,
  shared fetch/delay/body deadlines, no retry after expiry, bounded response-body
  cancellation and timer cleanup on every exit. `npm run verify` passes
  (76 suites, 1,301 tests, production build). Targeted ESLint and diff checks pass;
  `graphify update .` completed. No live provider calls or checkpoint commits.
  Step 5 approved by the user with "continue"; no checkpoint commit requested.
- [x] **Step 6 - Setup and compatibility evidence.** Add commented Jev settings to
  `.env.example` and transport/setup notes in `docs/jev-integration.md`. *Done when:*
  examples contain no secrets or active premature routing, `npm run verify` and
  contract checks pass, and affected HTTP/module evidence shows no paid Jev calls.
  *Evidence (2026-09-30):* `.env.example` adds only commented task/Jev settings;
  `docs/jev-integration.md` records configuration, staged capabilities, Choice
  contracts, deadlines, retries, safe results and verification without paid calls.
  The example parses and validates with OpenAI task defaults and absent Jev
  settings; local documentation links resolve. `npm run verify` passes
  (76 suites, 1,301 tests, production build); focused config/module/transport
  tests pass (4 suites, 269 tests). `npm run contract:check` passes
  (124 scenarios; 6 suites, 79 tests). Selected HTTP startup/auth/configuration
  suites pass (3 suites, 10 tests), asserting zero provider fetches with configured
  Jev settings and stubbed persistence. Diff checks pass. No source changes in
  Step 6; the graph remains refreshed from Step 5. No live paid calls, commits,
  merge, push or deployment. All six steps are built and verified;
  Step 6 approved by the user with "continue"; no checkpoint commit requested.
  Implementation is verified and ready for `/complete`.

## Files / areas

| Area | Expected changes |
| --- | --- |
| `src/config/application-config.ts`, adjacent specs | Shared validation, selectors, credentials, staged capability errors |
| `src/config/`, `src/main.ts`, `src/app.module.ts` as needed | Small config token/registration carrying resolved model settings |
| `src/llm/llm.module.ts`, adjacent specs | Inject settings, retain generation provider, export decision client |
| `src/llm/typesafe/jev-decision.types.ts` | Internal Choice request/result types |
| `src/llm/typesafe/jev-decision.validation.ts`, adjacent specs | Request and unknown-response validation |
| `src/llm/typesafe/jev-decision.client.ts`, adjacent specs | Fetch, cancellation, safe failures, bounded retry |
| `.env.example`, `docs/jev-integration.md` | Private setup and capability/transport contract |
| Affected existing test fixtures | Explicit injection without weakening production validation |

Split Step 2 if its test-fixture changes exceed one reviewable diff. Avoid unrelated
auth, database, or scheduler configuration refactors.

## Data / contracts

### Configuration (load-bearing for 37b/37d)

| Setting | Contract |
| --- | --- |
| `LLM_PROVIDER`, `LLM_MODEL`, `OPENAI_API_KEY` | Existing OpenAI generation semantics and production credential requirement |
| `PRODUCT_RESOLUTION_PROVIDER` | `openai` or `typesafe`; default `openai` |
| `STOCK_PREDICTION_PROVIDER` | `openai` or `typesafe`; default `openai` |
| `TYPESAFE_API_KEY` | Optional private nonblank key; required when either selector is TypeSafe |
| `JEV_MODEL` | Optional explicit versioned ID; required with TypeSafe; no moving alias/default |

Follow existing trimming/nonblank conventions. Commented examples pin
`jev-1.13.0`, currently documented as supported. Accept versioned IDs matching
`jev-<major>.<minor>.<patch>`; reject `jev-latest`/`jev-preview`. Syntax does not prove
account availability; an unsupported model fails safely at call time. Provided
optional settings must be well formed; missing Jev settings do not block OpenAI.

**Staged capability:** after validating selector vocabulary and conditional Jev
requirements, 37a rejects `typesafe` for either task with a clear adapter-not-
available startup error. Never silently substitute OpenAI. Feature 37b removes
only the resolution guard; 37d removes only the prediction guard. With both tasks
on OpenAI, configured Jev settings allow isolated transport tests without domain
routing changes.

Production bootstrap validates model settings once and passes that resolved object
to affected factories through a small injection token/registration. Tests supply
explicit fixtures, including the existing isolated unavailable-OpenAI case.
`loadApplicationConfig` must continue requiring the production OpenAI key.

### Internal Choice request (load-bearing)

`JevChoiceRequest` contains:

- `task`: `product_resolution` or `stock_prediction`.
- `taskVersion`: nonblank server-owned adapter version; future adapters use
  `jev-product-resolution-v1` and `jev-stock-prediction-v1`.
- `questionKey`: nonblank internal answer key.
- `state`: finite JSON object assembled by the future task adapter.
- `instructions`: nonblank task instructions.
- `criteria`: map of 2-255 unique nonblank option tokens to rubric strings, JSON
  objects/arrays, or null (no numeric/boolean rubric at the top level).

Validate before network access; reject non-JSON values and cycles. Treat option
and key membership as own properties, safely handling reserved-looking names.
Do not convert generation schemas into vendor questions.

POST `https://api.typesafe.ai/v1/systemone` with Bearer auth and JSON:

```text
{ model, state, questions: { [questionKey]: { type: 'choice', instructions, criteria } } }
```

Task/version fields are local provenance, not additional vendor request fields.

### Validated response and result (load-bearing)

Read the response as unknown. Require a nonblank versioned resolved `model`, an
`answers` map containing exactly the requested question, and a Choice answer with
`type: 'choice'`, `choice`, `confidence`, and `probabilities`. Require:

- Selected choice belongs to the requested options.
- Confidence and probabilities are finite values in `[0,1]`.
- Probability keys cover exactly all requested options; their sum differs from
  one by at most `0.001`; the selected option has maximum probability (ties allowed).
- Required `usage.input_tokens`/`output_tokens` are nonnegative safe integers.

Ignore unrelated envelope metadata; never return the raw response. Results form a
discriminated union:

- **Success:** `status: 'success'`, `provider: 'typesafe'`, actual resolved `model`,
  `task`, `taskVersion`, `choice`, `confidence`, validated `probabilities`, token usage.
- **Unavailable:** `status: 'unavailable'`, `provider: 'typesafe'`, requested model
  when configured, `task`, `taskVersion`, and safe reason enum: `not_configured`,
  `invalid_request`, `deadline_exceeded`, `authentication_error`, `request_rejected`,
  `rate_limited`, `provider_error`, `network_error`, or `invalid_response`.

Do not expose exceptions, raw errors, response headers, keys, or prompts. The
transport validates structure; future task adapters apply the `0.9` acceptance
policy and existing Zod domain schemas. Vendor confidence is distinct from the
selected option probability; neither proves household outcome accuracy.

### Deadline and retry

- Total task budget: resolution 10,000 ms; prediction 15,000 ms, covering all
  attempts, delays, and response-body consumption. Use monotonic elapsed time.
- AbortController cancels actual fetch/body work on expiry; a Promise race alone
  is insufficient. Contain late rejection and clear timers on every exit.
- At most one retry for HTTP 429, 529, 500, 502, 503, or 504. No retry for other
  statuses, network exceptions, malformed success, validation, auth, or cancellation.
- Backoff: 250 ms plus jitter in `[0,250]` ms. Honor valid Retry-After delta seconds
  or HTTP date by waiting at least the greater of that interval and local backoff;
  ignore malformed values. If delay consumes the remaining budget, stop without
  another attempt. Attempt two never receives a fresh deadline.
- Construction, startup, readiness, and OpenAI execution issue no TypeSafe calls.
  The client cannot invoke OpenAI fallback.

No persistence schema or public REST/MCP contract changes in 37a.

Classify HTTP 401/403 as `authentication_error`, other non-retryable 4xx as
`request_rejected`, exhausted 429 as `rate_limited`, and other failed HTTP statuses
as `provider_error`. Invalid JSON/schema is `invalid_response`; body/network
exceptions are `network_error` unless the overall deadline has expired, which
takes precedence as `deadline_exceeded`. A throwing/unconfigured transport never
lets provider exceptions reach domain mutation workflows.

## Testing

Existing Jest tests live next to source. Use fake timers and AbortSignal-aware
mocked fetch/body responses; each logic-bearing step ships its tests.

| Coverage | Required evidence |
| --- | --- |
| Configuration | Defaults, production key requirement, selectors, missing/blank settings, pinned IDs, safe errors, staged guards |
| Injection | Fixtures win over env; OpenAI generation routing; unavailable isolated provider; no startup request |
| Validation | Key/type/option errors, exact probability coverage, NaN/infinity/range/sum boundaries, ties, model/usage errors, reserved-looking tokens |
| HTTP | Exact request/auth, unconfigured zero requests, safe HTTP/network/body failures, resolved-model metadata |
| Deadline | Hanging fetch/body abort; overall retry budget; late rejection containment; timer cleanup |
| Retry | Status table, Retry-After seconds/date/malformed/excessive values, jitter bounds, attempt limit, second failure, ineligible failures |
| Compatibility | Existing OpenAI/product/estimation/shelf-life tests, affected HTTP startup, MCP schema fixtures |

Focused checks: `npm run test -- --runInBand <affected-spec-paths>`.
Final required gate: `npm run verify` (unit suite then production build).
Run `npm run contract:check` and affected end-to-end suites via
`npm run test:e2e -- --runInBand` with the repository's required test database/env
when wiring changes affect them. Report missing prerequisites; skipped evidence
is not a pass. No separate typecheck/browser runner is declared.

Direct Check: boot with private test credentials and OpenAI task defaults; prove
`/health` and authenticated read compatibility without TypeSafe traffic. Premature
TypeSafe routing fails before serving traffic. Paid connectivity/language-domain
evaluation waits for 37c. No visual design reference is needed for this backend.

## Notes for the AI

- Backend only; keep private keys out of examples, logs, errors, test output,
  API responses, and inference payloads.
- Follow Nest DI, thin boundaries, existing Zod, and native fetch; install no SDK,
  test runner, or generic framework.
- OperationalLogger currently types its LLM provider as OpenAI. Return safe
  transport failures without misattributing Jev; persisted task logs are later work.
- Transport has no mutation authority or demonstration endpoint. Preserve
  deterministic facts and confirmed user data.
- Recheck official protocol/model support before implementation. No paid provider
  calls or evaluation have been performed for this spec.
- After source changes, run `graphify update .`; planning changes do not require it.

## Spec critique

- Split shared transport from task mapping and separate evaluation releases.
- Closed premature routing with explicit unavailable-adapter startup errors.
- Covered hanging bodies, shared retry budgets, tied maxima, probability keys,
  usage validation, safe failure shapes, and configuration fixture conflicts.
- Locked internal Choice/provenance contracts without new Prisma fields or public
  DTOs. Empirical acceptance gates remain in evaluation features.

## Protocol references

Checked on 2026-09-30:

- [TypeSafe API](https://docs.typesafe.ai/api): endpoint, Choice criteria/answers,
  usage, rate limits, and overload statuses.
- [TypeSafe confidence](https://docs.typesafe.ai/confidence): distribution-derived
  confidence and domain-specific threshold evaluation.
- [TypeSafe models](https://docs.typesafe.ai/models): documented `jev-1.13.0`, moving
  aliases, and actual resolved-model response metadata.

Deadlines, retry budget, sum tolerance, and staged capability rules are service
policies, not vendor performance guarantees.

## Completion safety pass (2026-09-30)

- All six implementation steps approved by the user on
  `feature/jev-transport-foundation`.
- Final `npm run verify`: 76 suites, 1,301 tests and production build passed.
- Final `npm run contract:check`: 124 scenarios; 6 suites, 79 tests passed.
- Final `npm run test:e2e -- --runInBand test/app.e2e-spec.ts test/service-auth.e2e-spec.ts test/model-configuration.e2e-spec.ts`:
  3 suites, 10 tests passed with stubbed persistence and no provider fetches.
- No findings; no independent review requested. Regular audit, independent review,
  check and try-guide policies are manual. No UI done-when applies.
- Manual try path: `npm run test -- --runInBand src/llm/typesafe/jev-decision.client.spec.ts`
  runs 88 mocked HTTP/deadline cases without paid calls. Setup is documented in
  `docs/jev-integration.md`.
- Parent feature 37 and subfeatures 37b-37e remain planned. No live paid
  connectivity or task evaluation performed; task selection remains guarded.
- Work commit prepared by Complete; squash merge requires separate approval.
