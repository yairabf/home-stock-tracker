# Feature: Grocery quantity contract

**Proposed build-plan:** feature 28
**Status:** queued design
**Depends on:** none
**Intended history file:** `blueprint/history/features/28-grocery-quantity-contract.md`

## Goal

Give every grocery-list item a meaningful positive quantity and expose a narrow,
unambiguous quantity-setting operation for REST and MCP clients. Preserve the
existing rule that the service stores final values and never interprets natural
language or performs conversational arithmetic.

## Locked design decisions

- Persisted grocery quantities are finite numbers greater than zero.
- Positive fractions remain valid.
- Omitted quantity defaults to `1` only when a new grocery line is created.
- If the product already has a pending line, an omitted quantity remains ambiguous.
  Return `confirmation_required`; do not infer an increment of one.
- `grocery_set_quantity` receives an exact grocery item ID, the final absolute
  quantity, and the expected current quantity.
- Clients fetch the list before explicit quantity updates to obtain the exact item
  ID and current value.
- Clients calculate relative requests such as "add two more" and submit the final
  absolute value.
- Stale changes return the current item and require a fresh user decision. Never
  recalculate and retry automatically.
- Keep general `grocery_update` for unit, note, or multi-field edits. Prefer the
  narrow operation for quantity-only changes.

## In scope

- Default omitted quantity to `1` on every new pending-line creation path.
- Make `GroceryListItem.requestedQuantity` non-null.
- Add a database constraint requiring a positive, finite stored value to the extent
  PostgreSQL permits through a check constraint.
- Backfill existing null quantities to `1` and preserve existing positive fractions.
- Fail migration validation on zero, negative, NaN, or infinite stored values rather
  than guessing a correction.
- Update REST, MCP, DTO, response, service, docs, and skill nullability.
- Add a dedicated REST quantity endpoint or narrow controller operation over shared
  `GroceryService` logic.
- Add the `grocery_set_quantity` MCP tool.
- Require optimistic concurrency through `expectedRequestedQuantity`.

## Out of scope

- Server-side increment or decrement operations.
- Unit conversion.
- Product resolution and catalog proposal behavior.
- Merging duplicate pending grocery lines.
- Removing the general `grocery_update` operation.

## Public contracts

Narrow quantity operation:

```json
{
  "itemId": "grocery-item-uuid",
  "requestedQuantity": 5,
  "expectedRequestedQuantity": 3
}
```

`requestedQuantity` and `expectedRequestedQuantity` are required finite numbers
greater than zero after the migration. The server sets the final value to `5`; it
does not add `5` to the old value.

A stale update returns a conflict with the latest item:

```json
{
  "code": "GROCERY_ITEM_CHANGED",
  "message": "The grocery item changed before the update was applied.",
  "currentItem": {}
}
```

## Domain and transaction rules

- Defaulting to `1` occurs only in the path that persists a new grocery item.
  Requested-addition echoes may continue to distinguish omitted user input from an
  explicit `1` when needed for conversation state.
- A resolved existing pending item always returns the existing duplicate-aware
  result before any quantity mutation.
- Quantity updates use one conditional database write scoped by ID, pending status,
  and expected current quantity.
- Missing, non-pending, and changed items retain their stable domain codes.
- MCP and REST delegate to the same service method.
- The service rejects non-finite, zero, and negative values even if transport
  validation is bypassed.

## Build steps

- [ ] **Step 1 - Lock positive quantity semantics** - update DTO and domain
      validation contracts, default new-line quantities to `1`, and add focused
      tests for omitted, fractional, zero, negative, NaN, and infinite values.
      **Done when:** every new line has a positive quantity, fractions work, and
      duplicate detection never interprets omission as an increment.
- [ ] **Step 2 - Enforce the persistence invariant** - add a forward migration that
      validates stored values, backfills null to `1`, makes the column non-null, and
      applies a positive-value check. **Done when:** fresh and existing development
      databases reach the same invariant and invalid stored data fails with a clear
      migration error.
- [ ] **Step 3 - Add the narrow service and REST operation** - introduce a
      quantity-only `GroceryService` method and thin controller/DTO contract using
      optimistic concurrency. **Done when:** successful, stale, missing, and
      non-pending paths return the documented shapes without affecting unit or note.
- [ ] **Step 4 - Expose `grocery_set_quantity` through MCP** - add a discoverable
      schema and handler over the shared service operation. **Done when:** a real MCP
      contract test proves the tool requires final and expected quantities and
      preserves conflict details.
- [ ] **Step 5 - Align guidance and documentation** - update API docs, MCP tool
      descriptions, Hermes skill, and scenarios. **Done when:** protocol guidance
      distinguishes set, relative client arithmetic, ambiguous add, and no-change
      behavior, and no documentation describes nullable persisted quantities.

## Files / areas

- `prisma/schema.prisma`
- `prisma/migrations/<timestamp>_enforce_positive_grocery_quantity/migration.sql`
- `src/grocery/grocery.service.ts`
- `src/grocery/grocery.controller.ts`
- `src/grocery/dto/`
- `src/mcp/mcp-server.factory.ts`
- Grocery service, MCP, and E2E tests
- `integrations/hermes/home-stock-tracker/`
- `docs/api-reference.md`

## Data / contracts

- `GroceryListItem.requestedQuantity` becomes required and positive.
- New grocery lines default omission to `1`.
- `grocery_set_quantity` is quantity-only and absolute.
- `grocery_update` remains available for broader changes and follows the same
  positive quantity invariant when quantity is included.

## Testing

- Unit tests for defaulting and validation boundaries.
- Service tests for successful final-value set and atomic expected-value predicates.
- Concurrency tests proving one winner and safe latest-state conflicts.
- REST E2E tests for the narrow operation.
- MCP schema and real MCP flow tests.
- Regression tests for existing add/update/remove and purchase flows.
- Run `npm test`, `npm run test:e2e`, and `npm run build`.

## Acceptance criteria

- No persisted grocery item has a null, zero, negative, NaN, or infinite quantity.
- Omitted quantity creates a new line with `1` but never changes an existing line.
- Quantity-only writes use `grocery_set_quantity` and require a final value plus the
  expected current value.
- Relative arithmetic remains in the client or agent.
- Stale decisions never overwrite newer state or auto-retry.

## Handoff notes

When activating this plan, preserve the behavior delivered by
`mcp-03-direct-pending-grocery-item-updates.md`. Copy the reviewed plan into
`current-feature.md` through `/feature`; do not merge it with product proposal
work.
