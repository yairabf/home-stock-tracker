# Feature: MCP tool interface

**From build-plan:** feature 12
**Status:** complete

## Completion record

- **Completed:** 2026-08-27
- **Delivered:** Added a conditionally enabled, stateless Streamable HTTP MCP endpoint at `/mcp` with eight agent-callable tools for grocery operations, product lookup, inventory estimation, purchase and stock signals, and low-stock recommendations. Tools use strict Zod contracts, delegate to existing NestJS domain services, return JSON text plus structured content, and sanitize unexpected failures.
- **Changed areas:** Added the official MCP SDK and `src/mcp/` adapter, registered `McpModule` in the application, kept `/mcp` outside the REST prefix, exported existing grocery and inventory providers for reuse, added unit and real HTTP protocol tests, and refreshed `graphify-out/`.
- **Verification:** `npm run test -- --runInBand` passed 23 suites and 249 tests; `npm run test:e2e -- --runInBand` passed 7 suites and 45 tests; `npm run build` passed; `git diff --check` passed. A real MCP client initialized over Streamable HTTP, discovered exactly eight tools, invoked `grocery_list`, received structured output, and observed sanitized unexpected failures. The endpoint returned 404 with MCP disabled, remained stateless, and existing REST routing stayed beneath `/api/v1`.
- **Deviations:** None.

## Goal

Expose the inventory service's existing grocery, product, inventory, purchase,
and recommendation capabilities through an agent-callable MCP interface. Hermes
can then discover typed tools and invoke the same application services used by
the REST API without duplicating household business rules.

## In scope

- Add the official TypeScript MCP SDK and a NestJS `McpModule`.
- Expose a Streamable HTTP MCP endpoint at `/mcp`, outside the REST
  `/api/v1` prefix, with stateless request handling suitable for this private
  service's tool calls.
- Enable the endpoint only when `MCP_ENABLED=true`; when disabled, `/mcp` is not
  available and the REST application continues normally.
- Register the eight planned tools: `grocery_add`, `grocery_remove`,
  `grocery_list`, `record_purchase`, `record_stock_signal`, `get_inventory`,
  `get_product`, and `get_low_stock_predictions`.
- Give every tool a concise agent-facing description, strict input schema, and
  structured JSON result. Read tools return empty collections normally when no
  data matches.
- Reuse `GroceryService`, `ProductService`, `InventoryService`,
  `PredictionEngine`, and `LowStockRecommendationService` for all behavior.
- Translate validation and application failures into safe MCP tool errors while
  retaining actionable messages such as invalid IDs or missing products.
- Cover MCP discovery, successful calls, malformed input, disabled mode, domain
  errors, and unexpected failures with automated tests.

## Out of scope

- Hermes skill instructions and natural-language intent mapping (feature 13).
- End-to-end WhatsApp conversation orchestration, including resolving phrases
  such as "everything except toilet paper" into product and item IDs (feature 14).
- Scheduled/proactive MCP calls (feature 15).
- Bearer-token protection, authorization, HTTPS, and rate limiting (feature 16
  and deployment work). Until then, the MCP endpoint is for trusted private
  networking only.
- New inventory, product, prediction, or grocery business rules; MCP is an
  adapter over the existing domain services.
- MCP resources, prompts, elicitation, sampling, notifications, and durable MCP
  sessions.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - Establish the MCP adapter and transport** - add the MCP SDK,
  create the NestJS module/server factory and stateless Streamable HTTP route,
  conditionally mount `/mcp` from `MCP_ENABLED`, and export the existing domain
  providers needed by the adapter. Add focused lifecycle and enabled/disabled
  tests. *Done when:* an MCP client can initialize against `/mcp` and list an
  empty tool registry when enabled, `/mcp` is unavailable when disabled, REST
  routes still use `/api/v1`, and `npm run test` plus `npm run build` pass.
- [x] **Step 2 - Add grocery tools** - register `grocery_add`, `grocery_remove`,
  and `grocery_list` with strict schemas, invoke `GroceryService`, and serialize
  its response DTOs as structured results. *Done when:* MCP tests discover the
  three tools, prove add/list/remove calls delegate the exact validated inputs,
  return stable JSON shapes, preserve an empty list, and report malformed input
  or a missing item as tool errors; tests and build pass.
- [x] **Step 3 - Add product and inventory read tools** - register `get_product`
  by product UUID and `get_inventory` by product UUID, delegating respectively
  to `ProductService.findOne` and `PredictionEngine.predictProduct`; map the
  latter through `EstimationResponseDto`. *Done when:* MCP tests prove both
  schemas and response shapes, including cold-start/uncertain estimates, and
  unknown or malformed product IDs become tool errors; tests and build pass.
- [x] **Step 4 - Add inventory write tools** - register `record_purchase` for
  `PURCHASED` or `RESTOCKED` events and `record_stock_signal` for the direct
  `STOCK_LOW`, `STOCK_OUT`, `STOCK_CONFIRMED`, or `STOCK_CORRECTED` signals,
  fixing `source` to `hermes_mcp` at the adapter boundary and delegating to
  `InventoryService`. *Done when:* MCP tests prove allowed event types and
  optional quantity/unit/metadata handling, reject unrelated or malformed event
  types before service invocation, return the created event shape, and convert
  missing-product failures into tool errors; tests and build pass.
- [x] **Step 5 - Add recommendation tool and full protocol proof** - register
  `get_low_stock_predictions`, map recommendations through
  `LowStockRecommendationListResponseDto`, and add an integration test that
  initializes an MCP client, lists all eight tools, invokes representative read
  and write tools, and verifies an unexpected service exception is returned as
  a non-sensitive tool error without crashing the server. *Done when:* exactly
  the eight planned tools are discoverable, empty and populated recommendation
  results retain their contracts, protocol calls succeed over Streamable HTTP,
  cleanup closes transports, and `npm run test`, `npm run test:e2e`, and
  `npm run build` pass.

## Files / areas

- `package.json` and `package-lock.json` - official MCP SDK dependency.
- `src/main.ts` - keep the REST prefix while mounting the separate MCP route
  only when enabled.
- `src/mcp/` - MCP module, server/transport adapter, tool schemas, result/error
  mapping, and focused tests.
- `src/app.module.ts` - compose the MCP module.
- `src/grocery/grocery.module.ts`, `src/inventory/inventory.module.ts`, and
  `src/product/product.module.ts` - export existing providers where required,
  without moving business logic into MCP.
- `test/` - enabled/disabled route and real MCP client integration coverage.
- `.env.example` or existing environment documentation, if present - document
  `MCP_ENABLED` without adding secrets.

## Data / contracts

- No Prisma schema or migration changes.
- The load-bearing transport contract is one stateless Streamable HTTP endpoint
  at `POST /mcp`; unsupported MCP transport methods receive the SDK-appropriate
  response. It is not nested beneath `/api/v1`.
- All tool outputs include both MCP text content containing JSON and
  `structuredContent` containing the same JSON-compatible object, so clients can
  consume results reliably without parsing conversational prose.
- `grocery_add` input: `productName` (nonblank string), optional positive
  `requestedQuantity`, `unit`, and `note`; the adapter sets source to the
  existing Hermes-compatible source value.
- `grocery_remove` input: grocery item `id` (UUID).
- `grocery_list` input: optional existing `GroceryItemStatus`, defaulting to
  `pending`; output is `{ items: GroceryItemResponseDto[] }`.
- `record_purchase` input: `productId` (UUID), `eventType` (`PURCHASED` or
  `RESTOCKED`), optional nonnegative `quantity`, `unit`, `confidence`, and JSON
  object `metadata`; source is adapter-owned `hermes_mcp`.
- `record_stock_signal` input: `productId` (UUID), `eventType` limited to direct
  stock signals (`STOCK_LOW`, `STOCK_OUT`, `STOCK_CONFIRMED`,
  `STOCK_CORRECTED`), and the same optional measurement/metadata fields; source
  is adapter-owned `hermes_mcp`.
- `get_inventory` input: product `id` (UUID); output is the existing
  `EstimationResponseDto`. This means "inventory" remains an estimate, not an
  invented exact quantity.
- `get_product` input: product `id` (UUID); output is the existing
  `ProductResponseDto` shape.
- `get_low_stock_predictions` has no input; output is the existing
  `{ recommendations: LowStockRecommendationDto[] }` contract.
- `record_purchase` records purchase/restock signals only. Completing selected
  grocery items remains available through existing domain/REST operations and
  will be orchestrated in the Hermes conversation feature rather than hidden in
  an ambiguous MCP input contract here.

## Testing

- Jest unit tests cover tool registration, exact service delegation, output
  serialization, allowlisted enums, empty results, expected domain errors, and
  sanitized unexpected errors.
- Supertest and the MCP SDK client cover protocol initialization, tool listing,
  invocation over `/mcp`, enabled/disabled behavior, and transport cleanup.
- Logic-bearing steps ship their focused tests in the same diff.
- There is no configured `Verify` command. Each step runs `npm run test` and
  `npm run build`; the final protocol step also runs `npm run test:e2e`.
- Manual check after implementation: start with `MCP_ENABLED=true`, connect an
  MCP inspector/client to `http://localhost:3000/mcp`, list eight tools, invoke
  one read and one write tool, then confirm existing REST endpoints remain under
  `/api/v1`.

## Notes for the AI

- Use the official `@modelcontextprotocol/sdk` APIs and their built-in
  Streamable HTTP transport; do not hand-roll JSON-RPC.
- Keep the adapter thin. Controllers and MCP handlers may map DTOs, but all
  database access and business decisions stay in existing services.
- Use Zod schemas at the MCP boundary and keep class-validator DTO rules aligned
  where contracts overlap. Do not accept arbitrary inventory event types through
  `record_stock_signal`.
- Create a fresh MCP server/transport per stateless request as required by the
  selected transport lifecycle, and always close it after the response.
- Do not leak stack traces, Prisma details, environment values, or request
  internals in tool errors. Preserve safe `HttpException` messages where useful.
- Keep tool output presentation-agnostic. Hermes owns wording for WhatsApp.
- Do not add authentication in this feature. Clearly retain the private-network
  constraint until feature 16 is complete.
- Do not modify generated Prisma files.
