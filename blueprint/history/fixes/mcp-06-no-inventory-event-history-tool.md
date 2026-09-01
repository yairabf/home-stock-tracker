# Fix: Expose inventory-event history through MCP

**Type:** Fix
**Source:** `blueprint/context/bugs/mcp-06-no-inventory-event-history-tool.md`
**Status:** Complete

## Completion record

**Completed:** 2026-09-02

Home Stock Tracker now exposes `list_inventory_events` through MCP
tool. The strict, discoverable read contract delegates filtering, bounded
pagination, and deterministic newest-first ordering to the existing inventory
service while projecting a metadata-free agent response. The shared
Hermes/OpenClaw skill now resolves named products before history reads,
distinguishes recorded evidence from estimated current state, and treats history
review as read-only until the user separately requests a correction.

Changed areas:

- `src/mcp/mcp-server.factory.ts` - registers the new history tool, validates
  filters and pagination, delegates to `InventoryService.listEvents()`, and
  omits stored metadata from structured MCP output.
- MCP factory and HTTP controller tests - prove runtime `tools/list` discovery,
  defaults, bounds, filtering, empty results, metadata omission, sanitized
  failures, and authenticated Streamable HTTP invocation.
- `integrations/shared/home-stock-tracker/`, generated Hermes/OpenClaw bundles,
  and cross-platform contract tests - publish skill version `1.9.0` with named
  lookup, filtering, pagination, empty-history, and correction-review guidance
  while preserving platform-specific delivery boundaries.
- API, integration, root, and project-overview documentation - describe the
  additive contract and include it in the published sixteen-tool catalog.
- `graphify-out/` - refresh the repository knowledge graph after the code and
  contract changes.

Verification:

- `npm run skills:check` - generated Hermes and OpenClaw bundles matched their
  shared canonical sources.
- `npm run test -- --runInBand src/mcp/mcp-server.factory.spec.ts
  src/mcp/mcp.controller.spec.ts src/mcp/agent-skill-contract.spec.ts
  src/mcp/agent-skill-generator.spec.ts` - 4 suites and 129 tests passed.
- `npm run test -- --runInBand` - 47 suites and 664 tests passed.
- `env 'DATABASE_URL=postgresql://home_stock:home_stock@localhost:5432/home_stock_tracker?schema=public'
  npm run test:e2e -- --runInBand` - 24 suites and 219 tests passed against the
  documented local PostgreSQL configuration.
- `npm run build` - NestJS build passed.
- Runtime MCP assertions through both in-memory and authenticated Streamable
  HTTP clients confirmed the tool's discoverable schema and
  metadata-free structured response.
- Manual try path: ask Hermes "When did we last buy milk?" and confirm it
  resolves milk, calls `list_inventory_events` with `PURCHASED` and `limit: 1`,
  and describes the result as recorded history.
- `git diff --check` - passed.

**Deviations:** During the approved squash merge, `main` first introduced a
shared-source generator for separate Hermes and OpenClaw bundles, then added the
adjacent `record_prediction_feedback` MCP tool. The reviewed history guidance
was moved into the canonical shared source and reconciled with that feedback
workflow. Both generated platforms, the combined sixteen-tool catalog, and the
replacement cross-platform contract tests were verified. Public history
behavior and the fix scope did not change.

## The problem

The authenticated REST API already exposes `GET /api/v1/inventory/events`, and
`InventoryService.listEvents()` already owns product/event filtering, bounded
pagination, and deterministic newest-first ordering. MCP registers inventory
writes and current-state estimation, but no event-history read tool. Hermes and
other MCP clients therefore cannot inspect recorded evidence before answering
history questions or handling a correction.

The defect exists both at repository baseline
`4058dc2fdcb65a34c4ba0a9082b030d9ab4c7c96` and current HEAD
`2d4c7df92af78480c42eca1b1e9a3e201254f902`. The existing REST response includes
arbitrary event `metadata`, which must not be copied into agent-visible history
by default.

## The fix

- Add the read-only `list_inventory_events` MCP tool and delegate its validated
  filters and pagination directly to `InventoryService.listEvents()`.
- Publish a strict, discoverable input schema with optional UUID `productId`,
  optional `InventoryEventType` `eventType`, `limit` defaulting to `20` and
  bounded from `1` through `100`, and `offset` defaulting to `0` and bounded at
  zero or greater.
- Return `{ items, total, limit, offset }` in deterministic newest-first order.
  Each agent-visible item contains `id`, `productId`, `eventType`, `quantity`,
  `unit`, `timestamp`, `source`, and `confidence`. Omit `metadata` entirely at
  the MCP transport boundary rather than attempting to interpret arbitrary
  stored JSON.
- Update the shared Hermes/OpenClaw instruction bundle so name-based history
  questions resolve a product with `get_product` or `search_products` first,
  and so recorded events are never described as an estimated current state.
- Document the additive tool contract and update the discoverable tool count.

This is an additive MCP contract change. Existing REST behavior, stored events,
write provenance, product resolution, estimation behavior, and all existing MCP
tools remain unchanged. No database migration is required.

## Build steps

- [x] **Step 1: Register the safe event-history read contract.** Add a strict
      `list_inventory_events` input schema and metadata-free output schema in
      `src/mcp/mcp-server.factory.ts`, delegate the handler to the existing
      `InventoryService.listEvents()` method, and extend the in-memory and
      Streamable HTTP MCP tests. Cover runtime `tools/list` discovery, defaults,
      product/event filters, pagination boundaries, empty pages, stable structured
      output, metadata omission, invalid arguments failing before service
      invocation, and safe service errors. **Done when:** a real MCP client
      discovers the exact public schema; valid calls pass the normalized query to
      `listEvents()` and receive `{ items, total, limit, offset }` without
      `metadata`; malformed UUIDs, enum values, limits, offsets, and unknown fields
      are rejected without a read or write; and the pre-existing MCP tools still
      pass their contract tests.

- [x] **Step 2: Teach agent clients to use history without confusing it with
      estimation.** Add `list_inventory_events` to the Hermes/OpenClaw skill tool
      matrix and safe workflow, add scenarios for a named-product history question,
      filtered history, an empty result, pagination, and correction review, and
      update the skill contract test plus MCP/API and integration documentation.
      **Done when:** the checked-in agent bundle resolves spoken names before the
      history call, treats returned rows as recorded events rather than current
      estimates, never exposes or invents metadata, does not mutate on a history
      question, and all documented tool names, schemas, examples, and tool counts
      match runtime discovery.

## Files / areas

- `src/mcp/mcp-server.factory.ts`
- `src/mcp/mcp-server.factory.spec.ts`
- `src/mcp/mcp.controller.spec.ts`
- `src/mcp/hermes-skill-contract.spec.ts`
- `integrations/hermes/home-stock-tracker/SKILL.md`
- `integrations/hermes/home-stock-tracker/scenarios.md`
- `integrations/hermes/home-stock-tracker/README.md` if its tool guidance or
  count is affected
- `docs/api-reference.md`
- `docs/agent-integrations.md`

The existing `src/inventory/inventory.service.ts`, list DTOs, service tests, REST
controller, Prisma schema, and migrations should remain unchanged unless
implementation reveals evidence that the verified shared contract is
insufficient.

## Data / contracts

### MCP input

```json
{
  "productId": "optional UUID",
  "eventType": "optional InventoryEventType",
  "limit": 20,
  "offset": 0
}
```

The object is strict. `limit` accepts integers from `1` through `100`; `offset`
accepts integers greater than or equal to `0`.

### MCP output

```json
{
  "items": [
    {
      "id": "event UUID",
      "productId": "product UUID",
      "eventType": "PURCHASED",
      "quantity": 2,
      "unit": "cartons",
      "timestamp": "2026-09-01T10:00:00.000Z",
      "source": "mcp",
      "confidence": null
    }
  ],
  "total": 1,
  "limit": 20,
  "offset": 0
}
```

This additive public MCP contract is load-bearing for agent integrations.
`metadata` is intentionally absent even when the underlying REST/domain DTO
contains it. Event ordering remains owned by `InventoryService.listEvents()`:
`timestamp DESC`, then `id DESC` as the stable tie-breaker.

## Testing

- Run focused Jest coverage for `src/mcp/mcp-server.factory.spec.ts`,
  `src/mcp/mcp.controller.spec.ts`, and
  `src/mcp/hermes-skill-contract.spec.ts`.
- Run `npm run test` because the configured Jest runner is the gate for this
  logic-bearing change.
- Run `npm run test:e2e` to guard the existing authenticated REST and MCP
  integration surfaces.
- Run `npm run build` as the documented fallback build gate.
- Inspect `tools/list` through both the in-memory MCP client and authenticated
  Streamable HTTP transport. Confirm the fifteenth tool publishes the strict
  filters, defaults, bounds, and metadata-free output shape.
- Call the tool with no filters, each filter independently, both filters,
  nonzero pagination, and an empty page. Confirm service ordering and totals are
  preserved and no mutation service is invoked.
- Run `git diff --check`.

## Notes for the AI

- Keep pagination and ordering in the shared application service. The MCP
  handler is only validation, delegation, output projection, and error
  translation.
- Treat metadata omission as an MCP disclosure policy. Do not remove metadata
  from the existing REST response or persisted records in this fix.
- Use a real MCP client for schema assertions. Source-level Zod validity alone
  does not prove discoverability.
- Reads never create products. Resolve a spoken name through `get_product`; if
  exact lookup fails, use read-only `search_products` and require the user to
  choose among multiple candidates.
- History reports what was recorded at a timestamp. `get_inventory` reports an
  estimated current state. Agent wording and scenarios must keep those claims
  distinct.
- Preserve the single NestJS deployable, generic MCP provenance, existing auth
  boundary, safe error translation, and all existing tool names.
- Do not add a database migration, UI, new infrastructure, channel-specific
  behavior, automatic correction, or unrelated inventory functionality.
