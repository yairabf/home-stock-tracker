# Jev transport and product matching

Feature 37a exports an injectable `JevDecisionClient` from `LlmModule` for
bounded decisions. Feature 37b adds task-specific product-resolution advisors.
Stock prediction routing remains unavailable until 37d. Generation, including classification and shelf life, continues
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
`STOCK_PREDICTION_PROVIDER=typesafe` still fails startup with
`STOCK_PREDICTION_PROVIDER typesafe adapter is not available`; 37d owns that
adapter. Supplying Jev credentials while both selectors remain OpenAI configures
the transport but does not route domain calls to it. Keep runtime matching on
OpenAI until the separate 37c evaluation and rollout review.

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
Task adapters own acceptance policies; confidence differs from the selected
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
