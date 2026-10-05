# Home Stock Tracker - Project Overview

<!-- blueprint:source-hash 628891c34d5b612e001befb63ca349ac3fbdab1955061509d6fb2696e60424d2 -->

> A NestJS household grocery and inventory service used by Hermes through WhatsApp.

## Problem

Exact manual inventory is too much work. Track groceries and stock signals, learn purchase and consumption patterns, and estimate availability while favoring useful estimates over false precision. Hermes owns conversation and intent; the service owns state, persistence, product knowledge, predictions, and business rules.

## Users

- **Household members** - initially 2 adults and 3 children; shared groceries and useful reminders through WhatsApp/Hermes.
- **Hermes** - trusted REST/MCP client.

Private single-household tool. Multi-household accounts, member profiles, and shared access are future scope.

## Features

Build-plan order and progress; unchecked means planned. Feature 37 and sub-features 38a and 38b are complete. The next target in the approved JEV-first scope is 38c; item 21 remains the first unchecked in the general queue. Sub-features have separate spec/review/archive cycles.

- [x] **1. Grocery list management**
- [x] **2. Product catalog and normalization**
- [x] **3. Inventory event tracking**
- [x] **4. Purchase and restock flow**
  - [x] **4a. Record purchases and restocks**
  - [x] **4b. Complete grocery items from a purchase**
  - [x] **4c. Partial grocery-list completion**
- [x] **5. Household profile**
- [x] **6. Inventory state estimation**
- [x] **7. Consumption pattern learning**
- [x] **8. LLM-assisted product understanding**
- [x] **9. Hybrid low-stock prediction**
- [x] **10. Prediction feedback**
- [x] **11. Low-stock recommendations**
- [x] **12. MCP tool interface**
- [x] **13. Hermes inventory skill**
- [x] **14. Hermes grocery conversations**
- [x] **15. Proactive stock checks**
- [x] **16. Service authentication**
- [x] **17. Operational visibility**
- [x] **18. Deployment readiness**
- [x] **36. Issue #3: Typed MCP grocery arguments and same-conversation recovery**
- [x] **35. Category-aware list outputs**
- [x] **19. Expiration tracking**
  - [x] **19a. Expiration-batch foundation**
  - [x] **19b. Expiration status and reads**
  - [x] **19c. Expiring-soon recommendations**
- [ ] **21. Product-specific automation policies**
- [ ] **22. Advanced prediction engine**
- [ ] **23. Background job infrastructure**
- [ ] **24. Receipt and barcode ingestion**
- [ ] **26. Management dashboard**
- [x] **27. Product name namespace**
- [x] **28. Grocery quantity contract**
- [x] **29. Product search and resolution proposals**
- [x] **30. Policy-aware grocery additions**
- [x] **31. Confirmed grocery catalog decisions**
- [x] **32. Verifiable agent integration contract**
- [x] **33. Household stock ledger and daily estimation**
  - [x] **33a. Stock ledger foundation**
  - [x] **33b. Stock mutation and batch purchase APIs**
  - [x] **33c. Daily stock estimation workflow**
  - [x] **33d. Materialized inventory reads and recommendations**
  - [x] **33e. Agent integration and contract release**
- [x] **34. Online grocery store integration scaffold**
  - [x] **34a. Store-skill contract and tutorial**
  - [x] **34b. Fail-closed store-skill scaffold**
- [x] **37. Jev bounded-decision integration**
  - [x] **37a. Jev transport foundation**
  - [x] **37b. Jev product matching**
  - [x] **37c. Product-matching evaluation**
  - [x] **37d. Jev stock prediction**
  - [x] **37e. Stock-prediction evaluation**
- [ ] **38. JEV-first application inference**
  - [x] **38a. Task routing and choice vocabulary**
  - [x] **38b. JEV product understanding**
  - [ ] **38c. JEV shelf-life policies**
  - [ ] **38d. Stock predictions in application workflows**
  - [ ] **38e. Evaluation and dual-provider rollout**

**MVP exclusions:** dedicated UI/mobile app, exact real-time counts, OCR/barcodes, computer vision, built-in retailer integration, automatic purchasing, multi-tenancy, advanced ML/Python services, Redis without need, automatic grocery mutations from predictions. Post-MVP expiration and external adapter work are tracked separately.

## Data model

> Lock shapes that later features depend on, and say so. Field types are inferred from usage; exact DB types are decided when the Prisma schema is written.

### Household

- `id` (string, UUID) - primary key.
- `adultsCount` (number) - used in consumption-rate estimation.
- `childrenCount` (number) - used in consumption-rate estimation.
- `childAgeGroups` (string[] or JSON, optional) - only if later needed for prediction.
- `predictionPreferences` (JSON, optional) - household-level tuning.
- `suggestionConfidenceThreshold` (number) - minimum confidence before a suggestion is surfaced.
- `productPolicies` (JSON, optional) - future per-product overrides.

Single-row table for the MVP household; schema should not assume single-row forever (multi-household is post-MVP, not excluded from the shape).

### Product

- `id` (string, UUID) - primary key.
- `names` (`ProductName[]`) - the authoritative canonical name and explicit aliases.
- `category` (string, nullable).
- `typicalUnit` (string, optional) - e.g. "liter", "unit".
- `productType` (nullable enum: `fast_consumable` | `pantry_staple` | `household_consumable` | `discrete_consumable`).
- `isPerishable` (boolean, nullable; unknown is not false).
- `predictionStrategy` (string/enum, optional) - which estimation approach applies.
- `predictionEnabled` (boolean).
- `config` (JSON, optional) - product-specific overrides.

### ProductName

- `id` (string, UUID) - primary key.
- `productId` (FK -> Product) - owning product; names are deleted with the product.
- `displayName` (string) - approved spelling returned through public product contracts.
- `normalizedName` (string, globally unique) - deterministic lookup key produced with Unicode NFKC normalization, trimming, locale-independent lowercase, and internal whitespace collapse.
- `kind` (enum: `canonical` | `alias`) - exactly one canonical row is required per product; aliases are explicit identity terms.

Canonical and alias names share one global namespace: one normalized phrase can identify at most one product. Existing REST and MCP product responses continue to expose derived `canonicalName` and `aliases` fields.

### GroceryListItem

- `id` (string, UUID) - primary key.
- `productId` (FK -> Product).
- `requestedQuantity` (number, required and greater than zero) - defaults to `1` only when a new grocery line is created without an explicit quantity.
- `unit` (string, optional).
- `dateAdded` (datetime).
- `status` (enum: e.g. `pending` | `purchased` | `removed`).
- `note` (string, optional).
- `source` (enum: `hermes_whatsapp` | `api` | `mcp`) - server-owned transport
  provenance; `hermes_whatsapp` is retained for historical compatibility.
- `relatedInventoryEventId` (FK -> InventoryEvent, optional) - links to the event created when the item is resolved (purchased/removed).

### InventoryEvent

The append-only source of truth. All meaningful state changes are stored as events rather than only mutating a current quantity; derived statistics should be reproducible from stored events where practical.

- `id` (string, UUID) - primary key.
- `productId` (FK -> Product).
- `eventType` (enum) - includes grocery, purchase, qualitative stock, prediction feedback, `STOCK_SET`, and `STOCK_CONSUMED` events.
- `quantity` (number, optional).
- `unit` (string, optional).
- `timestamp` (datetime).
- `source` (string) - server-owned transport provenance, currently `api` or
  `mcp`; historical values remain unchanged.
- `confidence` (number, optional) - set when the event is inferred rather than reported.
- `metadata` (JSON, optional).

### ProductStatistics (derived)

Reproducible from `InventoryEvent` history; may be materialized for performance rather than fully denormalized state.

- `productId` (FK -> Product).
- `avgPurchaseIntervalDays` (number, optional).
- `avgNeedIntervalDays` (number, optional).
- `typicalPurchaseQuantity` (number, optional).
- `predictionAccuracy` (number, optional).
- `lastPurchaseAt` (datetime, optional).
- `lastLowStockSignalAt` (datetime, optional).
- `lastStockConfirmationAt` (datetime, optional).
- `estimatedConsumptionIntervalDays` (number, optional).
- `observationCount` (number).

### StockProjection

One materialized balance per tracked product. Existing products remain untracked until a purchase or explicit stock update creates this row.

- `productId` (unique FK -> Product), `unit` (string) - canonical stock identity.
- `recordedQuantity` (number, optional), `recordedAt` (datetime), `recordedSource` (string), `recordedEventId` (unique FK -> InventoryEvent) - the last explicit fact.
- `estimatedQuantity` (number, optional), `estimatedState` (`likely_available` | `probably_low` | `probably_out` | `uncertain`), `confidence` (number), `reason` (string), `evaluatedAt` (datetime) - the latest materialized estimate.
- `predictionId` (optional FK -> Prediction) - provenance for daily evaluation.

Purchases and absolute sets reset the recorded balance. Decrements clamp at zero. Daily evaluation updates only estimate fields and never rewrites the recorded fact.

### ProductShelfLifePolicy

- `productId` (unique FK -> Product), `kind` (`finite` | `nonperishable`), `shelfLifeDays` (positive number for finite, null for nonperishable).
- `modelProvider`, `modelVersion`, `promptVersion` (optional strings), `confidence` (number), `rationale` (string), `evaluatedAt` (datetime) - inference provenance.

### Prediction

- `id` (string, UUID) - primary key.
- `productId` (FK -> Product).
- `predictedState` (enum: `likely_available` | `probably_low` | `probably_out` | `uncertain`).
- `confidenceScore` (number).
- `predictedAt` (datetime).
- `recommendedAction` (string, optional).
- `deterministicSignals` (JSON) - the historical/heuristic inputs used.
- `llmResult` (JSON, optional) - present only when LLM reasoning contributed.
- `reason` (string) - human-readable explanation surfaced to the user.
- `modelProviderVersion` (string, optional).
- `feedbackStatus` (enum: `pending` | `accepted` | `rejected`, optional) - set via Prediction feedback (feature 10).

### LlmInferenceLog

Debugging record for LLM-assisted calls; must not retain unrelated WhatsApp conversation content - Hermes extracts structured intent before calling the backend.

- `id` (string, UUID) - primary key.
- `predictionId` (FK -> Prediction, optional).
- `modelProvider` (string).
- `promptVersion` (string, optional).
- `structuredResponse` (JSON).
- `confidence` (number, optional).
- `timestamp` (datetime).

## Tech stack

- **Node.js, TypeScript, NestJS** - modular backend, injected services, REST/JSON DTOs, OpenAPI, thin MCP tools.
- **PostgreSQL and Prisma** - authoritative persistence and migrations; TypeORM only if a NestJS constraint requires it.
- **Generation** - `LlmProvider` selected through DI and `LLM_PROVIDER`; OpenAI Responses API with validated output, private `OPENAI_API_KEY`, configurable `LLM_MODEL` (initial default `gpt-5.6-sol`). Product classification and shelf-life generation use this boundary. Adapters own requests, authentication, validation, errors; AI never writes directly to the database. Future OpenRouter/Anthropic adapters must preserve the domain boundary.
- **Bounded decisions (37a transport, 37b matching and 37d stock advice)** - `ProductResolutionAdvisor` and `StockPredictionAdvisor`, independently selected by `PRODUCT_RESOLUTION_PROVIDER` and `STOCK_PREDICTION_PROVIDER`. Both default to `openai`; the Jev matching advisor is available with a 0.9 gate, existing confirmation, and resolved-model/version provenance. 37c evaluation tooling is complete; matching rollout awaits independently reviewed live held-out evidence; The Jev stock advisor is available for the internal on-demand prediction engine with zero-history safety, deterministic precedence, a 0.9 gate, conservative confidence, and versioned accepted/rejected provenance. Inventory reads and daily materialization remain deterministic; 37e stock evaluation tooling is complete with cutoff-safe replay, metrics, a private bounded CLI and an authored safety corpus. Stock runtime rollout awaits independently reviewed live historical held-out evidence; authored/offline evidence remains inconclusive. Require private `TYPESAFE_API_KEY` and pinned supported `JEV_MODEL` for TypeSafe routing; OpenAI remains required for generation. Preserve confirmed writes and public contracts. The PRD defines transport, mapping, provenance, and rollout criteria.
- **Planned JEV-first routing (38)** - deterministic evidence first; JEV for bounded category, type, unit, perishability, shelf-life policy and stock choices; OpenAI only for unsupported required generation. Preserve entered names and confirmed aliases. Low confidence and failures do not automatically invoke OpenAI. Versioned vocabularies and per-field unknowns precede adapters; accepted stock advice must feed projections with race protection. Task evaluation precedes rollout. See the [approved detailed plan](feature-plans/jev-first-application-inference.md).
- **Hybrid prediction** - history, elapsed time, household context, metadata, deterministic heuristics, optional model inference behind `PredictionEngine`. Python only if justified by statistical workloads.
- **Jest/Nest testing utilities** - critical unit, PostgreSQL integration, API, prediction, and tool-contract coverage.
- **Docker/Compose** - packaging, local development, environment configuration, migrations.
- **Redis/BullMQ** - deferred to feature 23 for demonstrated caching, queue, lock, or distributed scheduling needs.

## Monetization

None in v1; private household use. Future subscriptions must not shape MVP architecture. Advertising is disfavored due to sensitive consumption data.

## UI/UX

`WhatsApp -> Hermes -> Inventory Service (REST/MCP) -> PostgreSQL`

No dedicated MVP UI. Hermes maps grocery, purchase, and stock requests to tools and renders concise replies. High confidence allows proactive suggestions; medium confidence is mentioned when relevant; low confidence stays silent. Service behavior stays independent of WhatsApp formatting for later clients.

## Deployment

- **App/host** - private NestJS REST/MCP backend with optional jobs, no frontend. Self-hosted Docker preferred with private Hermes infrastructure; VPS, shared or separate Docker host, Railway, Render, Fly.io are alternatives. Exact host unspecified.
- **Build/start** - `npm ci && npm run build`; `npm run start:prod` serving `dist/`. Run `npx prisma migrate deploy`; enable PostgreSQL backups.
- **Verify** - `npm run verify`, unit tests then production build, per `AGENTS.md`.
- **Environment** - `NODE_ENV`, `PORT`, `DATABASE_URL`, `LLM_PROVIDER`, `OPENAI_API_KEY`, `LLM_MODEL`, `MCP_ENABLED`, `API_AUTH_TOKEN`, `LOG_LEVEL`. Transport configuration includes both task selectors, `TYPESAFE_API_KEY`, `JEV_MODEL`. Future: `REDIS_URL`, `PREDICTION_CRON`, `PREDICTION_MIN_CONFIDENCE`, `PREDICTION_LLM_ENABLED`. Never commit secrets.
- **Auth/network** - service bearer token, private networking/internal DNS preferred. Public access needs HTTPS, authentication, restricted exposure, request size/rate limits. No MVP signup/OAuth/session system.
- **Health** - `/health` liveness; `/ready` may check DB/config/dependencies. Neither invokes a model.
- **Scheduling** - Nest scheduler, external cron, or Hermes cron. Service computes predictions; Hermes sends messages. No initial workers/Redis.

## Open questions

- Exact deployment host remains unspecified; does not block Jev transport planning.
- Project-plan section 3 summarizes extensions while build-plan tracks additional detailed post-MVP outcomes and splits. Use build-plan for progress.
- Jev matching and prediction require separate evaluation before runtime rollout. PRD thresholds and precision targets are proposed policies, not demonstrated accuracy.

- Project-plan describes the existing OpenAI generation split; approved feature 38 extends it to JEV-first choices. Current routing is unchanged until implementation/evaluation. Category/unit choices and shelf-life policies are finalized in the respective specs; no catalog relabeling is implied.
