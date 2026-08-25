# Feature: Product catalog and normalization

**From build-plan:** feature 2
**Status:** complete

## Goal

Let a client explicitly manage the product catalog (create, list, look up, and add aliases to a `Product`) and make grocery-item resolution alias-aware, so "add milk" and "add moo juice" resolve to the same canonical product instead of creating duplicate rows. This also extracts feature 1's inline product-matching logic out of `GroceryService` into a dedicated `ProductService`, since alias-aware matching now needs to be shared rather than duplicated.

## In scope

- A new `ProductModule` / `ProductService` / `ProductController` under `src/product/`.
- `POST /api/v1/products` - explicit product creation (`canonicalName`, optional `aliases[]`, `category`, `typicalUnit`). Rejects (409) an exact case-insensitive duplicate `canonicalName`.
- `GET /api/v1/products` - list all products.
- `GET /api/v1/products/:id` - fetch one product; 404 if unknown.
- `POST /api/v1/products/:id/aliases` - append one normalized alias to an existing product; no-op/409 on a duplicate (case-insensitive, against that product's own `canonicalName` or existing aliases).
- Alias-aware resolution: the matching logic feature 1 built (trim + case-fold, exact match, auto-create-if-missing) is extracted into `ProductService.findOrCreateByExactOrAliasMatch()` and extended to also match against any alias, not just `canonicalName`. `GroceryService.addItem` is updated to call this instead of its own inline Prisma calls.
- Moving `normalizeProductName` (and its test) from `src/grocery/` to `src/product/`, since normalization is now product-owned logic.

## Out of scope

- Fuzzy/typo-tolerant matching (e.g. "milc" -> "milk") - still exact-name-or-exact-alias only, per this project's deterministic-first approach. Genuinely fuzzy or inferred matching is feature 8 (LLM-assisted product understanding).
- `category`/`productType` classification logic - this feature lets `category` be set explicitly at creation time only; automatic classification is feature 8.
- Editing or removing an existing alias, or updating `canonicalName`/`category`/`typicalUnit` after creation - no `PATCH /api/v1/products/:id` in this feature. Only additive (`POST .../aliases`) is in scope.
- Cross-product alias uniqueness (the same alias claimed by two different products) - only within-product duplicate aliases are rejected. Not a concern raised by the current data model or any downstream feature yet.
- A DB-level unique constraint on `canonicalName` - duplicate detection stays an application-level check (`findFirst` before `create`), consistent with feature 1's choice to leave `canonicalName` re-keyable for now.
- Authentication on these endpoints (feature 16).
- The Hermes/MCP tool wrapper (features 12-13).

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - ProductModule scaffold** - `src/product/product.module.ts` with an empty `ProductService`/`ProductController`, wired into `AppModule`. *Done when:* `npm run start:dev` boots with the new module loaded and no errors.
- [x] **Step 2 - Extract product matching into `ProductService` (behavior-preserving)** - move `normalizeProductName` from `src/grocery/product-name.util.ts` to `src/product/product-name.util.ts` (and its spec). Add `ProductService.findOrCreateByExactOrAliasMatch(rawName: string)` doing exactly what `GroceryService` did before - normalize, exact case-insensitive `canonicalName` match, else create - no alias matching yet. Update `GroceryService.addItem` to call this instead of its own inline `findFirst`/`create` calls; `GroceryModule` imports `ProductModule`. *Done when:* the existing grocery repro from feature 1 still holds - `POST /api/v1/grocery/items { "productName": "Milk" }` then `POST { "productName": "milk" }` resolve to the same `productId` - now served through `ProductService`.
- [x] **Step 3 - Extend matching to be alias-aware** - update `findOrCreateByExactOrAliasMatch` so the lookup also matches any case-insensitive entry in a product's `aliases` array, not just `canonicalName`. *Done when:* the build passes and step 2's exact-match repro still holds unchanged (regression-safe); the actual alias-resolution path is proven end-to-end once the add-alias endpoint exists (step 6).
- [x] **Step 4 - Create product (`POST /api/v1/products`)** - `CreateProductDto` (`canonicalName` required non-empty/trimmed, `aliases?: string[]`, `category?: string`, `typicalUnit?: string`); aliases are normalized (trim, case-fold, deduped, and any alias equal to the normalized `canonicalName` is dropped). *Done when:* `POST { "canonicalName": "Milk", "aliases": ["moo juice"] }` returns `201` with the created product; a second `POST { "canonicalName": "milk" }` returns `409`.
- [x] **Step 5 - List and get products (`GET /api/v1/products`, `GET /api/v1/products/:id`)** - list returns all products; get-by-id returns one or `404`. *Done when:* `GET /api/v1/products` returns `[]` on an empty catalog and the full array otherwise; `GET /api/v1/products/:id` returns `200` for an existing id and `404` for an unknown one.
- [x] **Step 6 - Add alias (`POST /api/v1/products/:id/aliases`)** - `AddProductAliasDto` (`alias` required non-empty/trimmed). Normalizes and appends if not already present (case-insensitive) among the product's aliases or its `canonicalName`; `404` for an unknown product id, `409` for a duplicate alias. *Done when:* `POST /api/v1/products/:id/aliases { "alias": "moo juice" }` returns the updated product with the new alias; a follow-up `POST /api/v1/grocery/items { "productName": "moo juice" }` resolves to that same `productId` rather than creating a new `Product` (this is the end-to-end proof of step 3's alias-aware matching); re-posting the same alias returns `409`.
- [x] **Step 7 - Unit test: normalization and alias dedup** - test `normalizeProductName` at its new location plus the alias-normalization/dedup logic (trim, case-fold, empty/whitespace-only, alias equal to canonical name excluded, duplicate alias excluded). *Done when:* `npm run test` passes and covers those edge cases.

## Files / areas

- `src/product/product.module.ts`, `product.controller.ts`, `product.service.ts`
- `src/product/product-name.util.ts`, `product-name.util.spec.ts` (moved from `src/grocery/`)
- `src/product/dto/create-product.dto.ts`, `add-product-alias.dto.ts`, `product-response.dto.ts`
- `src/grocery/grocery.service.ts` (delegates product resolution to `ProductService`, drops its inline Prisma product logic)
- `src/grocery/grocery.module.ts` (imports `ProductModule`)
- `src/app.module.ts` (imports `ProductModule`)

## Data / contracts

No schema/migration changes - `Product.aliases`, `category`, and `typicalUnit` already exist from feature 1's locked data model; this feature is the first to populate and expose them.

**Response shape** for all four product endpoints (array for list, single object otherwise), matching the existing `Product` model fields:
`{ id, canonicalName, aliases, category, typicalUnit, productType, isPerishable, predictionStrategy, predictionEnabled, config }` - `productType`, `predictionStrategy`, `config` stay `null`/default (feature 8's concern); `isPerishable`/`predictionEnabled` stay at their schema defaults.

**`ProductService.findOrCreateByExactOrAliasMatch(rawName: string): Promise<Product>`** - load-bearing: `GroceryService` depends on this exact signature/behavior, and any later feature that resolves a product by free-text name (e.g. a future Hermes/MCP tool) should call this rather than re-implementing matching.

## Testing

- The test gate is **on** (`npm run test`). Test files are `*.spec.ts` per this repo's Jest `testRegex`.
- **In scope for a unit test:** `normalizeProductName` (moved, same edge cases as feature 1) and the alias-normalization/dedup logic added in steps 4 and 6 - pure logic, real edge cases (empty, whitespace-only, mixed case, duplicate-of-canonical, duplicate-of-existing-alias).
- **Not unit-tested:** the Prisma-backed controller/service methods (`ProductService.findOrCreateByExactOrAliasMatch`, the four endpoints) - no Postgres-backed e2e harness exists yet (same gap noted in feature 1). Verify steps 2-6 manually against the Docker Postgres instance via curl/HTTPie, per each step's done-when.

## Notes for the AI

- Keep persistence behind `PrismaService`; controllers stay thin and delegate to services, per `coding-standards.md`.
- This is a refactor-and-extend of feature 1's product matching, not a rewrite: `GroceryService.addItem`'s observable behavior (auto-create a `Product` on first use, reuse it on exact match) must keep working exactly as before, now routed through `ProductService` and additionally alias-aware.
- No fuzzy matching, no LLM calls, no `productType` classification - all deferred per this project's `project-overview.md` feature boundaries (feature 8).
- No auth guard on these routes yet (feature 16).
- Follow `coding-standards.md` writing rules in any comments/docs this feature touches: no em dashes, hyphen for `term - description`.
