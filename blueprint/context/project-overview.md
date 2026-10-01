# Home Stock Tracker - Project Overview

<!-- blueprint:source-hash 380d3810364b537dedb399379d2424e443b90979dbc3a227dee33dfb2eb25d8a -->

> A NestJS household grocery and inventory service used by Hermes through WhatsApp.

## Problem

Exact manual inventory is too much work. Track groceries and stock signals, learn purchase and consumption patterns, and estimate availability while favoring useful estimates over false precision. Hermes owns conversation and intent; the service owns state, persistence, product knowledge, predictions, and business rules.

## Users

- **Household members** - initially 2 adults and 3 children; shared groceries and useful reminders through WhatsApp/Hermes.
- **Hermes** - trusted REST/MCP client.

Private single-household tool. Multi-household accounts, member profiles, and shared access are future scope.

## Features

Build-plan order and progress; unchecked means planned. Features 37a and 37b are complete; item 21 remains the first unchecked item in the general queue. Sub-features are separate branch/spec/review/archive units.

- [x] **1. Grocery list management** - add, remove, and retrieve grocery list items through the service API.
- [x] **2. Product catalog and normalization** - maintain canonical products and resolve common item names and aliases.
- [x] **3. Inventory event tracking** - record structured household stock signals such as restocked, low, out, and still available.
- [x] **4. Purchase and restock flow** - record purchased items, including completing all or part of the current grocery list.
  - [x] **4a. Record purchases and restocks**.
  - [x] **4b. Complete grocery items from a purchase**.
  - [x] **4c. Partial grocery-list completion**.
- [x] **5. Household profile** - store household composition and prediction preferences used when estimating consumption.
- [x] **6. Inventory state estimation** - derive likely product availability from inventory events, purchases, and elapsed time.
- [x] **7. Consumption pattern learning** - calculate product-specific purchase and need intervals from household history.
- [x] **8. LLM-assisted product understanding** - use structured LLM inference to classify and enrich products when deterministic data is insufficient.
- [x] **9. Hybrid low-stock prediction** - combine household history, product characteristics, deterministic signals, and LLM reasoning into confidence-scored stock predictions.
- [x] **10. Prediction feedback** - record accepted, rejected, and corrected predictions so future estimates can improve.
- [x] **11. Low-stock recommendations** - expose actionable high-confidence suggestions while suppressing uncertain or unnecessary recommendations.
- [x] **12. MCP tool interface** - expose the inventory service's core grocery, stock, purchase, and prediction capabilities as agent-callable tools.
- [x] **13. Hermes inventory skill** - teach Hermes to map natural-language household requests to the appropriate inventory tools.
- [x] **14. Hermes grocery conversations** - support natural WhatsApp flows such as "add milk", "what do we need?", and "I bought everything except toilet paper".
- [x] **15. Proactive stock checks** - let Hermes periodically request low-stock predictions and send useful recommendations through WhatsApp.
- [x] **16. Service authentication** - protect REST and MCP access with private service-to-service authentication.
- [x] **17. Operational visibility** - expose health checks and structured logs for inventory actions, predictions, and integration failures.
- [x] **18. Deployment readiness** - containerize the NestJS service, configure PostgreSQL migrations and environment variables, and verify the production deployment.
- [x] **36. Issue #3: Typed MCP grocery arguments and same-conversation recovery** - publish native JSON argument examples and bounded recovery guidance; archive records verification limits.
- [x] **35. Category-aware list outputs** - expose stored product categories in grocery and inventory reads, publish the additive MCP contract, and render returned categories safely in agent list responses.
- [x] **19. Expiration tracking** - record expiration information and surface products likely to expire soon.
  - [x] **19a. Expiration-batch foundation**.
  - [x] **19b. Expiration status and reads**.
  - [x] **19c. Expiring-soon recommendations**.
- [ ] **21. Product-specific automation policies** - allow selected products to be suggested, ignored, or automatically added based on prediction confidence.
- [ ] **22. Advanced prediction engine** - improve forecasting with richer statistical models and introduce a Python prediction service only if justified.
- [ ] **23. Background job infrastructure** - add Redis and a job queue when asynchronous or distributed prediction workloads require them.
- [ ] **24. Receipt and barcode ingestion** - use receipts or barcode scans as additional purchase and inventory signals.
- [ ] **26. Management dashboard** - add a web interface for reviewing inventory state, predictions, history, and manual corrections if conversational control proves insufficient.
- [x] **27. Product name namespace** - store canonical names and aliases in one globally unique normalized namespace for deterministic indexed lookup.
- [x] **28. Grocery quantity contract** - require a positive quantity on every grocery line and expose an absolute, concurrency-safe quantity-setting operation.
- [x] **29. Product search and resolution proposals** - provide deterministic read-only product discovery and optional non-mutating LLM advice.
- [x] **30. Policy-aware grocery additions** - make unknown-product handling explicit for deterministic and assisted clients.
- [x] **31. Confirmed grocery catalog decisions** - apply user-approved product creation or alias decisions and safely complete the original grocery addition.
- [x] **32. Verifiable agent integration contract** - version MCP/skill compatibility with fixtures, drift checks, safety scenarios, probes, and release manifests.
- [x] **33. Household stock ledger and daily estimation** - materialize explicit and daily estimated stock and expose it through REST, MCP, recommendations, and agents.
  - [x] **33a. Stock ledger foundation**.
  - [x] **33b. Stock mutation and batch purchase APIs**.
  - [x] **33c. Daily stock estimation workflow**.
  - [x] **33d. Materialized inventory reads and recommendations**.
  - [x] **33e. Agent integration and contract release**.
- [x] **34. Online grocery store integration scaffold** - document and generate isolated vendor-cart skills using the grocery MCP contract.
  - [x] **34a. Store-skill contract and tutorial**.
  - [x] **34b. Fail-closed store-skill scaffold**.
- [ ] **37. Jev bounded-decision integration** - use TypeSafe Jev for evaluated product matching and stock decisions while retaining OpenAI generation.
  - [x] **37a. Jev transport foundation**.
  - [x] **37b. Jev product matching**.
  - [ ] **37c. Product-matching evaluation**.
  - [ ] **37d. Jev stock prediction**.
  - [ ] **37e. Stock-prediction evaluation**.

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
- `category` (string).
- `typicalUnit` (string, optional) - e.g. "liter", "unit".
- `productType` (enum: `fast_consumable` | `pantry_staple` | `household_consumable` | `discrete_consumable`).
- `isPerishable` (boolean).
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
- **Bounded decisions (37a transport and 37b matching; stock adapter planned)** - `ProductResolutionAdvisor` and `StockPredictionAdvisor`, independently selected by `PRODUCT_RESOLUTION_PROVIDER` and `STOCK_PREDICTION_PROVIDER`. Both default to `openai`; the Jev matching advisor is available with a 0.9 gate, existing confirmation, and resolved-model/version provenance. Matching rollout awaits 37c evaluation; TypeSafe stock selection stays blocked until 37d. Require private `TYPESAFE_API_KEY` and pinned supported `JEV_MODEL` for TypeSafe routing; OpenAI remains required for generation. Preserve confirmed writes and public contracts. The PRD defines transport, mapping, provenance, and rollout criteria.
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
