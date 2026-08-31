# Feature: Product name namespace

**Proposed build-plan:** feature 27
**Status:** queued design
**Depends on:** none
**Intended history file:** `blueprint/history/features/27-product-name-namespace.md`

## Goal

Make product identity deterministic and efficient by storing canonical names and
aliases in one authoritative, globally unique normalized namespace. Replace the
current full-catalog array scan and prevent one phrase from identifying multiple
products.

## Locked design decisions

- `ProductName` is the only persisted source of canonical names and aliases.
- Every product has exactly one canonical name and zero or more aliases.
- Canonical names and aliases both mean strict identity. Similar products, such as
  `2% Milk` and `3% Milk`, are separate products.
- Every normalized phrase belongs to at most one product, regardless of whether it
  is canonical or an alias.
- Store both approved display spelling and a normalized lookup value.
- Normalize with Unicode NFKC normalization, trim, locale-independent lowercase,
  and internal whitespace collapse.
- Do not infer semantic equivalence. `3% milk` and `three percent milk` become the
  same identity only through an explicit alias.
- PostgreSQL uniqueness is authoritative. Do not maintain a process-local lookup
  map.
- Use a new forward Prisma migration. Never rewrite committed migrations.
- Existing REST and MCP product responses retain `canonicalName` and `aliases`,
  assembled from `ProductName` rows.

## In scope

- Add `ProductName` and `ProductNameKind` to Prisma.
- Store `displayName`, `normalizedName`, `kind`, and `productId`.
- Add global uniqueness on `normalizedName`.
- Add an index on `productId` and a PostgreSQL partial unique index that permits at
  most one canonical row per product.
- Enforce at least one canonical row through product creation service validation and
  migration verification before old columns are removed.
- Backfill existing canonical names and aliases into the namespace.
- Validate backfill data before applying constraints.
- Remove the old writable `Product.canonicalName` and `Product.aliases` columns in
  the same forward migration after successful backfill.
- Refactor product creation, exact lookup, alias addition, and response mapping to
  use the namespace.
- Return a stable `PRODUCT_NAME_CONFLICT` domain result for uniqueness violations.
- Make alias addition idempotent when the alias already belongs to the same target
  product and conflicting when another product owns it.
- Add a typed, allowlisted catalog-integrity operational log for impossible or
  manually corrupted collision states.

## Out of scope

- Product candidate search, proposal generation, and grocery add policies.
- Canonical-name rename, alias removal, product merge, or product deletion.
- Generic family terms shared by several products.
- Per-household or multi-household catalogs.
- Fuzzy, trigram, vector, or semantic matching.

## Public contracts

Product responses keep their current convenient shape:

```json
{
  "id": "product-uuid",
  "canonicalName": "3% Milk",
  "aliases": ["Three Percent Milk"],
  "category": "dairy",
  "typicalUnit": "carton"
}
```

Product creation requires a canonical display name. Aliases are explicit:

```json
{
  "canonicalName": "3% Milk",
  "aliases": ["Three Percent Milk"],
  "category": "dairy",
  "typicalUnit": "carton",
  "productType": "fast_consumable",
  "isPerishable": true
}
```

A normalized phrase already owned by another product returns a stable conflict and
never exposes a raw Prisma or PostgreSQL error.

## Domain and transaction rules

- Normalize names once in application code and persist the resulting key. Database
  uniqueness operates on that stored key rather than reproducing normalization.
- Product creation inserts the `Product` and all `ProductName` rows atomically.
- Alias addition inserts one alias row in a serializable transaction.
- A same-product retry is non-destructive and returns the existing product.
- A cross-product conflict stops without mutation.
- Product lookup uses the unique `normalizedName` index and includes the owning
  product and its name rows.
- If manually corrupted data creates multiple owners despite constraints, canonical
  may be used only for defensive direct-mode completion after emitting a structured
  error-level integrity event. Normal constrained writes must make this unreachable.

## Build steps

- [ ] **Step 1 - Lock namespace and normalization contracts** - add focused name
      normalization tests, `ProductNameKind`, namespace DTO/model types, and stable
      conflict codes. **Done when:** case, surrounding whitespace, repeated internal
      whitespace, and Unicode-equivalent input normalize consistently while semantic
      variants remain distinct.
- [ ] **Step 2 - Add and backfill the authoritative namespace** - create a new
      forward migration that validates current names, creates and backfills
      `ProductName`, verifies exactly one canonical row per product, adds foreign
      keys and uniqueness constraints, and removes old writable name columns. Use a
      verified application-generated backfill or equivalent strategy so NFKC and
      lowercase semantics exactly match runtime normalization. **Done when:** both a
      fresh database and an existing development database migrate successfully,
      invalid collisions or missing canonical rows fail clearly, and generated
      Prisma types expose only the authoritative relation.
- [ ] **Step 3 - Refactor all product-name consumers** - audit product, grocery,
      inventory, prediction, statistics, test factories, and E2E setup; replace
      removed-column access with namespace relations and derive the existing response
      shape from name rows. **Done when:** canonical and alias lookups return the same
      product, all public responses include display names and aliases, and no
      application or test path reads removed columns.
- [ ] **Step 4 - Refactor product writes and conflicts** - create products and aliases
      through namespace rows, translate uniqueness failures, and make same-owner alias
      retries idempotent. **Done when:** concurrent writes produce one owner per phrase,
      cross-product conflicts are stable, and no raw persistence error reaches REST or
      MCP.
- [ ] **Step 5 - Add integrity visibility and update contracts** - extend the
      operational logger with an allowlisted catalog-integrity event and update API
      documentation. **Done when:** defensive collision detection emits safe IDs and
      counts without raw request bodies, and published product contracts match the
      namespace model.

## Files / areas

- `prisma/schema.prisma`
- `prisma/migrations/<timestamp>_add_product_name_namespace/migration.sql`
- `src/product/product-name.util.ts`
- `src/product/product.service.ts`
- `src/product/dto/`
- `src/product/types/`
- Grocery, inventory, prediction, and statistics consumers of product names
- Shared test factories and E2E database setup
- `src/observability/operational-logger.service.ts`
- Product unit and database-backed tests
- `docs/api-reference.md`

## Data / migration impact

- Add an authoritative product-name relation with cascade deletion from `Product`.
- Backfill canonical and alias display values using exactly the application
  normalization semantics.
- Reject existing cross-product collisions before destructive column removal. The
  project is not in production, so development data may be corrected or reinitialized,
  but migration history remains forward-only.
- Remove old columns only after validation and backfill complete in the new
  migration.

## Testing

- Unit tests for normalization and response assembly.
- Product service tests for canonical lookup, alias lookup, creation, same-owner
  idempotency, cross-owner conflict, and concurrent uniqueness.
- Migration or E2E evidence for fresh and previously migrated databases.
- REST contract tests for create, list, get, and alias addition.
- Run `npm test`, `npm run test:e2e`, and `npm run build` because no `Verify` command
  is configured.

## Acceptance criteria

- One normalized phrase cannot belong to two products.
- Every product has exactly one canonical name.
- Exact product lookup is indexed and deterministic.
- Product responses preserve approved display spelling and the current response
  shape.
- Product and alias writes are atomic, idempotent where safe, and concurrency-safe.
- No production code scans all products to resolve one exact name.

## Handoff notes

When activating this plan, reconcile migration SQL with the then-current Prisma
schema and copy the reviewed result to `blueprint/context/current-feature.md` via
`/feature`. Do not combine it with proposal or grocery-add policy work.
