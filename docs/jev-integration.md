# Jev transport foundation

Feature 37a exports an injectable `JevDecisionClient` from `LlmModule` for future
bounded decisions. Product matching (37b) and stock prediction (37d) will supply
their own adapters. Generation, including classification and shelf life, continues
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

Selecting `typesafe` first requires its key and pinned model, then fails startup
with `<TASK_SELECTOR> typesafe adapter is not available`. Feature 37b will remove
only the resolution guard; 37d will remove only the prediction guard. Supplying
Jev credentials while both selectors remain OpenAI configures the transport but
does not route domain calls to it.

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
`product_resolution` or `stock_prediction`. Version, question and instructions
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
Future adapters own acceptance policies; confidence differs from the selected
option probability and does not establish household outcome accuracy.

## Deadline and failures

The single monotonic budget is 10,000 ms for resolution and 15,000 ms for
prediction, including preparation, fetch, body consumption and retry delay.
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

Live paid connectivity, task evaluation, rollout and persisted inference logs are
outside 37a. Matching evaluation is 37c; prediction evaluation is 37e.
