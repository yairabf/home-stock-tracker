# Fix Brief: MCP-03 - Pending grocery items need direct field updates

**Priority:** P1 - the update capability exists, but its contract is more complex than needed and cannot update notes
**Gap type:** Incomplete tool capability
**Repository baseline:** `0ddc2b5c172d662518f190f0e583c9bd52f87a3d`

## Objective

Allow an agent to update the final requested quantity, unit, or note on one exact pending grocery item. Keep conversational interpretation and arithmetic in Hermes. The API service validates and atomically persists the final fields; it does not interpret conversational operations such as "add one more."

## Responsibility split

Hermes owns conversation and intent resolution:

1. A household member asks to add two milk.
2. Hermes discovers an existing pending line with quantity two.
3. Hermes asks whether the member wants two more, one more, or no change.
4. After the member answers, Hermes calculates the final quantity.
5. Hermes calls `grocery_update` once with the final value, such as three or four.

The service owns:

- validating final field values;
- allowing updates only on pending items;
- checking the expected old value for each changed field;
- applying selected fields atomically;
- returning current state when a concurrent change makes the request stale;
- preserving all omitted fields and creation provenance.

## Current behavior

MCP-02 added `grocery_update`, but the service contract models quantity operations with `quantityMode: set | increment`. That puts increment arithmetic in the service and requires quantity-specific branching. Notes can be supplied when an item is created and returned in responses, but cannot be changed or cleared later.

## Required contract

Use direct PATCH semantics for the existing REST route and MCP tool:

```json
{
  "id": "grocery-item UUID",
  "requestedQuantity": 4,
  "expectedRequestedQuantity": 2,
  "unit": "cartons",
  "expectedUnit": "liters",
  "note": "lactose-free",
  "expectedNote": null
}
```

Rules:

- Omitted update fields are preserved exactly.
- `requestedQuantity` is a final positive finite value, never an increment amount.
- `unit` is a final non-empty string, or `null` to clear it.
- `note` is a final non-empty trimmed string, or `null` to clear it.
- At least one of `requestedQuantity`, `unit`, or `note` must be present.
- Each present update field requires its matching expected old value, which may be `null`.
- Expected values for omitted update fields are invalid because they do not protect a mutation.
- The service performs no arithmetic and no automatic unit conversion.
- Do not use a top-level union in the MCP schema.

This intentionally replaces the MCP-02 `quantityMode`, `quantity`, and increment contract. Hermes instructions and scenarios must migrate to final requested quantities in the same fix.

## Stable errors

Preserve applicable existing errors:

- `GROCERY_ITEM_NOT_FOUND`
- `GROCERY_ITEM_NOT_PENDING`
- `GROCERY_ITEM_CHANGED`
- `INVALID_QUANTITY`
- `INVALID_UNIT`

Add:

- `INVALID_NOTE`
- `INVALID_UPDATE`

The obsolete `QUANTITY_UNSPECIFIED` and `UNIT_MISMATCH` errors may be removed when no code path can produce them. Use `GROCERY_ITEM_CHANGED` when any expected value for a selected field is stale.

## Acceptance criteria

- `grocery_update` sets a final requested quantity without service-side arithmetic.
- It can set or clear unit and note fields directly.
- Omitted fields are preserved exactly.
- Every selected field is protected by its expected old value in one atomic conditional update.
- A stale update returns `GROCERY_ITEM_CHANGED` with current state and is not retried automatically.
- Non-pending items cannot be changed.
- REST and MCP expose equivalent behavior through the shared service.
- Hermes resolves duplicate additions conversationally, calculates the final quantity, and sends one update only after a clear user decision.
- Unit, REST, real MCP contract, and persistence-backed tests cover direct field updates, clearing nullable fields, preservation, combined updates, invalid shapes, and stale state.
- Public API/MCP documentation describes the direct field-update contract.

## Repository investigation

Before changing code:

1. Treat `blueprint/history/fixes/mcp-02-duplicate-safe-grocery-additions.md` as historical context, not a contract that must be retained unchanged.
2. Locate every current use of `GroceryQuantityMode`, `quantityMode`, increment behavior, note fields, expected fields, and the associated stable errors.
3. Keep validation and atomic persistence in the shared grocery service, not only in MCP or Hermes.
4. Preserve the conditional `updateMany` concurrency boundary and include only selected fields and their expected values.
5. Confirm the existing nullable database columns are sufficient. No migration is expected.
6. Update every REST, MCP, Hermes, test, and documentation consumer in the same fix so there is no mixed old/new contract.

## Implementation constraints

- Preserve a single NestJS deployable for the MVP.
- REST and MCP must call the shared grocery service.
- MCP schemas must be discoverable by a real MCP client.
- Writes must fail safely on ambiguous or stale state.
- Do not invent values or silently reinterpret household state.
- Preserve generic MCP provenance and every unrelated grocery-item field.
- Add or update tests before considering the gap complete.

## Expected implementation output

1. Shared DTO and service changes for direct selected-field updates.
2. Stable error updates.
3. Unit and domain tests.
4. REST and real MCP contract tests.
5. Persistence-backed REST and MCP tests.
6. Hermes skill and scenario updates for conversational resolution and final quantities.
7. Public API/MCP documentation updates.
8. A verification report mapping evidence to each acceptance criterion.

## Out of scope

- Product identity edits.
- Automatic unit conversion.
- Service-side interpretation of conversational increments.
- Notes generated or inferred without explicit user input.
- Unrelated features, UI, store integrations, multi-household support, or new infrastructure.
