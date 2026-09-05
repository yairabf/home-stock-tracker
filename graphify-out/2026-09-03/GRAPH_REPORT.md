# Graph Report - home-stock-tracker  (2026-09-03)

## Corpus Check
- 517 files · ~422,341 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 4472 nodes · 6504 edges · 343 communities (311 shown, 32 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 122 edges (avg confidence: 0.81)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `b3a13bb3`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- managedFiles
- RecordPurchasesDto
- statistics.service.ts
- hermes/home-stock-tracker/manifest.json
- devDependencies
- product-resolution.ts
- prisma.service.ts
- 8. Deployment - Where and how will this ship?
- product.service.ts
- features
- RecordPurchaseDto
- mcp-server.factory.ts
- estimation.service.ts
- PolicyAwareAddGroceryItemDto
- ListInventoryEventsDto
- ProductService
- Model Queries
- Driver Adapters
- app.module.ts
- health.controller.ts
- generate-agent-skills.mjs
- Upgrade to Prisma ORM 7
- .addExplicitProductItem
- What You Must Do When Invoked
- What You Must Do When Invoked
- What You Must Do When Invoked
- OperationalLogger
- Relation Queries
- Removed Features
- low-stock-recommendation.service.ts
- compilerOptions
- Prisma CLI Reference
- Raw Queries
- Troubleshooting Prisma Compute
- UpdateStockDto
- Client Methods
- Filter Conditions and Operators
- Query Options
- dependencies
- CompletePurchaseDto
- AddGroceryItemDto
- prisma db push
- prisma dev
- prisma generate
- prisma studio
- Prisma Client API Reference
- Prisma Config
- McpServerFactory
- prisma migrate dev
- Data model
- requiredTools
- normalizeProductName
- prisma db seed
- Environment Variables
- purchase-contract.ts
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
- GroceryController
- Schema Changes
- InventoryService
- Feature: Inventory state estimation
- Feature: Consumption pattern learning
- Feature: LLM-assisted product understanding
- Feature: Product name namespace
- Feature: Grocery quantity contract
- Home Stock Tracker
- scripts
- grocery-quantity-migration.e2e-spec.ts
- continuous - complete the build plan one local feature at a time
- Transactions
- Workflow
- PrismaService
- Fix Brief: MCP-05 - Standalone alias administration
- GroceryService
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
- inventory/stock-materialization.ts
- application-config.ts
- Feature: Daily stock estimation workflow
- RecordInventoryEventDto
- Coding Standards
- grocery-update.e2e-spec.ts
- browser-tests - set up repeatable browser verification
- browser-tests - set up repeatable browser verification
- Feature 3: Inventory event tracking
- Feature: Complete grocery items from a purchase
- Feature: Policy-aware grocery additions
- Feature: Partial grocery-list completion
- Fix: MCP-07 prediction feedback tool
- autopilot - optional Blueprint loop
- onboard - finish the Blueprint overlay setup
- product-name.exception.ts
- CompletePartialPurchaseDto
- adopt - bootstrap the blueprint from an existing codebase
- Feature: <name>
- <Project Name> - Project Overview
- prisma migrate diff
- prisma migrate reset
- PostgreSQL Setup
- Prisma Postgres Setup
- SQLite Setup
- Rollback: Feature NN - Name
- Household Stock Ledger and Daily Estimation
- structured-generation.ts
- policy-aware-grocery-addition.ts
- Independent review record
- Independent review record
- Integration troubleshooting
- LlmProvider
- product-with-names.ts
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
- ProductSearchService
- Fix Brief: MCP-10 — No read-only household context tool
- Feature: Product search and resolution proposals
- audit - review code quality against the project standards
- debug - find the cause before changing the code
- release - deployment readiness for Render and Vercel
- rollback - safely reverse a completed feature
- tests - add unit testing to the project
- ProductResolutionService
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
- agent-release-contract.generated.ts
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
- Fix: Publish a reliable `get_product` input schema
- Fix: Separate Hermes and OpenClaw skill instructions
- brief - understand a feature before you spec it
- doctor - Blueprint health check
- status - where the project stands right now
- package.json
- Home Stock Tracker
- fix - document an ad-hoc fix, then build it like anything else
- graphify reference: query, path, explain
- Q: Which existing estimation, shelf-life, statistics, stock projection, and quantity contracts constrain feature 33b Step 2?
- triage.md
- fix - document an ad-hoc fix, then build it like anything else
- graphify reference: query, path, explain
- graphify reference: query, path, explain
- agent-integrations.md
- OpenClaw installation
- nest-cli.json
- Fix: Expose inventory-event history through MCP
- @nestjs/schedule
- review.md
- Q: Why is ProductService the main cross-community bridge between product, grocery, inventory, persistence, and controllers?
- Q: Okay I want to plan all the bugs that we have fixed. I think we fixed a lot of them already in the history. You can see I think we fixed the first, second, and third. I think we already fixed maybe even the fourth. What I want you to do now is go through all of README and the files, trying to send according to what we have in the code right now: what needs to be fixed and not what can be weighted and what we can reject.
- Q: can you update the blueprint/context/bugs/triage.md file?
- Q: according to blueprint/context/bugs/triage.md which ones i can run paralel?
- product-name-namespace-migration.e2e-spec.ts
- network
- graphify reference: add a URL and watch a folder
- graphify reference: commit hook and native AGENTS.md integration
- graphify reference: incremental update and cluster-only
- AI safety checkpoint for destructive commands
- build-plan.md
- pg
- @prisma/adapter-pg
- @prisma/client
- mcp-contract-fixture.spec.ts
- .listItems
- purchase-completion.mcp.e2e-spec.ts
- grocery.service.ts
- graphify reference: add a URL and watch a folder
- graphify reference: commit hook and native CLAUDE.md integration
- graphify reference: incremental update and cluster-only
- graphify reference: add a URL and watch a folder
- graphify reference: commit hook and native CLAUDE.md integration
- graphify reference: incremental update and cluster-only
- mcp.controller.spec.ts
- inventory-mutations.mcp.e2e-spec.ts
- agent-scenario-contract.spec.ts
- graphify reference: GitHub clone and cross-repo merge
- graphify reference: transcribe video and audio
- prisma complete
- @nestjs/mapped-types
- Home Stock Tracker
- graphify reference: GitHub clone and cross-repo merge
- graphify reference: transcribe video and audio
- graphify reference: GitHub clone and cross-repo merge
- graphify reference: transcribe video and audio
- Home Stock Tracker skill scenarios
- Home Stock Tracker skill scenarios
- agent-skill-contract.spec.ts
- .agents/skills/graphify/references/extraction-spec.md
- Feature: Materialized inventory reads and recommendations
- findings.md
- features/README.md
- rollbacks/README.md
- network
- .claude/CLAUDE.md
- .claude/skills/graphify/references/extraction-spec.md
- .codex/skills/graphify/references/extraction-spec.md
- estimation-response.e2e-spec.ts
- hermes/scenarios.md
- hermes/workflow.md
- agent-documentation-contract.mjs
- AddProductAliasDto
- HouseholdService
- mcp
- mcp
- policy-aware-grocery.mcp.e2e-spec.ts
- agent-installation-probe.mjs
- class-validator
- Feature: Verifiable agent integration contract
- Home Stock Tracker Hermes release contract
- Home Stock Tracker OpenClaw release contract
- rxjs

## God Nodes (most connected - your core abstractions)
1. `PrismaService` - 80 edges
2. `managedFiles` - 63 edges
3. `ProductService` - 53 edges
4. `GroceryService` - 44 edges
5. `InventoryService` - 40 edges
6. `OperationalLogger` - 37 edges
7. `AppModule` - 32 edges
8. `createProductFixture()` - 32 edges
9. `LlmProvider` - 31 edges
10. `ProductWithNames` - 30 edges

## Surprising Connections (you probably didn't know these)
- `createProductFixture()` --indirect_call--> `toProductNameValue()`  [INFERRED]
  test/product-fixture.ts → src/product/product-name.util.ts
- `pendingCount()` --indirect_call--> `productId()`  [INFERRED]
  test/grocery-add-duplicate.e2e-spec.ts → src/product/types/product-search.spec.ts
- `createItem()` --indirect_call--> `productId()`  [INFERRED]
  test/grocery-remove.e2e-spec.ts → src/product/types/product-search.spec.ts
- `createItem()` --indirect_call--> `productId()`  [INFERRED]
  test/grocery-set-quantity.e2e-spec.ts → src/product/types/product-search.spec.ts
- `createItem()` --indirect_call--> `productId()`  [INFERRED]
  test/grocery-update.e2e-spec.ts → src/product/types/product-search.spec.ts

## Import Cycles
- None detected.

## Communities (343 total, 32 thin omitted)

### Community 0 - "managedFiles"
Cohesion: 0.03
Nodes (63): managedFiles, .agents/skills/adopt/SKILL.md, .agents/skills/audit/reference/independent-review.md, .agents/skills/audit/SKILL.md, .agents/skills/autopilot/SKILL.md, .agents/skills/brief/SKILL.md, .agents/skills/browser-tests/SKILL.md, .agents/skills/check/SKILL.md (+55 more)

### Community 1 - "RecordPurchasesDto"
Cohesion: 0.13
Nodes (21): ArrayMaxSize, RecordPurchaseBatchItemDto, RecordPurchasesDto, ArrayMinSize, ArrayUnique, IsArray, IsIn, IsISO8601 (+13 more)

### Community 2 - "statistics.service.ts"
Cohesion: 0.12
Nodes (12): MS_PER_DAY, StatisticsResponseDto, StatisticsController, Controller, HttpCode, Param, Post, NEED_EVENT_TYPES (+4 more)

### Community 3 - "hermes/home-stock-tracker/manifest.json"
Cohesion: 0.14
Nodes (13): platform, rollback, guidance, strategy, schemaVersion, service, name, version (+5 more)

### Community 4 - "devDependencies"
Cohesion: 0.04
Nodes (49): eslint, eslint-config-prettier, @eslint/eslintrc, @eslint/js, eslint-plugin-prettier, globals, jest, @nestjs/cli (+41 more)

### Community 5 - "product-resolution.ts"
Cohesion: 0.08
Nodes (27): ProductResolutionLogService, Injectable, candidate(), candidateForContextBytes(), addAliasProposalSchema, askUserToChooseProposalSchema, boundedDisplayName, boundedString() (+19 more)

### Community 6 - "prisma.service.ts"
Cohesion: 0.12
Nodes (17): AppModule, Module, ServiceAuthGuard, Injectable, AUTH_TEST_BYPASS, createProduct(), createProduct(), projectionEstimate() (+9 more)

### Community 7 - "8. Deployment - Where and how will this ship?"
Cohesion: 0.05
Nodes (39): 1. Problem - What problem are we solving?, 2. Users - Who is this for?, 3. Features - What does the MVP need?, 4. Data - What are we storing?, 5. Tech - What stack are we using?, 6. Monetize - How will this make money?, 7. UI/UX - How should this look and feel?, 8. Deployment - Where and how will this ship? (+31 more)

### Community 8 - "product.service.ts"
Cohesion: 0.18
Nodes (14): LlmGenerationResult, ProductClassificationLogService, Injectable, PRODUCT_CLASSIFICATION_MIN_CONFIDENCE, PRODUCT_CLASSIFICATION_PROMPT_VERSION, ProductClassifier, Injectable, ProductMetadata (+6 more)

### Community 9 - "features"
Cohesion: 0.11
Nodes (18): features, batch-purchase-recording, grocery-catalog-confirmation, grocery-list, grocery-purchase-completion, grocery-remove, grocery-update, household-context (+10 more)

### Community 10 - "RecordPurchaseDto"
Cohesion: 0.17
Nodes (12): RecordPurchaseDto, IsIn, IsISO8601, IsNotEmpty, IsNumber, IsObject, IsOptional, IsPositive (+4 more)

### Community 11 - "mcp-server.factory.ts"
Cohesion: 0.05
Nodes (41): batchPurchaseItemInputSchema, completeGroceryPurchaseInputSchema, completeGroceryPurchaseItemInputSchema, completeGroceryPurchaseOutputSchema, concretePredictedStateSchema, estimationOutputSchema, eventMeasurementsSchema, explicitProductInputSchema (+33 more)

### Community 12 - "estimation.service.ts"
Cohesion: 0.08
Nodes (26): EstimationService, HouseholdPredictionContext, HybridReasoningResult, LearnedStatistics, PRODUCT_TYPE_THRESHOLDS, ProductPredictionContext, RELEVANT_EVENT_TYPES, Injectable (+18 more)

### Community 13 - "PolicyAwareAddGroceryItemDto"
Cohesion: 0.09
Nodes (27): IsBoolean, GroceryAdditionItemDto, GroceryAdditionProductDto, PolicyAwareAddGroceryItemDto, PolicyAwareGroceryAdditionShape, product, validateDto(), IsArray (+19 more)

### Community 14 - "ListInventoryEventsDto"
Cohesion: 0.14
Nodes (12): ListInventoryEventsDto, IsEnum, IsInt, IsOptional, IsPositive, IsUUID, Max, Min (+4 more)

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
Cohesion: 0.17
Nodes (18): renderScenarioTable(), checkBundles(), generatedBundles(), generatedReleaseArtifacts(), platforms, projectRootArgument, readSource(), releaseContract (+10 more)

### Community 21 - "Upgrade to Prisma ORM 7"
Cohesion: 0.08
Nodes (25): 1. Update package.json for ESM-first projects, 2. Update tsconfig.json, 3. Update schema.prisma, 4. Create prisma.config.ts, 5. Install a driver adapter (SQL providers only), 6. Update client instantiation, 7. Replace Prisma.validator with satisfies, 8. Run migrations and generate (+17 more)

### Community 22 - ".addExplicitProductItem"
Cohesion: 0.23
Nodes (5): ConfirmProductAliasGroceryAddition, GroceryCatalogConfirmationResult, CreateIfMissingGroceryAddition, GroceryAdditionItemInput, GroceryRequestedAddition

### Community 23 - "What You Must Do When Invoked"
Cohesion: 0.08
Nodes (24): For /graphify add and --watch, For /graphify query, For the commit hook and native AGENTS.md integration, For --update and --cluster-only, /graphify, Honesty Rules, Interpreter guard for subcommands, Part A - Structural extraction for code files (+16 more)

### Community 24 - "What You Must Do When Invoked"
Cohesion: 0.08
Nodes (24): For /graphify add and --watch, For /graphify query, For the commit hook and native CLAUDE.md integration, For --update and --cluster-only, /graphify, Honesty Rules, Interpreter guard for subcommands, Part A - Structural extraction for code files (+16 more)

### Community 25 - "What You Must Do When Invoked"
Cohesion: 0.08
Nodes (24): For /graphify add and --watch, For /graphify query, For the commit hook and native CLAUDE.md integration, For --update and --cluster-only, /graphify, Honesty Rules, Interpreter guard for subcommands, Part A - Structural extraction for code files (+16 more)

### Community 26 - "OperationalLogger"
Cohesion: 0.09
Nodes (19): PredictionReasoner, Inject, Injectable, CatalogIntegrityAction, CatalogIntegrityLog, IntegrationErrorType, InventoryAction, InventoryActionLog (+11 more)

### Community 27 - "Relation Queries"
Cohesion: 0.08
Nodes (23): Connect existing, Count Relations, Create or connect, Create with relations, Delete related, Disconnect, every, Filter counted relations (+15 more)

### Community 28 - "Removed Features"
Cohesion: 0.08
Nodes (23): Alternatives, Auto-generate after migrate, Auto-seed after migrate, Automatic Behaviors Removed, CLI Flags Removed, Client Middleware, Common Middleware Patterns, Custom counter with extensions (+15 more)

### Community 29 - "low-stock-recommendation.service.ts"
Cohesion: 0.16
Nodes (10): LowStockRecommendationDto, LowStockRecommendationService, Injectable, compareRecommendations(), LowStockRecommendation, LowStockState, qualifies(), RecommendationCandidate (+2 more)

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

### Community 34 - "UpdateStockDto"
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
Cohesion: 0.09
Nodes (23): class-transformer, cron, dotenv, @modelcontextprotocol/sdk, @nestjs/common, @nestjs/core, @nestjs/platform-express, openai (+15 more)

### Community 39 - "CompletePurchaseDto"
Cohesion: 0.18
Nodes (11): ArrayNotEmpty, CompletePurchaseDto, ArrayUnique, IsArray, IsNotEmpty, IsNumber, IsObject, IsOptional (+3 more)

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

### Community 47 - "McpServerFactory"
Cohesion: 0.29
Nodes (4): mcpGroceryAddition(), McpServerFactory, Inject, Injectable

### Community 48 - "prisma migrate dev"
Cohesion: 0.11
Nodes (18): After schema changes, Command, Common Patterns, Create and apply migration, Create without applying, Examples, Follow-up Commands, Full workflow (+10 more)

### Community 49 - "Data model"
Cohesion: 0.10
Nodes (20): Data model, Deployment, Features, GroceryListItem, Home Stock Tracker - Project Overview, Household, InventoryEvent, LlmInferenceLog (+12 more)

### Community 50 - "requiredTools"
Cohesion: 0.11
Nodes (18): complete_grocery_purchase, get_household_context, get_inventory, get_low_stock_predictions, get_product, grocery-add, grocery_confirm_new_product, grocery_confirm_product_alias (+10 more)

### Community 51 - "normalizeProductName"
Cohesion: 0.16
Nodes (13): normalizeAliases(), normalizeProductDisplayName(), normalizeProductName(), toProductNameValue(), PreparedProductNames, PRODUCT_NAME_KINDS, ProductNameContract, ProductNameKind (+5 more)

### Community 52 - "prisma db seed"
Cohesion: 0.11
Nodes (17): Best Practices, Command, Common Patterns, Common seed commands, Conditional seeding, Configuration, Current Workflow, Development reset (+9 more)

### Community 53 - "Environment Variables"
Cohesion: 0.11
Nodes (17): 1. Install dotenv, 2. Import in prisma.config.ts, Application Code, Bun Users, CI/CD Considerations, Entry point, Environment Variables, Multiple .env Files (+9 more)

### Community 54 - "purchase-contract.ts"
Cohesion: 0.18
Nodes (9): PURCHASE_EVENT_TYPES, RecordPurchasesShapeConstraint, validateDto(), ValidatorConstraint, BatchPurchaseTimestampInput, MAX_BATCH_PURCHASE_ITEMS, PurchaseTimestampException, resolveBatchPurchaseTimestamps() (+1 more)

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

### Community 66 - "GroceryController"
Cohesion: 0.19
Nodes (9): Delete, GroceryController, Body, Controller, Param, Patch, Post, PolicyAwareGroceryAddition (+1 more)

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

### Community 74 - "Home Stock Tracker"
Cohesion: 0.11
Nodes (18): Add one item and handle an existing line, Add several items, Complete a shopping trip, Event mapping, Examples, Grocery conversation workflows, Home Stock Tracker, Household context (+10 more)

### Community 75 - "scripts"
Cohesion: 0.11
Nodes (19): scripts, agent:probe, build, contract:capture, contract:check, db:migrate:deploy, format, lint (+11 more)

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

### Community 80 - "PrismaService"
Cohesion: 0.08
Nodes (7): PrismaService, Injectable, RankedProductId, createProduct(), ProductSearchResponseBody, createFixture(), FixtureProduct

### Community 81 - "Fix Brief: MCP-05 - Standalone alias administration"
Cohesion: 0.14
Nodes (11): Behavior, Fix Brief: MCP-05 - Standalone alias administration, Input, Out of scope, Public contract updates, Remaining gap, Required implementation, Verification (+3 more)

### Community 82 - "GroceryService"
Cohesion: 0.19
Nodes (8): groceryConflict(), GroceryErrorCode, GroceryErrorResponse, groceryInvalid(), groceryNotFound(), GroceryService, Injectable, getCanonicalProductName()

### Community 84 - "product-search.ts"
Cohesion: 0.12
Nodes (22): compareProductSearchMatches(), compareUtf8(), getMatchCategory(), isTokenPrefixMatch(), MATCH_RANK, matchProductName(), PRODUCT_SEARCH_DEFAULT_LIMIT, PRODUCT_SEARCH_MATCH_CATEGORIES (+14 more)

### Community 85 - "inventory-read-response.dto.ts"
Cohesion: 0.13
Nodes (14): DeterministicSignalsDto, DISCRETE_UNITS, emptyDeterministicSignals(), HouseholdInventoryResponseDto, InventoryEstimateResponseDto, InventoryItemResponseDto, InventoryReadEntity, InventoryReadProjection (+6 more)

### Community 86 - "Feature: Confirmed grocery catalog decisions"
Cohesion: 0.13
Nodes (14): 31/F-01 [P2] closed - Confirmed-name validation issues one query per approved name, 31/F-02 [P2] closed - Grocery API reference still describes delivered flows as future or impossible, Build loop, Build steps, Completion record, Data / contracts, Feature: Confirmed grocery catalog decisions, Files / areas (+6 more)

### Community 87 - "continuous - complete the build plan one local feature at a time"
Cohesion: 0.13
Nodes (14): 2.1 Select and spec, 2.2 Create or resume the feature branch, 2.3 Implement small steps, 2.4 Apply Continuous quality gates, 2.5 Repair and re-review findings, 2.6 Complete locally like a human, continuous - complete the build plan one local feature at a time, Formatting (+6 more)

### Community 88 - "Agent Integrations"
Cohesion: 0.15
Nodes (13): Agent Integrations, Configure the MCP server, Hermes Agent, Install the Home Stock Tracker skill, Install the instruction skill, OpenClaw, Other MCP clients, Register and probe MCP (+5 more)

### Community 89 - "Home Stock Tracker"
Cohesion: 0.11
Nodes (17): Add one item and handle an existing line, Add several items, Complete a shopping trip, Event mapping, Examples, Grocery conversation workflows, Home Stock Tracker, Household context (+9 more)

### Community 90 - "Home Stock Tracker"
Cohesion: 0.11
Nodes (17): Add one item and handle an existing line, Add several items, Complete a shopping trip, Event mapping, Examples, Grocery conversation workflows, Home Stock Tracker, Household context (+9 more)

### Community 91 - "ServiceAuthConfigService"
Cohesion: 0.18
Nodes (4): ServiceAuthConfigService, Injectable, ServiceAuthModule, Module

### Community 92 - "InventoryController"
Cohesion: 0.38
Nodes (6): InventoryController, Body, Controller, HttpCode, Param, Post

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
Cohesion: 0.17
Nodes (11): Build loop, Build steps, Completion record, Data / contracts, Files / areas, Fix: MCP-05 standalone alias administration, Goal, In scope (+3 more)

### Community 98 - "product.controller.ts"
Cohesion: 0.16
Nodes (13): CreateProductDto, IsArray, IsNotEmpty, IsOptional, IsString, Transform, ProductResponseDto, ProductController (+5 more)

### Community 99 - "inventory.service.ts"
Cohesion: 0.15
Nodes (18): TransportSource, GroceryItemResponseDto, CompletedItemDto, CompletePartialPurchaseResponseDto, PendingItemDto, SkippedItemDto, CompletePurchaseResponseDto, InventoryEventListResponseDto (+10 more)

### Community 100 - "Feature: Stock ledger foundation"
Cohesion: 0.14
Nodes (13): Build loop, Build steps, Data / contracts, Existing write semantics, Feature: Stock ledger foundation, Files / areas, Goal, In scope (+5 more)

### Community 101 - "Feature: Household profile"
Cohesion: 0.14
Nodes (13): Build loop, Build steps, Data / contracts, Design reference, Feature: Household profile, Files / areas, Goal, Household model (Prisma) (+5 more)

### Community 102 - "Fix: MCP-09 purchase completion loses actual quantity details"
Cohesion: 0.17
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
Cohesion: 0.13
Nodes (14): Build loop, Build steps, Completion record, Data / contracts, Files / areas, Fix: MCP-10 read-only household context, Goal, In scope (+6 more)

### Community 111 - "inventory/stock-materialization.ts"
Cohesion: 0.07
Nodes (35): StockLedgerException, StockStateConflictException, ProjectionRecord, UpdateArguments, UpsertArguments, StockLedgerService, Injectable, assertDailyInput() (+27 more)

### Community 112 - "application-config.ts"
Cohesion: 0.05
Nodes (43): ApplicationConfig, DEFAULT_STOCK_WORKFLOW_CRON, DEFAULT_STOCK_WORKFLOW_TIMEZONE, loadApplicationConfig(), loadStockWorkflowConfig(), optionalTrimmed(), parseBoolean(), parsePort() (+35 more)

### Community 113 - "Feature: Daily stock estimation workflow"
Cohesion: 0.18
Nodes (10): Build loop, Build steps, Data / contracts, Feature: Daily stock estimation workflow, Files / areas, Goal, In scope, Notes for the AI (+2 more)

### Community 114 - "RecordInventoryEventDto"
Cohesion: 0.22
Nodes (9): RecordInventoryEventDto, IsEnum, IsNotEmpty, IsNumber, IsObject, IsOptional, IsString, IsUUID (+1 more)

### Community 115 - "Coding Standards"
Cohesion: 0.15
Nodes (12): API and Data, Browser Verification, Code Quality, Coding Standards, Comments, Error Handling, File Organization, Naming (+4 more)

### Community 116 - "grocery-update.e2e-spec.ts"
Cohesion: 0.14
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
Cohesion: 0.15
Nodes (13): 30/F-01 [P1] closed - Legacy grocery add still permits implicit product creation, Acceptance criteria, Build loop, Build steps, Completion record, Feature: Policy-aware grocery additions, Files / areas, Findings (+5 more)

### Community 122 - "Feature: Partial grocery-list completion"
Cohesion: 0.15
Nodes (12): Build loop, Build steps, Data / contracts, Feature: Partial grocery-list completion, Files / areas, Goal, In scope, Notes for the AI (+4 more)

### Community 123 - "Fix: MCP-07 prediction feedback tool"
Cohesion: 0.17
Nodes (12): Build loop, Build steps, Completion record, Data / contracts, Files / areas, Fix: MCP-07 prediction feedback tool, Goal, In scope (+4 more)

### Community 124 - "autopilot - optional Blueprint loop"
Cohesion: 0.14
Nodes (13): autopilot - optional Blueprint loop, Formatting, Hard Stops, Input, Rules, Step 1 - preflight like /status, Step 2 - choose or write the spec, Step 3 - create or reuse the branch (+5 more)

### Community 125 - "onboard - finish the Blueprint overlay setup"
Cohesion: 0.15
Nodes (12): Formatting, Input, onboard - finish the Blueprint overlay setup, Rules, Step 0 - confirm this is onboarding, not adoption, Step 1 - survey the project facts, Step 2 - update project entry files, Step 3 - tune coding standards (+4 more)

### Community 126 - "product-name.exception.ts"
Cohesion: 0.53
Nodes (4): PRODUCT_NAME_CONFLICT, PRODUCT_NOT_FOUND, ProductNameConflictResponse, productNotFound()

### Community 127 - "CompletePartialPurchaseDto"
Cohesion: 0.18
Nodes (11): CompletePartialPurchaseDto, ArrayMinSize, IsArray, IsNotEmpty, IsNumber, IsObject, IsOptional, IsString (+3 more)

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

### Community 137 - "Household Stock Ledger and Daily Estimation"
Cohesion: 0.22
Nodes (9): Assumptions and Deferred Work, Daily stock workflow, Household Stock Ledger and Daily Estimation, Key Changes, Public Types, REST, MCP, and agent behavior, Stock persistence and events, Summary (+1 more)

### Community 138 - "structured-generation.ts"
Cohesion: 0.17
Nodes (10): OpenAiLlmProvider, parsedResult, request, Inject, Injectable, LlmRefusal, LlmResultMetadata, LlmSuccess (+2 more)

### Community 139 - "policy-aware-grocery-addition.ts"
Cohesion: 0.17
Nodes (11): ConfirmedGroceryItemInput, ConfirmNewProductGroceryAddition, GroceryCatalogConfirmationBase, CreatedGroceryAdditionResult, GroceryAdditionProductInput, GroceryAdditionRequestBase, GroceryConfirmationRequiredResult, ProposeIfMissingGroceryAddition (+3 more)

### Community 140 - "Independent review record"
Cohesion: 0.33
Nodes (5): Completed receipt, Freshness, Independent review record, Pending request, Reset stub

### Community 141 - "Independent review record"
Cohesion: 0.33
Nodes (5): Completed receipt, Freshness, Independent review record, Pending request, Reset stub

### Community 142 - "Integration troubleshooting"
Cohesion: 0.40
Nodes (5): Integration troubleshooting, The client cannot connect, The client receives `401`, The client receives `404`, The connection works but tools are missing

### Community 143 - "LlmProvider"
Cohesion: 0.15
Nodes (9): candidate, LLM_PROVIDER, LlmProvider, LlmProviderRegistry, Injectable, Inject, confirmNew(), postNew() (+1 more)

### Community 144 - "product-with-names.ts"
Cohesion: 0.28
Nodes (4): getProductAliases(), PRODUCT_NAMES_ORDER_BY, PRODUCT_WITH_NAMES_ARGS, PRODUCT_WITH_NAMES_INCLUDE

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
Cohesion: 0.14
Nodes (20): assertExactKeys(), assertObject(), AUTHENTICATION_KEYS, BUNDLE_KEYS, compareSemver(), loadReleaseContract(), loadReleaseContractFile(), MCP_KEYS (+12 more)

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
Cohesion: 0.11
Nodes (18): features, batch-purchase-recording, grocery-catalog-confirmation, grocery-list, grocery-purchase-completion, grocery-remove, grocery-update, household-context (+10 more)

### Community 168 - "agent-scenarios.mjs"
Cohesion: 0.18
Nodes (16): assertExactKeys(), assertObject(), assertUniqueStrings(), CALL_KEYS, ENUM_KEYS, INVARIANTS, loadScenarioContract(), PLATFORMS (+8 more)

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
Cohesion: 0.11
Nodes (18): complete_grocery_purchase, get_household_context, get_inventory, get_low_stock_predictions, get_product, grocery-add, grocery_confirm_new_product, grocery_confirm_product_alias (+10 more)

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

### Community 190 - "ProductSearchService"
Cohesion: 0.18
Nodes (9): ProductResolutionRequiredResult, ProductSearchProductResponseDto, ProductSearchResponseDto, Query, ProductSearchService, Injectable, ProductSearchProduct, ProductSearchRequest (+1 more)

### Community 191 - "Fix Brief: MCP-10 — No read-only household context tool"
Cohesion: 0.15
Nodes (13): Acceptance criteria, Acceptance criteria, Agent discussion prompts, Expected implementation output, Fix Brief: MCP-10 — No read-only household context tool, Implementation constraints, Objective, Out of scope (+5 more)

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

### Community 198 - "ProductResolutionService"
Cohesion: 0.27
Nodes (5): ProductResolutionService, Inject, Injectable, ProductResolutionContext, ProductResolutionResult

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
Cohesion: 0.22
Nodes (9): Build the image, Configure the environment, Deployment, Migrate before starting the app, Prerequisites, Probe and smoke-test, Restart and stop, Rollback and recovery (+1 more)

### Community 227 - "Hermes installation"
Cohesion: 0.22
Nodes (9): Create the job, Hermes installation, Install locally, Job prompt, Prerequisite, Prerequisites, Proactive stock-check cron, Smoke check (+1 more)

### Community 228 - "exclude"
Cohesion: 0.22
Nodes (8): dist, node_modules, prisma.config.ts, **/*spec.ts, test, ./tsconfig.json, exclude, extends

### Community 229 - "mcp-server.factory.spec.ts"
Cohesion: 0.12
Nodes (18): CORRECTED_STATES, CorrectedStateMatchesOutcomeConstraint, PredictionFeedbackDto, PredictionFeedbackOutcome, accepted, corrected, rejected, validateBody() (+10 more)

### Community 230 - "agent-release-contract.generated.ts"
Cohesion: 0.12
Nodes (11): BundleManifest, bundleRoot(), readManifest(), ToolFixture, householdContext, ProbeProcessResult, ProbeServerState, AGENT_RELEASE_CONTRACT (+3 more)

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

### Community 249 - "Fix: Publish a reliable `get_product` input schema"
Cohesion: 0.29
Nodes (6): Build steps, Completion record, Fix: Publish a reliable `get_product` input schema, The fix, The problem, Verify

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
Cohesion: 0.29
Nodes (7): Architecture, Common commands, Current status, Documentation, Home Stock Tracker, Quickstart, What it does

### Community 256 - "fix - document an ad-hoc fix, then build it like anything else"
Cohesion: 0.33
Nodes (5): fix - document an ad-hoc fix, then build it like anything else, Formatting, Input, Rules, Step 1 - write the fix spec

### Community 257 - "graphify reference: query, path, explain"
Cohesion: 0.33
Nodes (5): For /graphify explain, For /graphify path, graphify reference: query, path, explain, Step 0 — Constrained query expansion (REQUIRED before traversal), Step 1 — Traversal

### Community 259 - "Q: Which existing estimation, shelf-life, statistics, stock projection, and quantity contracts constrain feature 33b Step 2?"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: Which existing estimation, shelf-life, statistics, stock projection, and quantity contracts constrain feature 33b Step 2?, Source Nodes

### Community 260 - "triage.md"
Cohesion: 0.22
Nodes (4): Archived resolutions, Deferred candidates, MCP and skill gaps — active triage, Rejected as separate work

### Community 261 - "fix - document an ad-hoc fix, then build it like anything else"
Cohesion: 0.33
Nodes (5): fix - document an ad-hoc fix, then build it like anything else, Formatting, Input, Rules, Step 1 - write the fix spec

### Community 262 - "graphify reference: query, path, explain"
Cohesion: 0.33
Nodes (5): For /graphify explain, For /graphify path, graphify reference: query, path, explain, Step 0 — Constrained query expansion (REQUIRED before traversal), Step 1 — Traversal

### Community 263 - "graphify reference: query, path, explain"
Cohesion: 0.33
Nodes (5): For /graphify explain, For /graphify path, graphify reference: query, path, explain, Step 0 — Constrained query expansion (REQUIRED before traversal), Step 1 — Traversal

### Community 264 - "agent-integrations.md"
Cohesion: 0.31
Nodes (3): Home Stock Tracker skill scenarios, Review record, Scheduled proactive-check scenarios

### Community 265 - "OpenClaw installation"
Cohesion: 0.33
Nodes (5): Install locally, OpenClaw installation, Prerequisite, Scheduling boundary, Smoke check

### Community 266 - "nest-cli.json"
Cohesion: 0.33
Nodes (5): collection, compilerOptions, deleteOutDir, $schema, sourceRoot

### Community 267 - "Fix: Expose inventory-event history through MCP"
Cohesion: 0.17
Nodes (11): Build steps, Completion record, Data / contracts, Files / areas, Fix: Expose inventory-event history through MCP, MCP input, MCP output, Notes for the AI (+3 more)

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

### Community 274 - "product-name-namespace-migration.e2e-spec.ts"
Cohesion: 0.18
Nodes (10): applyMigration(), applyMigrations(), contractMigrationIndex, expandedMigrations, migrationNames, MIGRATIONS_DIRECTORY, namespaceMigrationIndex, previousMigrations (+2 more)

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

### Community 280 - "build-plan.md"
Cohesion: 0.25
Nodes (5): Build Plan, MVP, Post-MVP, Ideas that are not implementation-ready, Queued feature plans

### Community 284 - "mcp-contract-fixture.spec.ts"
Cohesion: 0.50
Nodes (6): discoverMcpContractSnapshot(), McpContractSnapshot, normalizeJson(), normalizeMcpContractSnapshot(), readMcpContractSnapshot(), writeNewMcpContractSnapshot()

### Community 285 - ".listItems"
Cohesion: 0.29
Nodes (5): ListGroceryItemsDto, IsEnum, IsOptional, Get, Query

### Community 286 - "purchase-completion.mcp.e2e-spec.ts"
Cohesion: 0.25
Nodes (4): CompletionContent, createProduct(), eventCount(), unchangedItems()

### Community 287 - "grocery.service.ts"
Cohesion: 0.11
Nodes (20): SetGroceryItemQuantityDto, IsDefined, IsNumber, IsPositive, IsDefined, IsNotEmpty, IsNumber, IsOptional (+12 more)

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

### Community 294 - "mcp.controller.spec.ts"
Cohesion: 0.12
Nodes (11): All, Req, Res, MCP_SERVER_INFO, McpController, initializeRequest, TestRestController, Controller (+3 more)

### Community 310 - "Feature: Materialized inventory reads and recommendations"
Cohesion: 0.18
Nodes (10): Build loop, Build steps, Data / contracts, Feature: Materialized inventory reads and recommendations, Files / areas, Goal, In scope, Notes for the AI (+2 more)

### Community 314 - "network"
Cohesion: 0.20
Nodes (10): environmentVariable, scheme, baseUrlEnvironmentVariable, healthPath, mcpPath, readinessPath, transport, prerequisites (+2 more)

### Community 318 - "estimation-response.e2e-spec.ts"
Cohesion: 0.60
Nodes (3): PREDICTION_ENGINE, PredictionEngine, baseResult

### Community 321 - "agent-documentation-contract.mjs"
Cohesion: 0.20
Nodes (7): authoredPublicDocs, integrationGuide, normalizedIntegrationGuide, platforms, projectRoot, releaseContract, TOOL_COUNT_PATTERN

### Community 322 - "AddProductAliasDto"
Cohesion: 0.40
Nodes (4): AddProductAliasDto, IsNotEmpty, IsString, Transform

### Community 323 - "HouseholdService"
Cohesion: 0.10
Nodes (21): CreateHouseholdDto, IsArray, IsInt, IsNumber, IsOptional, IsString, Max, Min (+13 more)

### Community 324 - "mcp"
Cohesion: 0.22
Nodes (9): mcp, compatibleRange, contractVersion, serverName, toolsFixture, versionPolicy, additive, breaking (+1 more)

### Community 335 - "mcp"
Cohesion: 0.22
Nodes (9): mcp, compatibleRange, contractVersion, serverName, toolsFixture, versionPolicy, additive, breaking (+1 more)

### Community 337 - "agent-installation-probe.mjs"
Cohesion: 0.19
Nodes (18): checkHttpEndpoint(), classifyMcpConnectionError(), compareVersions(), diagnostic(), DIAGNOSTICS, EXIT_CODES, HOUSEHOLD_CONTEXT_KEYS, isHouseholdContext() (+10 more)

### Community 339 - "Feature: Verifiable agent integration contract"
Cohesion: 0.18
Nodes (11): Build loop, Build steps, Completion record, Data / contracts, Feature: Verifiable agent integration contract, Files / areas, Goal, In scope (+3 more)

### Community 341 - "Home Stock Tracker Hermes release contract"
Cohesion: 0.29
Nodes (6): Compatibility, Home Stock Tracker Hermes release contract, Prerequisites, Required MCP tools, Rollback, Verification

### Community 342 - "Home Stock Tracker OpenClaw release contract"
Cohesion: 0.29
Nodes (6): Compatibility, Home Stock Tracker OpenClaw release contract, Prerequisites, Required MCP tools, Rollback, Verification

## Knowledge Gaps
- **2476 isolated node(s):** `schemaVersion`, `version`, `claude`, `codex`, `copilot` (+2471 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **32 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Work-memory lessons

**Preferred sources** — corroborated by past sessions; start here.
- `InventoryService` (6× useful, score=5.751132538) _(code changed — re-verify)_
- `McpServerFactory` (4× useful, score=3.894282531) _(code changed — re-verify)_
- `StockLedgerService` (2× useful, score=1.999517406) _(code changed — re-verify)_
- `OpenClaw` (2× useful, score=1.929868891)
- `PredictionFeedbackService` (2× useful, score=1.929868891)
- `GroceryService` (2× useful, score=1.821746242)

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `PrismaService` connect `PrismaService` to `statistics.service.ts`, `product-resolution.ts`, `prisma.service.ts`, `product.service.ts`, `policy-aware-grocery-addition.ts`, `estimation.service.ts`, `LlmProvider`, `app.module.ts`, `health.controller.ts`, `OperationalLogger`, `low-stock-recommendation.service.ts`, `purchase-completion.mcp.e2e-spec.ts`, `grocery.service.ts`, `AppService`, `inventory-mutations.mcp.e2e-spec.ts`, `normalizeProductName`, `estimation-response.e2e-spec.ts`, `ProductSearchService`, `HouseholdService`, `ProductResolutionService`, `policy-aware-grocery.mcp.e2e-spec.ts`, `inventory.service.ts`, `mcp-server.factory.spec.ts`, `inventory/stock-materialization.ts`, `application-config.ts`, `grocery-update.e2e-spec.ts`?**
  _High betweenness centrality (0.012) - this node is a cross-community bridge._
- **Why does `CompletePurchaseDto` connect `CompletePurchaseDto` to `inventory.service.ts`, `InventoryController`, `InventoryService`?**
  _High betweenness centrality (0.007) - this node is a cross-community bridge._
- **Why does `GroceryItemResponseDto` connect `inventory.service.ts` to `GroceryController`, `AddGroceryItemDto`, `policy-aware-grocery-addition.ts`, `GroceryService`, `.listItems`, `grocery.service.ts`?**
  _High betweenness centrality (0.005) - this node is a cross-community bridge._
- **What connects `schemaVersion`, `version`, `claude` to the rest of the system?**
  _2476 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `managedFiles` be split into smaller, more focused modules?**
  _Cohesion score 0.031746031746031744 - nodes in this community are weakly interconnected._
- **Should `RecordPurchasesDto` be split into smaller, more focused modules?**
  _Cohesion score 0.13333333333333333 - nodes in this community are weakly interconnected._
- **Should `statistics.service.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.12413793103448276 - nodes in this community are weakly interconnected._