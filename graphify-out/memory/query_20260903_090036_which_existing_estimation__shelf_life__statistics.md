---
type: "query"
date: "2026-09-03T09:00:36.989624+00:00"
question: "Which existing estimation, shelf-life, statistics, stock projection, and quantity contracts constrain feature 33b Step 2?"
contributor: "graphify"
outcome: "useful"
source_nodes: ["ProductShelfLifePolicy", "ProductStatistics", "EstimationService", "stock-ledger.e2e-spec.ts"]
---

# Q: Which existing estimation, shelf-life, statistics, stock projection, and quantity contracts constrain feature 33b Step 2?

## Answer

Expanded from original query via graph vocab: [estimate, estimation, prediction, consumption, interval, shelf, life, policy, statistics, stock, projection, quantity]. The graph connected ProductShelfLifePolicy, ProductStatistics, StockProjection, EstimationService, and the stock-ledger tests. Step 2 therefore adds a pure forward calculator plus a transaction-aware evidence loader, uses estimatedConsumptionIntervalDays as the learned decay input, treats finite shelf life as a zero-forcing upper bound, and leaves prediction persistence and scheduled orchestration for 33c.

## Outcome

- Signal: useful

## Source Nodes

- ProductShelfLifePolicy
- ProductStatistics
- EstimationService
- stock-ledger.e2e-spec.ts