# Feature: Operational visibility

**From build-plan:** feature 17
**Status:** complete
**Archive:** `blueprint/history/features/17-operational-visibility.md`

## Completion record

- **Completed:** 2026-08-28
- **Delivered:** Added unauthenticated, unprefixed process-liveness and
  PostgreSQL-readiness probes; configured NestJS single-line JSON logging with a
  validated `LOG_LEVEL`; and introduced allowlisted operational events for
  inventory mutations, prediction success/fallback/persistence, OpenAI failures,
  and MCP domain or unexpected failures. Existing domain, prediction fallback,
  REST, and MCP response behavior remains unchanged, while caught provider,
  database, request, and credential details are excluded from operational logs.
- **Changed areas:** Added the global observability contract and tests under
  `src/observability/`; added the health module, probe DTOs, and HTTP coverage
  under `src/health/`; added a narrow public-route decorator to `src/auth/`;
  configured bootstrap/module wiring in `src/main.ts` and `src/app.module.ts`;
  instrumented inventory, estimation, recommendation, OpenAI, and MCP boundaries;
  documented `LOG_LEVEL` in `.env.example`; and refreshed `graphify-out/`.
- **Verification:** `npm run test -- --runInBand` passed 29 suites and 312 tests;
  the focused operational gate passed 9 suites and 174 tests; `npm run build`
  passed; scoped ESLint over changed production and focused test files passed;
  `git diff --check` passed; HTTP contract tests observed public `/health` and
  `/ready`, sanitized database-down `503`, and continued `401` protection for a
  business route; and an in-memory capture parsed real JSON for
  `inventory.action`, `prediction.run`, and `integration.mcp` while confirming
  injected secret/payload sentinels were absent.
- **Deviations:** `npm run test:e2e -- --runInBand` passed 3 non-database suites
  and 8 tests, but PostgreSQL refused connections on `localhost:5432`; 5
  database-backed suites were environmentally blocked, causing 41 downstream
  failures. Request correlation IDs, metrics, tracing, latency reporting, and
  vendor-specific observability remain out of scope as planned.

## Goal

Expose deployment-friendly liveness and readiness probes, and emit consistent
structured logs for the inventory mutations, prediction work, and integration
failures that operators need to diagnose. Probes and logs must reveal service
state without exposing bearer tokens, household data, prompts, or provider
responses.

## In scope

- Add unauthenticated, unprefixed `GET /health` and `GET /ready` endpoints.
- Make liveness depend only on the running NestJS process.
- Make readiness verify PostgreSQL connectivity and return a sanitized failure
  without invoking the LLM or another external integration.
- Configure NestJS console output as structured JSON, controlled by the existing
  `LOG_LEVEL` environment variable with a documented default.
- Define a small operational-event contract and stable event names for successful
  inventory actions, prediction outcomes, and integration failures.
- Instrument the existing REST/MCP-backed domain paths at their transaction or
  operation boundaries, avoiding duplicate success events for one action.
- Add focused automated coverage for probe exposure, readiness failure, log
  structure, level filtering, and sensitive-data exclusion.

## Out of scope

- Metrics, tracing, dashboards, alert rules, log shipping, retention, or a
  vendor-specific observability SDK.
- Request correlation IDs or distributed trace propagation.
- Database, LLM, MCP, or external-service latency histograms and performance
  profiling.
- Deep health checks that mutate data, call an LLM, or validate Hermes/WhatsApp.
- Container health-check configuration and deployment-platform wiring (feature
  18).
- Changing domain, REST, MCP, prediction, or persistence response contracts.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - Establish the structured logging contract** - add a focused
  operational logging provider that writes through NestJS's logger in JSON mode,
  validates `LOG_LEVEL` against the supported levels, and accepts only the
  allowlisted fields defined below. Configure it at bootstrap and document the
  environment variable. Add unit tests for event shape, level selection, and
  rejection or omission of sensitive values. *Done when: a captured log line is
  parseable JSON with the stable operational fields, `LOG_LEVEL` selects the
  expected NestJS levels, invalid configuration fails clearly before listening,
  and secrets or arbitrary payloads cannot enter the event metadata.*
- [x] **Step 2 - Add public liveness and readiness probes** - introduce a focused
  health module/controller, an explicit public-route metadata decorator honored
  by the existing global authentication guard, and a readiness service that runs
  a minimal PostgreSQL query. Exclude only `/health` and `/ready` from the global
  `api/v1` prefix, and return sanitized DTOs for healthy and unavailable states.
  Add unit and HTTP contract coverage, including proof that ordinary routes stay
  protected. *Done when: unauthenticated `GET /health` returns `200` with
  `{ "status": "ok" }`; unauthenticated `GET /ready` returns `200` with a
  database-up check or `503` with a database-down check; neither endpoint calls
  the LLM; and an unauthenticated business route still returns `401`.*
- [x] **Step 3 - Log inventory action outcomes** - emit one structured success
  event after each committed inventory-event or purchase transaction, covering
  direct stock signals, direct purchases, full grocery-list completion, and
  partial completion. Include only action type, safe record identifiers, counts,
  and outcome; do not log DTO bodies, source strings, notes, quantities,
  authorization data, or product/household content. Add focused assertions to the existing
  inventory service tests. *Done when: every successful inventory mutation emits
  exactly one stable event after persistence succeeds, failed or rolled-back
  mutations never emit a success event, and tests show that event metadata
  contains only allowlisted fields.*
- [x] **Step 4 - Log prediction outcomes** - standardize the existing estimation
  and recommendation logs around the event contract,
  logging prediction success, deterministic fallback after an LLM failure,
  prediction persistence failure, and per-product recommendation failure.
  Add focused assertions to the existing estimation and recommendation tests.
  *Done when: each prediction run has an observable success or fallback outcome,
  persistence and per-product failures produce sanitized events, and all existing
  prediction and recommendation fallback behavior remains unchanged.*
- [x] **Step 5 - Log integration failures** - instrument the OpenAI and MCP
  failure boundaries with provider or tool category and a closed-set sanitized
  error classification while preserving their current unavailable and tool-error
  responses. Add focused tests for provider exceptions, unexpected MCP errors,
  and expected domain errors. *Done when: OpenAI and MCP failures emit structured
  failure events without request, prompt, provider-response, stack, or credential
  data; expected client/domain failures remain distinguishable from unexpected
  integration failures; and client-facing behavior is unchanged.*
- [x] **Step 6 - Run the operational visibility regression gate** - exercise both
  probes over HTTP, capture representative JSON logs for an inventory action, a
  prediction, and an integration failure, then run the configured unit suite,
  available e2e suites, scoped lint, and production build. *Done when: the probe
  contracts and representative event shapes are observed, `npm run test` and
  `npm run build` pass, `npm run test:e2e` passes against an available PostgreSQL
  database or its environmental blocker is recorded, scoped lint and
  `git diff --check` pass, and captured output contains no configured bearer token
  or test-sensitive payload.*

## Files / areas

- New focused operational logging files under `src/common/` or
  `src/observability/`, with colocated Jest tests.
- New `src/health/` module, controller, service, response DTOs, and tests.
- `src/main.ts` and `src/app.module.ts` for logger, prefix exclusions, and module
  wiring.
- `src/auth/` for the narrow public-route metadata exception and guard coverage.
- `src/inventory/inventory.service.ts`, estimation/recommendation services under
  `src/estimation/` and `src/inventory/`, `src/llm/openai/`, and
  `src/mcp/mcp-server.factory.ts` for boundary-level events.
- `.env.example` for `LOG_LEVEL` documentation.
- Existing unit and e2e test areas for focused contract/regression coverage.
- No Prisma schema or migration changes.

## Data / contracts

- **Load-bearing probe routes:** `GET /health` and `GET /ready` are unprefixed and
  intentionally bypass service authentication so infrastructure can probe them.
  No other route becomes public.
- **Liveness response:** `200 { "status": "ok" }` when the process can serve the
  request.
- **Readiness response:** `200 { "status": "ok", "checks": {
  "database": "up" } }` when PostgreSQL responds; otherwise `503 { "status":
  "error", "checks": { "database": "down" } }`. It exposes no exception,
  connection string, host, query, or stack trace.
- **Load-bearing log event:** each operational event contains `event`, `outcome`,
  and NestJS `context`; it may include only event-specific safe metadata such as
  `action`, opaque record IDs, affected/skipped counts, `provider`, `tool`, or
  `errorType`. NestJS JSON output supplies timestamp and severity.
- **Stable event families:** `inventory.action`, `prediction.run`,
  `prediction.persistence`, `integration.llm`, and `integration.mcp`. `outcome`
  is one of `success`, `fallback`, or `failure`.
- **Configuration contract:** `LOG_LEVEL` is optional and defaults to `log` in
  normal operation. Supported values map explicitly to NestJS log levels;
  unsupported values fail startup rather than silently changing visibility.
- **Sensitive-data rule:** never log `Authorization`, `API_AUTH_TOKEN`,
  `OPENAI_API_KEY`, database URLs, request/DTO bodies, grocery notes, household
  data, LLM instructions or input, raw provider responses, or stack traces that
  may contain those values.
- No persisted data contract changes.

## Testing

- Jest unit tests cover `LOG_LEVEL` parsing, the allowlisted event builder,
  liveness/readiness success and database failure, public metadata handling,
  inventory success timing, prediction outcomes, and integration sanitization.
- HTTP/e2e contract coverage proves the exact public probe paths and response
  shapes, sanitized readiness failure, and continued authentication of a normal
  business route.
- Existing inventory, estimation, recommendation, OpenAI-provider, MCP, and auth
  tests receive focused log assertions without replacing their behavioral
  assertions.
- Run `npm run test` for the configured unit-test gate, `npm run test:e2e` when
  PostgreSQL is available, and `npm run build` as the fallback build gate.
  `Verify` is not configured.
- **Final gate evidence (2026-08-28):** the feature-focused gate passed 9 suites
  and 174 tests, the full unit gate passed 29 suites and 312 tests, the production
  build and scoped lint passed, three representative JSON event families were
  captured without sensitive sentinels, and `git diff --check` passed. The e2e
  command passed 3 non-database suites and 8 tests; 5 database-backed suites were
  environmentally blocked by PostgreSQL refusing connections on
  `localhost:5432`, causing 41 downstream failures.

## Notes for the AI

- Keep the public-route exception metadata-driven and fail closed: the global
  guard should bypass only handlers/classes explicitly marked public.
- Register `/health` and `/ready` as exact prefix exclusions; preserve the
  existing unprefixed `/mcp` route and the `/api/v1` prefix for every business
  controller.
- Use a minimal read-only database query for readiness. Do not reuse domain
  services, inspect household data, run migrations, or invoke an LLM.
- Use NestJS dependency injection for operational logging and preserve the
  existing logger abstraction. Do not add a third-party logging dependency
  unless implementation proves the built-in JSON logger cannot satisfy the
  contract and the user approves the architecture change.
- Emit success events only after the owning transaction or persistence call has
  completed. Log at domain/integration boundaries rather than controllers to
  avoid duplicate REST and MCP events for the same action.
- Preserve graceful degradation: observability must not turn LLM, prediction,
  recommendation, or MCP failures into new client-visible errors.
- Prefer opaque IDs and counts over names or content. Never pass an unknown
  `Error` object, raw stack, request object, DTO, provider payload, or arbitrary
  metadata directly to the logger.
- Keep tests deterministic by mocking the logger sink and PostgreSQL readiness
  query, and restore environment variables after each test.
