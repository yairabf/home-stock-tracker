# Feature: Product name namespace

**From build-plan:** feature 27
**Status:** complete
**Depends on:** none
**Intended history file:** `blueprint/history/features/27-product-name-namespace.md`

## Completion record

**Completed:** 2026-09-01

**Delivered:** Product identity now uses one authoritative, globally unique `ProductName` namespace for canonical names and aliases. Product creation and alias writes are transactional, exact lookup remains indexed, public REST and MCP responses preserve approved display spelling, cross-owner conflicts return `PRODUCT_NAME_CONFLICT`, and impossible multi-owner states emit an allowlisted `catalog.integrity` error before failing closed. Forward expand and contract migrations validate and backfill existing names, then remove the legacy `Product.canonicalName` and `Product.aliases` columns.

**Changed areas:**

- `prisma/schema.prisma` and two forward migrations add, validate, backfill, constrain, and contract the namespace.
- `src/product/` owns normalization, namespace-backed reads and writes, conflict translation, response assembly, and focused tests.
- Grocery, inventory, estimation, statistics, MCP, and shared E2E fixtures now consume products with ordered namespace rows.
- `src/observability/` publishes safe catalog-integrity failures.
- `docs/api-reference.md` documents normalization, idempotency, response, REST conflict, and MCP behavior.

**Verification:**

- `npx prisma validate` passed.
- `npx prisma generate` passed.
- `npm test -- --runInBand` passed: 35 suites and 392 tests.
- `npm run test:e2e -- --runInBand` passed: 13 suites and 98 tests, including fresh and upgraded migrations, invalid migration fixtures, concurrent writes, REST conflicts, approved display spelling, grocery aliases, and MCP behavior.
- `npm run build` passed.
- Focused ESLint for the changed implementation files passed.
- `git diff --check` passed.
- Manual try path: create a mixed-case product and alias, resolve it with normalized case and whitespace, repeat the alias idempotently, then attempt cross-product alias ownership and observe the stable HTTP `409` payload. MCP `get_product` resolves the same alias to the same approved display response.

**Deviations:** None.

## Goal

Make product identity deterministic and efficient by storing canonical names and aliases in one authoritative, globally unique normalized namespace. Replace full-catalog scans for exact matching and prevent one normalized phrase from identifying multiple products.

## In scope

- Add `ProductName` and `ProductNameKind` to Prisma.
- Store an approved `displayName`, a deterministic `normalizedName`, the name kind, and the owning `productId`.
- Require every service-created product to have exactly one canonical name and zero or more explicit aliases.
- Enforce global uniqueness of `normalizedName`, index `productId`, and add a PostgreSQL partial unique index allowing at most one canonical row per product.
- Backfill and validate existing canonical names and aliases before removing the legacy `Product.canonicalName` and `Product.aliases` columns.
- Refactor product creation, exact lookup, alias addition, response assembly, and all product-name consumers to use the namespace.
- Preserve the existing REST and MCP response shape with derived `canonicalName` and `aliases` fields.
- Return a stable `PRODUCT_NAME_CONFLICT` response for cross-product ownership conflicts.
- Make alias addition idempotent when the normalized phrase already belongs to the target product, including when it is that product's canonical name.
- Emit an allowlisted error-level operational event if an impossible catalog collision is detected defensively.

## Out of scope

- Product candidate search, proposal generation, and grocery-add policy changes planned for later queued features.
- Canonical-name rename, alias removal, product merge, or product deletion.
- Generic family terms shared by several products.
- Per-household or multi-household catalogs.
- Fuzzy, trigram, vector, or semantic matching.
- New product metadata fields or changes to the current create-product request beyond name storage semantics.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff, not full files; you read and understand it.
4. You approve, then choose whether to commit a checkpoint or continue.
   Checkpoints are optional; `/complete` makes the feature-level commit.

Never accept a step you have not read. If a diff is too big to review, split the step.

## Build steps

- [x] **Step 1 - Lock display and lookup normalization contracts** - update product-name utilities and focused tests for the two stored values: `displayName` uses Unicode NFKC normalization, trim, and internal whitespace collapse while preserving approved case; `normalizedName` applies locale-independent lowercase to that display value. Add typed product-name and `PRODUCT_NAME_CONFLICT` domain contracts without changing persistence yet. _Done when:_ case, surrounding whitespace, repeated internal whitespace, and Unicode-equivalent input normalize consistently; blank input remains invalid; `3% milk` and `three percent milk` remain distinct unless one is explicitly stored as an alias.
- [x] **Step 2 - Expand and backfill the namespace without breaking the running app** - add `ProductNameKind`, `ProductName`, its relation, global normalized-name uniqueness, the `productId` index, and the raw PostgreSQL partial canonical index in a forward expand migration. Preflight legacy rows for blank names, within-product duplicates, cross-product collisions, and missing canonical values; backfill canonical and alias display values; verify one canonical row per product. Retain the legacy name columns temporarily so the pre-refactor application still builds and runs. _Done when:_ a fresh database and a database migrated from the current schema both apply the expand migration; invalid legacy data aborts with a clear diagnostic before destructive changes; generated Prisma types expose the new relation while the existing application remains green.
- [x] **Step 3 - Move product writes and conflict handling to the namespace** - make product creation insert the product and all normalized name rows atomically, and make alias addition use a serializable transaction. During the expand/contract window, maintain the legacy columns only as a compatibility projection. Translate Prisma uniqueness failures into the stable domain conflict and resolve same-owner retries idempotently. Preserve the existing create-product metadata fields. _Done when:_ creation always produces one canonical row; same-owner alias retries return the existing product without mutation; cross-owner and concurrent conflicts return `PRODUCT_NAME_CONFLICT`; no raw Prisma or PostgreSQL error reaches REST, MCP, or grocery flows.
- [x] **Step 4 - Move exact reads and public response assembly to the namespace** - replace full-catalog scans with an indexed `normalizedName` lookup that loads the owning product and ordered name rows. Refactor list/get, grocery, inventory, estimation, statistics, MCP mappings, test factories, and E2E setup to use a shared product-with-names shape and derive `canonicalName` plus `aliases` from rows. _Done when:_ canonical and alias lookups resolve the same product through the unique index; approved display spelling is returned by every existing public product projection; no production or test path reads the legacy name columns; all current non-namespace behavior remains unchanged.
- [x] **Step 5 - Contract away legacy product-name columns** - add the forward contract migration that re-verifies every product has exactly one canonical row, then removes `Product.canonicalName` and `Product.aliases`; update Prisma and remove temporary compatibility writes. _Done when:_ fresh and previously migrated databases reach the contracted schema, generated `Product` types contain only the authoritative `names` relation for identity, and the complete automated suite and build pass without legacy-column references.
- [x] **Step 6 - Add catalog-integrity visibility and publish the contract** - extend `OperationalLogger` with a typed `catalog.integrity` failure event and call it only when defensive collision checks observe an otherwise impossible multi-owner state. Update API documentation with normalization, idempotency, response, and conflict behavior. _Done when:_ integrity logs contain only allowlisted product IDs, normalized-key fingerprint or safe identifier, owner count, action, and error type, never raw request bodies or database/provider errors; documented REST and MCP product contracts match tested behavior.

## Files / areas

- `prisma/schema.prisma`
- `prisma/migrations/<timestamp>_add_product_name_namespace/migration.sql`
- `prisma/migrations/<timestamp>_remove_legacy_product_names/migration.sql`
- `src/product/product-name.util.ts`
- `src/product/product-name.util.spec.ts`
- `src/product/product.service.ts`
- `src/product/product.service.spec.ts`
- `src/product/dto/`
- `src/product/types/`
- Product-name consumers in grocery, inventory, estimation, statistics, MCP, and their tests
- Shared E2E database setup and direct Prisma product factories
- `src/observability/operational-logger.service.ts`
- `src/observability/operational-logger.service.spec.ts`
- Product REST/database-backed E2E coverage
- `docs/api-reference.md`

## Data / contracts

### Persisted namespace

```text
ProductName
- id: UUID primary key
- productId: FK -> Product, cascade on delete
- displayName: approved, whitespace-normalized spelling
- normalizedName: globally unique exact-lookup key
- kind: canonical | alias
```

- `Product.names` is the only authoritative persisted source of product identity after the contract migration.
- `normalizedName` is computed once in application code as NFKC, trim, internal whitespace collapse, then locale-independent lowercase.
- The backfill SQL must use equivalent PostgreSQL normalization and have database-backed parity tests for the supported Unicode and whitespace corpus before legacy columns are removed.
- `normalizedName` has a normal unique constraint, suitable for Prisma unique lookup.
- A raw partial unique index on `productId WHERE kind = 'canonical'` enforces at most one canonical row. Service creation plus migration verification enforce at least one; rename and deletion operations are out of scope.
- Name rows must be assembled deterministically: the canonical row supplies `canonicalName`; aliases are returned in a stable order defined by the implementation and locked by tests.

### Public product projection

Existing REST and MCP consumers keep this shape:

```json
{
  "id": "product-uuid",
  "canonicalName": "3% Milk",
  "aliases": ["Three Percent Milk"],
  "category": "dairy",
  "typicalUnit": "carton"
}
```

The current create request remains `canonicalName`, optional `aliases`, `category`, and `typicalUnit`. This feature changes storage and identity rules, not the accepted metadata surface.

### Conflict response

A normalized phrase owned by another product returns HTTP `409` through REST with the stable domain payload:

```json
{
  "code": "PRODUCT_NAME_CONFLICT",
  "message": "A product name is already assigned to another product"
}
```

MCP and internal callers receive the equivalent stable domain failure. The response must not disclose raw Prisma constraints, SQL, or provider details.

### Transaction rules

- Product creation writes the `Product` and all `ProductName` rows in one transaction.
- Alias addition runs in a serializable transaction with the existing bounded retry policy.
- A phrase already owned by the target product is an idempotent success.
- A phrase owned by a different product causes no mutation.
- Exact lookup uses the unique `normalizedName` index and includes the owning product plus all names.
- Normal exact lookup and writes fail closed if a defensive diagnostic query observes multiple owners despite constraints. Only defensive direct-mode completion may choose the unique canonical owner, and only after emitting `catalog.integrity`; if canonical ownership is also ambiguous, it must not guess.

## Testing

- Unit tests cover display normalization, lookup normalization, alias deduplication, response assembly, blank input, Unicode equivalence, and semantically distinct phrases.
- Product service tests cover canonical lookup, alias lookup, product creation, one-canonical enforcement, same-owner idempotency, cross-owner conflict, transaction rollback, and uniqueness error translation.
- Database-backed tests cover concurrent product and alias writes plus the raw partial canonical index.
- Migration evidence covers both a fresh database and a database at the current migration head, including explicit failure fixtures for normalized collisions and missing or duplicate canonical rows.
- REST contract tests cover product create, list, get, alias idempotency, approved display spelling, and stable `409` conflicts.
- Existing grocery and MCP tests prove alias lookup and unknown-product flows still behave as before and do not leak persistence errors.
- Operational logger tests prove the catalog event is error-level and allowlisted.
- Run `npm test`, `npm run test:e2e`, and `npm run build` after each affected step because no `Verify` command is configured.

## Notes for the AI

- Use NestJS controllers only for transport mapping; keep normalization, ownership, transactions, and conflict translation in product-domain services.
- Do not use a process-local name map or reintroduce catalog-wide scans.
- Do not rewrite committed migrations. Use expand and contract forward migrations so every reviewed step leaves the application buildable.
- Prisma cannot declare the required partial unique index directly in the schema. Preserve it in reviewed migration SQL and guard it with a database-backed test.
- Keep deterministic identity separate from LLM classification. Do not add candidate search, proposal, fuzzy matching, or grocery policy behavior from queued features 29 through 31.
- Audit direct `prisma.product.create` calls in tests; after contraction, fixtures must create valid product-name rows or use a shared factory.
- Generated Prisma files may change after schema generation, but source code must not hand-edit generated output.
- Keep comments sparse and explain only non-obvious migration or constraint decisions.
