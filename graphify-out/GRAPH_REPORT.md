# Graph Report - home-stock-tracker  (2026-08-26)

## Corpus Check
- 184 files · ~116,619 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 765 nodes · 946 edges · 131 communities (34 shown, 97 thin omitted)
- Extraction: 88% EXTRACTED · 12% INFERRED · 0% AMBIGUOUS · INFERRED: 115 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `dd20b0c0`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- managedFiles
- inventory.service.ts
- ProductService
- GroceryItemResponseDto
- scripts
- Inventory Service
- prisma-cli Skill
- Feature 3: Inventory event tracking
- app.module.ts
- Client Methods
- compilerOptions
- complete skill
- dependencies
- Feature implementation loop
- Upgrade to Prisma ORM 7
- Prisma Compute
- Prisma Postgres skill
- implement skill
- Prisma Next (MongoDB Successor)
- adapters
- exclude
- overview Skill
- Prisma Management API
- Product entity
- devDependencies
- onboard skill
- PostgreSQL Driver Adapter (PrismaPg)
- nest-cli.json
- SqlDriverAdapter Interface
- create-db CLI
- Rollback - Safe Reverse
- grill-me skill
- MySQL/MariaDB Driver Adapter
- Prisma Client Connection Pool
- SQLite Driver Adapters (BetterSQLite3, LibSQL/Turso)
- SQL Server Driver Adapter (PrismaMssql)
- Driver Adapter Error Mapping
- MongoDB Driver Session Transactions
- Index Parity Verification
- Direct TCP Connection
- Prisma Console
- Management API
- Client Extensions Replacement
- Rationale: unit testing is opt-in
- Prediction architecture
- eslint-config-prettier
- @eslint/eslintrc
- @eslint/js
- Feature: Record purchases and restocks
- globals
- jest
- @nestjs/cli
- @nestjs/schematics
- @nestjs/testing
- prettier
- prisma
- source-map-support
- supertest
- ts-jest
- ts-loader
- ts-node
- tsconfig-paths
- @types/jest
- @types/node
- @types/pg
- @types/supertest
- typescript
- typescript-eslint
- brownfield onboarding
- findings ledger
- bounded spec build loop
- verify command
- Debug agent interface
- Discovery agent interface
- deep planning conversation
- blueprint health check
- Grill Me agent interface
- Grilling agent interface
- design tree interview
- prisma studio
- prisma validate
- PlanetScale
- Prisma Schema for MySQL/MariaDB
- Prisma Schema for PostgreSQL
- Prisma Generator Block
- Resource Model
- OAuth Flow
- Management API Base URL
- Resource ID Prefixes (proj_, db_, con_, wksp_)
- OAuth 2.0 Authentication
- Prisma 7 Import Path Requirement
- Accelerate URL Handling
- Connection Pool Configuration
- Environment Variable Loading
- Driver Adapter Requirement
- ESM-first Module System
- Explicit Output Path
- prisma-client generator
- Feature Commit
- Feature 10: Prediction feedback
- Feature 11: Low-stock recommendations
- Feature 13: Hermes inventory skill
- Feature 14: Hermes grocery conversations
- Feature 15: Proactive stock checks
- Feature 17: Operational visibility
- Feature 18: Deployment readiness
- Feature 19: Expiration tracking
- Feature 1: Grocery list management
- Feature 20: Storage locations
- Feature 21: Product-specific automation policies
- Feature 22: Advanced prediction engine
- Feature 23: Background job infrastructure
- Feature 24: Receipt and barcode ingestion
- Feature 25: Home Assistant integration
- Feature 26: Management dashboard
- Feature 2: Product catalog and normalization
- Feature 8: LLM-assisted product understanding
- MVP build plan
- Post-MVP build plan
- Blueprint feature workflow
- NestJS coding standard
- TypeScript coding standard
- Features history
- Fixes history
- Rollbacks history
- LLM integration
- REST API
- Home Stock Tracker
- dotenv

## God Nodes (most connected - your core abstractions)
1. `managedFiles` - 57 edges
2. `ProductService` - 22 edges
3. `compilerOptions` - 22 edges
4. `prisma-cli Skill` - 22 edges
5. `CompletePurchaseDto` - 17 edges
6. `Feature 3: Inventory event tracking` - 16 edges
7. `RecordInventoryEventDto` - 15 edges
8. `RecordPurchaseDto` - 15 edges
9. `PrismaService` - 15 edges
10. `scripts` - 13 edges

## Surprising Connections (you probably didn't know these)
- `PostgreSQL container` --conceptually_related_to--> `PostgreSQL`  [INFERRED]
  docker-compose.yml → blueprint/context/project-overview.md
- `tests skill` --references--> `Coding Standards`  [EXTRACTED]
  .claude/skills/tests/SKILL.md → blueprint/context/coding-standards.md
- `try skill` --references--> `Coding Standards`  [EXTRACTED]
  .claude/skills/try/SKILL.md → blueprint/context/coding-standards.md
- `Feature 3: Inventory event tracking` --semantically_similar_to--> `Feature 3: Inventory event tracking`  [INFERRED] [semantically similar]
  blueprint/build-plan.md → blueprint/history/features/03-inventory-event-tracking.md
- `brief skill` --conceptually_related_to--> `feature skill`  [INFERRED]
  .claude/skills/brief/SKILL.md → .claude/skills/feature/SKILL.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **MVP features** — blueprint_build_plan_mvp, blueprint_build_plan_feature_1_grocery_list_management, blueprint_build_plan_feature_2_product_catalog_and_normalization, blueprint_build_plan_feature_3_inventory_event_tracking, blueprint_build_plan_feature_4_purchase_and_restock_flow, blueprint_build_plan_feature_5_household_profile, blueprint_build_plan_feature_6_inventory_state_estimation, blueprint_build_plan_feature_7_consumption_pattern_learning, blueprint_build_plan_feature_8_llm_assisted_product_understanding, blueprint_build_plan_feature_9_hybrid_low_stock_prediction, blueprint_build_plan_feature_10_prediction_feedback, blueprint_build_plan_feature_11_low_stock_recommendations, blueprint_build_plan_feature_12_mcp_tool_interface, blueprint_build_plan_feature_13_hermes_inventory_skill, blueprint_build_plan_feature_14_hermes_grocery_conversations, blueprint_build_plan_feature_15_proactive_stock_checks, blueprint_build_plan_feature_16_service_authentication, blueprint_build_plan_feature_17_operational_visibility, blueprint_build_plan_feature_18_deployment_readiness [EXTRACTED 1.00]
- **Post-MVP features** — blueprint_build_plan_post_mvp, blueprint_build_plan_feature_19_expiration_tracking, blueprint_build_plan_feature_20_storage_locations, blueprint_build_plan_feature_21_product_specific_automation_policies, blueprint_build_plan_feature_22_advanced_prediction_engine, blueprint_build_plan_feature_23_background_job_infrastructure, blueprint_build_plan_feature_24_receipt_and_barcode_ingestion, blueprint_build_plan_feature_25_home_assistant_integration, blueprint_build_plan_feature_26_management_dashboard [EXTRACTED 1.00]
- **Inventory event tracking implementation** — blueprint_history_features_03_inventory_event_tracking_feature_3, blueprint_history_features_03_inventory_event_tracking_inventory_event_model, blueprint_history_features_03_inventory_event_tracking_inventory_module, blueprint_history_features_03_inventory_event_tracking_rest_api, blueprint_history_features_03_inventory_event_tracking_prisma_migration, blueprint_history_features_03_inventory_event_tracking_unit_tests, blueprint_history_features_03_inventory_event_tracking_integration_tests [EXTRACTED 1.00]

## Communities (131 total, 97 thin omitted)

### Community 0 - "managedFiles"
Cohesion: 0.04
Nodes (57): managedFiles, .agents/skills/adopt/SKILL.md, .agents/skills/audit/SKILL.md, .agents/skills/autopilot/SKILL.md, .agents/skills/brief/SKILL.md, .agents/skills/check/SKILL.md, .agents/skills/ci/SKILL.md, .agents/skills/complete/SKILL.md (+49 more)

### Community 1 - "inventory.service.ts"
Cohesion: 0.05
Nodes (54): ArrayNotEmpty, ArrayUnique, HttpCode, IsIn, IsInt, Max, CompletePurchaseDto, IsArray (+46 more)

### Community 2 - "ProductService"
Cohesion: 0.10
Nodes (21): AddProductAliasDto, IsNotEmpty, IsString, Transform, CreateProductDto, IsArray, IsNotEmpty, IsOptional (+13 more)

### Community 3 - "GroceryItemResponseDto"
Cohesion: 0.10
Nodes (22): Delete, AddGroceryItemDto, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString (+14 more)

### Community 4 - "scripts"
Cohesion: 0.06
Nodes (34): author, description, jest, collectCoverageFrom, coverageDirectory, moduleFileExtensions, moduleNameMapper, rootDir (+26 more)

### Community 5 - "Inventory Service"
Cohesion: 0.07
Nodes (33): status skill, Rationale: unit testing only, no E2E/browser, tests skill, try skill, AI Interaction Guidelines, Coding Standards, Findings, Grocery list management (+25 more)

### Community 6 - "prisma-cli Skill"
Cohesion: 0.12
Nodes (31): agent-safety, prisma complete, prisma db execute, prisma db pull, prisma db push, prisma db seed, prisma debug, prisma dev (+23 more)

### Community 7 - "Feature 3: Inventory event tracking"
Cohesion: 0.07
Nodes (30): Feature 12: MCP tool interface, Feature 16: Service authentication, Feature 3: Inventory event tracking, Feature 4: Purchase and restock flow, Feature 5: Household profile, Feature 6: Inventory state estimation, Feature 7: Consumption pattern learning, Feature 9: Hybrid low-stock prediction (+22 more)

### Community 8 - "app.module.ts"
Cohesion: 0.08
Nodes (18): Global, AppController, Controller, Get, AppModule, Module, AppService, Injectable (+10 more)

### Community 9 - "Client Methods"
Cohesion: 0.09
Nodes (24): $connect, $disconnect, $extends, $on, Client Methods, adapter, PrismaClient Constructor, Singleton Pattern (+16 more)

### Community 10 - "compilerOptions"
Cohesion: 0.09
Nodes (22): compilerOptions, allowSyntheticDefaultImports, baseUrl, declaration, emitDecoratorMetadata, esModuleInterop, experimentalDecorators, forceConsistentCasingInFileNames (+14 more)

### Community 11 - "complete skill"
Cohesion: 0.16
Nodes (21): brief skill, check skill, ci skill, complete skill, debug agent interface, debug skill, discovery agent interface, discovery skill (+13 more)

### Community 12 - "dependencies"
Cohesion: 0.10
Nodes (21): class-transformer, class-validator, @nestjs/common, @nestjs/core, @nestjs/platform-express, dependencies, class-transformer, class-validator (+13 more)

### Community 13 - "Feature implementation loop"
Cohesion: 0.14
Nodes (16): AI Blueprint, Feature branch policy, complete skill, Core Blueprint skills, Feature implementation loop, feature skill, implement skill, NestJS framework (+8 more)

### Community 14 - "Upgrade to Prisma ORM 7"
Cohesion: 0.15
Nodes (16): Accelerate Users, Driver Adapters, Environment Variables, ESM and CommonJS Support, Prisma Config, Removed Features, Schema Changes, Upgrade to Prisma ORM 7 (+8 more)

### Community 15 - "Prisma Compute"
Cohesion: 0.27
Nodes (11): App Deploy CLI, Compute Config, defineComputeConfig, prisma.compute.ts, create-prisma, Framework Readiness, ComputeClient, Management API (+3 more)

### Community 16 - "Prisma Postgres skill"
Cohesion: 0.24
Nodes (11): Console-first workflow, create-db CLI, Prisma Management API, Prisma Management API SDK, OAuth 2.0, Persistent database platform CLI, Prisma Console, prisma postgres link (+3 more)

### Community 17 - "implement skill"
Cohesion: 0.40
Nodes (10): audit skill, autopilot skill, brief skill, check skill, complete skill, debug skill, feature spec template, feature skill (+2 more)

### Community 18 - "Prisma Next (MongoDB Successor)"
Cohesion: 0.20
Nodes (10): Prisma Next MongoDB Early Access Status, MongoDB 8.0+ Requirement, Prisma Next (MongoDB Successor), Prisma v6 MongoDB (Terminal Classic-ORM), Aggregation Pipeline Builder, Mongo Raw Lane, Contract-Driven Migrations, JSON Schema Validators (+2 more)

### Community 19 - "adapters"
Cohesion: 0.25
Nodes (7): adapters, schemaVersion, version, claude, codex, copilot, opencode

### Community 20 - "exclude"
Cohesion: 0.25
Nodes (7): dist, node_modules, **/*spec.ts, test, ./tsconfig.json, exclude, extends

### Community 21 - "overview Skill"
Cohesion: 0.48
Nodes (7): project-overview-template, overview Skill, build-plan.md, Checkbox Build Plan, project-overview.md, project-overview workflow, project-plan.md

### Community 22 - "Prisma Management API"
Cohesion: 0.29
Nodes (7): Prisma Management API, Cursor-Based Pagination, API Response Envelope, Create Connection Endpoint, Create Project Endpoint, Regions Endpoint, Service Token (Prisma Management API)

### Community 23 - "Product entity"
Cohesion: 0.29
Nodes (7): GroceryListItem entity, Household entity, InventoryEvent entity, Prediction entity, Product entity, Rationale: append-only event history, Rationale: single-household MVP scope

### Community 24 - "devDependencies"
Cohesion: 0.29
Nodes (7): eslint, eslint-plugin-prettier, devDependencies, eslint, eslint-plugin-prettier, @types/express, @types/express

### Community 25 - "onboard skill"
Cohesion: 0.47
Nodes (6): adopt skill, ci skill, discovery skill, doctor skill, blueprint overlay setup, onboard skill

### Community 26 - "PostgreSQL Driver Adapter (PrismaPg)"
Cohesion: 0.33
Nodes (6): PostgreSQL Driver Adapter (PrismaPg), PostgreSQL, Prisma Postgres, Prisma Postgres Serverless, Prisma 7 Client Instantiation Pattern, Prisma 7 Adapter Pattern

### Community 27 - "nest-cli.json"
Cohesion: 0.33
Nodes (5): collection, compilerOptions, deleteOutDir, $schema, sourceRoot

### Community 28 - "SqlDriverAdapter Interface"
Cohesion: 0.50
Nodes (4): Savepoint Support, Shadow Database, SqlDriverAdapter Interface, Transaction Interface

### Community 29 - "create-db CLI"
Cohesion: 0.50
Nodes (4): Database Claim URL, create-db CLI, create-db Programmatic API, TTL Option (--ttl)

### Community 30 - "Rollback - Safe Reverse"
Cohesion: 0.50
Nodes (4): Release - Deployment Readiness, Rollback OpenAI Agent Config, Rollback Spec Template, Rollback - Safe Reverse

### Community 48 - "Feature: Record purchases and restocks"
Cohesion: 0.18
Nodes (10): Build steps, Data / contracts, Feature: Record purchases and restocks, Files / areas, Goal, In scope, Notes for the AI, Out of scope (+2 more)

## Knowledge Gaps
- **348 isolated node(s):** `schemaVersion`, `version`, `claude`, `codex`, `copilot` (+343 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **97 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `devDependencies` connect `devDependencies` to `dotenv`, `scripts`, `eslint-config-prettier`, `@eslint/eslintrc`, `@eslint/js`, `globals`, `jest`, `@nestjs/cli`, `@nestjs/schematics`, `@nestjs/testing`, `prettier`, `prisma`, `source-map-support`, `supertest`, `ts-jest`, `ts-loader`, `ts-node`, `tsconfig-paths`, `@types/jest`, `@types/node`, `@types/pg`, `@types/supertest`, `typescript`, `typescript-eslint`?**
  _High betweenness centrality (0.014) - this node is a cross-community bridge._
- **Why does `ProductService` connect `ProductService` to `app.module.ts`, `inventory.service.ts`, `GroceryItemResponseDto`?**
  _High betweenness centrality (0.011) - this node is a cross-community bridge._
- **Why does `GroceryItemResponseDto` connect `GroceryItemResponseDto` to `inventory.service.ts`?**
  _High betweenness centrality (0.008) - this node is a cross-community bridge._
- **What connects `schemaVersion`, `version`, `claude` to the rest of the system?**
  _348 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `managedFiles` be split into smaller, more focused modules?**
  _Cohesion score 0.03508771929824561 - nodes in this community are weakly interconnected._
- **Should `inventory.service.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05052631578947368 - nodes in this community are weakly interconnected._
- **Should `ProductService` be split into smaller, more focused modules?**
  _Cohesion score 0.09725158562367865 - nodes in this community are weakly interconnected._