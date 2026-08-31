# Feature: Policy-aware grocery additions

**Proposed build-plan:** feature 30
**Status:** queued design
**Depends on:** features 27, 28, and 29
**Intended history file:** `blueprint/history/features/30-policy-aware-grocery-additions.md`

## Goal

Make add-to-grocery-list behavior explicit for both deterministic clients and
interactive agents. A direct client can find or create the catalog prerequisite,
while an assisted client can pause safely for a user decision without mutating the
catalog or grocery list.

## Locked design decisions

- The primary operation is adding a grocery item. Product creation is only an
  incidental prerequisite when its canonical identity is missing.
- Use named policies:
  - `create_if_missing`
  - `propose_if_missing`
- Policies are client-selectable with transport defaults:
  - REST defaults to `create_if_missing`.
  - MCP defaults to `propose_if_missing`.
- Correctness-critical MCP descriptions instruct agents to use proposal mode on an
  initial uncertain name. A client may deliberately select deterministic creation.
- `create_if_missing` receives a complete explicit product payload. It never invokes
  the LLM, infers a canonical name, or silently creates an alias.
- `propose_if_missing` receives a product phrase. If unresolved, it returns
  deterministic candidates and optional advisory proposal without mutation.
- `product_resolution_required` is a successful domain outcome, not an HTTP or MCP
  error.
- New grocery-line quantity defaults to `1`. Existing pending lines return
  `confirmation_required`; no quantity is incremented or replaced implicitly.
- Product identity resolution and pending-line detection are concurrency-safe.
- No raw database uniqueness failure reaches a client.

## In scope

- Replace the current implicit exact-or-alias auto-create add contract with an
  explicit policy-aware application operation.
- Add discriminated REST and MCP request schemas.
- `create_if_missing` requires `product` plus separate `groceryItem` data.
- `propose_if_missing` requires `productName` plus separate `groceryItem` data.
- Extend the add result union with `product_resolution_required`.
- Echo the original material grocery request in non-mutating results.
- Return deterministic candidates, optional proposal, and server-computed allowed
  actions.
- Reuse indexed exact lookup, candidate search, proposal generation, positive
  quantity rules, and duplicate-aware pending-line detection.
- Make concurrent deterministic creation converge on one product and then normal
  pending-line behavior.
- Align service, REST, MCP, API docs, and agent guidance.
- Resolve the tracked SKILL-01 mismatch between actual unknown-product behavior and
  documentation.

## Out of scope

- Applying a proposed create or alias decision. Feature 31 owns confirmation writes.
- Generic catalog administration.
- Canonical rename, alias removal, product merge, or grocery-line merge.
- LLM use in `create_if_missing`.
- Server-side quantity arithmetic.

## Public contracts

### Create if missing

```json
{
  "unknownProductPolicy": "create_if_missing",
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

The operation normalizes and looks up `product.canonicalName`. If it exists, it
reuses that product and ignores creation-only metadata without updating the catalog.
If it is absent, it creates the product from the explicit payload. It then runs the
normal duplicate-aware grocery flow.

### Propose if missing

```json
{
  "unknownProductPolicy": "propose_if_missing",
  "productName": "3% milk",
  "groceryItem": {
    "requestedQuantity": 2,
    "unit": "cartons",
    "note": "for the children"
  }
}
```

Unknown response:

```json
{
  "outcome": "product_resolution_required",
  "requestedAddition": {
    "productName": "3% milk",
    "requestedQuantity": 2,
    "unit": "cartons",
    "note": "for the children"
  },
  "candidates": [],
  "proposal": null,
  "allowedActions": ["create_product", "cancel"]
}
```

If exact identity already exists, both policies proceed directly to normal pending
item detection.

## Domain and transaction rules

- `GroceryService` owns the overall use case and delegates catalog validation and
  creation to `ProductService`.
- Do not hold a database transaction open during an LLM request.
- In proposal mode, resolve exact identity first. If unresolved, retrieve candidates
  and optional advice, then return without any write.
- In deterministic mode, product creation and grocery-line creation must be atomic
  when both are required.
- If a concurrent request creates the same product first, recover the existing
  identity and continue through pending-line detection.
- If a concurrent request creates the pending line first, return
  `confirmation_required` with all current matching lines.
- Creation-only product metadata is never used to update an existing product.
- `allowedActions` is computed by server logic. The LLM cannot invent permissions.
- Optional LLM failure yields `proposal: null`, never deterministic fallback
  creation in proposal mode.

## Build steps

- [ ] **Step 1 - Lock discriminated add contracts** - define policy enums, mutually
      exclusive request DTOs/schemas, transport defaults, and the expanded result
      union. **Done when:** validation proves each policy requires only its proper
      product input, keeps grocery data separate, and exposes
      `product_resolution_required` as a normal result.
- [ ] **Step 2 - Implement deterministic `create_if_missing`** - add the shared
      internal `createProductAndAddGroceryItem` orchestration, coordinating indexed
      product lookup or atomic creation with normal grocery pending detection and
      positive quantity defaults. **Done when:** known products are reused without
      metadata updates, unknown products are created from the supplied payload with
      no LLM call, concurrent requests converge safely, and duplicate lines are not
      created implicitly.
- [ ] **Step 3 - Implement non-mutating `propose_if_missing`** - reuse exact lookup,
      deterministic candidates, and optional proposals. **Done when:** known products
      continue normally, unresolved names return the original request and advisory
      data, and database assertions prove no product, alias, or grocery item was
      created.
- [ ] **Step 4 - Expose REST and MCP policies** - add thin transport mappings with
      REST defaulting to create and MCP defaulting to propose. **Done when:** omitted
      defaults differ only by transport, explicit policy selection works in both,
      and runtime MCP schemas expose the full result union.
- [ ] **Step 5 - Align docs and agent guidance** - update MCP descriptions, API docs,
      Hermes skill, and scenarios, and retire or mark SKILL-01 resolved. **Done when:**
      docs explain both client styles, proposals are clearly non-mutating, and agent
      guidance never guesses quantity or silently chooses product identity.

## Files / areas

- `src/grocery/grocery.service.ts`
- `src/grocery/grocery.controller.ts`
- `src/grocery/dto/`
- `src/product/product.service.ts`
- `src/mcp/mcp-server.factory.ts`
- Grocery, product, MCP, and E2E tests
- `integrations/hermes/home-stock-tracker/`
- `docs/api-reference.md`
- `blueprint/context/bugs/skill-01-the-checked-in-skill-contradicts-actual-product-creation-behavior.md`

## Data / contracts

- Product creation fields accepted through this operation are canonical name,
  aliases, category, typical unit, product type, and perishability.
- Prediction strategy, prediction enabled state, and free-form config are not exposed
  through grocery addition.
- New lines use the quantity contract from feature 28.
- Proposal state is not persisted and has no proposal ID.
- The add result remains structured for MCP clients and future UIs.

## Testing

- DTO and Zod tests for discriminated policy inputs and transport defaults.
- Service tests for existing canonical, existing alias, unknown deterministic create,
  unresolved proposal, LLM unavailable, and no-write assertions.
- Concurrency tests for product uniqueness and pending-line duplication.
- REST E2E tests for default and explicit policies.
- Real MCP tests for proposal default, explicit create, structured outcomes, and
  discoverable schemas.
- Regression tests for existing `confirmation_required`, `create_separate`, source
  attribution, and multi-item addition sequencing.
- Run `npm test`, `npm run test:e2e`, and `npm run build`.

## Acceptance criteria

- Direct clients can add an unknown product deterministically without an LLM.
- MCP and other assisted clients can receive candidates and advice without mutation.
- Product and grocery data are separated clearly in request contracts.
- Existing product metadata is never silently overwritten.
- Unknown product behavior is consistent across service, REST, MCP, docs, and skill.
- Quantity ambiguity retains the previously implemented confirmation flow.

## Handoff notes

Activate only after features 27, 28, and 29 are complete. Reconcile all public
contracts against their delivered shapes, then copy this plan to
`current-feature.md` through `/feature`. Confirmation writes remain feature 31.
