# Feature: Inventory state estimation

**From build-plan:** feature 6
**Status:** not started

## Goal

Derive likely product availability from inventory events, purchases, and elapsed time. This feature provides the core estimation logic that powers low-stock predictions (feature 9) and Hermes recommendations (features 11-15), returning a confidence-scored state estimate for a given product without exposing raw event data.

## Design reference

Not applicable - no UI.

## In scope

- **Estimation service** - compute a likely stock state (`likely_available` | `probably_low` | `probably_out` | `uncertain`) for a single product based on:
  - Time since most recent `PURCHASED`/`RESTOCKED` event
  - Time since most recent `STOCK_LOW`/`STOCK_OUT`/`STOCK_CONFIRMED` signal
  - Product type (`fast_consumable` | `pantry_staple` | `household_consumable` | `discrete_consumable`)
  - Whether `predictionEnabled` is true for the product
- **REST endpoint** - `GET /inventory/estimate/:productId` returns a structured estimate for the specified product
- **Household context awareness** - use `adultsCount` and `childrenCount` from the household profile to adjust consumption-rate assumptions
- **Cold-start handling** - return `uncertain` when insufficient history exists (< 2 events or < 7 days since first event)
- **Time-based decay heuristics** - apply product-type-specific rules:
  - `fast_consumable`: if no purchase/stock confirmation in 7+ days and last signal is `STOCK_LOW` or older than 14 days → `probably_low`
  - `pantry_staple`: extend thresholds to 30+ days for `probably_low`
  - `household_consumable` / `discrete_consumable`: extend to 21+ days
- **Direct signal precedence** - if the most recent event is `STOCK_OUT`, return `probably_out`; if `STOCK_LOW`, return `probably_low`; if `STOCK_CONFIRMED` within 3 days, return `likely_available`
- **Confidence scoring** - assign a confidence (0.0-1.0) based on:
  - Recency of signals (more recent = higher confidence)
  - Number of events (more events = higher confidence)
  - Product-type match (known type = higher confidence than null)
- **Prediction persistence** - store each generated estimate as a `Prediction` record, linked to product and deterministic signals

## Out of scope

- **Consumption pattern learning** (feature 7) - this feature derives state from time and signals only, not learned purchase intervals
- **LLM-assisted reasoning** (feature 8) - deterministic heuristics only for this feature
- **Hybrid prediction** (feature 9) - combining multiple data sources beyond basic heuristics
- **Multi-product or bulk estimation** - this feature estimates one product at a time; batch endpoints come later
- **Low-stock recommendations** (feature 11) - filtering, suppression, and actionable suggestions
- **Auto-grocery-list mutation** - estimates inform but never directly modify the grocery list

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

Small, reviewable units. Each ends with something working. `/implement` checks these off as it finishes them, so progress survives a context clear: a fresh session reads which boxes are ticked and resumes from the first unchecked step.

- [x] **Step 1a - Add PredictedState and FeedbackStatus enums to Prisma schema** - add the enums before the `Prediction` model. *Done when:* enums compile without errors.
- [x] **Step 1b - Add Prediction model to Prisma schema** - create the `Prediction` model with fields for `productId`, `predictedState`, `confidenceScore`, `predictedAt`, `recommendedAction`, `deterministicSignals`, `llmResult`, `reason`, `modelProviderVersion`, and `feedbackStatus`. Add indexes on `productId` and `predictedAt`. Add relation to `Product`. *Done when:* schema compiles and relations are correct.
- [x] **Step 1c - Run Prisma migration** - execute `npx prisma migrate dev` to create and apply the migration. *Done when:* migration succeeds, `Prediction` model is visible in generated client, and database schema matches.
- [x] **Step 2 - Create EstimationService skeleton with dependency injection** - add `src/estimation/estimation.module.ts`, `estimation.service.ts`, and register in `AppModule`. Inject `PrismaService`, `ProductService`, and `HouseholdService`. Add placeholder method `estimateProductState(productId: string)` returning a typed `EstimationResult`. Add module to `app.module.ts`. *Done when:* service compiles and is injectable; app boots without errors.
- [x] **Step 3 - Implement event history retrieval logic** - in `EstimationService`, add a private method to fetch the most recent events for a product (limit 20, ordered by timestamp desc). Fetch `PURCHASED`, `RESTOCKED`, `STOCK_LOW`, `STOCK_OUT`, `STOCK_CONFIRMED`, and `STOCK_CORRECTED` event types. Ignore events with future timestamps (> `Date.now()`). Return structured `ProductEventHistory` type. *Done when:* unit test verifies retrieval returns expected events for a seeded product with at least 3 event types, and filters out future-dated events.
- [x] **Step 4a - Implement direct signal precedence logic** - add a private method that examines `ProductEventHistory` and returns an estimated state if the most recent event is a direct signal (`STOCK_OUT` → `probably_out`, `STOCK_LOW` → `probably_low`, `STOCK_CONFIRMED` within 3 days → `likely_available`). Otherwise, return null to defer to time-decay heuristics. *Done when:* unit tests verify correct precedence for each signal type and timestamp threshold.
- [x] **Step 4b - Implement time-decay heuristics by product type** - add a private method that takes product metadata + household profile + `ProductEventHistory` and applies time-since-purchase decay rules. Use product-type-specific thresholds: fast_consumable (7/14 days), pantry_staple (30 days), household_consumable/discrete_consumable (21 days). Return `uncertain` when insufficient data (< 2 events or < 7 days since first event). Use household defaults if no profile exists. *Done when:* unit tests verify each product type, cold-start detection, and missing household fallback.
- [x] **Step 4c - Implement confidence scoring logic** - add a private method that computes confidence (0.0-1.0) based on recency of signals, event count, and product-type certainty. Formula: base 0.5, +0.2 if productType known, +0.1 per event beyond 2 (capped +0.2), +0.1 if last signal within 7 days, -0.2 if cold-start. Clamp to [0.0, 1.0]. *Done when:* unit tests verify scoring for various event counts, recencies, and product types.
- [x] **Step 5 - Expose REST endpoint GET /inventory/estimate/:productId** - add controller method in `InventoryController` (or new `EstimationController` if preferred) that calls `EstimationService.estimateProductState` and returns a structured response DTO with `productId`, `predictedState`, `confidenceScore`, `reason`, and `deterministicSignals`. *Done when:* endpoint returns 200 with valid estimation for a seeded product; returns 404 for unknown product; returns 503 with `uncertain` state when prediction disabled.
- [x] **Step 6 - Persist prediction result to Prediction table** - after computing an estimate, write it to the `Prediction` table with `feedbackStatus: pending`. Link to `productId` and store `deterministicSignals` as JSON. *Done when:* each estimation call creates a `Prediction` row; database query confirms persistence.
- [x] **Step 7a - Add integration test for cold-start scenario** - seed product with < 2 events; call endpoint; verify response is `uncertain` with confidence 0.3 or lower; verify prediction persists. *Done when:* test passes.
- [x] **Step 7b - Add integration tests for direct signal precedence** - seed product with `STOCK_OUT`, `STOCK_LOW`, and `STOCK_CONFIRMED` events at different timestamps; call endpoint for each; verify response matches expected state. *Done when:* tests pass for all signal types.
- [x] **Step 7c - Add integration tests for time-decay by product type** - seed products of each type with old purchase events; call endpoint; verify response matches expected state (e.g., fast_consumable → `probably_low` after 10 days, pantry_staple stays `likely_available` until 30 days). *Done when:* tests pass for all product types.
- [x] **Step 8 - Add unit tests for EstimationService heuristics** - consolidate tests from steps 3, 4a, 4b, 4c into `src/estimation/estimation.service.spec.ts`. Ensure edge cases covered: no events, only grocery events, null productType, future timestamps, missing household. *Done when:* test suite passes with >80% coverage on `EstimationService` logic paths.
- [x] **Step 9 - Manual verification** - seed test data for multiple products with different event histories; call endpoint for each; verify estimation output matches expected state and confidence based on rules; verify predictions are persisted; verify missing household profile doesn't crash the service. *Done when:* manual walkthrough confirms behavior matches spec for at least 5 scenarios (fast_consumable recent purchase, fast_consumable old purchase + STOCK_LOW, pantry_staple cold-start, household_consumable STOCK_OUT, discrete_consumable STOCK_CONFIRMED).

## Files / areas

- `prisma/schema.prisma` - add enums and `Prediction` model (steps 1a-1b), run migration (step 1c)
- `src/estimation/estimation.module.ts` - new module (step 2)
- `src/estimation/estimation.service.ts` - core estimation logic (steps 2-6)
- `src/estimation/estimation.controller.ts` - REST endpoint (step 5) - or add to `InventoryController` if preferred
- `src/estimation/dto/*.dto.ts` - request and response DTOs (step 5)
- `src/estimation/types/product-event-history.ts` - typed event history struct (step 3)
- `src/estimation/types/estimation-result.ts` - typed estimation result (step 2)
- `src/app.module.ts` - import `EstimationModule` (step 2)
- `src/estimation/estimation.service.spec.ts` - unit tests (step 8, builds on tests from 3, 4a-4c)
- `test/estimation.e2e-spec.ts` - integration tests (steps 7a-7c)

## Data / contracts

### Prediction model (new)

```prisma
model Prediction {
  id                  String   @id @default(uuid())
  productId           String
  product             Product  @relation(fields: [productId], references: [id])
  predictedState      PredictedState
  confidenceScore     Float
  predictedAt         DateTime @default(now())
  recommendedAction   String?
  deterministicSignals Json
  llmResult           Json?
  reason              String
  modelProviderVersion String?
  feedbackStatus      FeedbackStatus @default(pending)

  @@index([productId])
  @@index([predictedAt])
}

enum PredictedState {
  likely_available
  probably_low
  probably_out
  uncertain
}

enum FeedbackStatus {
  pending
  accepted
  rejected
}
```

### API contract: GET /inventory/estimate/:productId

**Response 200:**
```json
{
  "productId": "uuid",
  "predictedState": "probably_low",
  "confidenceScore": 0.75,
  "reason": "Last purchase 9 days ago; most recent STOCK_LOW signal 3 days ago; product type fast_consumable suggests frequent consumption",
  "deterministicSignals": {
    "lastPurchaseAt": "2026-08-17T10:30:00Z",
    "lastLowStockSignalAt": "2026-08-23T14:00:00Z",
    "lastStockConfirmationAt": null,
    "daysSinceLastPurchase": 9,
    "daysSinceLastLowSignal": 3,
    "productType": "fast_consumable",
    "eventCount": 5,
    "coldStart": false
  }
}
```

**Response 404:** Product not found
**Response 503:** Prediction disabled for product (returns `uncertain` with confidence 0.0)

### EstimationResult type (internal)

```typescript
interface EstimationResult {
  productId: string;
  predictedState: PredictedState;
  confidenceScore: number;
  reason: string;
  deterministicSignals: {
    lastPurchaseAt: Date | null;
    lastLowStockSignalAt: Date | null;
    lastStockConfirmationAt: Date | null;
    daysSinceLastPurchase: number | null;
    daysSinceLastLowSignal: number | null;
    productType: ProductType | null;
    eventCount: number;
    coldStart: boolean;
  };
}
```

### ProductEventHistory type (internal)

```typescript
interface ProductEventHistory {
  productId: string;
  events: Array<{
    id: string;
    eventType: InventoryEventType;
    timestamp: Date;
    quantity?: number;
    unit?: string;
  }>;
  firstEventAt: Date | null;
  lastPurchaseAt: Date | null;
  lastRestockAt: Date | null;
  lastLowStockAt: Date | null;
  lastStockOutAt: Date | null;
  lastStockConfirmationAt: Date | null;
  eventCount: number;
}
```

## Testing

**Test runner configured:** Yes (`npm run test` per `AGENTS.md`)

**In-scope logic requiring tests:**
- Time-decay heuristics for each product type (fast_consumable, pantry_staple, household_consumable, discrete_consumable)
- Direct signal precedence (STOCK_OUT > STOCK_LOW > STOCK_CONFIRMED > time decay)
- Cold-start detection (< 2 events OR < 7 days since first event)
- Confidence scoring based on recency, event count, and product-type certainty
- Edge cases: no events, only grocery events, future timestamps, null productType

**Test strategy:**
- Unit tests: `src/estimation/estimation.service.spec.ts` - mock `PrismaService`, `ProductService`, `HouseholdService`; test heuristics in isolation
- Integration tests: `test/estimation.e2e-spec.ts` - seed database with products, events, household; call endpoint; verify response and persisted prediction
- Manual walkthrough: step 10 covers 5 representative scenarios

**Testing gate:** Per `coding-standards.md`, each logic-bearing step (3, 4, 5, 6, 7, 8) ships a passing test before checkpoint.

## Notes for the AI

- **Load-bearing contract:** The `Prediction` table schema is reused by feature 9 (Hybrid low-stock prediction) and feature 10 (Prediction feedback). Lock the shape in steps 1a-1c; later features extend with LLM fields and feedback logic.
- **No circular dependencies:** `EstimationService` must not import `InventoryService` (they share Prisma, but Estimation calls Inventory events, not vice versa). If `EstimationController` lives in `InventoryController`, EstimationModule imports InventoryModule; otherwise, keep controllers separate.
- **Time calculations:** Use `Date.now()` for current time in heuristics, but all stored timestamps are UTC. Mock `Date.now()` in tests with Jest fake timers (`jest.useFakeTimers()` and `jest.setSystemTime()`).
- **Future timestamp handling:** Ignore any event with `timestamp > Date.now()` in event retrieval (step 3). Log a warning if encountered. This prevents clock-skewed data from corrupting estimates.
- **Product-type null handling:** If `product.productType` is null, use a fallback threshold of 14 days for `probably_low` (middle ground between fast_consumable and pantry_staple) rather than throwing.
- **Missing household profile:** `HouseholdService.getOrCreate()` always returns a profile (creates default if missing). Use defaults if call fails unexpectedly: adultsCount=2, childrenCount=3. Do not crash the estimation on household lookup failure.
- **Confidence scoring formula (suggested):**
  - Base confidence: 0.5
  - +0.2 if productType is known
  - +0.1 per additional event beyond 2 (capped at +0.2)
  - +0.1 if last signal is within 7 days
  - -0.2 if cold-start (insufficient data)
  - Clamp to [0.0, 1.0]
- **API versioning:** If this project later adopts API versioning (per project-overview mentions `/api/v1/...`), add the route under `/api/v1/inventory/estimate/:productId`. For now, use `/inventory/estimate/:productId` to match existing `InventoryController` routes.
- **Household profile usage:** Fetch household once per estimation call. Store `adultsCount` and `childrenCount` in `deterministicSignals` for transparency. Do not apply household-adjusted consumption rates yet (feature 7 consumes this); the current heuristics are household-agnostic for simplicity.
- **Prediction persistence:** Write to `Prediction` on every estimation call (step 6). This creates a history trail for analytics, debugging, and feature 10 (feedback). Consider rate-limiting or caching if call volume becomes an issue (not in MVP scope).
- **Test file placement:** Per `coding-standards.md`, test files live next to source files (e.g., `estimation.service.spec.ts` in `src/estimation/`). Integration tests live in `test/` (e.g., `test/estimation.e2e-spec.ts`).
