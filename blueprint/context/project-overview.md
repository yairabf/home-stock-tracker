# Home Stock Tracker - Project Overview

> A NestJS backend service that tracks household grocery and inventory state, and estimates stock levels without requiring exact manual counts, so an AI agent (Hermes) can manage groceries and stock through natural WhatsApp conversation.

## Problem

Maintaining an exact home inventory manually is too much work; family members shouldn't have to report every item consumed or every quantity remaining. This service instead maintains a grocery list, stores household inventory signals and events, learns purchasing and consumption patterns over time, and estimates whether commonly used products are likely available, running low, or out - favoring useful estimates over false precision. It exposes a clean API/tool layer that Hermes calls from WhatsApp conversations; the inventory service owns household state, business logic, persistence, predictions, and product understanding, while Hermes owns intent interpretation and the communication channel.

## Users

- **Household members (initial: 2 adults, 3 children)** - want a shared grocery list and proactive low-stock reminders without opening a dedicated app or maintaining exact counts; interact entirely through natural language via WhatsApp/Hermes.
- **Hermes (the AI agent)** - the sole client of the service's REST/MCP surface; calls tools to add/remove grocery items, record purchases and stock signals, and fetch low-stock predictions.

This is a private single-household tool, not a multi-tenant SaaS product. Multiple households, per-member profiles, and shared family access are explicitly future scope, not MVP.

## Features

The MVP feature set, in build order. Item 12 (MCP tool interface) is the headline integration point - it's what makes the service usable by Hermes at all.

1. **Grocery list management** - add, remove, and retrieve grocery list items through the service API.
2. **Product catalog and normalization** - maintain canonical products and resolve common item names and aliases.
3. **Inventory event tracking** - record structured household stock signals such as restocked, low, out, and still available.
4. **Purchase and restock flow** - record purchased items, including completing all or part of the current grocery list.
5. **Household profile** - store household composition and prediction preferences used when estimating consumption.
6. **Inventory state estimation** - derive likely product availability from inventory events, purchases, and elapsed time.
7. **Consumption pattern learning** - calculate product-specific purchase and need intervals from household history.
8. **LLM-assisted product understanding** - use structured LLM inference to classify and enrich products when deterministic data is insufficient.
9. **Hybrid low-stock prediction** - combine household history, product characteristics, deterministic signals, and LLM reasoning into confidence-scored stock predictions.
10. **Prediction feedback** - record accepted, rejected, and corrected predictions so future estimates can improve.
11. **Low-stock recommendations** - expose actionable high-confidence suggestions while suppressing uncertain or unnecessary recommendations.
12. **MCP tool interface** (headline) - expose the inventory service's core grocery, stock, purchase, and prediction capabilities as agent-callable tools.
13. **Hermes inventory skill** - teach Hermes to map natural-language household requests to the appropriate inventory tools.
14. **Hermes grocery conversations** - support natural WhatsApp flows such as "add milk", "what do we need?", and "I bought everything except toilet paper".
15. **Proactive stock checks** - let Hermes periodically request low-stock predictions and send useful recommendations through WhatsApp.
16. **Service authentication** - protect REST and MCP access with private service-to-service authentication.
17. **Operational visibility** - expose health checks and structured logs for inventory actions, predictions, and integration failures.
18. **Deployment readiness** - containerize the NestJS service, configure PostgreSQL migrations and environment variables, and verify the production deployment.

Post-MVP:

19. **Expiration tracking** - record expiration information and surface products likely to expire soon.
20. **Storage locations** - track products across household storage locations.
21. **Product-specific automation policies** - control whether selected products are suggested, ignored, or automatically added at configured confidence.
22. **Advanced prediction engine** - add richer statistical forecasting and introduce Python only if justified.
23. **Background job infrastructure** - add Redis and a job queue when prediction work requires asynchronous or distributed execution.
24. **Receipt and barcode ingestion** - use receipts and barcode scans as additional purchase and inventory signals.
25. **Home Assistant integration** - expose grocery, inventory, and low-stock state to household automation.
26. **Management dashboard** - provide a web interface for inventory, predictions, history, and manual corrections if conversational control is insufficient.
27. **Product name namespace** - store canonical names and aliases in one globally unique normalized namespace for indexed, deterministic lookup.
28. **Grocery quantity contract** - require every grocery line to store a positive quantity, default new lines to `1`, and expose an absolute, concurrency-safe quantity-setting operation.
29. **Product search and resolution proposals** - provide deterministic read-only product discovery and optional non-mutating LLM advice.
30. **Policy-aware grocery additions** - make unknown-product handling explicit for deterministic and assisted clients.
31. **Confirmed grocery catalog decisions** - apply user-approved product creation or alias decisions and safely complete the original grocery addition.
32. **Verifiable agent integration contract** - establish one versioned MCP-and-skill compatibility contract with schema fixtures, drift checks, executable safety scenarios, installation verification, and platform-specific release manifests.

**Explicit MVP exclusions:** no web UI, no mobile app, no exact real-time inventory requirement, no barcode scanner, no receipt OCR, no supermarket integration, no automatic online purchasing, no computer vision, no Home Assistant integration, no expiration-date tracking (unless trivial), no advanced ML training pipeline, no dedicated Python prediction microservice, no multi-tenant architecture, no Redis unless a concrete need appears, and no automatic grocery-list mutation from predictions alone (predictions recommend; they don't silently modify the list).

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
- `eventType` (enum: `GROCERY_ADDED` | `GROCERY_REMOVED` | `PURCHASED` | `RESTOCKED` | `STOCK_LOW` | `STOCK_OUT` | `STOCK_CONFIRMED` | `STOCK_CORRECTED` | `PREDICTION_ACCEPTED` | `PREDICTION_REJECTED` | `INFERRED_LOW_STOCK`).
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

- **Node.js + TypeScript + NestJS** - primary backend framework; chosen because the project is an application service (domain logic, APIs, integrations, scheduling, tool exposure), not a data-science workload.
- **PostgreSQL** - source of truth for products, grocery list, household config, inventory events, prediction history, and derived statistics.
- **Prisma** (preferred ORM; TypeORM only if a NestJS-specific constraint forces it) - schema and migrations.
- **REST API via NestJS controllers** - JSON contracts, OpenAPI/Swagger docs, versioned routes (e.g. `/api/v1/grocery/items`, `/api/v1/inventory/events`, `/api/v1/inventory`, `/api/v1/predictions/low-stock`).
- **MCP tools** (service-exposed or via a thin adapter) - `grocery_add`, `grocery_confirm_new_product`, `grocery_confirm_product_alias`, `grocery_set_quantity`, `grocery_update`, `grocery_remove`, `grocery_list`, `record_purchase`, `record_stock_signal`, `record_prediction_feedback`, `complete_grocery_purchase`, `get_inventory`, `list_inventory_events`, `get_product`, `search_products`, `get_low_stock_predictions`. Purchase completion prefers per-row `items` and records actual quantity and unit only when the user explicitly provides them; the legacy ID-only shape remains transitional. Hermes learns tool usage via a dedicated skill; business rules stay in the service, not in Hermes.
- **Provider-neutral LLM layer** (`LlmProvider`, `PredictionEngine`, `ProductClassifier`) - domain services depend only on a structured-generation interface selected through dependency injection and `LLM_PROVIDER`. OpenAI Responses API is the first adapter, using structured outputs and a configurable model defaulting to `gpt-5.6-sol`; future OpenRouter or Anthropic adapters can be added without changing domain logic. Each adapter owns authentication, provider request mapping, structured-output handling, and error translation. The LLM never writes to the database directly, and all state changes go through domain services.
- **Hybrid prediction architecture** - historical events + time-since-signal + household profile + product metadata + deterministic heuristics + optional LLM inference, behind a `PredictionEngine` interface so a future Python service could replace/augment it without touching the rest of the app.
- **Jest + NestJS testing utilities** - integration tests against PostgreSQL, API contract tests, prediction-engine unit tests, MCP/tool integration tests. Critical business flows require automated coverage.
- **Docker + Docker Compose** - packaging and local development; environment-based configuration; DB migrations run as part of deployment.
- **Redis/BullMQ** - explicitly deferred; only introduced if async/distributed prediction workloads later require it (post-MVP, feature 23).

## Monetization

Not in v1. This is a private household tool with no monetization-related complexity in the MVP architecture. If the project later becomes a product, possible directions include a household subscription, a limited free tier, paid AI-powered prediction, family plans, or premium integrations - advertising is explicitly disfavored given the sensitivity of household consumption data. None of this should shape the MVP design.

## UI/UX

There is no dedicated UI in the MVP. The experience is entirely conversational:

```text
WhatsApp -> Hermes -> Inventory Service (REST/MCP) -> PostgreSQL
```

Hermes translates natural requests ("add milk and eggs", "what do we need?", "I bought everything except toilet paper", "we're almost out of cereal") into calls against the service's API/MCP surface, and translates responses back into concise, natural replies rather than exposing raw tool/operation results.

Notification behavior by confidence:

- **High confidence** - proactively suggest.
- **Medium confidence** - mention only when relevant or during a scheduled check.
- **Low confidence** - stay silent; the system favors silence over weak predictions.

The service itself must stay presentation-agnostic - it must not depend on WhatsApp or Hermes-specific formatting, so a future web dashboard, Home Assistant surface, or mobile app could consume the same API.

## Deployment

- **App type** - NestJS backend service (Node.js/TypeScript), no frontend build, REST API + MCP endpoint/adapter, optional internal scheduled jobs.
- **Target host** - private backend reachable by Hermes: a private VPS, the same infrastructure as Hermes, a separate Docker host, or a container platform (Railway, Render, Fly.io). Self-hosted Docker is preferred if Hermes already runs on privately controlled infrastructure. > TODO: exact host not yet chosen.
- **Build** - `npm ci && npm run build` (pnpm equivalent: `pnpm install --frozen-lockfile && pnpm build`).
- **Start** - `npm run start:prod`, serving from `dist/`.
- **Database** - PostgreSQL required; run `npx prisma migrate deploy` during deployment; backups should be enabled.
- **Environment variables** - `NODE_ENV`, `PORT`, `DATABASE_URL`, `LLM_PROVIDER` (initially `openai`), `OPENAI_API_KEY`, `LLM_MODEL` (default `gpt-5.6-sol`), `MCP_ENABLED`, `API_AUTH_TOKEN`, `LOG_LEVEL`. Potential future: `REDIS_URL`, `PREDICTION_CRON`, `PREDICTION_MIN_CONFIDENCE`, `PREDICTION_LLM_ENABLED`.
- **Authentication** - simple service-to-service bearer token (`Authorization: Bearer <service-token>`); Hermes/MCP is the sole trusted client. No user signup, OAuth, sessions, or multi-user auth in the MVP.
- **Health checks** - `GET /health` (process liveness); optionally `GET /ready` (DB connectivity, required config, critical dependencies). Health checks must not invoke an LLM.
- **Scheduled jobs** - a periodic low-stock prediction scan, run via the NestJS scheduler, external cron, or Hermes cron calling the prediction tool. Preferred split: the inventory service computes predictions; Hermes decides when/where to send WhatsApp notifications, keeping message delivery outside the inventory service.
- **Workers/queues** - none required initially; Redis + BullMQ + a NestJS worker are deferred to post-MVP (feature 23) if prediction jobs become expensive or asynchronous.
- **Networking/domain** - prefer private networking between Hermes and the service; no public domain required initially (e.g. `http://home-inventory:3000` or an internal DNS name). If a public/MCP-reachable endpoint is needed, require HTTPS, authentication, restricted access, and request size/rate limits.

## Open questions

> Resolve these in the plans if they matter, then re-run `/overview`.

- **Deployment host not yet chosen.** §8 lists several acceptable options (private VPS, shared Hermes infra, separate Docker host, or a platform like Railway/Render/Fly.io) without picking one.
- **Build-plan item 18 ("Deployment readiness") overlaps with `/release`.** The Blueprint workflow normally treats containerization/production verification as an optional `/release` step rather than a numbered feature. Kept as item 18 per your approval; when you reach it, decide whether to spec it with `/feature` or handle it through `/release` instead.
