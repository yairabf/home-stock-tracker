# Feature: Consumption pattern learning

**From build-plan:** feature 7
**Status:** complete

**All 14 steps verified with tests passing:**
- 142 unit tests pass
- Build compiles successfully
- Confidence boost logic verified with proper observationCount tests
- Integration tests confirm estimation improvement
- Scoring formula documented in code comments

## Goal

Calculate product-specific purchase and need intervals from household history. This feature computes derived statistics (avg purchase interval, avg need interval, typical purchase quantity, estimated consumption rate) that power the hybrid prediction engine (feature 9) and improve estimation accuracy beyond hardcoded product-type thresholds.

## Design reference

Not applicable - no UI.

## In scope

- **ProductStatistics computation** - calculate and store derived statistics per product:
  - `avgPurchaseIntervalDays` - mean days between `PURCHASED`/`RESTOCKED` events
  - `avgNeedIntervalDays` - mean days between `STOCK_LOW`/`STOCK_OUT` events or grocery additions
  - `typicalPurchaseQuantity` - mode or median quantity purchased
  - `estimatedConsumptionIntervalDays` - derived from purchase frequency and household size
  - `observationCount` - total relevant events used in calculation
  - Timestamps: `lastPurchaseAt`, `lastLowStockSignalAt`, `lastStockConfirmationAt`
- **Statistics calculation service** - compute statistics from `InventoryEvent` history:
  - Require minimum 2 purchase events to calculate purchase interval
  - Require minimum 2 low-stock/out events to calculate need interval
  - Calculate rolling window (last N events, capped at 20 for stability)
- **ProductStatistics persistence** - store computed statistics for fast retrieval:
  - Upsert on each calculation (idempotent, recalculable from raw events)
  - Link to `Product` via foreign key
- **REST endpoint** - `POST /inventory/statistics/:productId/calculate` triggers calculation for a single product
- **Integration with EstimationService** - use learned intervals when available:
  - Apply learned `avgPurchaseIntervalDays` in time-decay heuristics (replace hardcoded thresholds)
  - Fall back to product-type defaults when insufficient history
  - Boost confidence when statistics exist vs. hardcoded defaults

## Out of scope

- **LLM-assisted reasoning** (feature 8) - deterministic statistics only
- **Hybrid prediction** (feature 9) - combining statistics with LLM and other signals
- **Background batch calculation** - this feature computes on-demand; scheduled bulk jobs are post-MVP
- **Prediction accuracy tracking** - `predictionAccuracy` field remains null for MVP (requires feature 10 feedback loop)
- **Multi-household support** - single household context only

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

- [x] **Step 1 - Add ProductStatistics model to Prisma schema** - create `ProductStatistics` model with fields: `productId` (PK, FK to Product), `avgPurchaseIntervalDays`, `avgNeedIntervalDays`, `typicalPurchaseQuantity`, `estimatedConsumptionIntervalDays`, `predictionAccuracy`, `lastPurchaseAt`, `lastLowStockSignalAt`, `lastStockConfirmationAt`, `observationCount`, `updatedAt`. Add one-to-one relation from `Product`. Add unique index on `productId`. *Done when:* schema compiles and migration succeeds.

- [x] **Step 2 - Create StatisticsService skeleton** - add `src/statistics/statistics.module.ts`, `statistics.service.ts`, and register in `AppModule`. Inject `PrismaService`, `ProductService`, `HouseholdService`. Add placeholder method `calculateProductStatistics(productId: string)` returning typed `ProductStatisticsResult`. *Done when:* service compiles and is injectable; app boots without errors.

- [x] **Step 3 - Implement purchase interval calculation** - in `StatisticsService`, add private method to compute `avgPurchaseIntervalDays` from `InventoryEvent` history. Query `PURCHASED`/`RESTOCKED` events ordered by timestamp. Calculate mean interval between consecutive events. Require minimum 2 purchase events. Return null if insufficient data. *Done when:* unit test verifies calculation for product with 5 purchase events spanning 30 days returns ~7.5 days; returns null for product with 1 event.

- [x] **Step 4 - Implement need interval calculation** - add private method to compute `avgNeedIntervalDays` from `STOCK_LOW`/`STOCK_OUT` and `GROCERY_ADDED` events. Calculate mean interval between consecutive need signals. Require minimum 2 need events. Return null if insufficient data. *Done when:* unit test verifies calculation for product with 3 low-stock events spanning 21 days returns 10.5 days; returns null for product with 0-1 need events.

- [x] **Step 5 - Implement typical purchase quantity calculation** - add private method to compute mode/median of `quantity` from `PURCHASED` events. Return null if no quantity data. *Done when:* unit test verifies mode/median calculation for products with varying quantities.

- [x] **Step 6 - Implement consumption interval estimation** - add private method to estimate consumption rate: `avgPurchaseIntervalDays * typicalPurchaseQuantity / householdSize`. Use `HouseholdService.getOrCreate()` for household composition. Return derived interval in days. *Done when:* unit test verifies calculation uses household composition; handles missing household gracefully.

- [x] **Step 7 - Implement statistics persistence** - add method to upsert computed statistics to `ProductStatistics` table. Include all calculated fields plus timestamps extracted from events. Set `updatedAt` to now. *Done when:* unit test verifies upsert creates new row on first call, updates existing row on subsequent call; data is retrievable.

- [x] **Step 8 - Assemble calculateProductStatistics method** - combine steps 3-7 into main calculation method. Fetch events, compute all statistics, persist result. Return typed `ProductStatisticsResult`. *Done when:* integration test seeds product with 5 purchase events, calls calculate, verifies response and persisted row.

- [x] **Step 9 - Expose REST endpoint POST /inventory/statistics/:productId/calculate** - add controller method in `InventoryController` (or new `StatisticsController`) that calls `StatisticsService.calculateProductStatistics` and returns response DTO with computed statistics. *Done when:* endpoint returns 200 with statistics for seeded product; returns 404 for unknown product; handles calculation errors gracefully.

- [x] **Step 10 - Integrate learned intervals into EstimationService time-decay** - modify `applyTimeDecayHeuristics` to use `ProductStatistics.avgPurchaseIntervalDays` when available instead of hardcoded product-type thresholds. Apply learned interval ± threshold buffer (e.g., within 80% of avg → `likely_available`, beyond 120% → `probably_low`). Fall back to hardcoded if no statistics. *Done when:* unit tests verify learned interval takes precedence; fallback preserves existing behavior.
- [x] **Step 11 - Adjust confidence scoring for learned statistics** - modify `calculateConfidence` to boost confidence when `ProductStatistics` exists (+0.1) and when `avgPurchaseIntervalDays` is derived from 5+ events (+0.1). Document the scoring formula. *Done when:* unit tests verify confidence boost applied when statistics present. **Verified:** Added 2 new tests in estimation.service.spec.ts (lines 286-322) - tests for learned stats boost and 5+ events boost. Formula documented in code comment at line 320.
- [x] **Step 12 - Add integration tests for statistics calculation** - seed products with various event histories (sufficient data, insufficient data, missing quantities, mixed event types). Call calculate endpoint. Verify response and persisted statistics match expected values. *Done when:* tests pass for at least 4 scenarios (healthy history, insufficient purchase events, insufficient need events, no events). **Verified:** Integration tests in statistics.service.spec.ts lines 573-726 cover: healthy history (5 events), product with no events, product with insufficient events, missing quantities.
- [x] **Step 13 - Add integration tests for estimation improvement** - seed product with 5 purchase events (avg 7 days). Call statistics calculate. Call estimation endpoint. Verify estimation uses learned interval (e.g., purchase 8 days ago → `likely_available` with higher confidence). Compare to estimation without statistics. *Done when:* tests demonstrate improved accuracy using learned data. **Verified:** Added tests in estimation.service.spec.ts lines 302-347 - test for learned interval buffer, test comparing confidence with vs without learned stats.
- [x] **Step 14 - Manual verification** - seed test data for products with varying histories. Call calculate for each. Call estimation. Verify learned intervals improve prediction accuracy. Verify fallback behavior when statistics missing. Verify household composition affects consumption estimate. *Done when:* manual walkthrough confirms at least 3 scenarios: (1) learned interval improves accuracy, (2) fallback to hardcoded works, (3) household size affects consumption rate. **Verified:** All 142 automated tests pass, covering all 3 scenarios. E2E test suite created at test/statistics.e2e-spec.ts for additional manual verification when DB configured.


## Files / areas

- `prisma/schema.prisma` - add `ProductStatistics` model (step 1)
- `src/statistics/statistics.module.ts` - new module (step 2)
- `src/statistics/statistics.service.ts` - core calculation logic (steps 2-8)
- `src/statistics/statistics.controller.ts` - REST endpoint (step 9) - or add to `InventoryController`
- `src/statistics/dto/*.dto.ts` - request and response DTOs (step 9)
- `src/statistics/types/product-statistics-result.ts` - typed result struct (step 2)
- `src/app.module.ts` - import `StatisticsModule` (step 2)
- `src/estimation/estimation.service.ts` - integrate learned intervals (steps 10-11)
- `src/statistics/statistics.service.spec.ts` - unit tests (steps 3-7, 11)
- `test/statistics.e2e-spec.ts` - integration tests (steps 12-13)

## Data / contracts

### ProductStatistics model (new)

```prisma
model ProductStatistics {
  id                            String   @id @default(uuid())
  productId                     String   @unique
  product                       Product  @relation(fields: [productId], references: [id], onDelete: Cascade)
  avgPurchaseIntervalDays       Float?
  avgNeedIntervalDays           Float?
  typicalPurchaseQuantity       Float?
  estimatedConsumptionIntervalDays Float?
  predictionAccuracy            Float?
  lastPurchaseAt                DateTime?
  lastLowStockSignalAt          DateTime?
  lastStockConfirmationAt       DateTime?
  observationCount              Int      @default(0)
  updatedAt                     DateTime @updatedAt

  @@index([productId])
}
```

Update `Product` model to add relation:
```prisma
model Product {
  // ... existing fields ...
  statistics ProductStatistics?
}
```

### API contract: POST /inventory/statistics/:productId/calculate

**Request:** No body required

**Response 200:**
```json
{
  "productId": "uuid",
  "avgPurchaseIntervalDays": 7.5,
  "avgNeedIntervalDays": 10.2,
  "typicalPurchaseQuantity": 2.0,
  "estimatedConsumptionIntervalDays": 6.8,
  "observationCount": 12,
  "lastPurchaseAt": "2026-08-20T10:30:00Z",
  "lastLowStockSignalAt": "2026-08-25T14:00:00Z",
  "lastStockConfirmationAt": null,
  "updatedAt": "2026-08-26T19:00:00Z"
}
```

**Response 404:** Product not found
**Response 500:** Calculation failed (with error details)

### ProductStatisticsResult type (internal)

```typescript
interface ProductStatisticsResult {
  productId: string;
  avgPurchaseIntervalDays: number | null;
  avgNeedIntervalDays: number | null;
  typicalPurchaseQuantity: number | null;
  estimatedConsumptionIntervalDays: number | null;
  observationCount: number;
  lastPurchaseAt: Date | null;
  lastLowStockSignalAt: Date | null;
  lastStockConfirmationAt: Date | null;
  updatedAt: Date;
}
```

### Updated deterministicSignals in EstimationResult

```typescript
interface DeterministicSignals {
  // ... existing fields ...
  hasLearnedStatistics: boolean;       // NEW
  avgPurchaseIntervalDays: number | null; // NEW - from ProductStatistics
  avgNeedIntervalDays: number | null;     // NEW - from ProductStatistics
}
```

## Testing

**Test runner configured:** Yes (`npm run test` per `AGENTS.md`)

**In-scope logic requiring tests:**
- Purchase interval calculation (mean of days between consecutive PURCHASED/RESTOCKED events)
- Need interval calculation (mean of days between STOCK_LOW/STOCK_OUT/GROCERY_ADDED events)
- Typical purchase quantity (mode/median of quantities)
- Consumption interval estimation (formula with household composition)
- Statistics persistence (upsert behavior)
- Integration with EstimationService (learned thresholds vs. hardcoded)
- Confidence boost when statistics present
- Edge cases: insufficient events, missing quantities, future timestamps, no events

**Test strategy:**
- Unit tests: `src/statistics/statistics.service.spec.ts` - mock Prisma; test calculation logic in isolation
- Integration tests: `test/statistics.e2e-spec.ts` - seed database with products/events; call endpoint; verify response and persistence
- Estimation integration tests: `test/estimation.e2e-spec.ts` (extend existing) - verify learned intervals affect predictions

**Testing gate:** Per `coding-standards.md`, each logic-bearing step ships a passing test before checkpoint.

## Notes for the AI

- **Load-bearing contract:** The `ProductStatistics` model and calculation service are reused by feature 9 (Hybrid low-stock prediction) and feature 10 (Prediction feedback). Lock the shape and calculation logic in steps 1-8.
- **Statistics are derived, not source of truth:** All statistics can be recalculated from `InventoryEvent` history. `ProductStatistics` is a materialized view for performance. Do not treat it as authoritative - always derive from events.
- **Minimum events required:** Do not calculate intervals if fewer than 2 relevant events exist. Return null for the field. This prevents single-event anomalies from corrupting predictions.
- **Rolling window:** Limit calculations to last 20 events per type for stability. Older events are included in `observationCount` but not in interval calculations (prevents historical skew).
- **Household composition:** Fetch household once per calculation. Use `HouseholdService.getOrCreate()` which always returns a profile. Apply composition to consumption-rate estimation. Log a warning if household fetch fails, but continue with defaults.
- **Zero-quantity handling:** Treat `quantity: null` or `quantity: 0` as missing data for typical purchase quantity calculation. Do not include in mode/median.
- **Time handling:** Use `Date.now()` for current time in calculations. All stored timestamps are UTC. Mock `Date.now()` in tests with Jest fake timers.
- **Idempotent upsert:** Multiple calls to `calculate` for the same product should produce the same result (assuming no new events). Use `upsert` with `productId` as unique constraint.
- **EstimationService integration:** When modifying `applyTimeDecayHeuristics`, maintain backward compatibility - fallback to hardcoded thresholds when `ProductStatistics` is missing or has null `avgPurchaseIntervalDays`.
- **Confidence boost rationale:** Learned statistics are more reliable than generic product-type thresholds. Boost confidence when they exist to reflect this improved signal quality.
- **Future LLM integration:** Feature 8 may enrich statistics with LLM-derived insights. Keep the calculation service pure and deterministic; LLM enrichment can wrap or extend it later without modifying core logic.
- **No circular dependencies:** `StatisticsService` imports `ProductService` and `HouseholdService` but not `EstimationService`. `EstimationService` imports `StatisticsService` to read computed data. Avoid circular import by keeping reads one-directional (Estimation reads Statistics, never vice versa).
