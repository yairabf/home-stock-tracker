# Fix: MCP-05 standalone alias administration

**Type:** Fix
**Source:** `blueprint/context/bugs/mcp-05-no-controlled-alias-management-tool.md`
**Status:** Complete

## Completion record

**Completed:** 2026-09-02

Home Stock Tracker now exposes `product_add_alias` through MCP for standalone,
explicitly confirmed alias administration. The strict tool accepts one trusted
product UUID and one non-empty alias, delegates the write to
`ProductService.addAlias`, and returns the existing canonical product response.
The published agent contract requires explicit confirmation and exact product
identity, refuses ambiguous targets, and prevents automatic retries after
conflicts, missing targets, or uncertain transport results.

Changed areas:

- `src/mcp/mcp-server.factory.ts` registers `product_add_alias`, validates its
  strict input, delegates exactly once to the shared product service, and uses
  the existing MCP error and response boundaries.
- MCP factory, controller, and PostgreSQL-backed end-to-end tests prove
  discovery, successful persistence, normalized idempotency, ownership
  conflicts, deleted targets, invalid input rejection, sanitized failures, and
  zero grocery or LLM side effects.
- `scripts/agent-scenarios.mjs`, canonical workflow and scenarios, and contract
  tests require both explicit confirmation and a trusted product ID before the
  standalone write.
- Shared release metadata and generated Hermes and OpenClaw bundles publish MCP
  contract `1.1.0`, skill `1.11.0`, and the new immutable seventeen-tool
  fixture while preserving the released `1.0.0` fixture.
- Public API, platform installation, and project-overview documentation explain
  the standalone alias workflow and its safety boundaries.
- `graphify-out/` refreshes the repository code graph after the implementation.

Verification:

- `npm run contract:check` - release metadata, 90 executable scenarios,
  generated documentation, and 6 suites with 50 tests passed.
- `npm run test -- --runInBand` - 52 suites and 746 tests passed.
- `env DATABASE_URL='postgresql://home_stock:home_stock@localhost:5432/home_stock_tracker?schema=public' npm run test:e2e -- --runInBand test/product-alias.mcp.e2e-spec.ts`
  - 1 suite and 7 tests passed against the documented PostgreSQL service.
- `env DATABASE_URL='postgresql://home_stock:home_stock@localhost:5432/home_stock_tracker?schema=public' npm run test:e2e -- --runInBand`
  - 26 suites and 233 tests passed.
- `npm run build` - the NestJS build passed.
- Focused ESLint and Prettier checks passed for every changed TypeScript file and
  the new end-to-end suite.
- Runtime MCP assertions through in-memory and authenticated Streamable HTTP
  clients exposed exactly seventeen tools and returned the updated product from
  a valid `product_add_alias` call.
- `git diff --check` passed, and
  `integrations/shared/home-stock-tracker/contracts/1.0.0/tools-list.json`
  remained unchanged.
- `graphify update .` completed and refreshed the code graph. Graphify reported
  its existing optional SQL-parser and skill-version warnings.
- Manual try path: resolve one exact product through `get_product`, explicitly
  confirm the alias relationship, call `product_add_alias` with only
  `productId` and `alias`, and confirm the returned canonical product contains
  the alias without a grocery-list mutation.

**Deviations:** MCP-05 has no behavioral scope deviation. At the user's explicit
instruction during completion, the work-level commit also includes unrelated
dirty worktree changes that existed before MCP-05, including Blueprint cleanup
and pre-existing Graphify artifacts.

## Goal

Expose the existing standalone product-alias write through MCP so an agent can
save an explicitly confirmed alias outside a grocery-add workflow, without
duplicating domain rules or enabling broader catalog administration.

## In scope

- Add the strict `product_add_alias` MCP tool with `productId` and `alias`
  inputs and the existing canonical product output shape.
- Delegate exactly once to `ProductService.addAlias` so normalization,
  same-owner idempotency, concurrency handling, and cross-owner conflict rules
  remain shared with REST.
- Require explicit user confirmation and an exact trusted product ID in the
  tool description, canonical agent workflow, and executable scenarios.
- Publish the additive tool contract as MCP `1.1.0` under a new immutable
  `contracts/1.1.0/tools-list.json` fixture while preserving `1.0.0`.
- Advance the shared skill from `1.10.0` to `1.11.0`, keep its compatible range
  at `>=1.0.0 <2.0.0`, and regenerate the complete Hermes and OpenClaw bundles.
- Update the public API reference and platform installation guides to describe
  the new tool and its safe standalone workflow.

## Out of scope

- Product merge, alias removal, canonical-name changes, or product deletion.
- Automatic alias creation from search results, resolution proposals, or LLM
  output.
- Choosing a product when search returns multiple candidates.
- Changes to the delivered `grocery_confirm_product_alias` workflow.
- Changes to REST alias behavior, product persistence, or the database schema.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff, not full files; you read and understand it.
4. You approve, then choose whether to commit a checkpoint or continue.
   Checkpoints are optional; `/complete` creates the feature-level commit.

Never accept a step you have not read. If a diff is too big to review, split the
step before approval.

## Build steps

- [x] **Step 1 - Add and publish standalone alias administration atomically** -
      register `product_add_alias` with a strict discoverable schema, delegate to
      `ProductService.addAlias`, return `ProductResponseDto`, and extend in-memory
      plus authenticated real-client coverage for discovery, successful writes,
      same-owner retries, cross-owner conflicts, deleted targets, malformed or
      extra input, sanitized unexpected failures, and zero LLM or grocery side
      effects. Update the scenario validator so `product_add_alias` requires both
      `explicit-user-confirmation` and `trusted-product-id`; add success, ambiguous
      target refusal, conflict, deleted-target, and uncertain-transport scenarios;
      update canonical workflow and public docs; bump the MCP contract to `1.1.0`
      and skill to `1.11.0`; capture the new immutable fixture; and regenerate both
      platform bundles. _Done when:_ a real `tools/list` exposes exactly seventeen
      tools including a strict `product_add_alias` input with required UUID
      `productId` and non-empty `alias`; valid calls return the updated product and
      preserve domain idempotency/conflict behavior; invalid or unsafe calls do not
      invoke the service; agent scenarios cannot validate without confirmation and
      a trusted product ID; the `1.0.0` fixture is unchanged; all generated bundles
      agree on `1.1.0`/`1.11.0`; `npm run contract:check`, unit tests, focused MCP
      end-to-end tests, the full end-to-end suite, and `npm run build` pass.

## Files / areas

- `src/mcp/mcp-server.factory.ts`
- `src/mcp/mcp-server.factory.spec.ts`
- `src/mcp/mcp.controller.spec.ts`
- `src/mcp/mcp-contract-fixture.spec.ts`
- `src/mcp/agent-scenario-contract.spec.ts`
- `src/mcp/agent-skill-contract.spec.ts`
- `test/product-alias.mcp.e2e-spec.ts` (expected new file)
- `scripts/agent-scenarios.mjs`
- `integrations/shared/home-stock-tracker/release-contract.json`
- `integrations/shared/home-stock-tracker/workflow.md`
- `integrations/shared/home-stock-tracker/scenarios/grocery-catalog.json`
- `integrations/shared/home-stock-tracker/contracts/1.1.0/tools-list.json`
- Generated `src/mcp/agent-release-contract.generated.ts`
- Generated Hermes and OpenClaw bundle files under `integrations/`
- `integrations/hermes/home-stock-tracker/README.md`
- `integrations/openclaw/home-stock-tracker/README.md`
- `docs/api-reference.md`

## Data / contracts

- Load-bearing MCP input:

  ```json
  {
    "productId": "uuid",
    "alias": "non-empty trimmed string"
  }
  ```

- The input object is strict. It accepts no proposal state, product name in
  place of the ID, caller-supplied source, grocery payload, or unknown fields.
- Output reuses `productOutputSchema` and `ProductResponseDto`; no new response
  type is introduced.
- `PRODUCT_NAME_CONFLICT` remains the stable final result for cross-owner
  claims. A deleted target returns the existing safe product-not-found result.
- `product_add_alias` is a write. Agents must not call it from search output,
  inferred identity, or LLM advice alone. After uncertain transport failure,
  agents stop and verify product state before considering another write.
- Adding a tool is an additive MCP contract change, so contract version `1.1.0`
  uses a new fixture path. The prior `1.0.0` fixture remains immutable.
- No Prisma migration or stored-data change is expected.

## Testing

- Factory tests: exact tool ordering, strict runtime schema, description safety
  language, one service call, DTO serialization, malformed/extra-field
  rejection before delegation, domain-error visibility, unexpected-error
  sanitization, and operational failure logging.
- Authenticated Streamable HTTP test: discovery and one valid standalone alias
  call through the real MCP transport.
- PostgreSQL-backed MCP test: persisted alias, normalized same-owner retry,
  canonical-name idempotency, cross-owner conflict, deleted target, and no
  grocery or LLM side effects.
- Agent contract tests: both generated skills require explicit confirmation and
  an exact trusted ID; ambiguity causes no call; conflicts and missing targets
  are final; uncertain writes are not automatically retried.
- Contract checks: capture `contracts/1.1.0/tools-list.json`, preserve the
  existing `1.0.0` fixture byte-for-byte, regenerate both bundles, and run
  `npm run contract:check`.
- Final gate: run `npm run test -- --runInBand`, the focused MCP end-to-end test,
  the full `npm run test:e2e -- --runInBand` suite against the documented test
  database, `npm run build`, and `git diff --check`.

## Notes for the AI

- This is server and agent-contract work; there is no UI or design reference.
- Reuse `ProductService.addAlias`. Do not reproduce normalization, namespace,
  transaction, idempotency, or conflict logic in the MCP handler.
- Use the shared `runTool` error boundary and generic MCP operational logging.
  Do not expose stack traces or provider details.
- The server cannot prove conversational confirmation from the two-field input.
  Enforce that safety boundary through the tool description, generated agent
  instructions, and executable scenario prerequisites rather than adding a
  meaningless confirmation boolean.
- Treat release metadata and generated artifacts as one atomic public contract.
  Do not edit generated Hermes/OpenClaw files or the runtime contract constant
  by hand.
- Preserve all unrelated working-tree changes and the released `1.0.0` fixture.
- After code changes, run `graphify update .` and include the refreshed graph in
  the review packet.
