# Feature: Grocery list management

**From build-plan:** feature 1
**Status:** not started

## Goal

Let a client (Hermes, or direct API calls for now) add items to a shared household grocery list by name, retrieve the current list, and remove items - through a REST API. This is the first feature to touch the database, so it also stands up Postgres/Prisma for the project.

## In scope

- Local PostgreSQL via Docker Compose, and Prisma as the ORM (first-time setup for this repo).
- A minimal `Product` row, auto-created by exact (case/whitespace-insensitive) name match when a grocery item is added by name - just enough to satisfy the locked `GroceryListItem.productId` FK.
- `GroceryListItem` CRUD: add, list (with a `status` filter), and soft-remove, under `/api/v1/grocery/items`.
- A global `ValidationPipe` (first introduction of `class-validator`/`class-transformer` in this project) and the `api/v1` route prefix.

## Out of scope

- Product normalization/alias matching beyond an exact name match - fuzzy matching, aliases, category, `productType` classification, etc. belong to feature 2 (Product catalog and normalization) and feature 8 (LLM-assisted product understanding). This feature only creates the bare `Product` row; those fields stay nullable/defaulted.
- `InventoryEvent` records and `GroceryListItem.relatedInventoryEventId`. That column is intentionally **not** part of this feature's schema/migration - feature 3 (Inventory event tracking) creates the `InventoryEvent` table and adds the FK column then. Until feature 3 lands, add/remove here do not write any event log.
- The purchase/restock flow and the `status = 'purchased'` transition (feature 4).
- Deduplicating repeated adds of the same product into one row/quantity bump - each `POST` creates a new list entry, even if one for that product is already pending. Merge-on-duplicate behavior, if wanted, is a later decision.
- Authentication on these endpoints (feature 16 - Service authentication).
- Swagger/OpenAPI generation - can be added later without changing these routes.
- The Hermes/MCP tool wrapper (features 12-13) - this feature only builds the REST endpoints Hermes will eventually call.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - Local Postgres via Docker Compose** - add `docker-compose.yml` (a `postgres:16-alpine` service, named volume, env-driven user/password/db) and `.env.example` documenting `DATABASE_URL`. *Done when:* `docker compose up -d` starts a healthy Postgres container reachable at the documented `DATABASE_URL`.
- [x] **Step 2 - Install Prisma and define the schema** - add `prisma`/`@prisma/client`; write `prisma/schema.prisma` with the `Product` and `GroceryListItem` models and enums below; run the first migration. *Done when:* `npx prisma migrate dev` succeeds against the Docker Postgres and creates both tables.
- [x] **Step 3 - PrismaService + GroceryModule scaffold** - an injectable `PrismaService` (extends `PrismaClient`, hooks into Nest's lifecycle for connect/disconnect), a `GroceryModule` wired into `AppModule`, with an empty `GroceryController`/`GroceryService`. *Done when:* `npm run start:dev` boots with the new module loaded and no errors.
- [x] **Step 4 - Request validation pipeline** - add `class-validator`/`class-transformer`; enable a global `ValidationPipe` (`whitelist: true, transform: true`) and `app.setGlobalPrefix('api/v1')` in `main.ts`. *Done when:* a request with an invalid body (e.g. missing required field) returns `400` with a validation error message.
- [x] **Step 5 - Add grocery item (`POST /api/v1/grocery/items`)** - `AddGroceryItemDto` (`productName`, `requestedQuantity?`, `unit?`, `note?`, `source?`); service logic normalizes `productName` (trim + case-fold for lookup) and upserts a minimal `Product` if none matches, then creates a `GroceryListItem` with `status: pending`. *Done when:* `POST { "productName": "Milk" }` returns `201` with the created item and its resolved `productId`; a follow-up `POST { "productName": "milk" }` reuses that same `Product` row (verify via `productId` equality) rather than creating a second `Product`.
- [x] **Step 6 - List grocery items (`GET /api/v1/grocery/items`)** - optional `?status=` query param filters by status; omitted defaults to `pending`. *Done when:* `GET` with no query param returns only pending items; `GET ?status=removed` returns removed ones; an empty result returns `[]`, not an error.
- [x] **Step 7 - Remove grocery item (`DELETE /api/v1/grocery/items/:id`)** - sets `status` to `removed` (soft delete - never a hard row delete, consistent with this project's append-only-history direction). *Done when:* `DELETE` on an existing pending item returns `200`/`204` and it no longer appears in the default `GET` list; `DELETE` on an unknown id returns `404`.
- [x] **Step 8 - Unit test: product-name normalization** - test the normalization helper in isolation (trim, case-fold, empty/whitespace-only input). *Done when:* `npm run test` passes and covers those edge cases.

## Files / areas

- `docker-compose.yml`, `.env.example`
- `prisma/schema.prisma`, `prisma/migrations/`
- `src/prisma/prisma.service.ts`, `src/prisma/prisma.module.ts`
- `src/grocery/grocery.module.ts`, `grocery.controller.ts`, `grocery.service.ts`
- `src/grocery/dto/add-grocery-item.dto.ts`, `src/grocery/dto/grocery-item-response.dto.ts`
- `src/main.ts` (global `ValidationPipe` + prefix)
- `src/app.module.ts` (import `GroceryModule`)
- `package.json` (new deps: `prisma`, `@prisma/client`, `class-validator`, `class-transformer`)

## Data / contracts

Load-bearing - later features (Purchase flow, MCP tools) consume these shapes as-is.

**`Product`** (Prisma model; only `id`/`canonicalName`/`aliases` are populated by this feature - the rest stay nullable/defaulted until features 2 and 8):

- `id` (uuid, PK)
- `canonicalName` (string, unique-by-lookup - not a DB `@unique` constraint yet, since feature 2's normalization may need to merge/re-key entries)
- `aliases` (string[], `@default([])`)
- `category` (string, nullable)
- `typicalUnit` (string, nullable)
- `productType` (enum `ProductType`, nullable)
- `isPerishable` (boolean, `@default(false)`)
- `predictionStrategy` (string, nullable)
- `predictionEnabled` (boolean, `@default(true)`)
- `config` (Json, nullable)

**`GroceryListItem`** (Prisma model; no `relatedInventoryEventId` yet - see Out of scope):

- `id` (uuid, PK)
- `productId` (uuid, FK -> `Product.id`)
- `requestedQuantity` (float, nullable)
- `unit` (string, nullable)
- `dateAdded` (datetime, `@default(now())`)
- `status` (enum `GroceryItemStatus`: `pending` | `purchased` | `removed`, `@default(pending)`)
- `note` (string, nullable)
- `source` (enum `GroceryItemSource`: `hermes_whatsapp` | `api`, `@default(api)`)

**Enums:** `ProductType` (`fast_consumable`, `pantry_staple`, `household_consumable`, `discrete_consumable`), `GroceryItemStatus`, `GroceryItemSource` - all declared now even though only a subset of values is exercised by this feature, per the locked overview data model.

**Response shape** for all three endpoints (array for list, single object for add):
`{ id, productId, productName, requestedQuantity, unit, dateAdded, status, note, source }` - `productName` is denormalized from the joined `Product.canonicalName` for convenience.

## Testing

- The test gate is **on** (`npm run test` / Jest is configured). Test files in this repo are collected as `*.spec.ts` (the actual Jest `testRegex`, not the generic `*.test.ts` named in `coding-standards.md`) - name the new test `src/grocery/product-name.util.spec.ts` (or colocate with wherever the normalization helper lives) so Jest actually picks it up.
- **In scope for a unit test:** the product-name normalization helper (step 8) - pure logic, real edge cases (empty, whitespace-only, mixed case, already-normalized).
- **Not unit-tested:** the Prisma-backed controller/service methods. No Postgres-backed e2e harness exists yet in this repo (`test/jest-e2e.json` currently only covers the default scaffold `AppController`). Verify steps 5-7 manually against the Docker Postgres instance via curl/HTTPie, per each step's done-when.
- `> TODO`: wiring up an e2e harness that runs migrations against a real (or ephemeral/testcontainers) Postgres is worth a dedicated `/tests` pass later if automated API-level coverage becomes a priority. Out of scope here.

## Notes for the AI

- Keep persistence behind `PrismaService`; the controller stays thin and delegates to `GroceryService` (per `coding-standards.md`).
- `app.setGlobalPrefix('api/v1')` is enough for now - no need for NestJS's URI-versioning module with only one version in play.
- Soft-delete only: `removed` is a status, never a row delete - keeps the door open for the append-only event history this project is building toward, even though the event log itself (`InventoryEvent`) isn't wired up until feature 3.
- Product matching for this feature is exact-name-only (trim + case-fold). Do not add fuzzy/alias matching now - that's feature 2.
- No auth guard on these routes yet (feature 16 adds it) - don't add one prematurely.
- Follow `coding-standards.md` writing rules in any comments/docs this step touches: no em dashes, hyphen for `term - description`.
