# Feature: Agent integration and contract release

**From build-plan:** feature 33e
**Status:** verified

## Goal

Publish the stock-ledger capabilities through the versioned MCP contract and teach Hermes and OpenClaw to use purchase, inventory, and suggestion flows safely. Release generated fixtures and bundles that prove the documented agent behavior matches the server.

## In scope

- Replace MCP `get_inventory` on-demand prediction with the materialized per-product inventory response from 33d.
- Add read-only MCP `list_inventory` with the complete household `current` and `uncertain` view.
- Document safe use of `update_inventory`, `record_purchases`, `list_inventory`, and materialized `get_inventory` results.
- Make a grocery-list request call both `grocery_list` and `get_low_stock_predictions`, presenting committed items and suggestions as separate labeled groups.
- Require explicit confirmation before adding a suggestion and quantity clarification before recording a quantity-free "still have" statement.
- Add executable Hermes/OpenClaw scenarios for batch purchases, combined list presentation, suggestion confirmation, quantity clarification, validation failures, and uncertain writes.
- Publish the additive MCP `1.3.0` contract and skill `1.13.0`, then regenerate fixtures, manifests, platform bundles, runtime metadata, and probe expectations.
- Update operator and API documentation for the released contract.

## Out of scope

- New REST endpoints, persistence models, stock calculations, scheduler behavior, or recommendation logic.
- Automatic grocery additions from recommendations.
- Guessing product identity, quantities, units, stock counts, or performing unit conversion.
- Per-location or per-lot stock, policy editing, distributed scheduling, deployment, push, or publication.

## Build loop

Build one step at a time. Each step must include focused tests, pass the relevant Jest slice plus the fallback project gates, and receive a checkpoint commit only after it is green.

## Build steps

- [x] **Step 1 - Publish materialized inventory reads through MCP** - add strict schemas and handlers for materialized `get_inventory` and no-argument `list_inventory`, delegating to the existing `InventoryService` read methods. _Done when:_ `get_inventory` returns tracked or untracked projection fields without invoking the prediction engine, `list_inventory` returns the complete grouped household view without writes, both tools expose strict schemas and safe errors, and focused MCP tests pass.
- [x] **Step 2 - Teach agents the stock and suggestion workflows** - update the shared workflow and platform-specific guidance for batch purchases, explicit stock mutations, combined grocery-list and suggestion presentation, suggestion confirmation, and quantity-free availability clarification. _Done when:_ generated Hermes and OpenClaw skills clearly preserve item boundaries, trusted IDs, exact user measurements, all-or-nothing batch semantics, no automatic retries, and no grocery mutation without explicit confirmation, with focused skill-contract tests passing.
- [x] **Step 3 - Make the new behavior executable as scenarios** - refresh the pre-release `1.3.0` MCP fixture from the final read schemas, then extend the scenario contract, validator vocabulary/order rules, and scenario assertions for the new read and write flows plus ambiguity and failure paths. _Done when:_ both platform scenario tables are generated from validated JSON, every referenced argument and enum exists in the MCP fixture, combined list reads remain non-mutating, and focused fixture and scenario-contract tests pass.
- [x] **Step 4 - Cut and verify the generated contract release** - set skill `1.13.0`, finalize MCP `1.3.0` metadata, add `list_inventory` and materialized-inventory capability declarations, regenerate both bundles and runtime metadata, and update documentation and probe coverage. _Done when:_ generated artifacts are current and consistent, the probe validates the complete required tool set and safe household read, API/integration docs describe the released flows, `npm run contract:check`, `npm run test`, `npm run test:e2e`, `npm run build`, `git diff --check`, and `graphify update .` pass.

## Files / areas

- `src/mcp/mcp-server.factory.ts` and MCP unit tests - published read schemas and handlers.
- `integrations/shared/home-stock-tracker/workflow.md` - shared agent decision rules.
- `integrations/shared/home-stock-tracker/scenarios.md` and `scenarios/grocery-catalog.json` - human and executable behavior matrix.
- `integrations/shared/home-stock-tracker/platforms/*` - platform-only runtime guidance.
- `integrations/shared/home-stock-tracker/release-contract.json` - authoritative versions, capabilities, required tools, and bundle contract.
- `scripts/agent-*.mjs` and `src/mcp/agent-*.spec.ts` - contract validation, generation, scenarios, and probe evidence.
- `integrations/hermes/home-stock-tracker/` and `integrations/openclaw/home-stock-tracker/` - generated release bundles.
- `docs/api-reference.md` and `docs/agent-integrations.md` - public MCP and installation guidance.

## Data / contracts

- MCP remains additive at `1.3.0`; the agent skill becomes `1.13.0` and remains compatible with `>=1.0.0 <2.0.0`.
- `get_inventory({ id })` returns the same load-bearing `InventoryEstimateResponseDto` materialized contract exposed by REST, including `trackingStatus`, recorded fact, estimate fields, confidence, reason, evaluation time, and prediction provenance.
- `list_inventory({})` returns `{ current: InventoryItem[], uncertain: InventoryItem[] }`, with no pagination or filters.
- `record_purchases` accepts resolved unique product IDs, optional explicit quantities/units/timestamps, and remains all-or-nothing. Omitted item quantity uses the server default; agents do not invent it in conversation.
- `update_inventory` operation rules remain strict: `set` and `decrement` require positive explicit quantities; `mark_out` carries no quantity or unit.
- A general "show me the list" intent performs two reads and labels committed grocery items separately from suggestions. Empty groups stay explicit.
- Suggestion confirmation reuses the existing grocery-add workflow and never mutates directly from a recommendation read.

## Testing

- MCP unit tests cover strict tool discovery, materialized tracked/untracked responses, grouped inventory listing, no prediction calls, and safe errors.
- Skill-generation tests assert the new tool table entries and safety language in both platform bundles.
- Scenario-contract tests validate new calls, arguments, enum values, order constraints, safety invariants, and generated tables for Hermes and OpenClaw.
- Contract capture/check proves fixture identity, normalized schemas, semantic-version metadata, generated artifact freshness, required tools, manifests, and probe assumptions.
- Final fallback gates: `npm run contract:check`, `npm run test`, `npm run test:e2e`, `npm run build`, and `git diff --check`.

## Notes for the AI

- Reuse `InventoryService.getInventory` and `InventoryService.listInventory`; do not duplicate materialization or presentation logic in MCP.
- Keep reads free of prediction, event, projection, and grocery writes.
- Treat estimates as estimates. Never convert them into asserted physical counts.
- Keep shared behavior in shared sources and regenerate platform artifacts; do not hand-edit generated skills, scenarios, manifests, release READMEs, or runtime metadata.
- The existing committed `1.3.0` fixture is a pre-release intermediate from 33b. Replace it only with a freshly captured final `1.3.0` snapshot and verify every generated copy is identical.
- Preserve authentication, safe error mapping, and transport-uncertainty stop rules.
- Run `graphify update .` after code and contract changes.
