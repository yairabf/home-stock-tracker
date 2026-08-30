# Fix: Use transport-owned generic source attribution

**Type:** Fix
**Status:** Complete

## Completion record

**Completed:** 2026-08-30

All MCP mutation adapters now assign the truthful generic `mcp` source, while
REST mutation controllers assign `api`. Public REST DTOs and runtime MCP schemas
do not accept caller-selected provenance, and strict REST validation rejects a
supplied `source`. The grocery source enum gained an additive `mcp` value without
rewriting the retained `hermes_whatsapp` or `api` values.

Changed areas:

- `src/common/transport-source.ts`, REST controllers, and MCP registration -
  define and apply transport-owned provenance at trusted adapter boundaries.
- Grocery and inventory request DTOs and services - separate public request
  fields from the trusted source passed into shared application services.
- `prisma/schema.prisma` and
  `prisma/migrations/20260830120000_add_mcp_grocery_item_source/` - add the
  generic grocery source through an additive enum migration.
- MCP unit/contract tests and REST unit/e2e tests - verify generic provenance,
  undiscoverable source inputs, rejected caller overrides, and persisted `api`
  values.
- `docs/api-reference.md` and `blueprint/context/project-overview.md` - document
  server-owned provenance and historical compatibility.
- `graphify-out/` - refresh the project knowledge graph after code changes.

Verification:

- `npm run test -- --runInBand` - 31 suites and 326 tests passed.
- `DATABASE_URL=postgresql://home_stock:home_stock@localhost:5432/home_stock_tracker?schema=public npm run test:e2e -- --runInBand` - 8 suites and 51 tests passed.
- `npm run build` - NestJS build passed.
- `npm exec prisma migrate deploy` against the local PostgreSQL container - all
  eight migrations, including the additive `mcp` enum migration, applied.
- Runtime MCP `tools/list` assertions confirmed mutation schemas omit `source`,
  and tool calls with a supplied source fail before invoking services.
- REST e2e requests confirmed ordinary mutations persist `api` and supplied
  source overrides return `400`.
- `git diff --check` - passed.

**Deviations:** None.

## The problem

MCP mutation provenance is inconsistent and sometimes false. `grocery_add`
stores `hermes_whatsapp`, while inventory and grocery-completion tools store
`hermes_mcp`. An MCP request may originate from OpenClaw, Telegram, a CLI, or
another client, so neither value truthfully identifies the transport.

REST mutation DTOs also accept caller-controlled `source` values. This lets a
request claim provenance that the server did not establish, contrary to the
intended `api` attribution.

The defect exists on the current branch and at baseline
`4058dc2fdcb65a34c4ba0a9082b030d9ab4c7c96`. The shared services already own
the database writes; the incorrect policy is at their REST and MCP adapter
boundaries.

## The fix

- Define server-owned generic provenance values for the two trusted transports:
  `mcp` for every MCP mutation and `api` for every REST mutation.
- Keep provenance assignment at the transport boundary, then pass it through the
  existing shared application services. Do not infer a channel in the domain
  layer and do not expose `source` in public mutation input schemas.
- Add `mcp` to `GroceryItemSource` with an additive Prisma migration. Preserve
  the existing `hermes_whatsapp` and `api` enum values and do not rewrite any
  historical grocery items or inventory events.
- Update public documentation to describe server-owned provenance. No MCP tool
  name, mutation input, or response shape changes except that newly created
  records return the truthful generic source.

## Build steps

- [x] **Step 1: Make mutation provenance transport-owned.** Add the generic MCP
  grocery enum value and migration, use `mcp` for all MCP writes, remove
  caller-controlled source fields from REST mutation DTOs, and have REST
  controllers pass `api` into the existing services. Update affected API and
  integration documentation. **Done when:** every new MCP mutation persists
  `mcp`, every new REST mutation persists `api`, public schemas reject a supplied
  `source`, and existing database values require no data rewrite.

- [x] **Step 2: Prove the transport contracts.** Update unit and real MCP
  contract tests that currently assert WhatsApp or Hermes-specific attribution,
  and update REST controller/e2e coverage for fixed `api` attribution and
  rejection of caller-supplied sources. **Done when:** regression tests cover
  grocery adds, inventory writes, grocery purchase completion, and applicable
  REST mutations, with runtime MCP discovery still exposing no `source` input.

## Verify

- Run `npm run test`.
- Run `npm run test:e2e`.
- Run `npm run build`.
- Inspect the generated MCP tool schemas and call each mutation class to confirm
  clients cannot provide `source` and returned records use `mcp`.
- Exercise REST mutation endpoints with no `source` and with a supplied `source`;
  confirm the former records `api` and the latter fails validation.
- Apply the migration to a database containing `hermes_whatsapp` grocery rows
  and existing inventory-event source strings; confirm those rows are unchanged.
