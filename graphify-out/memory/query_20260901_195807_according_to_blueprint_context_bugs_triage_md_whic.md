---
type: "query"
date: "2026-09-01T19:58:07.210066+00:00"
question: "according to blueprint/context/bugs/triage.md which ones i can run paralel?"
contributor: "graphify"
outcome: "useful"
source_nodes: ["MCP and skill gaps - current triage", "McpServerFactory", "InventoryService", "PredictionFeedbackService", "OpenClaw"]
---

# Q: according to blueprint/context/bugs/triage.md which ones i can run paralel?

## Answer

Expanded from original query via graph vocabulary: parallel, dependencies, triage, mcp, skill, inventory, feedback, purchase, quantity, contract, openclaw, registry. Blueprint supports only one active current-feature, so implementation should normally remain sequential. Read-only investigation for SKILL-03, MCP-06, MCP-07, and MCP-09 can run in parallel. MCP-06 and MCP-07 are logically independent and could be implemented in separate git worktrees, but both touch McpServerFactory, MCP tests, API docs, Hermes skill guidance, and scenarios, so sequential delivery is safer. MCP-09 overlaps InventoryService plus the same MCP and documentation hotspots and should run alone. The combined MCP-11 and SKILL-04 through SKILL-07 contract effort must wait until MCP-06, MCP-07, and MCP-09 settle the tool surface. Deferred MCP-05 and MCP-10 may be investigated in parallel later but should not be started now.

## Outcome

- Signal: useful

## Source Nodes

- MCP and skill gaps - current triage
- McpServerFactory
- InventoryService
- PredictionFeedbackService
- OpenClaw