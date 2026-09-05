# MCP and skill gaps — active triage

Reviewed against the repository on 2026-09-02. Context holds only work that may
still be considered for implementation. Shipped work is recorded under
`blueprint/history/`; rejected proposals retain only their decision rationale
here.

## Deferred candidates

None currently retained. MCP-05 and MCP-10 were completed on 2026-09-02.

## Rejected as separate work

- **MCP-08 — universal atomic multi-item additions:** policy-aware additions can
  legitimately require separate product-resolution or quantity-confirmation
  decisions. Keep the honest per-item workflow unless usage demonstrates that a
  deliberately designed all-or-nothing interaction is needed.
- **SKILL-02 — workflows for tools that do not exist:** this was an umbrella
  observation, not an implementation unit. Skill instructions were updated with
  each delivered MCP capability; optional tools remain separate product choices.

## Archived resolutions

| Findings                                       | Durable shipped record                                                                                                       |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| MCP-01                                         | [Reliable `get_product` schema](../../history/fixes/reliable-get-product-schema.md)                                          |
| MCP-02                                         | [Duplicate-safe grocery additions](../../history/fixes/mcp-02-duplicate-safe-grocery-additions.md)                           |
| MCP-03                                         | [Direct pending grocery-item updates](../../history/fixes/mcp-03-direct-pending-grocery-item-updates.md)                     |
| MCP-04                                         | [Feature 29 — product search and resolution proposals](../../history/features/29-product-search-and-resolution-proposals.md) |
| MCP-05                                         | [Standalone alias administration](../../history/fixes/mcp-05-standalone-alias-administration.md)                             |
| MCP-06                                         | [Inventory-event history MCP tool](../../history/fixes/mcp-06-no-inventory-event-history-tool.md)                            |
| MCP-07                                         | [Prediction-feedback MCP tool](../../history/fixes/mcp-07-prediction-feedback-tool.md)                                       |
| MCP-09                                         | [Purchase-completion actual measurements](../../history/fixes/mcp-09-purchase-completion-actual-quantity-details.md)         |
| MCP-10 | [Read-only household context](../../history/fixes/mcp-10-no-read-only-household-context-tool.md) |
| MCP-11, SKILL-04, SKILL-05, SKILL-06, SKILL-07 | [Feature 32 — verifiable agent integration contract](../../history/features/32-verifiable-agent-integration-contract.md)     |
| MCP-12                                         | [Generic MCP source attribution](../../history/fixes/mcp-source-attribution.md)                                              |
| MCP-X01                                        | [Pending-only grocery removal](../../history/fixes/guard-grocery-remove-pending-state.md)                                    |
| SKILL-01                                       | [Feature 30 — policy-aware grocery additions](../../history/features/30-policy-aware-grocery-additions.md)                   |
| SKILL-03                                       | [Separate Hermes and OpenClaw instructions](../../history/fixes/separate-hermes-openclaw-skill-instructions.md)              |

The archived records own completion evidence. Do not recreate their old fix
briefs in context unless a new regression is independently reproduced.
