# Fix: Publish a reliable `get_product` input schema

**Type:** Fix
**Status:** Complete

## Completion record

**Completed:** 2026-08-30

`get_product` now publishes one strict object input schema with visible optional
`id` and `productName` properties while requiring exactly one selector at
runtime. Existing ID and normalized exact name or alias lookups continue to use
`ProductService`, and invalid selector combinations return one stable MCP
validation error without invoking domain services.

Changed areas:

- `src/mcp/mcp-server.factory.ts` - replaced the top-level union with the
  discoverable exactly-one selector schema.
- `src/mcp/mcp-server.factory.spec.ts` - verified published schema properties,
  valid lookup routing, invalid selector behavior, and stable errors through an
  in-memory MCP client.
- `src/mcp/mcp.controller.spec.ts` - verified the published schema through the
  authenticated Streamable HTTP MCP endpoint.
- `graphify-out/` - refreshed the project knowledge graph after code changes.

Verification:

- `npm run test -- --runInBand src/mcp/mcp-server.factory.spec.ts src/mcp/mcp.controller.spec.ts` - 2 suites and 35 tests passed.
- `npm run test -- --runInBand` - 30 suites and 324 tests passed.
- `npm run build` - NestJS build passed.
- `git diff --check` - passed.
- Real MCP `tools/list` assertions verified visible `id` and `productName`
  properties through both in-memory and Streamable HTTP clients.

**Deviations:** None.

## The problem

`get_product` is registered in `src/mcp/mcp-server.factory.ts` with a top-level
Zod union for its ID and name selectors. The MCP SDK publishes that union as an
empty object schema, so clients cannot discover the accepted `id` and
`productName` arguments. Existing MCP tests exercise both lookup paths and
invalid inputs, but they do not inspect the JSON Schema returned by a real
client's `tools/list` call.

The defect is present on the current branch and matches baseline
`4058dc2fdcb65a34c4ba0a9082b030d9ab4c7c96`. Product lookup behavior already
lives in `ProductService`: ID reads use `findOne`, while normalized exact
canonical-name or alias reads use `findByExactOrAliasName` and never create a
product. The fix must preserve those domain paths and the existing
`get_product` tool name.

## The fix

Register `get_product` with one strict object schema that visibly declares
optional `id` and `productName` properties, then apply an object-level runtime
constraint requiring exactly one selector. Keep routing to the existing
`ProductService` methods and return a stable MCP validation error for neither
or both selectors. Verify the published contract through the repository's real
MCP client transport, not by inspecting the source Zod schema alone.

If the installed MCP SDK still fails to publish both properties from this
object schema, stop and present the evidence before considering separate
`get_product_by_id` and `get_product_by_name` tools, because that fallback would
change the public MCP contract.

This fix requires no database migration and must not change REST behavior,
product resolution semantics, persistence, provenance, or unrelated tools.

## Build steps

- [x] **1. Make the selector schema discoverable and deterministic**
  - Replace the top-level union in `src/mcp/mcp-server.factory.ts` with one
    strict object exposing optional UUID `id` and trimmed, non-empty
    `productName` properties.
  - Enforce exactly one selector and keep delegation to `ProductService` for
    both lookup paths.
  - Preserve existing not-found behavior and ensure invalid selectors never
    invoke the service.
  - **Done when:** a real MCP client sees both properties in `tools/list`, valid
    ID and exact name/alias calls reach the correct service methods, and calls
    with neither or both selectors return the same stable validation failure.

- [x] **2. Lock the public contract with regression coverage**
  - Extend `src/mcp/mcp-server.factory.spec.ts` and, where the HTTP MCP boundary
    adds distinct evidence, `src/mcp/mcp.controller.spec.ts` to inspect the
    runtime-published JSON Schema and exercise both valid and invalid selector
    cases.
  - Update agent-facing documentation only if repository inspection finds a
    contract description that becomes stale; do not add parallel lookup logic
    or change REST endpoints.
  - **Done when:** tests fail against the old top-level union, pass against the
    corrected runtime schema, and map directly to every acceptance criterion.

## Verify

- Run `npm run test -- --runInBand src/mcp/mcp-server.factory.spec.ts
  src/mcp/mcp.controller.spec.ts`.
- Run `npm run test` because the configured test runner is a gate for this
  logic-bearing change.
- Run `npm run build` as the documented fallback build gate.
- Confirm from a real MCP client's `tools/list` response that `get_product` has
  an object input schema containing visible `id` and `productName` properties.
- Confirm ID lookup and normalized exact canonical-name or alias lookup succeed.
- Confirm empty input, both selectors, blank names, malformed UUIDs, and unknown
  products fail without unintended service calls or writes.
