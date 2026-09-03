# Feature: Daily stock estimation workflow

**From build-plan:** feature 33c
**Status:** verified

## Goal

Materialize each tracked product's daily stock estimate from persisted shelf-life and learned-consumption evidence, while inferring missing shelf-life policies through the configured structured LLM provider. Run both phases in order on a configurable internal schedule with per-product failure isolation and observable summaries.

## In scope

- Structured, validated shelf-life inference for products without a policy, including finite and nonperishable results with provider, model, prompt, confidence, rationale, and evaluation provenance.
- Deterministic incremental quantity decay from the last materialized estimate, finite shelf-life expiration from the last explicit stock timestamp, zero clamping, and existing explicit low/out precedence.
- Prediction creation and stock-projection estimate updates without changing recorded stock facts or creating inferred inventory events.
- One ordered workflow: infer missing policies first, then evaluate every tracked projection.
- Per-product failure isolation, retry eligibility for failed inference, and structured workflow start/end summaries.
- Configurable internal scheduling with `STOCK_WORKFLOW_ENABLED` (default `true`), `STOCK_WORKFLOW_CRON` (default `0 2 * * *`), and `STOCK_WORKFLOW_TIMEZONE` (default `Asia/Jerusalem`).
- Documentation of the single-service-replica scheduling assumption.

## Out of scope

- REST/MCP inventory reads, recommendation changes, display precision, and untracked response contracts (33d).
- Hermes/OpenClaw skills, fixtures, manifests, probes, scenarios, and MCP contract-version changes (33e).
- Policy editing APIs, historical backfill, per-lot expiration, inferred consumption events, distributed locking, or a queue.
- Reworking the existing legacy estimation endpoint or recalculating estimates during reads.
- A new household-size multiplier: learned consumption statistics already describe this single household's observed rate; household profile fields remain available for future model tuning without double-adjusting observed consumption.

## Build loop

Build one step at a time, never the whole feature at once.

1. Implement only the next unchecked step.
2. Add focused tests for its logic and failure paths.
3. Run the relevant Jest slice, build, and repository diff checks.
4. Review the diff against this spec, then checkpoint the passing step because Autopilot checkpoint commits are enabled.

## Build steps

- [x] **Step 1 - Add stock workflow configuration and scheduler boundary** - add validated defaults for enabled/cron/timezone settings, register the Nest scheduler infrastructure, and create a scheduler adapter that can be disabled and invokes one workflow entry point. *Done when:* defaults and overrides are test-covered, invalid values fail safely at startup, disabled scheduling registers no job, enabled scheduling registers the configured cron/timezone, and the application builds.
- [x] **Step 2 - Infer and persist missing shelf-life policies** - add strict input/result schemas and an injectable reasoner, select only products without a policy, and persist successful finite or nonperishable assessments with full provenance while leaving unavailable/refused/invalid/failed products policy-free. *Done when:* structured-provider requests and result validation are unit-tested, successes persist the load-bearing policy shape, failures remain retryable, and one product failure does not stop later products.
- [x] **Step 3 - Materialize one tracked projection incrementally** - extend the pure stock materializer and add a service operation that uses the current estimate/evaluation timestamp, recorded timestamp, shelf-life policy, learned household consumption interval, and latest explicit qualitative signal to create a prediction and update only estimate fields. *Done when:* fake-timer tests prove incremental decay without double-decrement, expiration, nonperishable and missing-policy behavior, explicit low/out and zero precedence, decimal precision, and no mutation of recorded facts or creation of inventory events.
- [x] **Step 4 - Orchestrate the ordered daily workflow with isolation and summaries** - run inference before evaluation, enumerate every tracked projection, isolate failures per product in both phases, and emit structured start/end data including duration, processed, succeeded, skipped, and failed counts. *Done when:* tests prove phase ordering, continued processing after failures, retry eligibility, stable summary counts, and scheduler invocation of exactly one workflow run.
- [x] **Step 5 - Verify integration and document operations** - add PostgreSQL-backed coverage for policy persistence and daily projection/prediction materialization, document environment variables and the single-replica constraint, then run all configured fallback gates. *Done when:* focused unit and e2e tests, `npm run test`, `npm run test:e2e`, `npm run build`, and `git diff --check` pass.

## Files / areas

- `src/config/` - stock-workflow environment parsing and defaults.
- `src/inventory/` - shelf-life reasoner, deterministic daily materialization, workflow orchestration, scheduler adapter, types, and tests.
- `src/observability/` - typed structured stock-workflow events.
- `src/llm/`, `src/inventory/inventory.module.ts`, and `src/app.module.ts` - dependency-injection and scheduling wiring.
- `test/` - PostgreSQL-backed workflow evidence.
- `package.json` and `package-lock.json` - Nest scheduling dependencies.
- `.env.example` and project documentation - operational configuration and single-replica assumption.
- `blueprint/context/current-feature.md` and `blueprint/.state/run.json` - durable workflow progress.

## Data / contracts

- Existing `ProductShelfLifePolicy` remains the load-bearing persisted policy: exactly one of finite `shelfLifeDays > 0` or nonperishable `shelfLifeDays = null`, plus `modelProvider`, `modelVersion`, `promptVersion`, `confidence`, `rationale`, and `evaluatedAt`.
- No Prisma schema change or backfill is expected because 33a created the policy, projection, and prediction relations.
- The shelf-life LLM result is strict: `kind`, nullable `shelfLifeDays`, confidence in `[0,1]`, and nonblank rationale; cross-field validation enforces the finite/nonperishable invariant.
- Daily evaluation writes a new `Prediction` and updates only `StockProjection.estimatedQuantity`, `estimatedState`, `confidence`, `reason`, `predictionId`, and `evaluatedAt`.
- Consumption is incremental from `estimatedQuantity` and `evaluatedAt`; expiration is measured from `recordedAt`. The persisted learned interval is already household-specific and is not multiplied by household member counts.
- Scheduler configuration is validated once at startup and one named cron job calls the ordered workflow. Distributed duplicate-run protection is deliberately deferred.

## Testing

- Jest fake timers cover configuration defaults, scheduler enablement, incremental elapsed-time decay, expiration, and repeat evaluation.
- Mocked unit tests cover structured LLM requests, strict cross-field parsing, provenance persistence, phase ordering, per-product isolation, prediction/projection write boundaries, and structured summaries.
- PostgreSQL/Supertest-style e2e setup proves successful policy and projection persistence using the real Prisma client, with external LLM behavior stubbed.
- Final fallback gates are `npm run test`, `npm run test:e2e`, `npm run build`, and `git diff --check`. No Verify command is configured.

## Notes for the AI

- Keep product creation and every stock write independent of shelf-life inference.
- Never infer history into a projection, mutate `recorded*` fields during daily evaluation, or create inferred inventory events.
- Keep external LLM calls outside database transactions. Persist only validated successful results.
- Select explicit fields in Prisma reads, keep writes narrow, and isolate each product so a rejected promise cannot abort the workflow.
- Preserve internal decimal precision. User-facing unit precision belongs to 33d.
- Reuse the existing `LlmProvider`, Zod structured-generation pattern, `StockMaterializationService`, `Prediction` model, and `OperationalLogger`.
- Run `graphify update .` after code changes.
