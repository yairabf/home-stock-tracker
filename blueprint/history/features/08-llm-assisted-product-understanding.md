# Feature: LLM-assisted product understanding

**From build-plan:** feature 8
**Status:** complete

## Completion record

**Completed:** 2026-08-27

### Delivered

- Added a provider-neutral structured-generation boundary with configuration-based
  adapter selection and an OpenAI Responses API implementation.
- Added validated product classification with normalized aliases, a `0.8`
  confidence gate, and provider-independent unavailable/refusal handling.
- Integrated classification into unmatched product resolution without holding a
  transaction open during inference. Existing catalog records are reused safely,
  inferred metadata enriches only new products, and every inference failure keeps
  the deterministic normalized-name fallback.
- Added persistence for successful, validated inference metadata without storing
  secrets, raw provider errors, or unrelated conversation content.
- Stabilized the shared database E2E harness with the supported Supertest import
  and serial Jest execution.
- Updated the `complete` workflow skill in both adapters so future feature archives
  document delivered behavior and verification evidence.

### Changed areas

- `src/llm/` - provider-neutral contracts, adapter registry, configuration, OpenAI
  adapter, structured schema, and focused tests.
- `src/product/` - classification contracts and service, inference-log persistence,
  safe product-resolution integration, and service tests.
- `prisma/schema.prisma` and
  `prisma/migrations/20260827120000_add_llm_inference_log/` - inference log model
  and database migration.
- `src/product/product.module.ts`, `package.json`, and `package-lock.json` - NestJS
  dependency injection plus OpenAI and Zod dependencies.
- `test/jest-e2e.json` and `test/statistics.e2e-spec.ts` - serial database suites,
  supported Supertest import, and corrected endpoint expectations.
- `blueprint/project-plan.md`, `blueprint/context/project-overview.md`, and
  `src/inventory/dto/estimation-response.dto.ts` - aligned provider architecture
  and load-bearing LLM result contracts.
- `.agents/skills/complete/SKILL.md` and `.claude/skills/complete/SKILL.md` - synced
  completion-history requirements requested during this feature.

### Verification

- `npm run build` - passed.
- `npm test` - 14 suites passed, 178 tests passed.
- `DATABASE_URL=<documented local development URL> npm run test:e2e` - 4 suites
  passed, 30 tests passed using the normal E2E command without additional Jest
  flags.
- Behavioral evidence covers exact-match bypass, validated high-confidence
  enrichment, inferred existing-product reuse, safe logging, concurrency rechecks,
  deterministic fallback, provider failures, and database-backed inventory flows.

### Deviations

- At the user's direction, this feature commit also includes the synchronized
  `complete` workflow-skill enhancement. It is workflow documentation rather than
  product behavior and is recorded here because the user explicitly chose to
  include it.

## Goal

Enrich newly encountered products with validated metadata when exact canonical-name
and alias matching cannot resolve them. Product logic depends only on a generic LLM
provider interface selected through configuration and dependency injection. OpenAI
is the first adapter, and inference failures never break deterministic behavior.

## In scope

- A provider-neutral `LlmProvider` structured-generation interface, provider token,
  and configured adapter registry/factory.
- A provider-independent `ProductClassifier` contract and implementation.
- An OpenAI Responses API adapter using structured outputs and configuration from
  `OPENAI_API_KEY` and `LLM_MODEL`.
- Classification of unmatched product names into canonical name, aliases,
  category, typical unit, product type, perishability, and confidence.
- Runtime validation and normalization of model output before domain use.
- A minimum classification confidence of `0.8`; lower-confidence results are
  treated as unavailable and cannot change catalog data.
- Successful inference logging without unrelated conversation content or secrets.
- Integration with the existing exact-or-alias product resolution path, including
  deterministic fallback when OpenAI is disabled, refuses, times out, rate-limits,
  or returns unusable output.

## Out of scope

- LLM-assisted stock prediction or household-context reasoning (feature 9).
- Prediction persistence, feedback, and recommendation behavior (features 9-11).
- Fuzzy or semantic matching against the full catalog.
- Automatic merging of two existing product records or overwriting manually supplied
  product metadata.
- Retry queues, caching, provider failover, cost dashboards, and operational log
  aggregation.
- OpenRouter, Anthropic, or other provider adapters; this feature establishes the
  extension point and implements only OpenAI.
- Hermes, MCP, authentication, and deployment work.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was
too big, so split it.

## Build steps

- [x] **Step 1 - Lock classification and logging contracts** - add the classifier
      input/result types, allowed enum values, confidence bounds, and the
      `LlmInferenceLog` Prisma model plus migration. _Done when:_ generated Prisma types
      expose the log model and focused tests prove valid output is accepted while
      missing fields, invalid enums, blank names, and out-of-range confidence are
      rejected.
- [x] **Step 2 - Add the provider-neutral LLM boundary** - introduce an injectable
      `LlmProvider` token/interface, provider-neutral structured request/result types,
      and adapter registry/factory selected by `LLM_PROVIDER`; add `ProductClassifier`
      on top to construct the minimal product-only request, validate the result,
      normalize names and aliases, and reject classifications below `0.8` confidence.
      _Done when:_ unit tests with fake providers prove the configured adapter is selected,
      unsupported provider names fail clearly at startup, the classifier returns the
      locked domain shape, and no unrelated household or conversation data crosses the
      provider boundary.
- [x] **Step 3 - Implement the OpenAI structured-output adapter** - add the official
      JavaScript SDK, configure the Responses API adapter with `OPENAI_API_KEY` and
      configurable `LLM_MODEL` defaulting to `gpt-5.6-sol`, and map refusals and provider
      failures to a provider-neutral unavailable result. _Done when:_ mocked SDK tests
      prove the adapter sends the locked schema, returns parsed structured output, and
      handles missing configuration, refusals, malformed responses, timeouts, and rate
      limits without leaking provider details.
- [x] **Step 4 - Persist successful inference records** - add an injectable inference
      log repository/service that stores only validated classification output and model
      metadata. _Done when:_ tests prove a successful classification produces the locked
      log shape while unavailable, refused, invalid, and low-confidence results create no
      record and no secret or raw provider error can enter the stored payload.
- [x] **Step 5 - Enrich unmatched products safely** - call the classifier only after
      exact canonical-name and alias matching fails, then recheck the raw and inferred
      names inside the existing serializable transaction. Return an inferred existing
      match and add the raw normalized name as an alias, or create an enriched product;
      fall back to the current normalized-name-only creation when inference is unavailable.
      _Done when:_ service tests prove exact matches make no LLM call, a high-confidence
      inferred match reuses the existing product without overwriting its metadata, valid
      inference creates an enriched product and log, concurrent rechecks avoid a duplicate,
      and every failure or low-confidence case creates the deterministic fallback product.
- [x] **Step 6 - Stabilize the database E2E harness** - use the Supertest import
      style supported by this TypeScript configuration and run database-backed E2E
      suites serially because they share destructive cleanup. _Done when:_ the normal
      `npm run test:e2e` command passes without additional Jest flags.

## Files / areas

- `src/llm/` for the provider-neutral contract, OpenAI adapter, configuration, and
  registry/factory, and focused tests.
- `src/product/` for classifier types/service and resolution integration.
- `prisma/schema.prisma` and a new migration for `LlmInferenceLog`.
- `src/app.module.ts`, `package.json`, and lockfile for module and SDK wiring.

## Data / contracts

- `ProductClassificationInput` contains only `rawName` and optional caller-supplied
  product hints needed for classification. It must not contain WhatsApp conversation
  history or household data.
- `ProductClassificationResult` is load-bearing for feature 9: `canonicalName`
  (nonblank string), `aliases` (normalized unique strings), `category` (nonblank
  string), `typicalUnit` (string or null), `productType` (existing `ProductType`
  enum), `isPerishable` (boolean), and `confidence` (number from 0 through 1).
- Only results with `confidence >= 0.8` may enrich or alias catalog data. The
  household suggestion threshold is unrelated and must not be reused here.
- `LlmProvider` accepts a provider-neutral structured-generation request containing
  a task identifier, instructions, minimal input, and output-schema contract. It
  returns a validated value plus provider/model metadata, a refusal, or an
  unavailable result. Provider SDK types must not escape the adapter.
- `LLM_PROVIDER` selects an adapter at application startup. `openai` is implemented
  now; unsupported values fail configuration clearly instead of silently falling
  back. Adding another adapter must not require changes in `ProductClassifier` or
  `ProductService`.
- The OpenAI adapter uses the Responses API with strict structured output matching
  that result. The configured model is recorded with each successful inference.
- `LlmInferenceLog` stores `id`, nullable `predictionId`, `modelProvider`,
  `modelVersion`, nullable `promptVersion`, `structuredResponse`, nullable
  `confidence`, and `timestamp`. Product classification logs have no prediction ID.
- OpenAI never writes to Prisma. `ProductService` owns product creation and the log
  write occurs through an application persistence boundary.

## Testing

- Run `npm test` for all logic-bearing steps. Each step ships its focused Jest tests.
- Run `npm run build` after each step because no project `Verify` command exists.
- Run `npm run test:e2e` after Step 5 to confirm existing grocery and inventory flows
  still resolve products when no OpenAI key is configured.
- No browser verification applies because this feature has no UI.

## Notes for the AI

- Keep controllers thin and provider code behind NestJS dependency injection.
- Domain modules must not import the OpenAI SDK or OpenAI-specific request/response
  types. Only the OpenAI adapter may do so.
- Use the official OpenAI JavaScript SDK and Responses API structured outputs; do
  not hand-parse free-form JSON.
- Keep the model configurable. The planned default reflects current guidance and
  must not spread as a hard-coded value outside configuration.
- Do not hold a database transaction open during the network call. Recheck catalog
  matches inside the serializable transaction before creating a product.
- Never log API keys, prompts containing unrelated user content, raw provider error
  bodies, or full WhatsApp conversations.
- Preserve current deterministic behavior whenever LLM use is disabled or fails.
- Follow the repository rule against em dashes in generated content.
