---
type: "query"
date: "2026-09-03T08:37:34.619218+00:00"
question: "What existing contracts and code paths constrain feature 33b stock mutation and batch purchase APIs?"
contributor: "graphify"
outcome: "useful"
source_nodes: ["InventoryService", "StockLedgerService", "inventory.controller.ts", "McpServerFactory"]
---

# Q: What existing contracts and code paths constrain feature 33b stock mutation and batch purchase APIs?

## Answer

Expanded from original query via graph vocab: [stock, ledger, inventory, purchase, purchases, mutation, batch, projection, transaction, controller, mcp, unit]. InventoryService owns retryable serializable event and projection writes; StockLedgerService owns canonical-unit and projection semantics; InventoryController already uses POST /inventory/purchases for the legacy single-purchase contract; McpServerFactory publishes record_purchase and record_stock_signal under the versioned MCP contract. Therefore 33b must preserve the legacy REST shape on the colliding route, centralize new ledger operations, keep batch writes atomic, and advance the additive MCP contract when new tools become discoverable.

## Outcome

- Signal: useful

## Source Nodes

- InventoryService
- StockLedgerService
- inventory.controller.ts
- McpServerFactory