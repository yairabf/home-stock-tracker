# Feature: Confirmed grocery catalog decisions

**Proposed build-plan:** feature 31
**Status:** queued design
**Depends on:** feature 30
**Intended history file:** `blueprint/history/features/31-confirmed-grocery-catalog-decisions.md`

## Goal

Let REST, MCP, UIs, and agents apply a user's explicit catalog decision and finish
the original grocery-add request through deterministic, concurrency-safe operations.
No confirmation write invokes the LLM or guesses product or quantity intent.

## Locked design decisions

- Expose two focused operations:
  - `grocery_confirm_new_product`
  - `grocery_confirm_product_alias`
- These are grocery use cases, not generic product-administration tools. Each
  completes the original grocery addition after applying the approved catalog
  decision.
- `GroceryService` owns orchestration and delegates catalog validation and writes to
  `ProductService`.
- Confirmation requests contain the final user-approved payload. They do not carry
  or trust a proposal ID.
- No second LLM call occurs after user confirmation.
- Product creation plus grocery addition is atomic when both are required.
- Approved alias persistence and grocery quantity resolution are separate decisions.
  The alias may remain saved when the resulting grocery operation returns
  `confirmation_required`.
- Both operations reuse normal duplicate-aware pending-line detection.
- Existing pending quantities are never incremented, replaced, or merged implicitly.
- Retries are idempotent where identity matches and conflicting where it does not.
- Writes revalidate the namespace at confirmation time.
- Correctness-critical behavior belongs in MCP descriptions and API docs. An
  agent-specific skill adds conversational phrasing only.

## In scope

- Shared `GroceryService` confirmation use cases.
- REST endpoints for both confirmation operations.
- MCP tools for both confirmation operations.
- Product creation payload with canonical name, aliases, category, typical unit,
  product type, and perishability.
- Alias confirmation payload with exact target product ID and approved alias.
- Separate grocery item payload carrying requested quantity, unit, and note.
- Atomic product creation and grocery-line creation.
- Atomic alias persistence and safe handoff to pending-line detection, while
  preserving the approved alias if only quantity clarification remains.
- Idempotent retries after uncertain transport results where the same identity was
  already established.
- Stable conflict results for target deletion, name ownership changes, stale
  decisions, and pending-line changes.
- The grocery-specific confirmed alias path from MCP-05. Standalone alias teaching
  remains deferred to catalog maintenance.

## Out of scope

- Generic `product_create` or unrestricted `product_add_alias` MCP administration.
- Canonical rename, alias removal, product merge, or product deletion.
- Automatic merging of grocery lines.
- LLM invocation, proposal regeneration, or proposal persistence.
- Multi-household catalog governance.
- Server-side quantity arithmetic.

## Public contracts

### Confirm a new product

```json
{
  "product": {
    "canonicalName": "3% Milk",
    "aliases": ["Three Percent Milk"],
    "category": "dairy",
    "typicalUnit": "carton",
    "productType": "fast_consumable",
    "isPerishable": true
  },
  "groceryItem": {
    "requestedQuantity": 2,
    "unit": "cartons",
    "note": "for the children"
  }
}
```

The operation creates or safely reuses the exact canonical identity and completes
normal grocery pending detection.

### Confirm an alias

```json
{
  "targetProductId": "product-uuid",
  "alias": "Three Percent Milk",
  "groceryItem": {
    "requestedQuantity": 2,
    "unit": "cartons",
    "note": "for the children"
  }
}
```

The alias becomes another strict identity for the target product. The operation then
adds a new pending line or returns the existing line through
`confirmation_required`.

## Domain and transaction rules

- Validate and normalize all approved display names at write time.
- Confirmed new product:
  - If the canonical identity is absent, create product, names, and new grocery line
    atomically when no pending line exists.
  - If a retry finds the same canonical identity already created, reuse it and run
    pending detection.
  - If any supplied canonical or alias name belongs to another product, stop with
    `PRODUCT_NAME_CONFLICT`.
- Confirmed alias:
  - The target product ID must exist at write time.
  - An alias already owned by the same target is an idempotent success.
  - An alias owned by another product is a stable conflict.
  - Once alias ownership is established, preserve it even if the grocery portion
    pauses on an existing pending line.
- Grocery handling after either identity decision:
  - No pending line: create one, defaulting omitted quantity to `1`.
  - Existing pending line or lines: return `confirmation_required` with the original
    requested addition and mutate no quantity.
- If the original phrase was explicit about a relative or final quantity, the
  consuming client may follow with `grocery_set_quantity` using the returned exact
  ID and expected quantity. The service never interprets the wording.
- Stale or conflicting outcomes are final for that decision and are not retried
  automatically by an agent.

## Build steps

- [ ] **Step 1 - Lock confirmation contracts and conflicts** - define request DTOs,
      MCP schemas, result unions, idempotency rules, and stable conflict codes.
      **Done when:** validation separates product and grocery fields, alias targets
      require exact IDs, and no contract includes LLM proposal state.
- [ ] **Step 2 - Reuse confirmed new-product orchestration** - expose the shared
      `createProductAndAddGroceryItem` operation delivered by feature 30 through the
      confirmation contract instead of implementing a parallel workflow. **Done
      when:** first calls are atomic, same-identity retries converge safely,
      conflicting names stop, and no LLM call occurs.
- [ ] **Step 3 - Implement confirmed alias orchestration** - persist an approved
      same-owner-idempotent alias and continue through normal pending detection.
      **Done when:** cross-owner conflicts stop, the alias survives a quantity
      confirmation branch, and duplicate grocery lines are not silently created.
- [ ] **Step 4 - Expose REST confirmation endpoints** - add thin endpoints over the
      shared operations with explicit response DTOs. **Done when:** REST E2E tests
      cover successful create, successful alias, pending-line confirmation, retries,
      and conflicts.
- [ ] **Step 5 - Expose MCP confirmation tools** - register
      `grocery_confirm_new_product` and `grocery_confirm_product_alias` with complete
      tool descriptions and structured results. **Done when:** real MCP tests prove
      tools are discoverable, non-LLM, idempotent, and preserve conflict details.
- [ ] **Step 6 - Align documentation and agent workflows** - update API docs, MCP
      descriptions, Hermes skill, and scenarios. **Done when:** any MCP client can
      understand that proposals are advisory, confirmations require approved
      payloads, quantity ambiguity is separate, and stale results are not
      auto-retried. Update MCP-05 tracking to record the grocery-specific path as
      delivered and standalone alias teaching as deferred.

## Files / areas

- `src/grocery/grocery.service.ts`
- `src/grocery/grocery.controller.ts`
- `src/grocery/dto/`
- `src/product/product.service.ts`
- Transaction-aware product persistence boundaries
- `src/mcp/mcp-server.factory.ts`
- Grocery, product, MCP, and E2E tests
- `integrations/hermes/home-stock-tracker/`
- `docs/api-reference.md`
- `blueprint/context/bugs/mcp-05-no-controlled-alias-management-tool.md`

## Data / contracts

- No proposal table or confirmation token.
- Approved confirmation payloads are the authority.
- `ProductName` uniqueness and the positive grocery quantity invariant are
  prerequisites.
- Alias display and normalized values use the same namespace representation as
  canonical names.
- Source attribution remains transport-owned and is not accepted from confirmation
  request bodies.

## Testing

- Service tests for atomic create-and-add success and rollback.
- Service tests for alias success, same-target retry, cross-target conflict, deleted
  target, and alias persistence when grocery confirmation is required.
- Concurrent confirmation tests for product and alias uniqueness.
- REST E2E tests for both endpoints and all result branches.
- Real MCP tests for schema discovery, structured success, structured
  `confirmation_required`, and stable errors.
- Agent scenario tests or documented fixtures for create, alias, cancel, existing
  quantity ambiguity, explicit relative quantity, and stale state.
- Run `npm test`, `npm run test:e2e`, and `npm run build`.

## Acceptance criteria

- A user-approved create or alias decision can be applied through REST and MCP.
- The operation completes the original grocery intent without a redundant question
  when no quantity ambiguity remains.
- No LLM call happens after confirmation.
- Identity writes are validated, idempotent, and concurrency-safe.
- Existing pending quantities are never guessed or silently changed.
- The grocery-specific portion of MCP-05 is delivered through a controlled,
  user-confirmed workflow; standalone alias teaching remains explicitly deferred.

## Handoff notes

Activate only after feature 30 is complete. Verify the delivered add result and
quantity contracts before copying this plan into `current-feature.md` through
`/feature`. Keep generic catalog maintenance deferred.
