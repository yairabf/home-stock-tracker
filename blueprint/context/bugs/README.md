# Home Stock Tracker — Gap Fix Briefs

These files were generated from `mcp-agent-skill-development-brief.md`.

## How to use these briefs

Open one brief at a time in the repository IDE/agent session. The coding agent should first inspect the repository and validate the stated gap against the current branch. The recommendation is intentionally framed as a proposed direction: if the actual repository supports a better coherent solution, the agent should explain it and then implement the better option rather than blindly following the brief.

Each fix should finish with code, tests, affected agent documentation, and a verification report mapped to acceptance criteria.

## Recommended execution order

### Phase 1 — Make the current MCP trustworthy

- [x] [MCP-01 — `get_product` publishes an unreliable input schema](mcp-01-get-product-publishes-an-unreliable-input-schema.md)
- [x] [MCP-12 — Source attribution is channel-specific and incorrect](mcp-12-source-attribution-is-channel-specific-and-incorrect.md)
- [x] [SKILL-01 — The checked-in skill contradicts actual product creation behavior](skill-01-the-checked-in-skill-contradicts-actual-product-creation-behavior.md)
- [x] [MCP-X01 — Guard grocery_remove pending-state transition](mcp-x01-guard-grocery-remove-pending-state.md)

### Phase 2 — Complete grocery-list conversation

- [x] [MCP-02 — `grocery_add` silently permits duplicate pending items](mcp-02-grocery-add-silently-permits-duplicate-pending-items.md)
- [x] [MCP-03 — No tool can update a pending grocery item](mcp-03-no-tool-can-update-a-pending-grocery-item.md)
- [x] [MCP-08 — Multi-item additions are non-atomic](mcp-08-multi-item-additions-are-non-atomic.md)
- [x] [MCP-09 — Purchase completion loses actual quantity details](mcp-09-purchase-completion-loses-actual-quantity-details.md)
- [x] [SKILL-02 — The skill cannot describe workflows for tools that do not exist](skill-02-the-skill-cannot-describe-workflows-for-tools-that-do-not-exist.md)

### Phase 3 — Product discovery and learning loop

- [x] [MCP-04 — No agent-safe product search or catalog discovery](mcp-04-no-agent-safe-product-search-or-catalog-discovery.md)
- [ ] [MCP-05 — No controlled alias-management tool](mcp-05-no-controlled-alias-management-tool.md)
- [x] [MCP-06 — No inventory-event history tool](mcp-06-no-inventory-event-history-tool.md)
- [x] [MCP-07 — No prediction-feedback tool](mcp-07-no-prediction-feedback-tool.md)
- [ ] [MCP-10 — No read-only household context tool](mcp-10-no-read-only-household-context-tool.md)

### Phase 4 — Make third-party installation reliable

- [x] [MCP-11 — No contract/capability compatibility probe](mcp-11-no-contract-capability-compatibility-probe.md)
- [x] [SKILL-03 — Hermes-specific and OpenClaw-specific instructions are mixed](skill-03-hermes-specific-and-openclaw-specific-instructions-are-mixed.md)
- [x] [SKILL-04 — Installation is manual and does not verify schemas](skill-04-installation-is-manual-and-does-not-verify-schemas.md)
- [x] [SKILL-05 — No release synchronization between MCP and skills](skill-05-no-release-synchronization-between-mcp-and-skills.md)
- [x] [SKILL-06 — The skill metadata and structure are too narrowly Hermes-shaped](skill-06-the-skill-metadata-and-structure-are-too-narrowly-hermes-shaped.md)
- [x] [SKILL-07 — Scenario coverage is prose-only and not executable](skill-07-scenario-coverage-is-prose-only-and-not-executable.md)

Wave 3 closes these five linked findings through feature 32. The evidence map is
recorded in [triage.md](triage.md#wave-3-contract-and-release-evidence).
Checked items have a resolved or rejected-as-separate-bug decision in that
ledger. MCP-05 and MCP-10 remain unchecked because they are deferred product
choices rather than active correctness work.

## Working rules

- Fix domain invariants in the domain/application layer first.
- Keep REST and MCP as transport adapters over shared services.
- Validate MCP schemas through a live MCP client.
- Keep one NestJS deployable for the MVP.
- Preserve the single-household, local-only architecture.
- Avoid unrelated infrastructure or store integrations.
- Update skill instructions only after the service/MCP contract is finalized.
- Treat uncertain write outcomes conservatively and never auto-retry them from the skill.
