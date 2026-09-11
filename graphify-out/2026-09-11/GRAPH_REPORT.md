# Graph Report - home-stock-tracker  (2026-09-11)

## Corpus Check
- 566 files · ~980,692 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 4844 nodes · 7109 edges · 365 communities (333 shown, 32 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 133 edges (avg confidence: 0.81)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `d89cf3fd`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- managedFiles
- RecordPurchasesDto
- product.service.ts
- hermes/home-stock-tracker/manifest.json
- devDependencies
- product-resolution.ts
- PrismaService
- 8. Deployment - Where and how will this ship?
- LlmProvider
- features
- Feature: Fail-closed store-skill scaffold
- mcp-server.factory.ts
- RecordPurchaseDto
- PolicyAwareAddGroceryItemDto
- Build a store-specific grocery cart skill
- ProductService
- Model Queries
- Driver Adapters
- app.module.ts
- health.controller.ts
- generate-agent-skills.mjs
- Upgrade to Prisma ORM 7
- GroceryService
- What You Must Do When Invoked
- What You Must Do When Invoked
- What You Must Do When Invoked
- operational-logger.service.ts
- Relation Queries
- Removed Features
- low-stock-recommendation.service.ts
- compilerOptions
- Prisma CLI Reference
- Raw Queries
- Troubleshooting Prisma Compute
- stock-mutation.ts
- Client Methods
- Filter Conditions and Operators
- Query Options
- dependencies
- statistics.service.ts
- AddGroceryItemDto
- prisma db push
- prisma dev
- prisma generate
- prisma studio
- Prisma Client API Reference
- Prisma Config
- daily-stock-workflow.service.ts
- prisma migrate dev
- Data model
- requiredTools
- normalizeProductName
- prisma db seed
- Environment Variables
- product-search.service.ts
- openclaw/home-stock-tracker/manifest.json
- prisma db pull
- prisma init
- prisma migrate deploy
- Constructor Options
- Prisma Database Setup
- Prisma Accelerate Users
- ESM and CommonJS Support
- Feature: Stock mutation and batch purchase APIs
- ConfirmProductAliasGroceryItemDto
- SearchProductsQueryDto
- ExpirationBatchService
- Schema Changes
- InventoryService
- Feature: Inventory state estimation
- Feature: Consumption pattern learning
- Feature: LLM-assisted product understanding
- Feature: Product name namespace
- Feature: Grocery quantity contract
- Grocery conversation workflows
- scripts
- grocery-quantity-migration.e2e-spec.ts
- continuous - complete the build plan one local feature at a time
- Transactions
- Workflow
- estimation.service.ts
- generate-store-skill.mjs
- UpdateGroceryItemDto
- fixes/README.md
- product-search.ts
- inventory-read-response.dto.ts
- Feature: Confirmed grocery catalog decisions
- continuous - complete the build plan one local feature at a time
- Agent Integrations
- Home Stock Tracker
- Home Stock Tracker
- ServiceAuthConfigService
- InventoryController
- Prisma Compute Framework Readiness
- MongoDB Setup
- Prisma SQL Driver Adapter Implementation
- Core Workflows
- Fix: MCP-05 standalone alias administration
- product.controller.ts
- inventory.service.ts
- Feature: Stock ledger foundation
- Feature: Household profile
- Fix: MCP-09 purchase completion loses actual quantity details
- Operations Guide
- autopilot - optional Blueprint loop
- onboard - finish the Blueprint overlay setup
- prisma db execute
- Prisma Platform CLI App Deploy
- MySQL Setup
- management-api
- Fix: MCP-10 read-only household context
- inventory.service.spec.ts
- application-config.ts
- Feature: Daily stock estimation workflow
- GroceryItemResponseDto
- Coding Standards
- prediction-feedback.mcp.e2e-spec.ts
- browser-tests - set up repeatable browser verification
- browser-tests - set up repeatable browser verification
- Feature 3: Inventory event tracking
- Feature: Complete grocery items from a purchase
- Feature: Policy-aware grocery additions
- Feature: Partial grocery-list completion
- Fix: MCP-07 prediction feedback tool
- autopilot - optional Blueprint loop
- onboard - finish the Blueprint overlay setup
- HomeStockTrackerConfigFlow
- CompletePurchaseDto
- adopt - bootstrap the blueprint from an existing codebase
- Feature: <name>
- <Project Name> - Project Overview
- prisma migrate diff
- prisma migrate reset
- PostgreSQL Setup
- Prisma Postgres Setup
- SQLite Setup
- Rollback: Feature NN - Name
- Feature: Agent integration and contract release
- .listItems
- stock-product-confirmation.service.ts
- Independent review record
- Independent review record
- Fix: Confirmed product creation during absolute stock updates
- inventory/stock-materialization.ts
- McpServerFactory
- Feature: Hybrid low-stock prediction
- Feature: Prediction feedback
- Feature: Low-stock recommendations
- Feature: MCP tool interface
- Feature: Hermes inventory skill
- Feature: Hermes grocery conversations
- Feature: Proactive stock checks
- Feature: Service authentication
- Feature: Operational visibility
- Feature: Deployment readiness
- adopt - bootstrap the blueprint from an existing codebase
- Feature: <name>
- <Project Name> - Project Overview
- Rollback: Feature NN - Name
- API and MCP Reference
- agent-release-contract.mjs
- AppService
- ci - set up automatic GitHub checks
- feature - turn a build-plan feature into a buildable spec
- SQL Server Setup
- create-db-cli
- api-basics
- features
- agent-scenarios.mjs
- Feature: Grocery list management
- Feature: Product catalog and normalization
- Feature: Record purchases and restocks
- Fix: MCP-03 direct pending grocery item updates
- ci - set up automatic GitHub checks
- feature - turn a build-plan feature into a buildable spec
- jest
- requiredTools
- audit - review code quality against the project standards
- debug - find the cause before changing the code
- prisma format
- prisma migrate resolve
- prisma validate
- CockroachDB Setup
- decision-stay-or-migrate
- console-and-connections
- management-api-sdk
- release - deployment readiness for Render and Vercel
- rollback - safely reverse a completed feature
- tests - add unit testing to the project
- AI Interaction Guidelines
- mcp.controller.spec.ts
- shelf-life-reasoner.service.ts
- Feature: Product search and resolution proposals
- audit - review code quality against the project standards
- debug - find the cause before changing the code
- release - deployment readiness for Render and Vercel
- rollback - safely reverse a completed feature
- tests - add unit testing to the project
- Feature: Materialized inventory reads and recommendations
- check - prove it works against the spec, with evidence
- complete - log the finished work, make the work commit, and merge
- discovery - develop the plans through a deep conversation
- graphify reference: extra exports and benchmark
- implement - build the current spec, one reviewed step at a time
- overview - turn the two plans into the AI-facing source of truth
- prisma migrate status
- Prisma Compute Config
- create-prisma Compute Flow
- SDK and API Automation
- Quick Rules
- Prisma Compute
- migrations-mapping
- schema-contract-mapping
- Prisma MongoDB Upgrade Path
- endpoints
- prototype - lock the look before you build
- try - manual review guide
- check - prove it works against the spec, with evidence
- complete - log the finished work, make the work commit, and merge
- discovery - develop the plans through a deep conversation
- graphify reference: extra exports and benchmark
- implement - build the current spec, one reviewed step at a time
- overview - turn the two plans into the AI-facing source of truth
- prototype - lock the look before you build
- try - manual review guide
- graphify reference: extra exports and benchmark
- Deployment
- Hermes installation
- exclude
- mcp-server.factory.spec.ts
- mcp-contract-fixture.spec.ts
- AGENTS.md
- prisma mcp
- client-api-mapping
- Service Tokens
- Q: What existing contracts and code paths constrain feature 33b stock mutation and batch purchase APIs?
- adapters
- brief - understand a feature before you spec it
- doctor - Blueprint health check
- prisma debug
- Prisma Client Setup
- verify-cutover-checklist
- Prisma 7 Client Instantiation
- status - where the project stands right now
- Q: Which existing DTO, validation, purchase, event, response, quantity, unit, and stock contracts constrain implementation Step 1 of feature 33b?
- Data / contracts
- Fix: Guard grocery removal by pending state
- Fix: MCP-02 duplicate-safe grocery additions
- Fix: Use transport-owned generic source attribution
- triage.md
- Fix: Separate Hermes and OpenClaw skill instructions
- brief - understand a feature before you spec it
- doctor - Blueprint health check
- status - where the project stands right now
- package.json
- Home Stock Tracker
- fix - document an ad-hoc fix, then build it like anything else
- graphify reference: query, path, explain
- Q: Which existing estimation, shelf-life, statistics, stock projection, and quantity contracts constrain feature 33b Step 2?
- update-release.sh
- fix - document an ad-hoc fix, then build it like anything else
- graphify reference: query, path, explain
- graphify reference: query, path, explain
- OpenClaw installation
- nest-cli.json
- Fix: Expose inventory-event history through MCP
- Feature: Expiration-batch foundation
- review.md
- Q: Why is ProductService the main cross-community bridge between product, grocery, inventory, persistence, and controllers?
- Q: Okay I want to plan all the bugs that we have fixed. I think we fixed a lot of them already in the history. You can see I think we fixed the first, second, and third. I think we already fixed maybe even the fourth. What I want you to do now is go through all of README and the files, trying to send according to what we have in the code right now: what needs to be fixed and not what can be weighted and what we can reject.
- Q: can you update the blueprint/context/bugs/triage.md file?
- Q: according to blueprint/context/bugs/triage.md which ones i can run paralel?
- Home Stock Tracker skill scenarios
- network
- graphify reference: add a URL and watch a folder
- graphify reference: commit hook and native AGENTS.md integration
- graphify reference: incremental update and cluster-only
- AI safety checkpoint for destructive commands
- Household Stock Ledger and Daily Estimation
- preferences.mjs
- stock-workflow-scheduler.service.ts
- Queued feature plans
- Feature: Store-skill contract and tutorial
- home_stock_tracker/__init__.py
- purchase-completion.mcp.e2e-spec.ts
- grocery.service.ts
- graphify reference: add a URL and watch a folder
- graphify reference: commit hook and native CLAUDE.md integration
- graphify reference: incremental update and cluster-only
- graphify reference: add a URL and watch a folder
- graphify reference: commit hook and native CLAUDE.md integration
- graphify reference: incremental update and cluster-only
- test_config_flow.py
- Hermes Agent
- agent-scenario-contract.spec.ts
- graphify reference: GitHub clone and cross-repo merge
- graphify reference: transcribe video and audio
- prisma complete
- Home Stock Tracker
- graphify reference: GitHub clone and cross-repo merge
- graphify reference: transcribe video and audio
- graphify reference: GitHub clone and cross-repo merge
- graphify reference: transcribe video and audio
- Home Stock Tracker skill scenarios
- Home Stock Tracker skill scenarios
- agent-skill-contract.spec.ts
- .agents/skills/graphify/references/extraction-spec.md
- Confirmed product creation during absolute stock updates
- findings.md
- features/README.md
- rollbacks/README.md
- network
- .claude/CLAUDE.md
- .claude/skills/graphify/references/extraction-spec.md
- .codex/skills/graphify/references/extraction-spec.md
- CompletePartialPurchaseDto
- hermes/scenarios.md
- hermes/workflow.md
- agent-documentation-contract.mjs
- ProductSearchService
- OperationalLogger
- mcp
- agent-skill-generator.spec.ts
- mcp
- store-skill-scaffold.spec.ts
- agent-installation-probe.mjs
- ListInventoryEventsDto
- Feature: Verifiable agent integration contract
- adapter.mjs
- Home Stock Tracker Hermes release contract
- Home Stock Tracker OpenClaw release contract
- Current Feature
- HouseholdService
- reflect-metadata
- @nestjs/schedule
- RecordInventoryEventDto
- prisma
- @prisma/adapter-pg
- rxjs
- pg
- product-name.exception.ts
- ProductResolutionAction
- HomeStockTrackerSensor
- config_flow.py
- test_coordinator.py
- Feature: Read-only Home Assistant custom integration
- HomeStockTrackerCoordinator
- config_entry
- test_sensors_publish_records_and_stable_unique_ids
- home_stock_tracker/manifest.json
- PolicyAwareGroceryAdditionShape
- home-assistant.md
- tests/__init__.py

## God Nodes (most connected - your core abstractions)
1. `PrismaService` - 87 edges
2. `managedFiles` - 63 edges
3. `ProductService` - 57 edges
4. `GroceryService` - 44 edges
5. `InventoryService` - 41 edges
6. `OperationalLogger` - 41 edges
7. `AppModule` - 33 edges
8. `createProductFixture()` - 33 edges
9. `ProductWithNames` - 32 edges
10. `LlmProvider` - 31 edges

## Surprising Connections (you probably didn't know these)
- `domainCounts()` --calls--> `normalizeProductName()`  [EXTRACTED]
  test/policy-aware-grocery.service.e2e-spec.ts → src/product/product-name.util.ts
- `nameCount()` --calls--> `normalizeProductName()`  [EXTRACTED]
  test/policy-aware-grocery.service.e2e-spec.ts → src/product/product-name.util.ts
- `createProductFixture()` --indirect_call--> `toProductNameValue()`  [INFERRED]
  test/product-fixture.ts → src/product/product-name.util.ts
- `pendingCount()` --indirect_call--> `productId()`  [INFERRED]
  test/grocery-add-duplicate.e2e-spec.ts → src/product/types/product-search.spec.ts
- `createItem()` --indirect_call--> `productId()`  [INFERRED]
  test/grocery-remove.e2e-spec.ts → src/product/types/product-search.spec.ts

## Import Cycles
- None detected.

## Communities (365 total, 32 thin omitted)

### Community 0 - "managedFiles"
Cohesion: 0.03
Nodes (63): managedFiles, .agents/skills/adopt/SKILL.md, .agents/skills/audit/reference/independent-review.md, .agents/skills/audit/SKILL.md, .agents/skills/autopilot/SKILL.md, .agents/skills/brief/SKILL.md, .agents/skills/browser-tests/SKILL.md, .agents/skills/check/SKILL.md (+55 more)

### Community 1 - "RecordPurchasesDto"
Cohesion: 0.08
Nodes (30): ArrayMaxSize, PURCHASE_EVENT_TYPES, RecordPurchaseBatchItemDto, RecordPurchasesDto, RecordPurchasesShapeConstraint, validateDto(), ArrayMinSize, ArrayUnique (+22 more)

### Community 2 - "product.service.ts"
Cohesion: 0.10
Nodes (24): OpenAiLlmProvider, parsedResult, request, Injectable, LlmGenerationResult, LlmRefusal, LlmResultMetadata, LlmSuccess (+16 more)

### Community 3 - "hermes/home-stock-tracker/manifest.json"
Cohesion: 0.14
Nodes (13): platform, rollback, guidance, strategy, schemaVersion, service, name, version (+5 more)

### Community 4 - "devDependencies"
Cohesion: 0.04
Nodes (49): eslint, eslint-config-prettier, @eslint/eslintrc, @eslint/js, eslint-plugin-prettier, globals, jest, @nestjs/cli (+41 more)

### Community 5 - "product-resolution.ts"
Cohesion: 0.06
Nodes (35): ProductResolutionRequiredResult, ProductSearchProductResponseDto, ProductResolutionLogService, Injectable, ProductResolutionService, candidate(), candidateForContextBytes(), Inject (+27 more)

### Community 6 - "PrismaService"
Cohesion: 0.07
Nodes (20): AppModule, Module, ServiceAuthGuard, Injectable, EXPIRATION_ELIGIBLE_EVENT_TYPES, PrismaService, Injectable, AUTH_TEST_BYPASS (+12 more)

### Community 7 - "8. Deployment - Where and how will this ship?"
Cohesion: 0.05
Nodes (39): 1. Problem - What problem are we solving?, 2. Users - Who is this for?, 3. Features - What does the MVP need?, 4. Data - What are we storing?, 5. Tech - What stack are we using?, 6. Monetize - How will this make money?, 7. UI/UX - How should this look and feel?, 8. Deployment - Where and how will this ship? (+31 more)

### Community 8 - "LlmProvider"
Cohesion: 0.07
Nodes (15): candidate, Inject, LLM_PROVIDER, LlmProvider, LlmProviderRegistry, Injectable, confirmNew(), postNew() (+7 more)

### Community 9 - "features"
Cohesion: 0.09
Nodes (22): features, batch-purchase-recording, expiration-batch-recording, grocery-catalog-confirmation, grocery-list, grocery-purchase-completion, grocery-remove, grocery-update (+14 more)

### Community 10 - "Feature: Fail-closed store-skill scaffold"
Cohesion: 0.13
Nodes (14): Adapter result, Build loop, Build steps, Data / contracts, `data/preferences.json`, Feature: Fail-closed store-skill scaffold, Files / areas, Generator CLI (+6 more)

### Community 11 - "mcp-server.factory.ts"
Cohesion: 0.04
Nodes (46): batchPurchaseItemInputSchema, completeGroceryPurchaseInputSchema, completeGroceryPurchaseItemInputSchema, completeGroceryPurchaseOutputSchema, concretePredictedStateSchema, deterministicSignalsOutputSchema, eventMeasurementsSchema, expirationBatchInputSchema (+38 more)

### Community 12 - "RecordPurchaseDto"
Cohesion: 0.14
Nodes (13): PURCHASE_EVENT_TYPES, RecordPurchaseDto, IsIn, IsISO8601, IsNotEmpty, IsNumber, IsObject, IsOptional (+5 more)

### Community 13 - "PolicyAwareAddGroceryItemDto"
Cohesion: 0.16
Nodes (17): IsBoolean, GroceryAdditionItemDto, GroceryAdditionProductDto, PolicyAwareAddGroceryItemDto, IsArray, IsDefined, IsEnum, IsNotEmpty (+9 more)

### Community 14 - "Build a store-specific grocery cart skill"
Cohesion: 0.06
Nodes (32): Before use, Generate a starter, Online grocery store integration scaffold, Relationship to Home Stock Tracker, What it provides, `cart`, Common result states, DOM rules (+24 more)

### Community 15 - "ProductService"
Cohesion: 0.25
Nodes (4): productNameConflict(), ProductService, Injectable, ProductWithNames

### Community 16 - "Model Queries"
Cohesion: 0.07
Nodes (27): aggregate, Aggregation Operations, Atomic operations, count, create, Create Operations, createMany, createManyAndReturn (+19 more)

### Community 17 - "Driver Adapters"
Cohesion: 0.07
Nodes (27): Accept self-signed certificates, After (v7), Available Adapters, Before (v6), Configuration, Connection Pool Configuration, Driver Adapters, Installation (+19 more)

### Community 18 - "app.module.ts"
Cohesion: 0.16
Nodes (22): EstimationModule, Module, GroceryModule, Module, HouseholdModule, Module, InventoryModule, Module (+14 more)

### Community 19 - "health.controller.ts"
Cohesion: 0.13
Nodes (14): IS_PUBLIC_ROUTE, Public(), HealthResponseDto, ReadinessResponseDto, HealthController, ProtectedController, Controller, Get (+6 more)

### Community 20 - "generate-agent-skills.mjs"
Cohesion: 0.19
Nodes (17): renderScenarioTable(), checkBundles(), generatedBundles(), generatedReleaseArtifacts(), platforms, projectRootArgument, readSource(), releaseContract (+9 more)

### Community 21 - "Upgrade to Prisma ORM 7"
Cohesion: 0.08
Nodes (25): 1. Update package.json for ESM-first projects, 2. Update tsconfig.json, 3. Update schema.prisma, 4. Create prisma.config.ts, 5. Install a driver adapter (SQL providers only), 6. Update client instantiation, 7. Replace Prisma.validator with satisfies, 8. Run migrations and generate (+17 more)

### Community 22 - "GroceryService"
Cohesion: 0.17
Nodes (11): GroceryController, Body, Controller, Post, GroceryService, Injectable, GroceryCatalogConfirmationResult, GroceryAdditionItemInput (+3 more)

### Community 23 - "What You Must Do When Invoked"
Cohesion: 0.08
Nodes (24): For /graphify add and --watch, For /graphify query, For the commit hook and native AGENTS.md integration, For --update and --cluster-only, /graphify, Honesty Rules, Interpreter guard for subcommands, Part A - Structural extraction for code files (+16 more)

### Community 24 - "What You Must Do When Invoked"
Cohesion: 0.08
Nodes (24): For /graphify add and --watch, For /graphify query, For the commit hook and native CLAUDE.md integration, For --update and --cluster-only, /graphify, Honesty Rules, Interpreter guard for subcommands, Part A - Structural extraction for code files (+16 more)

### Community 25 - "What You Must Do When Invoked"
Cohesion: 0.08
Nodes (24): For /graphify add and --watch, For /graphify query, For the commit hook and native CLAUDE.md integration, For --update and --cluster-only, /graphify, Honesty Rules, Interpreter guard for subcommands, Part A - Structural extraction for code files (+16 more)

### Community 26 - "operational-logger.service.ts"
Cohesion: 0.12
Nodes (14): CatalogIntegrityAction, CatalogIntegrityLog, IntegrationErrorType, InventoryAction, InventoryActionLog, LlmIntegrationLog, McpIntegrationLog, OperationalEvent (+6 more)

### Community 27 - "Relation Queries"
Cohesion: 0.08
Nodes (23): Connect existing, Count Relations, Create or connect, Create with relations, Delete related, Disconnect, every, Filter counted relations (+15 more)

### Community 28 - "Removed Features"
Cohesion: 0.08
Nodes (23): Alternatives, Auto-generate after migrate, Auto-seed after migrate, Automatic Behaviors Removed, CLI Flags Removed, Client Middleware, Common Middleware Patterns, Custom counter with extensions (+15 more)

### Community 29 - "low-stock-recommendation.service.ts"
Cohesion: 0.17
Nodes (11): LowStockRecommendationDto, LowStockRecommendationListResponseDto, LowStockRecommendationService, Injectable, compareRecommendations(), LowStockRecommendation, LowStockState, qualifies() (+3 more)

### Community 30 - "compilerOptions"
Cohesion: 0.09
Nodes (22): compilerOptions, allowSyntheticDefaultImports, baseUrl, declaration, emitDecoratorMetadata, esModuleInterop, experimentalDecorators, forceConsistentCasingInFileNames (+14 more)

### Community 31 - "Prisma CLI Reference"
Cohesion: 0.09
Nodes (21): AI Safety Checkpoint, Boundary: Platform and Compute, Bun Runtime, Client Generation, Command Categories, Current Command Behavior, Current Prisma CLI Setup, Database Operations (+13 more)

### Community 32 - "Raw Queries"
Cohesion: 0.09
Nodes (21): BigInt handling, Database-Specific Features, Date handling, Delete example, Dynamic table/column names, $executeRaw, Handling Results, Insert example (+13 more)

### Community 33 - "Troubleshooting Prisma Compute"
Cohesion: 0.09
Nodes (22): Accidental Prisma Postgres Provisioning, Auth Fails, Bun Entrypoint Missing, Compute Config Invalid, `create-prisma --yes` Did Not Deploy, Database Wiring or Schema Did Not Apply, Env Changes Did Not Apply, First Checks (+14 more)

### Community 34 - "stock-mutation.ts"
Cohesion: 0.10
Nodes (21): validateDto(), StockMutationShapeConstraint, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString (+13 more)

### Community 35 - "Client Methods"
Cohesion: 0.10
Nodes (18): Add custom methods, Add model methods, Chain extensions, Client Methods, $connect(), $disconnect(), $extends(), Graceful shutdown (+10 more)

### Community 36 - "Filter Conditions and Operators"
Cohesion: 0.10
Nodes (20): AND (explicit), AND (implicit), Array Field Filters, Combined, Comparison, Equality, every, Filter Conditions and Operators (+12 more)

### Community 37 - "Query Options"
Cohesion: 0.10
Nodes (20): cursor, distinct, Filtered include, include, Include relation count, Multiple distinct fields, Negative take (reverse), Nested include (+12 more)

### Community 38 - "dependencies"
Cohesion: 0.08
Nodes (25): class-transformer, class-validator, cron, dotenv, @modelcontextprotocol/sdk, @nestjs/common, @nestjs/core, @nestjs/mapped-types (+17 more)

### Community 39 - "statistics.service.ts"
Cohesion: 0.11
Nodes (12): MS_PER_DAY, StatisticsResponseDto, StatisticsController, Controller, HttpCode, Param, Post, NEED_EVENT_TYPES (+4 more)

### Community 40 - "AddGroceryItemDto"
Cohesion: 0.11
Nodes (16): AddGroceryItemDto, PendingGroceryItemPolicy, create_separate, return_existing, IsEnum, IsNotEmpty, IsNumber, IsOptional (+8 more)

### Community 41 - "prisma db push"
Cohesion: 0.10
Nodes (19): Accept data loss, Basic push, Command, Common Patterns, Comparison with migrate dev, Examples, Follow-up Command, Force reset (+11 more)

### Community 42 - "prisma dev"
Cohesion: 0.10
Nodes (19): Background mode, Command, Configuration, Custom ports, Examples, Force remove (stops first), Instance Management, List all instances (+11 more)

### Community 43 - "prisma generate"
Cohesion: 0.10
Nodes (19): After schema changes, Basic generation, Bun Runtime, CI/CD pipeline, Command, Common Patterns, Compiler Build Tuning, Current Generator Behavior (+11 more)

### Community 44 - "prisma studio"
Cohesion: 0.10
Nodes (19): Command, Common Workflow, Custom port, Don't open browser, Edit Records, Examples, Features, Filter Data (+11 more)

### Community 45 - "Prisma Client API Reference"
Cohesion: 0.10
Nodes (19): Client Instantiation, Client Methods, Create records, Delete records, Filter Operators, Find records, How to Use, Model Query Methods (+11 more)

### Community 46 - "Prisma Config"
Cohesion: 0.10
Nodes (19): After (v7) - prisma.config.ts, Basic Configuration, Before (v6) - schema.prisma, Configuration Options, Custom Config Path, datasource.directUrl, datasource.shadowDatabaseUrl, datasource.url (+11 more)

### Community 47 - "daily-stock-workflow.service.ts"
Cohesion: 0.15
Nodes (10): DailyStockMaterializationService, EXPLICIT_STATES, Injectable, DailyStockWorkflowService, Injectable, ShelfLifeInferenceService, Injectable, DailyStockWorkflowSummary (+2 more)

### Community 48 - "prisma migrate dev"
Cohesion: 0.11
Nodes (18): After schema changes, Command, Common Patterns, Create and apply migration, Create without applying, Examples, Follow-up Commands, Full workflow (+10 more)

### Community 49 - "Data model"
Cohesion: 0.10
Nodes (20): Data model, Deployment, Features, GroceryListItem, Home Stock Tracker - Project Overview, Household, InventoryEvent, LlmInferenceLog (+12 more)

### Community 50 - "requiredTools"
Cohesion: 0.10
Nodes (21): complete_grocery_purchase, get_household_context, get_inventory, get_low_stock_predictions, get_product, grocery-add, grocery_confirm_new_product, grocery_confirm_product_alias (+13 more)

### Community 51 - "normalizeProductName"
Cohesion: 0.11
Nodes (21): normalizeAliases(), normalizeProductDisplayName(), normalizeProductName(), toProductNameValue(), PreparedProductNames, PRODUCT_NAME_KINDS, ProductNameContract, ProductNameKind (+13 more)

### Community 52 - "prisma db seed"
Cohesion: 0.11
Nodes (17): Best Practices, Command, Common Patterns, Common seed commands, Conditional seeding, Configuration, Current Workflow, Development reset (+9 more)

### Community 53 - "Environment Variables"
Cohesion: 0.11
Nodes (17): 1. Install dotenv, 2. Import in prisma.config.ts, Application Code, Bun Users, CI/CD Considerations, Entry point, Environment Variables, Multiple .env Files (+9 more)

### Community 54 - "product-search.service.ts"
Cohesion: 0.22
Nodes (3): RankedProductId, createFixture(), FixtureProduct

### Community 55 - "openclaw/home-stock-tracker/manifest.json"
Cohesion: 0.14
Nodes (13): platform, rollback, guidance, strategy, schemaVersion, service, name, version (+5 more)

### Community 56 - "prisma db pull"
Cohesion: 0.12
Nodes (16): Basic introspection, Command, Examples, Force overwrite, Generated Schema Example, MongoDB Introspection, Options, Post-Introspection Cleanup (+8 more)

### Community 57 - "prisma init"
Cohesion: 0.12
Nodes (16): Add an example model, Basic initialization, Bun Runtime, Command, Examples, Generated Config (Bun), Generated Config (Node.js default), Generated Schema (+8 more)

### Community 58 - "prisma migrate deploy"
Cohesion: 0.12
Nodes (16): Basic deployment, Best Practices, Check status first, Command, Comparison with migrate dev, Configuration, Docker deployment, Error Handling (+8 more)

### Community 59 - "Constructor Options"
Cohesion: 0.12
Nodes (16): accelerateUrl (For Accelerate users), adapter (Required for the SQL provider workflow), Basic Instantiation, comments, Constructor Options, errorFormat, log, Log Events (+8 more)

### Community 60 - "Prisma Database Setup"
Cohesion: 0.12
Nodes (16): Bun Runtime, Configuration Files, Driver Adapters, How to Use, MongoDB, MySQL, PostgreSQL, Prisma Client Setup (Required) (+8 more)

### Community 61 - "Prisma Accelerate Users"
Cohesion: 0.12
Nodes (16): 1. Keep your Accelerate URL, 2. Install Accelerate extension, 3. Configure prisma.config.ts, 4. Instantiate client with accelerateUrl, Caching with Accelerate, Correct v7 Setup for Accelerate, Edge Runtime, Important (+8 more)

### Community 62 - "ESM and CommonJS Support"
Cohesion: 0.12
Nodes (16): Browser-Safe Types, Bun, "Cannot use import statement outside a module", CommonJS Projects, "ERR_REQUIRE_ESM", ESM and CommonJS Support, ESM Projects, File Extensions (+8 more)

### Community 63 - "Feature: Stock mutation and batch purchase APIs"
Cohesion: 0.11
Nodes (17): Backward-compatible purchases route, Build loop, Build steps, Completion record, Data / contracts, Feature: Stock mutation and batch purchase APIs, Files / areas, Goal (+9 more)

### Community 64 - "ConfirmProductAliasGroceryItemDto"
Cohesion: 0.16
Nodes (14): ConfirmedGroceryItemDto, ConfirmNewProductGroceryItemDto, ConfirmProductAliasGroceryItemDto, product, IsDefined, IsNotEmpty, IsNumber, IsOptional (+6 more)

### Community 65 - "SearchProductsQueryDto"
Cohesion: 0.12
Nodes (14): ProductSearchQueryLengthConstraint, SearchProductsQueryDto, transform(), validateQuery(), IsInt, IsNotEmpty, IsOptional, IsString (+6 more)

### Community 66 - "ExpirationBatchService"
Cohesion: 0.28
Nodes (5): ExpirationBatchService, Injectable, expiresAtSchema, parseExpirationTimestamp(), RecordExpirationBatchInput

### Community 67 - "Schema Changes"
Cohesion: 0.12
Nodes (15): 1. Provider name, 2. Output is required, 3. engineType changed, 4. moduleFormat is explicit when needed, After Schema Changes, Datasource Block, Example Output Paths, Generated Entrypoints (+7 more)

### Community 68 - "InventoryService"
Cohesion: 0.18
Nodes (4): InventoryService, Injectable, CompleteGroceryPurchaseInput, CompleteGroceryPurchaseItemInput

### Community 69 - "Feature: Inventory state estimation"
Cohesion: 0.12
Nodes (15): API contract: GET /inventory/estimate/:productId, Build loop, Build steps, Data / contracts, Design reference, EstimationResult type (internal), Feature: Inventory state estimation, Files / areas (+7 more)

### Community 70 - "Feature: Consumption pattern learning"
Cohesion: 0.12
Nodes (15): API contract: POST /inventory/statistics/:productId/calculate, Build loop, Build steps, Data / contracts, Design reference, Feature: Consumption pattern learning, Files / areas, Goal (+7 more)

### Community 71 - "Feature: LLM-assisted product understanding"
Cohesion: 0.12
Nodes (15): Build loop, Build steps, Changed areas, Completion record, Data / contracts, Delivered, Deviations, Feature: LLM-assisted product understanding (+7 more)

### Community 72 - "Feature: Product name namespace"
Cohesion: 0.12
Nodes (15): Build loop, Build steps, Completion record, Conflict response, Data / contracts, Feature: Product name namespace, Files / areas, Goal (+7 more)

### Community 73 - "Feature: Grocery quantity contract"
Cohesion: 0.12
Nodes (15): Build loop, Build steps, Completion record, Data / contracts, Domain and concurrency rules, Feature: Grocery quantity contract, Files / areas, Goal (+7 more)

### Community 74 - "Grocery conversation workflows"
Cohesion: 0.09
Nodes (22): Add one item and handle an existing line, Add several items, Complete a shopping trip, Event mapping, Examples, Grocery conversation workflows, Home Stock Tracker, Household context (+14 more)

### Community 75 - "scripts"
Cohesion: 0.10
Nodes (21): scripts, agent:probe, build, contract:capture, contract:check, db:migrate:deploy, format, lint (+13 more)

### Community 76 - "grocery-quantity-migration.e2e-spec.ts"
Cohesion: 0.15
Nodes (10): applyMigration(), applyMigrations(), expectQuantityConstraint(), expectQuantityContract(), migrationNames, MIGRATIONS_DIRECTORY, previousMigrations, quantityMigrationIndex (+2 more)

### Community 77 - "continuous - complete the build plan one local feature at a time"
Cohesion: 0.13
Nodes (14): 2.1 Select and spec, 2.2 Create or resume the feature branch, 2.3 Implement small steps, 2.4 Apply Continuous quality gates, 2.5 Repair and re-review findings, 2.6 Complete locally like a human, continuous - complete the build plan one local feature at a time, Formatting (+6 more)

### Community 78 - "Transactions"
Cohesion: 0.13
Nodes (14): All or nothing, Best Practices, Handle errors, Interactive Transactions, Isolation levels, Keep transactions short, Nested Writes, OrThrow in Transactions (+6 more)

### Community 79 - "Workflow"
Cohesion: 0.13
Nodes (14): Error Handling, Prerequisites, Prisma Postgres Setup, Reference Files, Step 1: Authenticate, Step 2: List available regions, Step 3: Create a project with a database, Step 4: Create a named connection (optional) (+6 more)

### Community 80 - "estimation.service.ts"
Cohesion: 0.07
Nodes (31): EstimationService, HouseholdPredictionContext, HybridReasoningResult, LearnedStatistics, PRODUCT_TYPE_THRESHOLDS, ProductPredictionContext, RELEVANT_EVENT_TYPES, Injectable (+23 more)

### Community 81 - "generate-store-skill.mjs"
Cohesion: 0.20
Nodes (21): adapterContractPath, createScaffoldPlan(), EXPECTED_OPTIONS, fail(), GENERATED_FILES, generateScaffold(), parseArguments(), pathIsInside() (+13 more)

### Community 82 - "UpdateGroceryItemDto"
Cohesion: 0.14
Nodes (10): IsDefined, IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString, Transform, ValidateIf (+2 more)

### Community 84 - "product-search.ts"
Cohesion: 0.09
Nodes (26): compareProductSearchMatches(), compareUtf8(), getMatchCategory(), isTokenPrefixMatch(), MATCH_RANK, matchProductName(), PRODUCT_SEARCH_DEFAULT_LIMIT, PRODUCT_SEARCH_MATCH_CATEGORIES (+18 more)

### Community 85 - "inventory-read-response.dto.ts"
Cohesion: 0.11
Nodes (16): DeterministicSignalsDto, DISCRETE_UNITS, emptyDeterministicSignals(), HouseholdInventoryResponseDto, InventoryEstimateResponseDto, InventoryItemResponseDto, InventoryReadEntity, InventoryReadProjection (+8 more)

### Community 86 - "Feature: Confirmed grocery catalog decisions"
Cohesion: 0.13
Nodes (14): 31/F-01 [P2] closed - Confirmed-name validation issues one query per approved name, 31/F-02 [P2] closed - Grocery API reference still describes delivered flows as future or impossible, Build loop, Build steps, Completion record, Data / contracts, Feature: Confirmed grocery catalog decisions, Files / areas (+6 more)

### Community 87 - "continuous - complete the build plan one local feature at a time"
Cohesion: 0.13
Nodes (14): 2.1 Select and spec, 2.2 Create or resume the feature branch, 2.3 Implement small steps, 2.4 Apply Continuous quality gates, 2.5 Repair and re-review findings, 2.6 Complete locally like a human, continuous - complete the build plan one local feature at a time, Formatting (+6 more)

### Community 88 - "Agent Integrations"
Cohesion: 0.13
Nodes (15): Agent Integrations, Confirming unknown products while setting stock, Install the instruction skill, Integration troubleshooting, Online grocery store skills, OpenClaw, Other MCP clients, Register and probe MCP (+7 more)

### Community 89 - "Home Stock Tracker"
Cohesion: 0.09
Nodes (21): Add one item and handle an existing line, Add several items, Complete a shopping trip, Event mapping, Examples, Grocery conversation workflows, Home Stock Tracker, Household context (+13 more)

### Community 90 - "Home Stock Tracker"
Cohesion: 0.09
Nodes (21): Add one item and handle an existing line, Add several items, Complete a shopping trip, Event mapping, Examples, Grocery conversation workflows, Home Stock Tracker, Household context (+13 more)

### Community 91 - "ServiceAuthConfigService"
Cohesion: 0.18
Nodes (4): ServiceAuthConfigService, Injectable, ServiceAuthModule, Module

### Community 92 - "InventoryController"
Cohesion: 0.16
Nodes (12): ExpirationBatchResponseDto, RecordExpirationBatchDto, IsISO8601, IsNotEmpty, IsString, Matches, InventoryController, Body (+4 more)

### Community 93 - "Prisma Compute Framework Readiness"
Cohesion: 0.14
Nodes (14): Astro, Bun, Elysia, and Plain Source Servers, CLI-First Model, CLI Matrix, Custom Build Artifacts, Hono, NestJS, Next.js (+6 more)

### Community 94 - "MongoDB Setup"
Cohesion: 0.14
Nodes (13): 1. Schema Configuration, 2. Environment Variable, Common Issues, Current Verification Notes, Driver Adapters, ID Field Requirement, "Invalid ObjectID", Migrations vs Introspection (+5 more)

### Community 95 - "Prisma SQL Driver Adapter Implementation"
Cohesion: 0.14
Nodes (13): Commit and rollback, Contract snapshot, Error mapping, Factory, ownership, and shadow database, Priority rules, Prisma SQL Driver Adapter Implementation, Query implementation, Result mapping (+5 more)

### Community 96 - "Core Workflows"
Cohesion: 0.14
Nodes (13): 1. Console-first workflow, 2. Quick provisioning with create-db, 2b. Persistent databases with the Platform CLI, 3. Link an existing local project, 4. Programmatic provisioning with Management API, 5. Type-safe integration with Management API SDK, Core Workflows, How to Use (+5 more)

### Community 97 - "Fix: MCP-05 standalone alias administration"
Cohesion: 0.18
Nodes (11): Build loop, Build steps, Completion record, Data / contracts, Files / areas, Fix: MCP-05 standalone alias administration, Goal, In scope (+3 more)

### Community 98 - "product.controller.ts"
Cohesion: 0.12
Nodes (17): AddProductAliasDto, IsNotEmpty, IsString, Transform, CreateProductDto, IsArray, IsNotEmpty, IsOptional (+9 more)

### Community 99 - "inventory.service.ts"
Cohesion: 0.19
Nodes (14): CompletedItemDto, CompletePartialPurchaseResponseDto, PendingItemDto, SkippedItemDto, CompletePurchaseResponseDto, InventoryEventListResponseDto, InventoryEventResponseDto, RecordPurchasesResponseDto (+6 more)

### Community 100 - "Feature: Stock ledger foundation"
Cohesion: 0.14
Nodes (13): Build loop, Build steps, Data / contracts, Existing write semantics, Feature: Stock ledger foundation, Files / areas, Goal, In scope (+5 more)

### Community 101 - "Feature: Household profile"
Cohesion: 0.14
Nodes (13): Build loop, Build steps, Data / contracts, Design reference, Feature: Household profile, Files / areas, Goal, Household model (Prisma) (+5 more)

### Community 102 - "Fix: MCP-09 purchase completion loses actual quantity details"
Cohesion: 0.15
Nodes (12): Build loop, Build steps, Completion record, Data / contracts, Files / areas, Fix: MCP-09 purchase completion loses actual quantity details, Goal, In scope (+4 more)

### Community 103 - "Operations Guide"
Cohesion: 0.14
Nodes (14): A product is not found, Current limitations, Database lifecycle, Environment variables, Health and readiness, OpenAI is unavailable, Operations Guide, Predictions and recommendations (+6 more)

### Community 104 - "autopilot - optional Blueprint loop"
Cohesion: 0.14
Nodes (13): autopilot - optional Blueprint loop, Formatting, Hard Stops, Input, Rules, Step 1 - preflight like /status, Step 2 - choose or write the spec, Step 3 - create or reuse the branch (+5 more)

### Community 105 - "onboard - finish the Blueprint overlay setup"
Cohesion: 0.15
Nodes (12): Formatting, Input, onboard - finish the Blueprint overlay setup, Rules, Step 0 - confirm this is onboarding, not adoption, Step 1 - survey the project facts, Step 2 - update project entry files, Step 3 - tune coding standards (+4 more)

### Community 106 - "prisma db execute"
Cohesion: 0.15
Nodes (12): Command, Configuration, Current Option Surface, Examples, Execute from file, Execute from stdin, Execute `migrate diff` output, Limitations (+4 more)

### Community 107 - "Prisma Platform CLI App Deploy"
Cohesion: 0.15
Nodes (13): Agent Skill Installation, Auth and Project Binding, Build and Run Locally, Database and Env, Deploy, Deployment Story: GitHub vs CLI, Operations, Output Handling (+5 more)

### Community 108 - "MySQL Setup"
Cohesion: 0.15
Nodes (12): 1. Schema Configuration, 2. Config Configuration, 3. Environment Variable, Common Issues, Connection String Format, Driver Adapter, JSON Support, MySQL Setup (+4 more)

### Community 109 - "management-api"
Cohesion: 0.15
Nodes (12): API exploration, Authentication methods, Base URL, Current resource inventory, management-api, Notes, OAuth flow summary, Priority (+4 more)

### Community 110 - "Fix: MCP-10 read-only household context"
Cohesion: 0.14
Nodes (14): Build loop, Build steps, Completion record, Data / contracts, Files / areas, Fix: MCP-10 read-only household context, Goal, In scope (+6 more)

### Community 111 - "inventory.service.spec.ts"
Cohesion: 0.12
Nodes (19): PRODUCT_NAMES, StockLedgerException, StockStateConflictException, ProjectionRecord, UpdateArguments, UpsertArguments, StockLedgerService, Injectable (+11 more)

### Community 112 - "application-config.ts"
Cohesion: 0.17
Nodes (18): ApplicationConfig, DEFAULT_STOCK_WORKFLOW_CRON, DEFAULT_STOCK_WORKFLOW_TIMEZONE, loadApplicationConfig(), loadStockWorkflowConfig(), optionalTrimmed(), parseBoolean(), parsePort() (+10 more)

### Community 113 - "Feature: Daily stock estimation workflow"
Cohesion: 0.18
Nodes (10): Build loop, Build steps, Data / contracts, Feature: Daily stock estimation workflow, Files / areas, Goal, In scope, Notes for the AI (+2 more)

### Community 114 - "GroceryItemResponseDto"
Cohesion: 0.17
Nodes (13): Delete, GroceryItemResponseDto, SetGroceryItemQuantityDto, IsDefined, IsNumber, IsPositive, Param, Patch (+5 more)

### Community 115 - "Coding Standards"
Cohesion: 0.15
Nodes (12): API and Data, Browser Verification, Code Quality, Coding Standards, Comments, Error Handling, File Organization, Naming (+4 more)

### Community 116 - "prediction-feedback.mcp.e2e-spec.ts"
Cohesion: 0.25
Nodes (7): productId(), pendingCount(), createItem(), createItem(), createItem(), storedFeedbackStatus(), unchangedPendingPrediction()

### Community 117 - "browser-tests - set up repeatable browser verification"
Cohesion: 0.20
Nodes (9): browser-tests - set up repeatable browser verification, Input, Integration contract, Step 1 - inspect the project, Step 2 - choose the smallest useful harness, Step 3 - present the setup, Step 4 - create or normalize the harness, Step 5 - verify the path (+1 more)

### Community 118 - "browser-tests - set up repeatable browser verification"
Cohesion: 0.20
Nodes (9): browser-tests - set up repeatable browser verification, Input, Integration contract, Step 1 - inspect the project, Step 2 - choose the smallest useful harness, Step 3 - present the setup, Step 4 - create or normalize the harness, Step 5 - verify the path (+1 more)

### Community 119 - "Feature 3: Inventory event tracking"
Cohesion: 0.15
Nodes (12): API contracts, Build steps, Data model and contracts, Feature 3: Inventory event tracking, Files and areas, In scope, InventoryEvent (model), InventoryEventType (enum) (+4 more)

### Community 120 - "Feature: Complete grocery items from a purchase"
Cohesion: 0.15
Nodes (12): Build loop, Build steps, Data / contracts, Feature: Complete grocery items from a purchase, Files / areas, Goal, In scope, Notes for the AI (+4 more)

### Community 121 - "Feature: Policy-aware grocery additions"
Cohesion: 0.14
Nodes (13): 30/F-01 [P1] closed - Legacy grocery add still permits implicit product creation, Acceptance criteria, Build loop, Build steps, Completion record, Feature: Policy-aware grocery additions, Files / areas, Findings (+5 more)

### Community 122 - "Feature: Partial grocery-list completion"
Cohesion: 0.15
Nodes (12): Build loop, Build steps, Data / contracts, Feature: Partial grocery-list completion, Files / areas, Goal, In scope, Notes for the AI (+4 more)

### Community 123 - "Fix: MCP-07 prediction feedback tool"
Cohesion: 0.15
Nodes (12): Build loop, Build steps, Completion record, Data / contracts, Files / areas, Fix: MCP-07 prediction feedback tool, Goal, In scope (+4 more)

### Community 124 - "autopilot - optional Blueprint loop"
Cohesion: 0.14
Nodes (13): autopilot - optional Blueprint loop, Formatting, Hard Stops, Input, Rules, Step 1 - preflight like /status, Step 2 - choose or write the spec, Step 3 - create or reuse the branch (+5 more)

### Community 125 - "onboard - finish the Blueprint overlay setup"
Cohesion: 0.15
Nodes (12): Formatting, Input, onboard - finish the Blueprint overlay setup, Rules, Step 0 - confirm this is onboarding, not adoption, Step 1 - survey the project facts, Step 2 - update project entry files, Step 3 - tune coding standards (+4 more)

### Community 126 - "HomeStockTrackerConfigFlow"
Cohesion: 0.21
Nodes (11): ConfigFlow, ConfigFlowResult, async_validate_connection(), HomeStockTrackerConfigFlow, Any, HomeAssistant, Start reauthentication for an existing config entry., Replace a rejected API token. (+3 more)

### Community 127 - "CompletePurchaseDto"
Cohesion: 0.18
Nodes (11): ArrayNotEmpty, CompletePurchaseDto, ArrayUnique, IsArray, IsNotEmpty, IsNumber, IsObject, IsOptional (+3 more)

### Community 128 - "adopt - bootstrap the blueprint from an existing codebase"
Cohesion: 0.17
Nodes (11): adopt - bootstrap the blueprint from an existing codebase, Formatting, Input, Rules, Step 0 - confirm it's brownfield and safe, Step 1 - survey the codebase (read-only), Step 2 - interview for intent, Step 3 - generate the inputs (+3 more)

### Community 129 - "Feature: <name>"
Cohesion: 0.17
Nodes (11): Build loop, Build steps, Data / contracts, Design reference, Feature: <name>, Files / areas, Goal, In scope (+3 more)

### Community 130 - "<Project Name> - Project Overview"
Cohesion: 0.17
Nodes (11): Data model, Deployment, Features, <Model>, Monetization, Open questions, Problem, <Project Name> - Project Overview (+3 more)

### Community 131 - "prisma migrate diff"
Cohesion: 0.17
Nodes (11): Check for drift (CI), Command, Create baseline migration, Examples, Generate SQL for a schema change, Options, prisma migrate diff, Review pending migrations (+3 more)

### Community 132 - "prisma migrate reset"
Cohesion: 0.17
Nodes (11): Basic reset, Command, Configuration, Examples, Follow-up Steps, Force reset (CI/Automation), Options, prisma migrate reset (+3 more)

### Community 133 - "PostgreSQL Setup"
Cohesion: 0.17
Nodes (11): 1. Schema Configuration, 2. Config Configuration, 3. Environment Variable, "Authentication failed", "Can't reach database server", Common Issues, Connection String Format, Driver Adapter (+3 more)

### Community 134 - "Prisma Postgres Setup"
Cohesion: 0.17
Nodes (11): 1. Schema Configuration, 2. Config Configuration, Connection String, Driver Adapter, Edge/serverless option, Features, Overview, Prisma Postgres Setup (+3 more)

### Community 135 - "SQLite Setup"
Cohesion: 0.17
Nodes (11): 1. Schema Configuration, 2. Config Configuration, 3. Environment Variable, Common Issues, Connection String Format, "Database file not found", Driver Adapter, Limitations (+3 more)

### Community 136 - "Rollback: Feature NN - Name"
Cohesion: 0.17
Nodes (11): Build steps, Goal, Later-change risk, Notes for the AI, Out of scope, Preserve, Product paths, Reverse (+3 more)

### Community 137 - "Feature: Agent integration and contract release"
Cohesion: 0.18
Nodes (10): Build loop, Build steps, Data / contracts, Feature: Agent integration and contract release, Files / areas, Goal, In scope, Notes for the AI (+2 more)

### Community 138 - ".listItems"
Cohesion: 0.29
Nodes (5): ListGroceryItemsDto, IsEnum, IsOptional, Get, Query

### Community 139 - "stock-product-confirmation.service.ts"
Cohesion: 0.24
Nodes (9): TransportSource, StockProductConfirmationResponse, StockProductConfirmationService, Injectable, assertCompatibleStockProduct(), encodeConfirmationPayload(), StockConfirmationPayload, StockProductConfirmationInput (+1 more)

### Community 140 - "Independent review record"
Cohesion: 0.33
Nodes (5): Completed receipt, Freshness, Independent review record, Pending request, Reset stub

### Community 141 - "Independent review record"
Cohesion: 0.33
Nodes (5): Completed receipt, Freshness, Independent review record, Pending request, Reset stub

### Community 142 - "Fix: Confirmed product creation during absolute stock updates"
Cohesion: 0.11
Nodes (17): Agent workflow and compatibility release, Autopilot review packet, Build loop, Build steps, Data / contracts, Durable receipt and transaction, Files / areas, Fix: Confirmed product creation during absolute stock updates (+9 more)

### Community 143 - "inventory/stock-materialization.ts"
Cohesion: 0.19
Nodes (17): assertDailyInput(), assertValidInput(), assertValidShelfLifePolicy(), evidenceConfidence(), fallbackReason(), isExpired(), materializeDailyStock(), materializeStockForward() (+9 more)

### Community 144 - "McpServerFactory"
Cohesion: 0.34
Nodes (3): mcpGroceryAddition(), McpServerFactory, Injectable

### Community 145 - "Feature: Hybrid low-stock prediction"
Cohesion: 0.17
Nodes (11): Build loop, Build steps, Completion record, Data / contracts, Feature: Hybrid low-stock prediction, Files / areas, Goal, In scope (+3 more)

### Community 146 - "Feature: Prediction feedback"
Cohesion: 0.17
Nodes (11): Build loop, Build steps, Completion record, Data / contracts, Feature: Prediction feedback, Files / areas, Goal, In scope (+3 more)

### Community 147 - "Feature: Low-stock recommendations"
Cohesion: 0.17
Nodes (11): Build loop, Build steps, Completion record, Data / contracts, Feature: Low-stock recommendations, Files / areas, Goal, In scope (+3 more)

### Community 148 - "Feature: MCP tool interface"
Cohesion: 0.17
Nodes (11): Build loop, Build steps, Completion record, Data / contracts, Feature: MCP tool interface, Files / areas, Goal, In scope (+3 more)

### Community 149 - "Feature: Hermes inventory skill"
Cohesion: 0.17
Nodes (11): Build loop, Build steps, Completion record, Data / contracts, Feature: Hermes inventory skill, Files / areas, Goal, In scope (+3 more)

### Community 150 - "Feature: Hermes grocery conversations"
Cohesion: 0.17
Nodes (11): Build loop, Build steps, Completion record, Data / contracts, Feature: Hermes grocery conversations, Files / areas, Goal, In scope (+3 more)

### Community 151 - "Feature: Proactive stock checks"
Cohesion: 0.17
Nodes (11): Build loop, Build steps, Completion record, Data / contracts, Feature: Proactive stock checks, Files / areas, Goal, In scope (+3 more)

### Community 152 - "Feature: Service authentication"
Cohesion: 0.17
Nodes (11): Build loop, Build steps, Completion record, Data / contracts, Feature: Service authentication, Files / areas, Goal, In scope (+3 more)

### Community 153 - "Feature: Operational visibility"
Cohesion: 0.17
Nodes (11): Build loop, Build steps, Completion record, Data / contracts, Feature: Operational visibility, Files / areas, Goal, In scope (+3 more)

### Community 154 - "Feature: Deployment readiness"
Cohesion: 0.17
Nodes (11): Build loop, Build steps, Completion record, Data / contracts, Feature: Deployment readiness, Files / areas, Goal, In scope (+3 more)

### Community 155 - "adopt - bootstrap the blueprint from an existing codebase"
Cohesion: 0.17
Nodes (11): adopt - bootstrap the blueprint from an existing codebase, Formatting, Input, Rules, Step 0 - confirm it's brownfield and safe, Step 1 - survey the codebase (read-only), Step 2 - interview for intent, Step 3 - generate the inputs (+3 more)

### Community 156 - "Feature: <name>"
Cohesion: 0.17
Nodes (11): Build loop, Build steps, Data / contracts, Design reference, Feature: <name>, Files / areas, Goal, In scope (+3 more)

### Community 157 - "<Project Name> - Project Overview"
Cohesion: 0.17
Nodes (11): Data model, Deployment, Features, <Model>, Monetization, Open questions, Problem, <Project Name> - Project Overview (+3 more)

### Community 158 - "Rollback: Feature NN - Name"
Cohesion: 0.17
Nodes (11): Build steps, Goal, Later-change risk, Notes for the AI, Out of scope, Preserve, Product paths, Reverse (+3 more)

### Community 159 - "API and MCP Reference"
Cohesion: 0.17
Nodes (12): API and MCP Reference, Authentication and base URLs, First-use example, Grocery list, Household, Inventory and predictions, MCP server, Products (+4 more)

### Community 160 - "agent-release-contract.mjs"
Cohesion: 0.15
Nodes (19): assertExactKeys(), assertObject(), AUTHENTICATION_KEYS, BUNDLE_KEYS, compareSemver(), loadReleaseContractFile(), MCP_KEYS, NETWORK_KEYS (+11 more)

### Community 161 - "AppService"
Cohesion: 0.27
Nodes (5): AppController, Controller, Get, AppService, Injectable

### Community 162 - "ci - set up automatic GitHub checks"
Cohesion: 0.18
Nodes (10): ci - set up automatic GitHub checks, Formatting, Input, Interaction with other skills, Rules, Step 1 - inspect without changing files, Step 2 - define one Verify command, Step 3 - create or align the workflow (+2 more)

### Community 163 - "feature - turn a build-plan feature into a buildable spec"
Cohesion: 0.18
Nodes (10): feature - turn a build-plan feature into a buildable spec, Formatting, Input, New-feature intake, Rules the spec must follow, Step 1 - pick the target, Step 2 - size it, and split if too big, Step 3 - write the spec (+2 more)

### Community 164 - "SQL Server Setup"
Cohesion: 0.18
Nodes (10): 1. Schema Configuration, 2. Config Configuration, 3. Environment Variable, Common Issues, Connection String Format, Driver Adapter, "Login failed for user", Prerequisites (+2 more)

### Community 165 - "create-db-cli"
Cohesion: 0.18
Nodes (10): Command discovery (`--help`), Commands, Common patterns, create-db-cli, `create` options, Lifecycle and claim flow, Priority, Programmatic usage (library API) (+2 more)

### Community 166 - "api-basics"
Cohesion: 0.18
Nodes (10): api-basics, Base URL, Collection, Error codes by HTTP status, Error Responses, Pagination, Resource ID Prefixes, Response Envelope (+2 more)

### Community 167 - "features"
Cohesion: 0.09
Nodes (22): features, batch-purchase-recording, expiration-batch-recording, grocery-catalog-confirmation, grocery-list, grocery-purchase-completion, grocery-remove, grocery-update (+14 more)

### Community 168 - "agent-scenarios.mjs"
Cohesion: 0.17
Nodes (18): loadReleaseContract(), assertExactKeys(), assertObject(), assertUniqueStrings(), CALL_KEYS, ENUM_KEYS, INVARIANTS, isSafeStockConfirmationReplay() (+10 more)

### Community 169 - "Feature: Grocery list management"
Cohesion: 0.18
Nodes (10): Build loop, Build steps, Data / contracts, Feature: Grocery list management, Files / areas, Goal, In scope, Notes for the AI (+2 more)

### Community 170 - "Feature: Product catalog and normalization"
Cohesion: 0.18
Nodes (10): Build loop, Build steps, Data / contracts, Feature: Product catalog and normalization, Files / areas, Goal, In scope, Notes for the AI (+2 more)

### Community 171 - "Feature: Record purchases and restocks"
Cohesion: 0.18
Nodes (10): Build steps, Data / contracts, Feature: Record purchases and restocks, Files / areas, Goal, In scope, Notes for the AI, Out of scope (+2 more)

### Community 172 - "Fix: MCP-03 direct pending grocery item updates"
Cohesion: 0.17
Nodes (11): Build loop, Build steps, Completion record, Data / contracts, Files / areas, Fix: MCP-03 direct pending grocery item updates, Goal, In scope (+3 more)

### Community 173 - "ci - set up automatic GitHub checks"
Cohesion: 0.18
Nodes (10): ci - set up automatic GitHub checks, Formatting, Input, Interaction with other skills, Rules, Step 1 - inspect without changing files, Step 2 - define one Verify command, Step 3 - create or align the workflow (+2 more)

### Community 174 - "feature - turn a build-plan feature into a buildable spec"
Cohesion: 0.18
Nodes (10): feature - turn a build-plan feature into a buildable spec, Formatting, Input, New-feature intake, Rules the spec must follow, Step 1 - pick the target, Step 2 - size it, and split if too big, Step 3 - write the spec (+2 more)

### Community 175 - "jest"
Cohesion: 0.13
Nodes (15): jest, collectCoverageFrom, coverageDirectory, moduleFileExtensions, moduleNameMapper, rootDir, testEnvironment, testRegex (+7 more)

### Community 176 - "requiredTools"
Cohesion: 0.10
Nodes (21): complete_grocery_purchase, get_household_context, get_inventory, get_low_stock_predictions, get_product, grocery-add, grocery_confirm_new_product, grocery_confirm_product_alias (+13 more)

### Community 177 - "audit - review code quality against the project standards"
Cohesion: 0.15
Nodes (12): audit - review code quality against the project standards, Formatting, Independent mode, Input, Phase A - prepare the handoff, Phase B - perform the review, Rules, Step 1 - gather context (+4 more)

### Community 178 - "debug - find the cause before changing the code"
Cohesion: 0.20
Nodes (9): debug - find the cause before changing the code, Formatting, Input, Rules, Step 1 - establish the boundary, Step 2 - reproduce safely, Step 3 - localize the failure, Step 4 - confirm or narrow (+1 more)

### Community 179 - "prisma format"
Cohesion: 0.20
Nodes (9): Behavior, Command, Examples, Format default schema, Format specific schema, Options, prisma format, Use in Editor (+1 more)

### Community 180 - "prisma migrate resolve"
Cohesion: 0.20
Nodes (9): Command, Examples, Mark as Applied (Baselining), Mark as Rolled Back (Fixing Failures), Options, prisma migrate resolve, References, Use Cases (+1 more)

### Community 181 - "prisma validate"
Cohesion: 0.20
Nodes (9): Command, Common Errors, Examples, Options, prisma validate, Use in CI, Validate default schema, Validate specific schema (+1 more)

### Community 182 - "CockroachDB Setup"
Cohesion: 0.20
Nodes (9): 1. Schema Configuration, 2. Config Configuration, 3. Environment Variable, CockroachDB Setup, Common Issues, Driver Adapter, ID Generation, Prerequisites (+1 more)

### Community 183 - "decision-stay-or-migrate"
Cohesion: 0.20
Nodes (9): Bad, Blocker checks before migrating, decision-stay-or-migrate, Good, Priority, References, Stay-on-v6 hygiene, The facts the decision rests on (+1 more)

### Community 184 - "console-and-connections"
Cohesion: 0.20
Nodes (9): Adapter choices, Connection setup, console-and-connections, Console workflow, Linking an existing project, Local Studio, Priority, References (+1 more)

### Community 185 - "management-api-sdk"
Cohesion: 0.20
Nodes (9): Full SDK (OAuth + refresh), Install, management-api-sdk, OAuth SDK flow, Priority, References, Simple client (existing token), Why It Matters (+1 more)

### Community 186 - "release - deployment readiness for Render and Vercel"
Cohesion: 0.20
Nodes (9): Formatting, Input, release - deployment readiness for Render and Vercel, Rules, Step 1 - read the project, Step 2 - choose the provider shape, Step 3 - verify local readiness, Step 4 - prepare local config (+1 more)

### Community 187 - "rollback - safely reverse a completed feature"
Cohesion: 0.20
Nodes (9): Formatting, Input, rollback - safely reverse a completed feature, Rules, Step 0 - preflight, Step 1 - resolve the exact feature, Step 2 - separate product changes from Blueprint history, Step 3 - review later-change risk (+1 more)

### Community 188 - "tests - add unit testing to the project"
Cohesion: 0.20
Nodes (9): Formatting, Input, Rules, Step 1 - inspect the project, Step 2 - choose the smallest test setup, Step 3 - make the setup changes, Step 4 - verify, Step 5 - report (+1 more)

### Community 189 - "AI Interaction Guidelines"
Cohesion: 0.20
Nodes (9): AI Interaction Guidelines, Branching, Code Changes, Code Review, Commits, Communication, Output formatting, When Stuck (+1 more)

### Community 190 - "mcp.controller.spec.ts"
Cohesion: 0.12
Nodes (11): All, Req, Res, MCP_SERVER_INFO, McpController, initializeRequest, TestRestController, Controller (+3 more)

### Community 191 - "shelf-life-reasoner.service.ts"
Cohesion: 0.21
Nodes (9): SHELF_LIFE_INFERENCE_PROMPT_VERSION, ShelfLifeReasoner, Inject, Injectable, nonBlankString, ShelfLifeInferenceInput, shelfLifeInferenceInputSchema, ShelfLifeInferenceResult (+1 more)

### Community 192 - "Feature: Product search and resolution proposals"
Cohesion: 0.11
Nodes (17): Build loop, Build steps, Completion record, Data / contracts, Deterministic search response, Feature: Product search and resolution proposals, Files / areas, Goal (+9 more)

### Community 193 - "audit - review code quality against the project standards"
Cohesion: 0.15
Nodes (12): audit - review code quality against the project standards, Formatting, Independent mode, Input, Phase A - prepare the handoff, Phase B - perform the review, Rules, Step 1 - gather context (+4 more)

### Community 194 - "debug - find the cause before changing the code"
Cohesion: 0.20
Nodes (9): debug - find the cause before changing the code, Formatting, Input, Rules, Step 1 - establish the boundary, Step 2 - reproduce safely, Step 3 - localize the failure, Step 4 - confirm or narrow (+1 more)

### Community 195 - "release - deployment readiness for Render and Vercel"
Cohesion: 0.20
Nodes (9): Formatting, Input, release - deployment readiness for Render and Vercel, Rules, Step 1 - read the project, Step 2 - choose the provider shape, Step 3 - verify local readiness, Step 4 - prepare local config (+1 more)

### Community 196 - "rollback - safely reverse a completed feature"
Cohesion: 0.20
Nodes (9): Formatting, Input, rollback - safely reverse a completed feature, Rules, Step 0 - preflight, Step 1 - resolve the exact feature, Step 2 - separate product changes from Blueprint history, Step 3 - review later-change risk (+1 more)

### Community 197 - "tests - add unit testing to the project"
Cohesion: 0.20
Nodes (9): Formatting, Input, Rules, Step 1 - inspect the project, Step 2 - choose the smallest test setup, Step 3 - make the setup changes, Step 4 - verify, Step 5 - report (+1 more)

### Community 198 - "Feature: Materialized inventory reads and recommendations"
Cohesion: 0.18
Nodes (10): Build loop, Build steps, Data / contracts, Feature: Materialized inventory reads and recommendations, Files / areas, Goal, In scope, Notes for the AI (+2 more)

### Community 199 - "check - prove it works against the spec, with evidence"
Cohesion: 0.22
Nodes (8): check - prove it works against the spec, with evidence, Formatting, Input, Rules, Step 1 - build the checklist, Step 2 - get the app running, Step 3 - exercise each claim, Step 4 - report

### Community 200 - "complete - log the finished work, make the work commit, and merge"
Cohesion: 0.20
Nodes (9): Before you start, complete - log the finished work, make the work commit, and merge, Configured regular quality gates, Formatting, Rules, Step 0 - final safety pass, Step 1 - log the work, Step 2 - make the work commit (+1 more)

### Community 201 - "discovery - develop the plans through a deep conversation"
Cohesion: 0.22
Nodes (8): discovery - develop the plans through a deep conversation, Formatting, Rules, Step 1 - establish the starting point, Step 2 - run adaptive discovery, Step 3 - decide whether the plans are ready, Step 4 - draft both planning files, Step 5 - write only after approval

### Community 202 - "graphify reference: extra exports and benchmark"
Cohesion: 0.22
Nodes (8): graphify reference: extra exports and benchmark, Step 6b - Wiki (only if --wiki flag), Step 7 - Neo4j export (only if --neo4j or --neo4j-push flag), Step 7a - FalkorDB export (only if --falkordb or --falkordb-push flag), Step 7b - SVG export (only if --svg flag), Step 7c - GraphML export (only if --graphml flag), Step 7d - MCP server (only if --mcp flag), Step 8 - Token reduction benchmark (only if total_words > 5000)

### Community 203 - "implement - build the current spec, one reviewed step at a time"
Cohesion: 0.22
Nodes (8): Before you start, Formatting, implement - build the current spec, one reviewed step at a time, Rules, Step 1 - branch, Step 2 - build one step, review, iterate, checkpoint, Step 3 - hand off to /complete, Type: Rollback safeguard

### Community 204 - "overview - turn the two plans into the AI-facing source of truth"
Cohesion: 0.20
Nodes (9): Formatting, Input, overview - turn the two plans into the AI-facing source of truth, Rules, Step 1 - read both plans, Step 2 - validate plan shape, Step 3 - synthesize the overview, Step 4 - offer the initial planning baseline commit (+1 more)

### Community 205 - "prisma migrate status"
Cohesion: 0.22
Nodes (8): Check status, Command, Examples, Exit Codes, Options, prisma migrate status, What It Does, When to Use

### Community 206 - "Prisma Compute Config"
Cohesion: 0.22
Nodes (9): App Fields, Basic Shape, Database Scope, File Names and Discovery, Generating a Config with `init`, Monorepos and Multi-App Repos, Precedence, Prisma Compute Config (+1 more)

### Community 207 - "create-prisma Compute Flow"
Cohesion: 0.22
Nodes (9): Addon Notes, Basic Commands, create-prisma Compute Flow, Failure Handling, Generated Deploy Script, Generated Files to Preserve, PostgreSQL and Database Behavior, Reference (+1 more)

### Community 208 - "SDK and API Automation"
Cohesion: 0.22
Nodes (8): Compute SDK, Management API Concepts, Prefer the CLI for App Workflows, Regions, Repository-snapshot detection, SDK and API Automation, SDK Build Strategies, Secrets and Redaction

### Community 209 - "Quick Rules"
Cohesion: 0.22
Nodes (9): 1. Command Verification, 2. Auth and Workspace Selection, 3. Framework Readiness, 4. Runtime Host and Port Binding, 5. Typed Compute Config, 6. Branch, Environment, and Database, 7. Deploy Operations, 8. SDK and API (+1 more)

### Community 210 - "Prisma Compute"
Cohesion: 0.22
Nodes (9): Avoid, Decision Tree, Preferred Workflow, Prisma Compute, Prisma Compute CLI Surface, Rules by Priority, Send Feedback and Report CLI Issues, Source-of-Truth Order (+1 more)

### Community 211 - "migrations-mapping"
Cohesion: 0.22
Nodes (8): Bad, Good, migrations-mapping, Priority, Prisma Next: first-class, contract-driven migrations (Mongo included), References, v6: `db push` only, Why It Matters

### Community 212 - "schema-contract-mapping"
Cohesion: 0.22
Nodes (8): Bad, Environment requirements, Good, Priority, References, schema-contract-mapping, The mapping, Why It Matters

### Community 213 - "Prisma MongoDB Upgrade Path"
Cohesion: 0.22
Nodes (8): Decision table, Hand-off rule, If staying on v6: hygiene (a deliberate stay, not neglect), Prisma MongoDB Upgrade Path, Reference files, The decision, up front, The version landscape, Verified against

### Community 214 - "endpoints"
Cohesion: 0.22
Nodes (8): Create connection, Create project (with database), Delete database, Delete project, endpoints, Get database, List projects, List regions

### Community 215 - "prototype - lock the look before you build"
Cohesion: 0.22
Nodes (8): Formatting, prototype - lock the look before you build, Step 1 - read what the plan already says, Step 2 - ask about the look and the pages, Step 3 - propose the plan, then wait, Step 4 - lock one theme, Step 5 - mock each screen, Then stop

### Community 216 - "try - manual review guide"
Cohesion: 0.22
Nodes (8): Formatting, Input, Rules, Step 1 - find the work to explain, Step 2 - identify how to run the app, Step 3 - write the manual guide, Step 4 - include confidence and gaps, try - manual review guide

### Community 217 - "check - prove it works against the spec, with evidence"
Cohesion: 0.22
Nodes (8): check - prove it works against the spec, with evidence, Formatting, Input, Rules, Step 1 - build the checklist, Step 2 - get the app running, Step 3 - exercise each claim, Step 4 - report

### Community 218 - "complete - log the finished work, make the work commit, and merge"
Cohesion: 0.20
Nodes (9): Before you start, complete - log the finished work, make the work commit, and merge, Configured regular quality gates, Formatting, Rules, Step 0 - final safety pass, Step 1 - log the work, Step 2 - make the work commit (+1 more)

### Community 219 - "discovery - develop the plans through a deep conversation"
Cohesion: 0.22
Nodes (8): discovery - develop the plans through a deep conversation, Formatting, Rules, Step 1 - establish the starting point, Step 2 - run adaptive discovery, Step 3 - decide whether the plans are ready, Step 4 - draft both planning files, Step 5 - write only after approval

### Community 220 - "graphify reference: extra exports and benchmark"
Cohesion: 0.22
Nodes (8): graphify reference: extra exports and benchmark, Step 6b - Wiki (only if --wiki flag), Step 7 - Neo4j export (only if --neo4j or --neo4j-push flag), Step 7a - FalkorDB export (only if --falkordb or --falkordb-push flag), Step 7b - SVG export (only if --svg flag), Step 7c - GraphML export (only if --graphml flag), Step 7d - MCP server (only if --mcp flag), Step 8 - Token reduction benchmark (only if total_words > 5000)

### Community 221 - "implement - build the current spec, one reviewed step at a time"
Cohesion: 0.22
Nodes (8): Before you start, Formatting, implement - build the current spec, one reviewed step at a time, Rules, Step 1 - branch, Step 2 - build one step, review, iterate, checkpoint, Step 3 - hand off to /complete, Type: Rollback safeguard

### Community 222 - "overview - turn the two plans into the AI-facing source of truth"
Cohesion: 0.20
Nodes (9): Formatting, Input, overview - turn the two plans into the AI-facing source of truth, Rules, Step 1 - read both plans, Step 2 - validate plan shape, Step 3 - synthesize the overview, Step 4 - offer the initial planning baseline commit (+1 more)

### Community 223 - "prototype - lock the look before you build"
Cohesion: 0.22
Nodes (8): Formatting, prototype - lock the look before you build, Step 1 - read what the plan already says, Step 2 - ask about the look and the pages, Step 3 - propose the plan, then wait, Step 4 - lock one theme, Step 5 - mock each screen, Then stop

### Community 224 - "try - manual review guide"
Cohesion: 0.22
Nodes (8): Formatting, Input, Rules, Step 1 - find the work to explain, Step 2 - identify how to run the app, Step 3 - write the manual guide, Step 4 - include confidence and gaps, try - manual review guide

### Community 225 - "graphify reference: extra exports and benchmark"
Cohesion: 0.22
Nodes (8): graphify reference: extra exports and benchmark, Step 6b - Wiki (only if --wiki flag), Step 7 - Neo4j export (only if --neo4j or --neo4j-push flag), Step 7a - FalkorDB export (only if --falkordb or --falkordb-push flag), Step 7b - SVG export (only if --svg flag), Step 7c - GraphML export (only if --graphml flag), Step 7d - MCP server (only if --mcp flag), Step 8 - Token reduction benchmark (only if total_words > 5000)

### Community 226 - "Deployment"
Cohesion: 0.15
Nodes (13): Build and deploy locally, Build the image, Configure the environment, Deployment, First-time registry activation (maintainer), Install or update from the registry, Migrate before starting the app, Prerequisites (+5 more)

### Community 227 - "Hermes installation"
Cohesion: 0.22
Nodes (9): Create the job, Hermes installation, Install locally, Job prompt, Prerequisite, Prerequisites, Proactive stock-check cron, Smoke check (+1 more)

### Community 228 - "exclude"
Cohesion: 0.22
Nodes (8): dist, node_modules, prisma.config.ts, **/*spec.ts, test, ./tsconfig.json, exclude, extends

### Community 229 - "mcp-server.factory.spec.ts"
Cohesion: 0.12
Nodes (18): CORRECTED_STATES, CorrectedStateMatchesOutcomeConstraint, PredictionFeedbackDto, PredictionFeedbackOutcome, accepted, corrected, rejected, validateBody() (+10 more)

### Community 230 - "mcp-contract-fixture.spec.ts"
Cohesion: 0.10
Nodes (17): BundleManifest, bundleRoot(), readManifest(), ToolFixture, householdContext, ProbeProcessResult, ProbeServerState, AGENT_RELEASE_CONTRACT (+9 more)

### Community 231 - "AGENTS.md"
Cohesion: 0.25
Nodes (6): Automatic verification, Commands, graphify, Read these for full context, What this is, Workflow

### Community 232 - "prisma mcp"
Cohesion: 0.25
Nodes (7): Command, Notes, prisma mcp, References, Typical Use Cases, Usage, What It Does

### Community 233 - "client-api-mapping"
Cohesion: 0.25
Nodes (7): Bad, client-api-mapping, Good, Priority, References, The mapping, Why It Matters

### Community 234 - "Service Tokens"
Cohesion: 0.25
Nodes (7): auth, Creating a service token, OAuth 2.0 (for user-scoped access), Security practices, Service Tokens, Token scope, Using a service token

### Community 235 - "Q: What existing contracts and code paths constrain feature 33b stock mutation and batch purchase APIs?"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: What existing contracts and code paths constrain feature 33b stock mutation and batch purchase APIs?, Source Nodes

### Community 236 - "adapters"
Cohesion: 0.25
Nodes (7): adapters, schemaVersion, version, claude, codex, copilot, opencode

### Community 237 - "brief - understand a feature before you spec it"
Cohesion: 0.29
Nodes (6): brief - understand a feature before you spec it, Formatting, Input, Output, Rules, What it reads

### Community 238 - "doctor - Blueprint health check"
Cohesion: 0.29
Nodes (6): doctor - Blueprint health check, Formatting, Input, Output, Rules, What it checks

### Community 239 - "prisma debug"
Cohesion: 0.29
Nodes (6): Command, Example Output, Options, prisma debug, What It Does, When to Use

### Community 240 - "Prisma Client Setup"
Cohesion: 0.29
Nodes (6): 1. Install dependencies, 2. Add generator block, 3. Generate Prisma Client, 4. Instantiate Prisma Client, 5. Use a single instance, Prisma Client Setup

### Community 241 - "verify-cutover-checklist"
Cohesion: 0.29
Nodes (6): Checklist, Ground rules, Priority, References, verify-cutover-checklist, Why It Matters

### Community 242 - "Prisma 7 Client Instantiation"
Cohesion: 0.29
Nodes (6): Basic instantiation, Common mistakes, Key rules, Prisma 7 Client Instantiation, Required packages, Usage in application code

### Community 243 - "status - where the project stands right now"
Cohesion: 0.29
Nodes (6): Formatting, Input, Output, Rules, status - where the project stands right now, What it reads

### Community 244 - "Q: Which existing DTO, validation, purchase, event, response, quantity, unit, and stock contracts constrain implementation Step 1 of feature 33b?"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: Which existing DTO, validation, purchase, event, response, quantity, unit, and stock contracts constrain implementation Step 1 of feature 33b?, Source Nodes

### Community 245 - "Data / contracts"
Cohesion: 0.29
Nodes (7): `create_if_missing` request, Data / contracts, `propose_if_missing` request, Result union, Shared grocery request, Shared request policies, Transaction and concurrency rules

### Community 246 - "Fix: Guard grocery removal by pending state"
Cohesion: 0.29
Nodes (6): Build steps, Completion record, Fix: Guard grocery removal by pending state, The fix, The problem, Verify

### Community 247 - "Fix: MCP-02 duplicate-safe grocery additions"
Cohesion: 0.29
Nodes (6): Build steps, Completion record, Fix: MCP-02 duplicate-safe grocery additions, The fix, The problem, Verify

### Community 248 - "Fix: Use transport-owned generic source attribution"
Cohesion: 0.29
Nodes (6): Build steps, Completion record, Fix: Use transport-owned generic source attribution, The fix, The problem, Verify

### Community 249 - "triage.md"
Cohesion: 0.12
Nodes (13): Active bug context, Completed work, Deferred candidates, Archived resolutions, Deferred candidates, MCP and skill gaps — active triage, Rejected as separate work, Build steps (+5 more)

### Community 250 - "Fix: Separate Hermes and OpenClaw skill instructions"
Cohesion: 0.29
Nodes (6): Build steps, Completion record, Fix: Separate Hermes and OpenClaw skill instructions, The fix, The problem, Verify

### Community 251 - "brief - understand a feature before you spec it"
Cohesion: 0.29
Nodes (6): brief - understand a feature before you spec it, Formatting, Input, Output, Rules, What it reads

### Community 252 - "doctor - Blueprint health check"
Cohesion: 0.29
Nodes (6): doctor - Blueprint health check, Formatting, Input, Output, Rules, What it checks

### Community 253 - "status - where the project stands right now"
Cohesion: 0.29
Nodes (6): Formatting, Input, Output, Rules, status - where the project stands right now, What it reads

### Community 254 - "package.json"
Cohesion: 0.29
Nodes (6): author, description, license, name, private, version

### Community 255 - "Home Stock Tracker"
Cohesion: 0.25
Nodes (8): Architecture, Common commands, Conversation mockups, Current status, Documentation, Home Stock Tracker, Quickstart, What it does

### Community 256 - "fix - document an ad-hoc fix, then build it like anything else"
Cohesion: 0.33
Nodes (5): fix - document an ad-hoc fix, then build it like anything else, Formatting, Input, Rules, Step 1 - write the fix spec

### Community 257 - "graphify reference: query, path, explain"
Cohesion: 0.33
Nodes (5): For /graphify explain, For /graphify path, graphify reference: query, path, explain, Step 0 — Constrained query expansion (REQUIRED before traversal), Step 1 — Traversal

### Community 259 - "Q: Which existing estimation, shelf-life, statistics, stock projection, and quantity contracts constrain feature 33b Step 2?"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: Which existing estimation, shelf-life, statistics, stock projection, and quantity contracts constrain feature 33b Step 2?, Source Nodes

### Community 260 - "update-release.sh"
Cohesion: 0.67
Nodes (3): compose(), IMAGE_REF, update-release.sh script

### Community 261 - "fix - document an ad-hoc fix, then build it like anything else"
Cohesion: 0.33
Nodes (5): fix - document an ad-hoc fix, then build it like anything else, Formatting, Input, Rules, Step 1 - write the fix spec

### Community 262 - "graphify reference: query, path, explain"
Cohesion: 0.33
Nodes (5): For /graphify explain, For /graphify path, graphify reference: query, path, explain, Step 0 — Constrained query expansion (REQUIRED before traversal), Step 1 — Traversal

### Community 263 - "graphify reference: query, path, explain"
Cohesion: 0.33
Nodes (5): For /graphify explain, For /graphify path, graphify reference: query, path, explain, Step 0 — Constrained query expansion (REQUIRED before traversal), Step 1 — Traversal

### Community 265 - "OpenClaw installation"
Cohesion: 0.33
Nodes (5): Install locally, OpenClaw installation, Prerequisite, Scheduling boundary, Smoke check

### Community 266 - "nest-cli.json"
Cohesion: 0.33
Nodes (5): collection, compilerOptions, deleteOutDir, $schema, sourceRoot

### Community 267 - "Fix: Expose inventory-event history through MCP"
Cohesion: 0.17
Nodes (11): Build steps, Completion record, Data / contracts, Files / areas, Fix: Expose inventory-event history through MCP, MCP input, MCP output, Notes for the AI (+3 more)

### Community 268 - "Feature: Expiration-batch foundation"
Cohesion: 0.15
Nodes (12): Build loop, Build steps, Data / contracts, Expiration batch, Feature: Expiration-batch foundation, Files / areas, Goal, In scope (+4 more)

### Community 270 - "Q: Why is ProductService the main cross-community bridge between product, grocery, inventory, persistence, and controllers?"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: Why is ProductService the main cross-community bridge between product, grocery, inventory, persistence, and controllers?, Source Nodes

### Community 271 - "Q: Okay I want to plan all the bugs that we have fixed. I think we fixed a lot of them already in the history. You can see I think we fixed the first, second, and third. I think we already fixed maybe even the fourth. What I want you to do now is go through all of README and the files, trying to send according to what we have in the code right now: what needs to be fixed and not what can be weighted and what we can reject."
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: Okay I want to plan all the bugs that we have fixed. I think we fixed a lot of them already in the history. You can see I think we fixed the first, second, and third. I think we already fixed maybe even the fourth. What I want you to do now is go through all of README and the files, trying to send according to what we have in the code right now: what needs to be fixed and not what can be weighted and what we can reject., Source Nodes

### Community 272 - "Q: can you update the blueprint/context/bugs/triage.md file?"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: can you update the blueprint/context/bugs/triage.md file?, Source Nodes

### Community 273 - "Q: according to blueprint/context/bugs/triage.md which ones i can run paralel?"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: according to blueprint/context/bugs/triage.md which ones i can run paralel?, Source Nodes

### Community 274 - "Home Stock Tracker skill scenarios"
Cohesion: 0.40
Nodes (4): Home Stock Tracker skill scenarios, Review record, Scheduled proactive-check scenarios, Stock confirmation review

### Community 275 - "network"
Cohesion: 0.20
Nodes (10): environmentVariable, scheme, baseUrlEnvironmentVariable, healthPath, mcpPath, readinessPath, transport, prerequisites (+2 more)

### Community 276 - "graphify reference: add a URL and watch a folder"
Cohesion: 0.50
Nodes (3): For /graphify add, For --watch, graphify reference: add a URL and watch a folder

### Community 277 - "graphify reference: commit hook and native AGENTS.md integration"
Cohesion: 0.50
Nodes (3): For git commit hook, For native AGENTS.md integration, graphify reference: commit hook and native AGENTS.md integration

### Community 278 - "graphify reference: incremental update and cluster-only"
Cohesion: 0.50
Nodes (3): For --cluster-only, For --update (incremental re-extraction), graphify reference: incremental update and cluster-only

### Community 279 - "AI safety checkpoint for destructive commands"
Cohesion: 0.50
Nodes (3): AI safety checkpoint for destructive commands, Reference, Required workflow

### Community 280 - "Household Stock Ledger and Daily Estimation"
Cohesion: 0.14
Nodes (12): Build Plan, MVP, Post-MVP, Assumptions and Deferred Work, Daily stock workflow, Household Stock Ledger and Daily Estimation, Key Changes, Public Types (+4 more)

### Community 281 - "preferences.mjs"
Cohesion: 0.40
Nodes (13): assertExactKeys(), assertText(), fail(), findPreference(), loadPreferences(), normalizeGenericName(), PREFERENCE_KEYS, REGISTRY_KEYS (+5 more)

### Community 282 - "stock-workflow-scheduler.service.ts"
Cohesion: 0.25
Nodes (6): STOCK_WORKFLOW_CONFIG, StockWorkflowConfig, STOCK_WORKFLOW_JOB, StockWorkflowSchedulerService, Inject, Injectable

### Community 284 - "Feature: Store-skill contract and tutorial"
Cohesion: 0.18
Nodes (10): Build loop, Build steps, Data / contracts, Feature: Store-skill contract and tutorial, Files / areas, Goal, In scope, Notes for the AI (+2 more)

### Community 285 - "home_stock_tracker/__init__.py"
Cohesion: 0.19
Nodes (10): Constants for the Home Stock Tracker integration., Read-only data coordinator for Home Stock Tracker., async_setup_entry(), async_unload_entry(), ConfigEntry, HomeAssistant, Home Stock Tracker integration., Set up Home Stock Tracker from a config entry. (+2 more)

### Community 286 - "purchase-completion.mcp.e2e-spec.ts"
Cohesion: 0.25
Nodes (4): CompletionContent, createProduct(), eventCount(), unchangedItems()

### Community 287 - "grocery.service.ts"
Cohesion: 0.10
Nodes (24): product, product, ConfirmedGroceryItemInput, ConfirmNewProductGroceryAddition, ConfirmProductAliasGroceryAddition, GroceryCatalogConfirmationBase, CreatedGroceryAdditionResult, CreateIfMissingGroceryAddition (+16 more)

### Community 288 - "graphify reference: add a URL and watch a folder"
Cohesion: 0.50
Nodes (3): For /graphify add, For --watch, graphify reference: add a URL and watch a folder

### Community 289 - "graphify reference: commit hook and native CLAUDE.md integration"
Cohesion: 0.50
Nodes (3): For git commit hook, For native CLAUDE.md integration, graphify reference: commit hook and native CLAUDE.md integration

### Community 290 - "graphify reference: incremental update and cluster-only"
Cohesion: 0.50
Nodes (3): For --cluster-only, For --update (incremental re-extraction), graphify reference: incremental update and cluster-only

### Community 291 - "graphify reference: add a URL and watch a folder"
Cohesion: 0.50
Nodes (3): For /graphify add, For --watch, graphify reference: add a URL and watch a folder

### Community 292 - "graphify reference: commit hook and native CLAUDE.md integration"
Cohesion: 0.50
Nodes (3): For git commit hook, For native CLAUDE.md integration, graphify reference: commit hook and native CLAUDE.md integration

### Community 293 - "graphify reference: incremental update and cluster-only"
Cohesion: 0.50
Nodes (3): For --cluster-only, For --update (incremental re-extraction), graphify reference: incremental update and cluster-only

### Community 294 - "test_config_flow.py"
Cohesion: 0.20
Nodes (13): ConfigEntry, HomeAssistant, Tests for Home Stock Tracker configuration., A valid authenticated service creates one normalized config entry., The integration only accepts a service origin, not an API route., A service origin can only be configured once., An unauthorized token is never saved as a config entry., Reauthentication validates and replaces only the token. (+5 more)

### Community 295 - "Hermes Agent"
Cohesion: 0.40
Nodes (5): Configure the MCP server, Hermes Agent, Install the Home Stock Tracker skill, Verify the Hermes bundle, WhatsApp and scheduled checks

### Community 306 - "Home Stock Tracker skill scenarios"
Cohesion: 0.50
Nodes (3): Home Stock Tracker skill scenarios, Review record, Stock confirmation review

### Community 307 - "Home Stock Tracker skill scenarios"
Cohesion: 0.50
Nodes (3): Home Stock Tracker skill scenarios, Review record, Stock confirmation review

### Community 310 - "Confirmed product creation during absolute stock updates"
Cohesion: 0.13
Nodes (14): Acceptance criteria, Actions and stock semantics, Agreed decisions, Atomic confirmation, Confirmed product creation during absolute stock updates, Deferred work and superseded scope, Documentation and Hermes scenarios, Example (+6 more)

### Community 314 - "network"
Cohesion: 0.20
Nodes (10): environmentVariable, scheme, baseUrlEnvironmentVariable, healthPath, mcpPath, readinessPath, transport, prerequisites (+2 more)

### Community 318 - "CompletePartialPurchaseDto"
Cohesion: 0.18
Nodes (11): CompletePartialPurchaseDto, ArrayMinSize, IsArray, IsNotEmpty, IsNumber, IsObject, IsOptional, IsString (+3 more)

### Community 321 - "agent-documentation-contract.mjs"
Cohesion: 0.20
Nodes (7): authoredPublicDocs, integrationGuide, normalizedIntegrationGuide, platforms, projectRoot, releaseContract, TOOL_COUNT_PATTERN

### Community 322 - "ProductSearchService"
Cohesion: 0.22
Nodes (6): ProductSearchResponseDto, Query, ProductSearchService, Injectable, ProductSearchRequest, ProductSearchResult

### Community 323 - "OperationalLogger"
Cohesion: 0.31
Nodes (3): Inject, OperationalLogger, Injectable

### Community 324 - "mcp"
Cohesion: 0.22
Nodes (9): mcp, compatibleRange, contractVersion, serverName, toolsFixture, versionPolicy, additive, breaking (+1 more)

### Community 335 - "mcp"
Cohesion: 0.22
Nodes (9): mcp, compatibleRange, contractVersion, serverName, toolsFixture, versionPolicy, additive, breaking (+1 more)

### Community 336 - "store-skill-scaffold.spec.ts"
Cohesion: 0.33
Nodes (3): runGenerator(), ScaffoldPlan, validArguments()

### Community 337 - "agent-installation-probe.mjs"
Cohesion: 0.19
Nodes (18): checkHttpEndpoint(), classifyMcpConnectionError(), compareVersions(), diagnostic(), DIAGNOSTICS, EXIT_CODES, HOUSEHOLD_CONTEXT_KEYS, isHouseholdContext() (+10 more)

### Community 338 - "ListInventoryEventsDto"
Cohesion: 0.22
Nodes (9): ListInventoryEventsDto, IsEnum, IsInt, IsOptional, IsPositive, IsUUID, Max, Min (+1 more)

### Community 339 - "Feature: Verifiable agent integration contract"
Cohesion: 0.17
Nodes (11): Build loop, Build steps, Completion record, Data / contracts, Feature: Verifiable agent integration contract, Files / areas, Goal, In scope (+3 more)

### Community 341 - "Home Stock Tracker Hermes release contract"
Cohesion: 0.29
Nodes (6): Compatibility, Home Stock Tracker Hermes release contract, Prerequisites, Required MCP tools, Rollback, Verification

### Community 342 - "Home Stock Tracker OpenClaw release contract"
Cohesion: 0.29
Nodes (6): Compatibility, Home Stock Tracker OpenClaw release contract, Prerequisites, Required MCP tools, Rollback, Verification

### Community 343 - "Current Feature"
Cohesion: 0.40
Nodes (4): Current Feature, Docker image publishing, Final completion gate, Verification evidence

### Community 344 - "HouseholdService"
Cohesion: 0.10
Nodes (21): CreateHouseholdDto, IsArray, IsInt, IsNumber, IsOptional, IsString, Max, Min (+13 more)

### Community 347 - "RecordInventoryEventDto"
Cohesion: 0.22
Nodes (9): RecordInventoryEventDto, IsEnum, IsNotEmpty, IsNumber, IsObject, IsOptional, IsString, IsUUID (+1 more)

### Community 352 - "product-name.exception.ts"
Cohesion: 0.53
Nodes (4): PRODUCT_NAME_CONFLICT, PRODUCT_NOT_FOUND, ProductNameConflictResponse, productNotFound()

### Community 353 - "ProductResolutionAction"
Cohesion: 0.40
Nodes (5): ProductResolutionAction, add_alias, cancel, create_product, use_existing_product

### Community 354 - "HomeStockTrackerSensor"
Cohesion: 0.20
Nodes (9): AddEntitiesCallback, async_setup_entry(), HomeStockTrackerSensor, Any, ConfigEntry, HomeAssistant, Set up Home Stock Tracker sensors., Expose one read-only Home Stock Tracker collection. (+1 more)

### Community 355 - "config_flow.py"
Cohesion: 0.18
Nodes (11): Exception, CannotConnectError, InvalidAuthError, InvalidBaseUrlError, normalize_base_url(), Config flow for Home Stock Tracker., Raised when the configured service is unreachable., Raised when the configured service rejects the token. (+3 more)

### Community 356 - "test_coordinator.py"
Cohesion: 0.26
Nodes (11): ConfigEntry, HomeAssistant, Tests for Home Stock Tracker read coordination., One refresh exposes all three documented read responses., An authentication rejection starts Home Assistant reauthentication., Malformed read models leave the coordinator unavailable., A non-success response prevents all sensor data from publishing., test_refresh_publishes_all_read_models_atomically() (+3 more)

### Community 357 - "Feature: Read-only Home Assistant custom integration"
Cohesion: 0.18
Nodes (10): Build loop, Build steps, Data / contracts, Feature: Read-only Home Assistant custom integration, Files / areas, Goal, In scope, Notes for the AI (+2 more)

### Community 358 - "HomeStockTrackerCoordinator"
Cohesion: 0.28
Nodes (6): ClientSession, HomeStockTrackerCoordinator, Any, ConfigEntry, HomeAssistant, Fetch all Home Stock Tracker read state atomically.

### Community 361 - "config_entry"
Cohesion: 0.29
Nodes (7): fixture, auto_enable_custom_integrations(), config_entry(), Shared fixtures for Home Stock Tracker integration tests., Enable the repository custom component for every integration test., Create the configured Home Stock Tracker entry., MockConfigEntry

### Community 362 - "test_sensors_publish_records_and_stable_unique_ids"
Cohesion: 0.32
Nodes (7): ConfigEntry, HomeAssistant, Tests for Home Stock Tracker sensor entities., A successful shared refresh publishes all service-owned records., Empty successful data is distinct from an unavailable coordinator., test_sensors_publish_records_and_stable_unique_ids(), test_sensors_show_zero_for_empty_data_and_unavailable_after_failed_refresh()

### Community 363 - "home_stock_tracker/manifest.json"
Cohesion: 0.29
Nodes (6): config_flow, domain, integration_type, name, single_config_entry, version

### Community 365 - "PolicyAwareGroceryAdditionShape"
Cohesion: 0.40
Nodes (3): PolicyAwareGroceryAdditionShape, validateDto(), ValidatorConstraint

## Knowledge Gaps
- **2624 isolated node(s):** `schemaVersion`, `version`, `claude`, `codex`, `copilot` (+2619 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **32 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Work-memory lessons

**Preferred sources** — corroborated by past sessions; start here.
- `InventoryService` (6× useful, score=5.720973127)
- `McpServerFactory` (4× useful, score=3.873860593) _(code changed — re-verify)_
- `StockLedgerService` (2× useful, score=1.989031773)
- `OpenClaw` (2× useful, score=1.9197485) _(code changed — re-verify)_
- `PredictionFeedbackService` (2× useful, score=1.9197485)
- `EstimationService` (2× useful, score=1.847331576)
- `GroceryService` (2× useful, score=1.812192855)

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `PrismaService` connect `PrismaService` to `product.service.ts`, `product-resolution.ts`, `LlmProvider`, `stock-product-confirmation.service.ts`, `app.module.ts`, `health.controller.ts`, `low-stock-recommendation.service.ts`, `purchase-completion.mcp.e2e-spec.ts`, `grocery.service.ts`, `AppService`, `statistics.service.ts`, `daily-stock-workflow.service.ts`, `product-search.service.ts`, `shelf-life-reasoner.service.ts`, `ExpirationBatchService`, `ProductSearchService`, `estimation.service.ts`, `HouseholdService`, `inventory.service.ts`, `mcp-server.factory.spec.ts`, `inventory.service.spec.ts`, `prediction-feedback.mcp.e2e-spec.ts`?**
  _High betweenness centrality (0.010) - this node is a cross-community bridge._
- **Why does `ProductService` connect `ProductService` to `product.service.ts`, `product-resolution.ts`, `PrismaService`, `LlmProvider`, `stock-product-confirmation.service.ts`, `mcp-server.factory.ts`, `app.module.ts`, `grocery.service.ts`, `statistics.service.ts`, `mcp.controller.spec.ts`, `ProductSearchService`, `InventoryService`, `estimation.service.ts`, `HouseholdService`, `product.controller.ts`, `inventory.service.ts`, `mcp-server.factory.spec.ts`, `mcp-contract-fixture.spec.ts`, `inventory.service.spec.ts`?**
  _High betweenness centrality (0.008) - this node is a cross-community bridge._
- **Why does `PolicyAwareAddGroceryItemDto` connect `PolicyAwareAddGroceryItemDto` to `GroceryService`, `grocery.service.ts`?**
  _High betweenness centrality (0.004) - this node is a cross-community bridge._
- **What connects `schemaVersion`, `version`, `claude` to the rest of the system?**
  _2624 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `managedFiles` be split into smaller, more focused modules?**
  _Cohesion score 0.031746031746031744 - nodes in this community are weakly interconnected._
- **Should `RecordPurchasesDto` be split into smaller, more focused modules?**
  _Cohesion score 0.07823613086770982 - nodes in this community are weakly interconnected._
- **Should `product.service.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.10460992907801418 - nodes in this community are weakly interconnected._