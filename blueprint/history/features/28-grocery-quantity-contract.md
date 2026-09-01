# Feature: Grocery quantity contract

**From build-plan:** feature 28
**Status:** complete
**Depends on:** none
**Intended history file:** `blueprint/history/features/28-grocery-quantity-contract.md`

## Completion record

**Completed:** 2026-09-01

**Delivered:** Grocery lines now persist a finite positive quantity, defaulting omitted quantities to `1` only when a new line is created. PostgreSQL, Prisma, service, REST, and MCP contracts enforce the invariant. Clients can set an absolute final quantity through concurrency-safe REST and `grocery_set_quantity` operations while omitted duplicate input remains an explicit nullable request echo.

**Main changed areas:**

- `prisma/schema.prisma` and `prisma/migrations/20260901140000_enforce_positive_grocery_quantity/migration.sql` - added the default, non-null contract, finite-positive check, aggregate legacy-data preflight, and null backfill.
- `src/grocery/` - added service-level validation, `GroceryService.setQuantity`, the narrow DTO and REST route, stable conflict translation, and focused tests.
- `src/mcp/` - added the strict `grocery_set_quantity` tool, positive persisted output schemas, safe conflict coverage, and Hermes contract assertions.
- `test/` - added database migration, REST, MCP protocol, concurrency, and regression coverage; aligned direct grocery fixtures and purchase projections.
- `docs/` and `integrations/hermes/home-stock-tracker/` - documented defaulting, duplicate ambiguity, client-side relative arithmetic, no-change behavior, stale decisions, and explicit separate lines.
- `graphify-out/` - refreshed the project knowledge graph after the implementation.

**Verification:**

- `npx prisma validate` passed.
- `npx prisma generate` completed successfully.
- `npm test -- --runInBand` passed: 36 suites, 444 tests.
- `npm run test:e2e -- --runInBand` passed: 15 suites, 132 tests, including real REST and MCP behavior plus database migration coverage.
- `npm run build` passed.
- `git diff --check` passed.
- Behavioral evidence: `PATCH /api/v1/grocery/items/:id/quantity` and the real `grocery_set_quantity` MCP protocol tests proved absolute replacement, positive fractions, stable stale-state errors, unchanged unrelated fields, strict schemas, and one-winner concurrency behavior.
- Manual try path: list a pending item, set a new final quantity using its exact current value, then repeat with the stale expected value and verify `GROCERY_ITEM_CHANGED` returns the latest `currentItem`.

**Deviations:** None.

## Goal

Give every persisted grocery-list item a meaningful positive quantity and expose a narrow, absolute quantity-setting operation for REST and MCP clients. Preserve the boundary that clients interpret conversation and calculate relative requests, while the service validates and stores only a final value.

## In scope

- Default an omitted quantity to `1` whenever a new grocery line is persisted, including the normal duplicate-safe path and an explicit `create_separate` path.
- Preserve omitted input as `null` in `requestedAddition` when an existing pending line causes `confirmation_required`; omission must never imply an increment.
- Make `GroceryListItem.requestedQuantity` non-null with a database default of `1`.
- Add a PostgreSQL check constraint that rejects zero, negative, NaN, and positive or negative infinity while preserving positive fractions.
- Add a forward migration that first rejects invalid non-null legacy values, then backfills legacy nulls to `1`, applies the default and non-null constraint, and installs the finite-positive check.
- Because PostgreSQL transactions roll back `RAISE EXCEPTION`, fail the migration with an exception that lists only invalid-category counts, not grocery IDs or product details; no earlier migration statement may commit independently.
- Make grocery response, REST, MCP, and generated persistence contracts non-null for persisted requested quantities.
- Keep positive quantity validation in the service so callers cannot bypass the invariant by skipping transport validation.
- Add a dedicated `GroceryService.setQuantity` operation with one conditional write scoped by item ID, `pending` status, and expected current quantity.
- Add `PATCH /api/v1/grocery/items/:id/quantity` and the `grocery_set_quantity` MCP tool over the shared service operation.
- Require both the final `requestedQuantity` and `expectedRequestedQuantity` for the narrow operation.
- Keep `grocery_update` for unit, note, and intentional multi-field edits, while applying the same non-null positive quantity contract when it includes quantity.
- Align API documentation, MCP descriptions, the Hermes skill, and scenario coverage.

## Out of scope

- Server-side increment, decrement, merge, or other quantity arithmetic.
- Unit conversion or unit compatibility rules.
- Product resolution, product creation policy, and catalog proposal behavior planned for features 29 through 31.
- Automatic merging of duplicate pending grocery lines.
- Removing the general `grocery_update` operation.
- Changing purchase or inventory-event quantities, or creating a new inventory event when a grocery line quantity changes.
- Correcting invalid legacy quantities during migration. Invalid non-null data must be fixed deliberately before the migration is rerun.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff, not full files; you read and understand it.
4. You approve, then choose whether to commit a checkpoint or continue.
   Checkpoints are optional; `/complete` makes the feature-level commit.

Never accept a step you have not read. If a diff is too big to review, split the step.

## Build steps

- [x] **Step 1 - Lock positive quantity creation semantics** - centralize finite-positive validation for grocery quantities, default omitted input to `1` only in the shared new-line persistence data, and add focused service and transport validation tests for omission, positive fractions, zero, negatives, NaN, and infinities. Keep `requestedAddition.requestedQuantity` nullable so a duplicate result still reflects what the client actually supplied. *Done when:* both current new-line paths persist `1` for omission, explicit positive fractions are unchanged, invalid values are rejected even through a direct service call, and duplicate detection never treats omission as a quantity change.
- [x] **Step 2 - Enforce and publish the persistence invariant** - add one forward migration with an invalid-data preflight, null backfill, database default, non-null column, and named finite-positive check; update Prisma and persisted response nullability; update direct grocery fixtures and affected purchase-flow tests. Add migration coverage for a fresh database, a database with nulls, positive fractions, and separate invalid fixtures for zero, negative, NaN, and infinities. *Done when:* fresh and upgraded databases reach the same invariant, nulls become `1`, positive fractions survive unchanged, invalid non-null legacy data aborts before mutation with a clear diagnostic, and all persisted grocery-item projections expose `requestedQuantity: number`.
- [x] **Step 3 - Add the narrow service and REST operation** - add a quantity DTO and `GroceryService.setQuantity`, implement one conditional `updateMany` using item ID, pending status, and expected quantity, and expose it through `PATCH /api/v1/grocery/items/:id/quantity`. Keep the broader update operation compatible but make its expected quantity non-null whenever quantity is selected. *Done when:* service and REST tests prove successful absolute replacement, unchanged unit and note fields, positive fractions, missing item, non-pending item, stale expected value with latest state, validation bypass defense, and two concurrent updates with the same expectation produce one winner and one safe conflict.
- [x] **Step 4 - Expose `grocery_set_quantity` through MCP** - register a strict MCP schema requiring exact `itemId`, final `requestedQuantity`, and `expectedRequestedQuantity`; delegate to the shared service and retain safe conflict details. Update the existing grocery item output schemas to require a positive quantity. *Done when:* MCP registry and real protocol tests prove the tool is discoverable, rejects missing, extra, non-positive, NaN, and infinite inputs, sets the absolute final value, and returns `GROCERY_ITEM_CHANGED` with `currentItem` without retrying or recalculating.
- [x] **Step 5 - Align guidance and published contracts** - update API docs, MCP descriptions, Hermes skill rules, contract assertions, and scenarios. Replace all guidance for nullable persisted quantities with the default-`1` contract, prefer `grocery_set_quantity` for quantity-only changes, and retain `grocery_update` for unit, note, or multi-field edits. *Done when:* documentation and checked-in agent guidance distinguish omitted new-line defaulting, duplicate ambiguity, final totals, client-side relative arithmetic, no-change behavior, stale-decision handling, and explicit separate lines, with no claim that a persisted grocery quantity can be null.

## Files / areas

- `prisma/schema.prisma`
- `prisma/migrations/<timestamp>_enforce_positive_grocery_quantity/migration.sql`
- `src/grocery/grocery.service.ts`
- `src/grocery/grocery.controller.ts`
- `src/grocery/grocery-operation.exception.ts`
- `src/grocery/dto/add-grocery-item.dto.ts`
- `src/grocery/dto/add-grocery-item-result.dto.ts`
- `src/grocery/dto/grocery-item-response.dto.ts`
- `src/grocery/dto/update-grocery-item.dto.ts`
- `src/grocery/dto/set-grocery-item-quantity.dto.ts`
- `src/mcp/mcp-server.factory.ts`
- Grocery service, controller, MCP, migration, and REST E2E tests
- Direct grocery fixtures and affected inventory purchase-flow tests
- `integrations/hermes/home-stock-tracker/SKILL.md`
- `integrations/hermes/home-stock-tracker/scenarios.md`
- `src/mcp/hermes-skill-contract.spec.ts`
- `docs/api-reference.md`

## Data / contracts

### Persisted quantity

```text
GroceryListItem.requestedQuantity: Float
- required
- database default: 1
- finite
- greater than zero
```

- Application code validates before writing; PostgreSQL remains the final invariant boundary.
- PostgreSQL `DOUBLE PRECISION` permits NaN and infinities, so the check must exclude them explicitly rather than relying only on `requestedQuantity > 0`.
- The migration preflight evaluates invalid non-null rows before any backfill or constraint change. It then changes only null rows to `1`. A preflight exception reports aggregate counts by invalid category and relies on PostgreSQL transaction rollback to leave the schema and data unchanged.
- Positive fractions remain valid. No upper bound, rounding, integer-only rule, or unit conversion is introduced.
- New-line creation explicitly supplies `dto.requestedQuantity ?? 1`; the database default protects direct inserts and future creation paths.
- `requestedAddition.requestedQuantity` remains `number | null` because it echoes omitted client input in a non-mutating `confirmation_required` result. `createdItem`, `existingItems`, list results, completed items, and other persisted projections use non-null `number`.

### REST quantity operation

```http
PATCH /api/v1/grocery/items/:id/quantity
Content-Type: application/json

{
  "requestedQuantity": 5,
  "expectedRequestedQuantity": 3
}
```

Both fields are required finite numbers greater than zero. The server sets the stored value to `5`; it does not add `5` or calculate a total.

Successful response: the updated `GroceryItemResponseDto`, with unit, note, source, status, and related event unchanged.

Stable failures:

- Unknown ID: HTTP `404`, code `GROCERY_ITEM_NOT_FOUND`, no fabricated `currentItem`.
- Purchased or removed item: HTTP `409`, code `GROCERY_ITEM_NOT_PENDING`, with the latest `currentItem`.
- Expected quantity mismatch or a lost concurrent race: HTTP `409`, code `GROCERY_ITEM_CHANGED`, with the latest `currentItem`.
- Invalid final or expected quantity: HTTP `422` or transport validation `400`, with no write.

### MCP quantity operation

```json
{
  "itemId": "grocery-item-uuid",
  "requestedQuantity": 5,
  "expectedRequestedQuantity": 3
}
```

`grocery_set_quantity` uses the exact item ID and current quantity returned by `grocery_list`, then applies the same service method as REST. Its correctness-critical description states:

- quantities are absolute final values;
- relative user requests are calculated by the client before the call;
- the expected value must be copied from the latest read;
- a stale conflict requires a fresh user decision and must not be recalculated or retried automatically;
- no call is needed when the user chooses no change.

### Domain and concurrency rules

- Existing pending-line detection completes before any new-line default is applied to persisted state.
- An omitted duplicate request remains `requestedAddition.requestedQuantity: null` and returns the existing lines unchanged.
- Quantity setting performs one conditional database write with `where: { id, status: pending, requestedQuantity: expectedRequestedQuantity }` and updates only `requestedQuantity`.
- If the conditional write affects zero rows, fetch the latest item once and translate it to not found, not pending, or changed.
- MCP and REST contain only transport mapping. Validation, conditional mutation, and conflict translation stay in `GroceryService`.
- Clients must use the numeric value returned by the service as the expected value. The service does not use tolerances or approximate floating-point comparison.

## Testing

- Unit tests cover omitted new-line defaulting, explicit positive fractions, invalid numeric boundaries, duplicate echo behavior, conditional write predicates, unchanged unrelated fields, and conflict translation.
- DTO and Zod contract tests cover required narrow-operation fields, strict unknown-field rejection, positive finite values, and non-null persisted output schemas.
- Database-backed migration tests cover fresh and upgraded schemas, null backfill, fraction preservation, defaulted direct insertion, database rejection after migration, and preflight failure fixtures for each invalid legacy category.
- REST E2E tests cover the narrow route's successful and stale paths, stable status/code/current-item shapes, and concurrency with one winner.
- Real MCP tests cover tool discovery, schema validation, absolute updates, and safe conflict details.
- Existing add, update, remove, list, complete-purchase, and partial-purchase tests remain regression gates.
- Run `npx prisma validate`, `npx prisma generate`, `npm test -- --runInBand`, `npm run test:e2e -- --runInBand`, and `npm run build` because no `Verify` command is configured.

## Notes for the AI

- Use NestJS controllers only for transport mapping and keep the shared business rule in `GroceryService`.
- Do not remove quantity support from `grocery_update`; only make the narrow operation the documented preference for quantity-only changes.
- Do not let a transport decorator be the only finite-positive defense.
- Do not rewrite committed migrations. Add one forward migration after the current product-name contract migration.
- Preserve the established duplicate-safe result union and `requestedAddition` echo semantics.
- Reuse the existing stable grocery error helpers and safe MCP error serialization rather than introducing a second error format.
- Audit direct `prisma.groceryListItem.create` calls in E2E tests and use the database default intentionally or provide a positive quantity.
- Keep future product-resolution and grocery-add policy work out of this feature.
- Generated Prisma output may change after `prisma generate`; never hand-edit generated files.
- Keep comments sparse and explain only non-obvious PostgreSQL float or migration decisions.
