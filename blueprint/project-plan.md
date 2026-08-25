# Project Plan

> One of the two planning docs you provide. Use as much detail as the project  
> needs, including rationale, constraints, examples, edge cases, and explicit  
> exclusions that should guide later feature work. Draft it directly, develop it  
> through any AI conversation, or optionally run `/discovery` for a guided deep  
> planning session. The content is always yours to direct. When it is filled in,  
> run `/overview` to generate the project overview from this plus `build-plan.md`.

## 1. Problem - What problem are we solving?

This project creates a lightweight household grocery and inventory tracking service that can be used by an AI agent such as Hermes.

The main problem is that maintaining an exact home inventory manually is too much work. Family members should not need to constantly report every item consumed, every quantity remaining, or every stock change.

Instead, the system should:

- Maintain a grocery list.
- Store household inventory-related events and signals.
- Learn purchasing and consumption patterns over time.
- Estimate whether commonly used products are likely available, running low, or out.
- Use household context and LLM-assisted reasoning when exact information is unavailable.
- Provide actionable low-stock suggestions without requiring exact inventory tracking.
- Expose a clean API/tool layer that Hermes can use from natural-language conversations over WhatsApp.

The inventory service itself must remain independent from Hermes.

Hermes is responsible for understanding the user and deciding which tool to call. The inventory service is responsible for household state, business logic, persistence, predictions, and product understanding.

Example interaction:

User says through WhatsApp:

> Add milk to the grocery list.

Hermes interprets the intent and calls the inventory service.

Later:

> I bought everything on the list except toilet paper.

Hermes translates that into purchase/restock events.

Later, without an explicit stock update, the inventory service may infer that milk is probably running low based on previous purchases, household consumption patterns, product characteristics, and elapsed time.

The system should favor useful estimates over false precision.

Exact stock counts are not required for most products in the MVP.

## 2. Users - Who is this for?

The initial user is a single household consisting of:

- 2 adults.
- 3 children.

Household composition matters because it affects estimated consumption rates.

The MVP is designed primarily for families who:

- Already communicate with an AI assistant regularly.
- Want a shared grocery list without opening a dedicated grocery app.
- Prefer natural-language interaction over structured manual inventory entry.
- Want proactive reminders about items they may be running low on.
- Do not want to maintain exact counts for every household item.

The initial implementation is a private household tool rather than a public multi-tenant SaaS product.

Future versions may support:

- Multiple households.
- Different household member profiles.
- Shared family access.
- Personalized consumption behavior per household.

These are explicitly outside the MVP unless required for the initial household.

## 3. Features - What does the MVP need?

- Add items to the grocery list.
- Remove items from the grocery list.
- Show the current grocery list.
- Record purchased or restocked items.
- Support "bought everything" and partial-list purchase flows.
- Record inventory signals such as "running low", "out", "still have plenty", and "just bought".
- Store an event history for grocery and inventory activity.
- Normalize product names and basic product metadata.
- Maintain a household profile used by the prediction system.
- Estimate stock status as likely available, probably low, probably out, or uncertain.
- Assign confidence scores to stock predictions.
- Combine deterministic historical calculations with optional LLM reasoning.
- Detect recurring consumption and purchase intervals.
- Generate low-stock suggestions.
- Avoid suggestions when confidence is too low.
- Expose REST endpoints for all core functionality.
- Expose agent-friendly tools, preferably through MCP.
- Support Hermes calling the service from natural-language WhatsApp conversations.
- Support a Hermes skill that teaches the agent when and how to use inventory tools.
- Support scheduled prediction checks that Hermes can use for proactive WhatsApp notifications.
- Provide health and readiness endpoints.
- Log important actions and prediction decisions for debugging.

Explicit MVP exclusions:

- No web UI.
- No mobile app.
- No exact real-time inventory requirement.
- No barcode scanner.
- No receipt OCR.
- No supermarket integration.
- No automatic online purchasing.
- No computer vision.
- No Home Assistant integration.
- No expiration-date tracking unless it becomes trivial to add.
- No advanced ML training pipeline.
- No dedicated Python prediction microservice.
- No multi-tenant SaaS architecture.
- No Redis unless a concrete requirement appears.
- No automatic grocery-list addition based solely on predictions initially; predictions should recommend rather than silently modify the list.

## 4. Data - What are we storing?

### Household

- Household ID.
- Number of adults.
- Number of children.
- Optional child age groups or ages if later needed for prediction.
- Household-level prediction preferences.
- Suggestion confidence threshold.
- Future product-specific policies.

### Products

- Product ID.
- Canonical name.
- Aliases and normalized names.
- Category.
- Typical unit.
- Product type, such as fast consumable, pantry staple, household consumable, or discrete consumable.
- Whether the product is perishable.
- Prediction strategy.
- Whether prediction is enabled.
- Optional product-specific configuration.

Examples:

- milk
- eggs
- bread
- toilet paper
- dishwasher tablets
- rice
- cereal

### Grocery List Items

- Item ID.
- Product ID.
- Requested quantity if known.
- Unit if known.
- Date added.
- Status.
- Optional note.
- Source, such as Hermes/WhatsApp/API.
- Related inventory event if applicable.

### Inventory Events

All meaningful state changes should be stored as events rather than only mutating a current quantity.

Possible event types include:

- GROCERY_ADDED
- GROCERY_REMOVED
- PURCHASED
- RESTOCKED
- STOCK_LOW
- STOCK_OUT
- STOCK_CONFIRMED
- STOCK_CORRECTED
- PREDICTION_ACCEPTED
- PREDICTION_REJECTED
- INFERRED_LOW_STOCK

Each event may contain:

- Event ID.
- Product ID.
- Event type.
- Quantity if known.
- Unit if known.
- Timestamp.
- Source.
- Confidence if inferred.
- Free-text metadata or structured JSON metadata.

### Product Statistics

Derived data may include:

- Average or median time between purchases.
- Average or median time between "need" events.
- Typical purchase quantity.
- Historical prediction accuracy.
- Last known purchase.
- Last known low-stock signal.
- Last stock confirmation.
- Estimated consumption interval.
- Number of observations.

Derived statistics should be reproducible from stored events where practical.

### Predictions

Prediction records should include:

- Product ID.
- Predicted state.
- Confidence score.
- Prediction timestamp.
- Recommended action.
- Deterministic signals used.
- LLM result if an LLM was used.
- Human-readable reason.
- Model/provider/version if relevant.
- Whether the prediction was later accepted or rejected.

Prediction states:

- likely_available
- probably_low
- probably_out
- uncertain

### LLM Metadata

Where LLM inference is used, store enough information to debug behavior without unnecessarily retaining conversational data.

Possible fields:

- Model/provider.
- Prompt/version identifier.
- Structured response.
- Confidence or score.
- Prediction ID.
- Timestamp.

Avoid storing full unrelated WhatsApp conversations in the inventory service.

Hermes should extract the relevant structured intent before sending data to the backend.

## 5. Tech - What stack are we using?

### Primary Backend

- Node.js.
- TypeScript.
- NestJS.

NestJS is the preferred backend framework because the project is primarily an application service involving domain logic, state management, APIs, integrations, scheduling, and tool exposure.

The prediction system should initially remain inside the NestJS application.

Python should only be introduced later if the prediction system evolves into advanced statistical modeling, data-science-heavy forecasting, custom ML training, or other workloads where Python provides a clear advantage.

### Database

- PostgreSQL.

PostgreSQL is the source of truth for:

- Products.
- Grocery list.
- Household configuration.
- Inventory events.
- Prediction history.
- Derived statistics.

### ORM

Preferred:

- Prisma.

Alternative:

- TypeORM.

Use Prisma unless a NestJS-specific constraint provides a strong reason to choose another ORM.

### API

- REST API using NestJS controllers.
- OpenAPI/Swagger documentation.
- JSON request/response contracts.
- Versioned API routes if needed.

Example:

```text
/api/v1/grocery/items
/api/v1/inventory/events
/api/v1/inventory
/api/v1/predictions/low-stock

```

### Agent Integration

Preferred:

- MCP tools exposed by the inventory service or by a very thin MCP adapter.

Core tools should map closely to service capabilities:

- grocery_add
- grocery_remove
- grocery_list
- record_purchase
- record_stock_signal
- get_inventory
- get_product
- get_low_stock_predictions

Hermes should use a custom skill to learn when to call these tools.

The Hermes skill should contain workflow instructions, examples, ambiguity handling, and tool-selection guidance.

Hermes should not contain business rules that belong in the inventory service.

### LLM Integration

Use an LLM provider through a dedicated abstraction such as:

```text
LlmService
PredictionEngine
ProductClassifier

```

The service should not be tightly coupled to one LLM provider.

LLM responsibilities may include:

- Product classification.
- Product normalization when deterministic matching is insufficient.
- Cold-start stock estimation.
- Household-context reasoning.
- Interpreting incomplete inventory history.
- Producing structured prediction insights.

The LLM must return structured output validated by DTO/schema validation.

The LLM should not directly write to the database.

All state changes must pass through normal domain services.

### Prediction Architecture

Use a hybrid prediction model:

```text
Historical events
+
Time since previous signals
+
Household profile
+
Product metadata
+
Deterministic heuristics
+
Optional LLM inference
=
Stock prediction

```

Prediction logic should be behind an interface so a future Python service can replace or augment it without changing the rest of the application.

Conceptually:

```typescript
interface PredictionEngine {
  estimateStock(productId: string): Promise<StockPrediction>;
}

```

### Caching / Queues

Do not add Redis to the initial MVP unless needed.

Potential future uses:

- Background job queues.
- Prediction-job locks.
- Caching expensive prediction results.
- Rate limiting.
- Distributed scheduling.

If these needs appear, use Redis with a NestJS-compatible job queue such as BullMQ.

### Testing

- Jest.
- NestJS testing utilities.
- Integration tests against PostgreSQL.
- API contract tests.
- Prediction-engine unit tests.
- Tool/MCP integration tests.

Critical business flows should have automated coverage.

### Packaging

- Docker.
- Docker Compose for local development.
- Environment-based configuration.
- Database migrations as part of deployment.

## 6. Monetize - How will this make money?

The MVP is a private household tool and does not need to generate revenue.

There should be no monetization-related complexity in the initial architecture.

If the project later becomes a product, possible monetization models include:

- Monthly household subscription.
- Free tier with limited prediction history.
- Paid AI-powered inventory prediction.
- Family/shared-household plans.
- Premium integrations such as Home Assistant or retailer services.

Advertising is not a preferred model because the product may handle sensitive household consumption and purchasing behavior.

Do not design the MVP around monetization.

## 7. UI/UX - How should this look and feel?

There is no dedicated UI in the MVP.

The primary user experience is conversational:

```text
WhatsApp
↓
Hermes
↓
Inventory Service

```

The UX should feel like talking naturally to a household assistant rather than operating an inventory application.

Users should be able to say things such as:

> Add milk and eggs to the grocery list.

> What do we need to buy?

> I bought everything except toilet paper.

> We still have plenty of rice.

> We're almost out of cereal.

> Did we probably run out of milk?

Hermes should translate these phrases into structured backend operations.

Responses should be concise and useful.

Example:

> Added milk and eggs.

Instead of:

> The grocery_add tool completed successfully for 2 items.

For predictions:

> Milk is probably getting low. You usually need it around every 6 days, and it has been 5 days since the last restock. Want me to add it?

Avoid excessive notifications.

The system should prefer silence over weak predictions.

Suggested behavior:

- High confidence: proactively suggest.
- Medium confidence: mention only when relevant or during a scheduled inventory check.
- Low confidence: do nothing.

The service itself must not depend on WhatsApp or Hermes-specific presentation.

Future UIs may include:

- Web dashboard.
- Home Assistant dashboard.
- Mobile application.

These would consume the same backend API.

## 8. Deployment - Where and how will this ship?

### Initial Deployment Model

Deploy as a private backend service accessible by Hermes.

Recommended deployment:

```text
Docker container
+
Managed or self-hosted PostgreSQL

```

The service may run on:

- A private VPS.
- The same private infrastructure as Hermes.
- A separate Docker host.
- Railway, Render, [Fly.io](http://Fly.io), or another container platform.

A self-hosted Docker environment is preferred if Hermes already runs on privately controlled infrastructure.

### Application Type

- NestJS backend service.
- No frontend build.
- REST API.
- MCP endpoint or MCP adapter.
- Optional internal scheduled jobs.

### Build

Typical build command:

```bash
npm ci && npm run build

```

If using pnpm:

```bash
pnpm install --frozen-lockfile && pnpm build

```

### Start

Production:

```bash
npm run start:prod

```

Equivalent expected output:

```text
dist/

```

### Database

PostgreSQL is required.

Run Prisma migrations during deployment.

Example:

```bash
npx prisma migrate deploy

```

Database backups should be enabled.

### Environment Variables

Initial expected variables:

```text
NODE_ENV
PORT

DATABASE_URL

LLM_PROVIDER
LLM_API_KEY
LLM_MODEL

MCP_ENABLED

API_AUTH_TOKEN

LOG_LEVEL

```

Potential future variables:

```text
REDIS_URL
PREDICTION_CRON
PREDICTION_MIN_CONFIDENCE
PREDICTION_LLM_ENABLED

```

Exact provider-specific names can be added when the LLM provider is selected.

Secrets must never be committed to the repository.

### Authentication

Because this is a private household service, start with simple service-to-service authentication.

For example:

```text
Authorization: Bearer <service-token>

```

Hermes/MCP is the primary trusted client.

Do not build user signup, OAuth, sessions, or multi-user authentication in the MVP unless required.

### Health Checks

Expose:

```text
GET /health

```

The health check should verify that the application process is running.

Optionally expose:

```text
GET /ready

```

Readiness may verify:

- Database connectivity.
- Required configuration.
- Critical dependencies.

Health checks should not invoke an LLM.

### Scheduled Jobs

The inventory service should support a periodic prediction scan.

Initially this can run:

- Through NestJS scheduler.
- Through an external cron.
- Or through Hermes cron calling the low-stock prediction tool.

Preferred early approach:

Keep proactive message delivery in Hermes.

The inventory service calculates predictions; Hermes decides when and where to send notifications.

Example flow:

```text
Hermes cron
↓
get_low_stock_predictions
↓
Inventory Service
↓
Return only meaningful predictions
↓
Hermes sends WhatsApp message

```

This keeps WhatsApp delivery outside the inventory service.

### Redis / Workers

No Redis or separate worker process is required initially.

If prediction jobs later become expensive or asynchronous, introduce:

```text
Redis
+
BullMQ
+
NestJS worker

```

At that point deployment may include:

```text
inventory-api
inventory-worker
postgres
redis

```

But this is explicitly not required for the MVP.

### Networking

Prefer private networking between Hermes and the inventory service.

If the inventory service must be publicly accessible:

- Require HTTPS.
- Require authentication.
- Restrict access where practical.
- Apply request size and rate limits.

### Domain

A dedicated public domain is not required initially.

Possible private/internal endpoint:

```text
http://home-inventory:3000

```

or a private DNS name such as:

```text
inventory.internal.example

```

If MCP requires an externally reachable HTTP endpoint, expose only the necessary authenticated endpoint through HTTPS.

### Initial Deployment Shape

```text
┌──────────────────────────┐
│        WhatsApp          │
└─────────────┬────────────┘
              │
              ▼
┌──────────────────────────┐
│          Hermes          │
│                          │
│ Home Inventory Skill     │
│ MCP Client / Tools       │
│ Scheduled Notifications  │
└─────────────┬────────────┘
              │
              │ authenticated API / MCP
              ▼
┌──────────────────────────┐
│ Home Inventory Service   │
│                          │
│ NestJS                   │
│ Grocery                  │
│ Inventory                │
│ Products                 │
│ Events                   │
│ Predictions              │
│ LLM Integration          │
└─────────────┬────────────┘
              │
              ▼
┌──────────────────────────┐
│       PostgreSQL         │
└──────────────────────────┘

```

The architectural rule for later feature work is:

**Hermes understands the human. The inventory service understands the household.**

Hermes owns conversation, intent interpretation, and communication channels.

The inventory service owns state, product knowledge, grocery behavior, household consumption history, predictions, and business rules.
