# Feature: Hybrid low-stock prediction

**From build-plan:** feature 9
**Status:** complete

## Completion record

**Completed:** 2026-08-27

**Delivered:** Added a provider-neutral hybrid prediction engine that builds explainable deterministic candidates from household events, learned statistics, product characteristics, and household context. Ambiguous candidates can use validated structured LLM reasoning with explicit precedence, confidence thresholds, weighted arbitration, safe fallback, auditable persistence, and a stable HTTP response that does not expose provider internals.

**Main changed areas:**

- `src/estimation/` - added the engine contract, deterministic candidate model, structured reasoning service and schemas, hybrid arbitration, persistence, and focused tests.
- `src/inventory/` - routed estimation through the engine token and exposed the stable hybrid response fields.
- `test/estimation-response.e2e-spec.ts` - proved deterministic, hybrid, and fallback HTTP response shapes without exposing LLM metadata.
- `test/statistics.e2e-spec.ts` - loaded the documented local environment so the existing PostgreSQL-backed suite uses the same connection setup as the other e2e suites.

**Verification:**

- `npm run test -- --runInBand` - 202 tests passed across 16 suites.
- `npm run test:e2e -- --runInBand` - 33 tests passed across 5 suites against the migrated local PostgreSQL container.
- `npm run build` - NestJS production build passed.
- `git diff --check` - passed.
- `GET /api/v1/inventory/estimate/:productId` - transport-level e2e tests proved deterministic, accepted-hybrid, and no-LLM fallback responses, including suppression of internal provider and model metadata.

**Deviations:** The existing PostgreSQL e2e harness initially lacked a usable local environment. Completion added an ignored `.env`, used port `5433` because `5432` belonged to an unrelated container, applied the checked-in migrations, and corrected the statistics suite's missing `dotenv/config` import. No product-scope deviation.

## Goal

Turn the current deterministic inventory estimate into a provider-neutral hybrid prediction that combines recent household stock events, learned product statistics, product characteristics, household context, and optional structured LLM reasoning. Return and persist a confidence-scored, explainable result while remaining useful when the LLM is disabled, unavailable, refuses, or returns invalid output.

## In scope

- Keep the existing single-product prediction endpoint and introduce a load-bearing `PredictionEngine` contract behind it.
- Build a deterministic prediction candidate from inventory events, learned statistics, product metadata, and the household profile.
- Request structured LLM reasoning only for ambiguous predictions where it can add value.
- Validate and combine deterministic and LLM candidates using explicit precedence and confidence rules.
- Persist the final prediction, its input signal snapshot, optional LLM contribution, recommended action, provider/model version, and a linked LLM inference log.
- Preserve deterministic prediction when LLM use is disabled or fails safely.

## Out of scope

- Recording accepted, rejected, or corrected predictions (feature 10).
- Listing or filtering actionable low-stock recommendations and applying the household suggestion threshold (feature 11).
- Automatically adding predicted products to the grocery list.
- Batch scans, schedules, proactive notifications, MCP tools, or Hermes/WhatsApp behavior (features 12-15).
- Product-specific automation policies, model training, a Python service, or background queues.
- Reworking product classification or sending raw conversation content to the LLM.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - Lock the prediction engine and hybrid contracts** - Introduce a provider-neutral `PredictionEngine` interface, typed deterministic-candidate and final-result shapes, and strict Zod schemas for the bounded LLM input/output. Keep `EstimationService` as the initial deterministic implementation or adapter so the existing endpoint behavior remains green. *Done when:* the inventory endpoint resolves its prediction through the injected engine contract, existing estimation tests pass unchanged, and contract tests reject unknown fields, invalid states, blank reasons, and confidence values outside `0..1`.
- [x] **Step 2 - Build a complete deterministic candidate** - Refactor deterministic calculation into a testable candidate builder whose signal snapshot includes relevant event recency, learned purchase/need/consumption intervals and observation count, product type/perishability/strategy, and household composition/preferences. Preserve explicit `STOCK_OUT` and `STOCK_LOW` precedence, ignore future events, and produce `uncertain` for disabled prediction or insufficient usable evidence. *Done when:* focused Jest cases prove direct-signal precedence, learned-history use, product and household context capture, cold start, disabled prediction, future-event handling, and confidence clamping without calling an LLM.
- [x] **Step 3 - Add guarded LLM reasoning and deterministic fallback** - Add a prediction reasoner using `LlmProvider` structured generation. Invoke it only when prediction is enabled and the deterministic candidate is ambiguous (`uncertain` or confidence below `0.8`); send only the structured signal snapshot, never unrelated conversation text. Accept only schema-valid success with LLM confidence of at least `0.65`. Explicit recent `STOCK_LOW`/`STOCK_OUT` signals remain authoritative; otherwise the LLM may choose the state only when the deterministic state is `uncertain`, and final confidence is the clamped weighted score `0.7 * deterministic + 0.3 * LLM`. *Done when:* Jest cases prove the invocation gate, valid ambiguous-state arbitration, direct-signal precedence, weighting, and unchanged deterministic fallback for disabled configuration, refusal, unavailability, thrown provider errors, invalid output, or low-confidence output.
- [x] **Step 4 - Persist one auditable hybrid result** - Persist the final `Prediction` with deterministic signals, accepted `llmResult`, concise reason, optional recommended action, and provider/model version; create a linked `LlmInferenceLog` for every schema-valid successful prediction-reasoning response, including responses below the acceptance threshold, so rejected advice remains diagnosable. Keep classification logs unlinked and unchanged. *Done when:* unit/integration tests prove deterministic-only and hybrid rows have the expected nullable fields, accepted LLM metadata is stored on the prediction, successful LLM calls create a log linked to that prediction, non-success calls do not create a log, and persistence failure is logged without changing the returned prediction behavior.
- [x] **Step 5 - Expose and verify the hybrid response** - Extend the existing estimation response with optional `recommendedAction`, an `llmContributed` boolean, and the expanded deterministic signal DTO while keeping existing fields stable. Update end-to-end coverage for deterministic, hybrid, and no-LLM paths. *Done when:* `GET /inventory/estimate/:productId` returns the documented stable shape for all three paths, persists the matching prediction, does not expose provider errors or raw prompt content, and `npm run test`, `npm run test:e2e`, and `npm run build` pass.

## Files / areas

- `src/estimation/` - prediction engine contract, deterministic candidate builder, hybrid orchestration, types, and unit tests.
- `src/llm/` or `src/prediction/` - structured prediction-reasoning schema/service and tests, following the established provider-neutral LLM boundary.
- `src/inventory/inventory.controller.ts` and `src/inventory/dto/estimation-response.dto.ts` - existing transport boundary and response mapping.
- `src/estimation/estimation.module.ts` and `src/llm/llm.module.ts` - dependency-injection wiring.
- `prisma/schema.prisma` and migrations only if implementation reveals a missing persisted field; the current `Prediction` and `LlmInferenceLog` models appear sufficient.
- `test/estimation.e2e-spec.ts` - endpoint and persistence verification.

## Data / contracts

- **Load-bearing engine contract:** `PredictionEngine.predictProduct(productId): Promise<PredictionResult>`. Controllers depend on this token/interface, not a concrete provider or LLM adapter.
- **Stable result:** existing `productId`, `predictedState`, `confidenceScore`, `reason`, and `deterministicSignals`, plus `recommendedAction: string | null` and `llmContributed: boolean`.
- **LLM output:** strict `{ predictedState, confidence, reason, recommendedAction }`, where state uses the existing `PredictedState` enum, confidence is `0..1`, reason is nonblank, and action is a nonblank nullable string.
- **Arbitration thresholds:** LLM eligibility below deterministic confidence `0.8` or for `uncertain`; minimum accepted LLM confidence `0.65`; accepted confidence weighting is `70%` deterministic and `30%` LLM, clamped to `0..1`.
- **Precedence:** an explicit recent `STOCK_LOW` or `STOCK_OUT` result cannot be overturned by LLM output. For a non-uncertain deterministic state, LLM reasoning may enrich the explanation/action and confidence but not change the state.
- **Persistence:** one `Prediction` per request. `llmResult` and `modelProviderVersion` are null when no LLM result contributes. A schema-valid successful LLM response gets one linked `LlmInferenceLog`; refusal/unavailable/error gets none.
- **Configuration:** use the existing `LLM_PROVIDER` selection and lack of a configured provider as the safe-off path. Do not add a required environment variable.

## Testing

- Jest is configured and is the gate for all scoring, validation, invocation, arbitration, fallback, and mapping logic added in each step.
- Mock Prisma and `LlmProvider` in focused unit tests; use fake timers for all recency and interval boundaries.
- Extend PostgreSQL-backed Supertest coverage for the endpoint and stored `Prediction`/`LlmInferenceLog` relationship.
- Run `npm run test` after each logic-bearing step. Run `npm run test:e2e` when persistence or HTTP behavior changes, and `npm run build` for every step because no umbrella Verify command is configured.

## Notes for the AI

- Keep controllers thin and use NestJS injection tokens for interface-backed services.
- Preserve the append-only inventory-event source of truth and do not let the LLM write to the database directly.
- Treat deterministic signals, thresholds, output schema, and `PredictionEngine` as load-bearing contracts for features 10-15.
- Catch provider failures at the hybrid orchestration boundary and log operational detail server-side without returning provider internals.
- Do not send aliases, household IDs, event IDs, or free-form conversation text when aggregate structured evidence is enough.
- Keep classification inference logging behavior unchanged; prediction reasoning uses the same table but a prediction-specific prompt version and linked `predictionId`.
- Follow existing NestJS module boundaries, DTO mapping, Prisma access, and colocated Jest patterns. Avoid unrelated cleanup while refactoring the estimator.
