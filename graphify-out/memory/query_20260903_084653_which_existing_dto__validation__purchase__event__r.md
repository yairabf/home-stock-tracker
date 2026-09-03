---
type: "query"
date: "2026-09-03T08:46:53.525241+00:00"
question: "Which existing DTO, validation, purchase, event, response, quantity, unit, and stock contracts constrain implementation Step 1 of feature 33b?"
contributor: "graphify"
outcome: "useful"
source_nodes: ["RecordPurchaseDto", "InventoryEventResponseDto", "InventoryService", "StockLedgerService"]
---

# Q: Which existing DTO, validation, purchase, event, response, quantity, unit, and stock contracts constrain implementation Step 1 of feature 33b?

## Answer

Expanded from original query via graph vocab: [dto, validation, purchase, purchases, inventory, event, response, quantity, unit, stock]. The graph identified RecordPurchaseDto and InventoryEventResponseDto as the existing single-purchase boundary, InventoryService as the owner of purchase behavior, and StockLedgerService as the unit and projection boundary. Step 1 therefore preserves the existing DTO and event response while adding separate strict batch, mutation, timestamp, and projection receipt contracts.

## Outcome

- Signal: useful

## Source Nodes

- RecordPurchaseDto
- InventoryEventResponseDto
- InventoryService
- StockLedgerService