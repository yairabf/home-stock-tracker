# Feature: Prediction feedback

**From build-plan:** feature 10
**Status:** complete

## Completion record

- **Completed:** 2026-08-27
- **Delivered:** Inventory estimates now return their persisted prediction ID. Trusted REST clients can submit accepted, rejected, or corrected feedback exactly once; the service atomically updates the prediction, appends an auditable inventory event, and recalculates product prediction accuracy.
- **Main areas changed:** Prediction result and response contracts expose `predictionId`; the inventory controller and feedback DTOs define the validated HTTP boundary; `PredictionFeedbackService` owns transactional feedback, correction, concurrency, event, and accuracy behavior; unit and PostgreSQL-backed e2e suites cover the contracts and unhappy paths.
- **Verification:** `npm run test -- --runInBand` passed 217 tests across 18 suites; `npm run test:e2e -- --runInBand` passed 42 tests across 6 suites against PostgreSQL, including the feedback route and persisted records; `npm run build` passed; `git diff --check` passed.
- **Behavioral evidence:** `POST /api/v1/inventory/predictions/:predictionId/feedback` returned 201 for accepted and corrected feedback, persisted the matching event and accuracy, returned 409 for a repeated submission, returned 404 for an unknown prediction, and returned 400 for malformed requests in the e2e suite.
- **Deviations:** None.

## Goal

Let trusted clients record whether a persisted stock prediction was accepted,
rejected, or corrected. Keep an auditable feedback event, update the prediction
once, and recalculate per-product prediction accuracy so later recommendations
can learn from confirmed outcomes.

## In scope

- Return the persisted prediction ID from inventory estimation when persistence succeeds.
- Add a validated REST endpoint for accepted, rejected, and corrected feedback.
- Atomically update a pending prediction and append the corresponding inventory event.
- For corrected feedback, capture the reported stock state as an authoritative `STOCK_CORRECTED` event.
- Recalculate and persist product-level prediction accuracy from completed feedback.
- Cover validation, missing predictions, repeated or conflicting feedback, and transactional behavior with automated tests.

## Out of scope

- Changing prediction weights or confidence from feedback. Feature 11 may use the stored accuracy when deciding which recommendations to expose.
- Automatically changing the grocery list or emitting low-stock recommendations.
- Feedback deletion, reopening, history editing, or bulk feedback.
- New prediction states, household-specific accuracy, or model training.
- MCP and Hermes tool mappings, which remain features 12 through 14.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - Return the persisted prediction identity** - Extend the load-bearing `PredictionResult` and estimation response with `predictionId: string | null`; make prediction persistence return the created ID while retaining the current log-and-continue behavior on a database failure. *Done when:* a successful `GET /inventory/estimate/:productId` response includes the matching stored prediction ID, a persistence failure returns `predictionId: null` without changing the computed prediction, and focused unit and PostgreSQL-backed endpoint tests pass.
- [x] **Step 2 - Lock the feedback request and response contracts** - Add DTOs for `POST /inventory/predictions/:predictionId/feedback` with `outcome: accepted | rejected | corrected`, a required `source`, and a required `correctedState` only for corrected feedback; reject forbidden or missing conditional fields and invalid UUIDs. Return the prediction ID, product ID, resulting feedback status, outcome, corrected state when present, feedback event ID, and updated prediction accuracy. *Done when:* DTO/controller tests accept all three valid shapes, reject malformed or contradictory payloads, and the route delegates only validated input to the feedback service.
- [x] **Step 3 - Persist accepted and rejected feedback once** - Add a focused feedback service that loads the prediction and, in one Prisma transaction, changes `pending` to `accepted` or `rejected` and appends `PREDICTION_ACCEPTED` or `PREDICTION_REJECTED` with metadata containing the prediction ID, original predicted state, and feedback outcome. Treat a second submission as a conflict, whether it repeats or contradicts the first result. *Done when:* service tests prove the correct event and status are committed together, an unknown prediction returns 404, a non-pending prediction returns 409 without another event, and a failed write leaves both records unchanged.
- [x] **Step 4 - Persist authoritative corrections** - Handle `outcome: corrected` in the same transaction by setting the prediction to `rejected` and appending one `STOCK_CORRECTED` event whose metadata contains the prediction ID, original predicted state, corrected state, and feedback outcome. *Done when:* tests prove corrected feedback requires and stores a different concrete state (`likely_available`, `probably_low`, or `probably_out`), rejects `uncertain` and a state equal to the original prediction, creates no separate rejection event, and obeys the same 404, 409, and rollback behavior as other feedback.
- [x] **Step 5 - Recalculate product prediction accuracy** - After the feedback write, calculate accuracy as accepted predictions divided by all accepted plus rejected predictions for that product, counting corrected feedback as rejected, and upsert `ProductStatistics.predictionAccuracy` without changing its other learned fields. Keep the calculation in the feedback transaction and return the updated value. *Done when:* tests cover the first result, mixed outcomes, product isolation, corrected feedback, and an existing statistics row whose unrelated fields remain unchanged; PostgreSQL-backed endpoint tests confirm the prediction, event, and accuracy commit as one operation.

## Files / areas

- `src/estimation/types/prediction-result.ts` and `src/estimation/estimation.service.ts` - expose the persisted prediction identity while preserving graceful persistence failure.
- `src/inventory/dto/estimation-response.dto.ts` - add `predictionId` to the HTTP response.
- `src/inventory/dto/prediction-feedback.dto.ts` and `src/inventory/dto/prediction-feedback-response.dto.ts` - validated feedback boundary.
- `src/inventory/prediction-feedback.service.ts` and its colocated spec - feedback transaction and accuracy calculation.
- `src/inventory/inventory.controller.ts` and `src/inventory/inventory.module.ts` - feedback route and provider wiring.
- Existing estimation and inventory unit/e2e specs, plus focused feedback endpoint coverage.
- `prisma/schema.prisma` only if implementation proves an index is needed; the current enums and models are sufficient, so no migration is planned.

## Data / contracts

- **Load-bearing estimate response:** add `predictionId: string | null`. It is the exact `Prediction.id` created for that request, or `null` if persistence failed. Features 12 through 15 must pass this ID back when recording feedback.
- **Feedback route:** `POST /inventory/predictions/:predictionId/feedback`.
- **Accepted/rejected body:**

  ```json
  {
    "outcome": "accepted",
    "source": "hermes_whatsapp"
  }
  ```

- **Corrected body:**

  ```json
  {
    "outcome": "corrected",
    "correctedState": "probably_out",
    "source": "hermes_whatsapp"
  }
  ```

- `outcome` is `accepted | rejected | corrected`. `correctedState` is forbidden for accepted/rejected and required for corrected. A correction must be a concrete `PredictedState`, excluding `uncertain`, and differ from the original.
- Accepted maps to `Prediction.feedbackStatus = accepted` plus `PREDICTION_ACCEPTED`. Rejected maps to `rejected` plus `PREDICTION_REJECTED`. Corrected maps to `rejected` plus one `STOCK_CORRECTED`; it does not create a duplicate rejection event.
- Feedback event metadata locks `predictionId`, `predictedState`, `outcome`, and `correctedState` when applicable. The event `source` comes from the validated request. Quantity, unit, and confidence remain null.
- `ProductStatistics.predictionAccuracy` is the product's accepted count divided by its accepted plus rejected count. Corrected predictions count as rejected. Pending predictions are excluded.
- A prediction accepts feedback only once. Later repeats or contradictions return HTTP 409 and do not mutate state.

## Testing

- The Jest test gate is configured. Each logic-bearing step ships focused unit coverage in the same diff and runs `npm run test`.
- Run `npm run test:e2e` for PostgreSQL-backed route, persistence, and transaction evidence where the local test database is available.
- Run `npm run build` after every step because no combined Verify command exists.
- Key unhappy paths: invalid prediction ID, missing prediction, invalid outcome, blank source, conditional corrected-state errors, uncertain or unchanged correction, already-resolved prediction, transaction failure, and product isolation in the accuracy calculation.

## Notes for the AI

- Keep the controller thin and all database behavior in the injected feedback service.
- Use generated Prisma enums at persistence boundaries and explicit DTO response types at HTTP boundaries.
- Use a conditional database update inside the transaction, not only a prior read, so concurrent submissions cannot both succeed.
- Do not route feedback through the generic public `recordEvent` method. The prediction update, event metadata, and accuracy calculation are one domain operation.
- Preserve feature 9's behavior: prediction persistence failures are logged and do not fail estimation. A null prediction ID means feedback cannot be recorded.
- Do not alter deterministic or LLM prediction logic in this feature.
