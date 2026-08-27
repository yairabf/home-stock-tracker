---
type: "query"
date: "2026-08-27T16:40:44.458164+00:00"
question: "Why is ProductService the main cross-community bridge between product, grocery, inventory, persistence, and controllers?"
contributor: "graphify"
outcome: "useful"
source_nodes: ["ProductService", "GroceryService", "InventoryService", "PrismaService", "ProductController", "EstimationService", "StatisticsService"]
---

# Q: Why is ProductService the main cross-community bridge between product, grocery, inventory, persistence, and controllers?

## Answer

Expanded from original query via graph vocabulary: product, service, grocery, inventory, prisma, controller, estimation, statistics, module. ProductService is the canonical product boundary. Extracted imports connect grocery.service.ts, inventory.service.ts, estimation.service.ts, statistics.service.ts, product.module.ts, and product.controller.ts to ProductService. Grocery uses findOrCreateByExactOrAliasMatch for normalized item entry; inventory and statistics use product lookup/validation; estimation uses product metadata; ProductController exposes catalog operations. ProductService reaches PrismaService through its constructor and owns transactional catalog writes. Most cross-community paths are two hops through the importing file, which explains its high betweenness. The ProductController shortest-path result used inferred DTO edges, but graphify explain separately reports the controller import as EXTRACTED.

## Outcome

- Signal: useful

## Source Nodes

- ProductService
- GroceryService
- InventoryService
- PrismaService
- ProductController
- EstimationService
- StatisticsService