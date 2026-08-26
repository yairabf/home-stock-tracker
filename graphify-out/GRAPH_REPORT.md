# Graph Report - Home Stock Tracker

> Generated: 2026-08-26
> Structural knowledge graph for the home-stock-tracker NestJS backend service

## Extraction Note

This rebuild contains structural TypeScript/Prisma extraction and manually classified project relationships. Semantic documentation extraction was not included because the configured backend returned authentication errors. Treat relationships as navigation aids and verify them against source code before making implementation decisions.

## Summary

- **359** nodes
- **614** edges
- **12** communities detected

### Node Types

| Type | Count |
|------|-------|
| method | 268 |
| dto | 48 |
| model | 14 |
| service | 8 |
| module | 8 |
| feature | 7 |
| controller | 6 |


### Communities

| Community | Nodes |
|-----------|-------|
| unknown | 313 |
| dto | 9 |
| inventory | 7 |
| product | 6 |
| grocery | 6 |
| household | 6 |
| statistics | 4 |
| estimation | 3 |
| database | 2 |
| services | 1 |
| other | 1 |
| api | 1 |


---

## God Nodes (Most Connected)

These nodes have the highest connectivity and serve as central hubs:

### `InventoryService` - 48 connections

- **Type:** service
- **Community:** inventory
- **Source:** `src/inventory/inventory.service.ts`

### `EstimationService` - 34 connections

- **Type:** service
- **Community:** estimation
- **Source:** `src/estimation/estimation.service.ts`

### `StatisticsService` - 32 connections

- **Type:** service
- **Community:** statistics
- **Source:** `src/statistics/statistics.service.ts`

### `ProductService` - 28 connections

- **Type:** service
- **Community:** product
- **Source:** `src/product/product.service.ts`

### `InventoryController` - 28 connections

- **Type:** controller
- **Community:** inventory
- **Source:** `src/inventory/inventory.controller.ts`

### `GroceryService` - 23 connections

- **Type:** service
- **Community:** grocery
- **Source:** `src/grocery/grocery.service.ts`

### `HouseholdService` - 22 connections

- **Type:** service
- **Community:** household
- **Source:** `src/household/household.service.ts`

### `ProductController` - 20 connections

- **Type:** controller
- **Community:** product
- **Source:** `src/product/product.controller.ts`

### `CompletePartialPurchaseDto` - 17 connections

- **Type:** dto
- **Community:** dto
- **Source:** `src/inventory/dto/complete-partial-purchase.dto.ts`

### `InventoryEventResponseDto` - 15 connections

- **Type:** dto
- **Community:** unknown
- **Source:** `src/inventory/inventory.service.ts`



---

## Data Models (Prisma)

- `module`
- `service`
- `inventoryEvent`
- `productStatistics`
- `product`
- `groceryListItem`
- `prediction`
- `household`
- `Product`
- `GroceryListItem`
- `InventoryEvent`
- `Household`
- `Prediction`
- `ProductStatistics`


---

## Services

- **AppService** (`src/app.service.ts`)
- **StatisticsService** (`src/statistics/statistics.service.ts`)
- **PrismaService** (`src/prisma/prisma.service.ts`)
- **ProductService** (`src/product/product.service.ts`)
- **GroceryService** (`src/grocery/grocery.service.ts`)
- **EstimationService** (`src/estimation/estimation.service.ts`)
- **InventoryService** (`src/inventory/inventory.service.ts`)
- **HouseholdService** (`src/household/household.service.ts`)


---

## Controllers (API Endpoints)

- **AppController** (`src/app.controller.ts`)
- **StatisticsController** (`src/statistics/statistics.controller.ts`)
- **ProductController** (`src/product/product.controller.ts`)
- **GroceryController** (`src/grocery/grocery.controller.ts`)
- **InventoryController** (`src/inventory/inventory.controller.ts`)
- **HouseholdController** (`src/household/household.controller.ts`)


---

## Key Relationships

### Service Dependencies

- `StatisticsService` injects:
  - `PrismaService`
  - `productService`
  - `householdService`
- `ProductService` injects:
  - `PrismaService`
- `GroceryService` injects:
  - `PrismaService`
  - `productService`
- `EstimationService` injects:
  - `PrismaService`
  - `productService`
  - `householdService`
- `InventoryService` injects:
  - `PrismaService`
  - `productService`
- `HouseholdService` injects:
  - `PrismaService`


---

## Cross-Community Connections

### Grocery ↔ Inventory Bridge

**`InventoryService.completePurchase()`** bridges:
- Grocery Management (Community)
- Inventory Events (Community)

This method atomically:
1. Creates `InventoryEvent { type: PURCHASED }`
2. Updates `GroceryListItem { status: purchased }`
3. Links via `relatedInventoryEventId`

### Product ↔ All Communities Bridge

**`ProductService`** is the central hub connecting:
- Product Catalog (ProductService home)
- Stock Estimation (EstimationService depends on it)
- Grocery Management (GroceryService depends on it)
- Inventory Events (InventoryService depends on it)

### Estimation ↔ Statistics Pipeline

**Prediction flow:**
1. `EstimationService.estimateProductState()`
2. → `fetchProductEventHistory()` (Prisma)
3. → `fetchProductStatistics()` (ProductStatistics)
4. → `applyTimeDecayHeuristics()` (prediction logic)
5. → `savePrediction()` (Prediction table)

---

## File Structure

### Source Files by Community

#### Grocery

- `GroceryController`
- `GroceryService`
- `GroceryModule`
- `GroceryItemResponseDto`
- `ListGroceryItemsDto`
- `AddGroceryItemDto`

#### Inventory

- `InventoryService`
- `InventoryModule`
- `InventoryController`
- `RecordInventoryEventDto`
- `ListInventoryEventsDto`
- `InventoryEventResponseDto`
- `InventoryEventListResponseDto`

#### Estimation

- `EstimationModule`
- `EstimationService`
- `EstimationResponseDto`

#### Statistics

- `StatisticsModule`
- `StatisticsController`
- `StatisticsService`
- `StatisticsResponseDto`

#### Product

- `ProductModule`
- `ProductController`
- `ProductService`
- `CreateProductDto`
- `ProductResponseDto`
- `AddProductAliasDto`

#### Household

- `HouseholdController`
- `HouseholdModule`
- `HouseholdService`
- `UpdateHouseholdDto`
- `CreateHouseholdDto`
- `HouseholdResponseDto`

#### Database

- `PrismaService`
- `PrismaModule`

#### Dto

- `CompletePurchaseDto`
- `CompletedItemDto`
- `SkippedItemDto`
- `PendingItemDto`
- `CompletePartialPurchaseResponseDto`
- `RecordPurchaseDto`
- `CompletePurchaseResponseDto`
- `CompletePartialPurchaseDto`
- `DeterministicSignalsDto`

#### Api

- `AppController`



---

## Next Features (from build-plan.md)

Based on the graph, upcoming features:

1. **Feature 8: LLM-assisted product understanding** - Will add LLM inference nodes
2. **Feature 9: Hybrid low-stock prediction** - Enhances EstimationService
3. **Feature 10: Prediction feedback** - Adds feedback loop edges
4. **Feature 11: Low-stock recommendations** - New RecommendationService
5. **Feature 12: MCP tool interface** - Exposes service as agent tools

---

## Graph Outputs

- `graph.html` - Interactive D3 visualization
- `graph.json` - Raw graph data (NetworkX compatible)
- `.graphify_extract.json` - Full extraction with all edges

---

*Generated by Claude Code graphify workflow*
