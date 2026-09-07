# Confirmed product creation during absolute stock updates

## Status and scope

This document records the decisions approved during the design interview. Use it
as input for `blueprint/context/current-feature.md`; implementation has not started.

The agreed fix supports unknown products during explicit absolute stock updates.
It supersedes the original completed-retailer-order reconciliation proposal.
Stock updates and purchase completion are separate intents. This flow must never
add, complete, remove, or change grocery-list items.

## Problem

Hermes can set stock for existing products but lacks an equivalent MCP confirmation
path that creates an unknown product and sets its stock atomically. The original
incident involved using `grocery_add` to stage products, creating unwanted pending
entries. Reuse the explicit unknown-product confirmation pattern from grocery
additions, with a stock set as the confirmed action instead of a grocery addition.

Do not use `grocery_add` or `grocery_confirm_new_product` to stage stock updates.

## Agreed decisions

### Actions and stock semantics

- Creation is supported only for absolute `set` operations.
- `decrement` and `mark_out` continue to require an existing product.
- A set overwrites recorded quantity; it does not increment it. Setting three
  liters when recorded stock is two produces three liters.
- Preserve existing validation: sets require finite positive quantities. Zero
  uses `mark_out`; creating unknown products with zero stock is unsupported.
- Preserve existing purchase stock-reset behavior. Changing the stock model is
  outside this fix.

### Generic identity and units

- Hermes simplifies descriptions into generic household products. Brand
  information stays on the Hermes side, not in this service's product identity.
- Use one generic `3% milk` product tracked in liters rather than separate
  products for brands or package sizes.
- Preserve meaningful variants such as lactose-free milk as separate products.
- Hermes converts explicit package measurements: two one-liter cartons become
  quantity `2`, unit liters.
- The service resolves the canonical product or enters confirmation. Uncertain
  identity or conversion requires clarification; neither may be guessed.

### Resolution and partial progress

1. Resolve each requested stock line through the existing product-resolution flow.
2. Apply clear, known, exact-product updates immediately.
3. Hold unknown products for explicit confirmation. A stock-update request does
   not itself authorize creating products.
4. Bundle proposed new products into one user-facing question, preserving each
   proposed product's requested quantity and unit through confirmation.
5. Hold ambiguous identities and uncertain conversions until clarified, without
   mutating catalog or stock for those lines.
6. Report which lines succeeded, failed, or still need input. Earlier successes
   remain applied when another line is unresolved or fails. Resume outstanding
   lines without replaying successful updates.

The existing stock tool operates on one product at a time. This partial-progress
behavior can be orchestrated by Hermes; a new batch endpoint is not required.
Bundling approval questions does not promise a transaction across all products.

### Atomic confirmation

- Reuse the existing grocery flow's explicit approval pattern for final product
  facts, carrying the absolute stock quantity and unit with the proposal.
- Approval creates the product and sets its stock in one transaction. If either
  part fails, neither effect persists.
- Declining leaves the catalog and stock unchanged for that line.
- If the exact product appears while approval is pending, reuse it only when its
  identity and stock unit match the approved proposal.
- Identity or unit conflicts require clarification. Do not silently change units,
  select another product, or create a duplicate.
- No outcome of this confirmation flow may mutate the grocery list.

### Safe confirmation retries

- Each product-and-stock confirmation operation has a stable operation ID.
- An identical retry returns the original successful result without creating
  another product, stock event, quantity overwrite, or timestamp refresh.
- A changed payload using the same operation ID is rejected without mutation.
- Persist the successful result atomically with the product and stock effects so
  a lost response cannot cause a second application.
- A retry after a newer stock change returns the original result and preserves
  the newer state.
- These identifiers belong to stock confirmation. Retailer, order, and receipt-line
  identifiers are not required. Broad changes to existing tool idempotency are
  outside this fix.

## Existing implementation context

Recheck these facts when writing the active feature spec:

- `update_inventory` currently accepts one exact product ID, not a name or batch.
- Read-only product resolution already supplies exact matches, candidates, and
  optional proposed creation facts without stock or catalog mutation.
- Standalone REST product creation exists. The missing capability is the atomic,
  confirmed MCP stock workflow, not all product-creation APIs.
- Grocery confirmation already combines product creation/reuse with a grocery
  mutation in a transaction. Reuse appropriate product primitives with a stock
  set, explicit compatibility checks, and the agreed retry protection.
- Existing confirmation trusts the client's user-approved final payload rather
  than requiring a stored proposal token. Reuse that approval pattern; an
  operation ID protects execution retries and does not replace user approval.
- Ordinary absolute sets can explicitly replace stock units. Preserve known-product
  behavior, but enforce the stricter compatibility check when reusing a product
  that appeared while new-product confirmation was pending.

Exact tool names, DTOs, persistence details, and implementation steps remain for
the active feature spec, subject to these agreed behaviors.

## Documentation and Hermes scenarios

Update MCP/tool descriptions and the bundled Hermes skill/scenarios to explain:

- Absolute stock updates versus purchase-completion intent.
- Generic normalization, exact resolution, and explicit package conversions.
- Immediate known-product updates and holding unresolved lines.
- Explicit bundled confirmation with quantity and unit preserved.
- Atomic creation and stock setting without grocery side effects.
- Declines, ambiguity, unit conflicts, concurrent creation, and partial failures.
- Retrying confirmation with the same operation ID and approved payload.
- No use of grocery-addition tools to stage stock updates.

### Example

The user asks Hermes to set stock from supplied grocery information: two one-liter
cartons of branded 3% milk, one kilogram of rice, and an unclear yogurt description.
This is an absolute stock-update request, not purchase completion.

1. Hermes keeps the brand on its side and normalizes milk to `3% milk`, quantity
   `2`, unit liters.
2. Rice resolves exactly, so Hermes immediately sets rice stock to one kilogram.
3. Milk is unknown. Hermes proposes the generic product and two-liter stock set
   for explicit approval, bundled with any other new-product proposals.
4. Yogurt is ambiguous, so Hermes asks for clarification without changing it.
5. Approval atomically creates milk and sets its stock to two liters. Declining
   would leave that line's catalog and stock unchanged.
6. If the response is lost, an identical confirmation retry with the same operation
   ID returns the original result without setting stock again.
7. Hermes reports completed and outstanding lines. All grocery entries, including
   matching pending items, remain unchanged.

## Deferred work and superseded scope

Earlier interview decisions explored purchase imports before the user narrowed
this fix. Preserve the following as future discussion inputs, not requirements:

- One retailer-agnostic import operation coordinating purchases and grocery
  reconciliation, with atomic submitted groups and later unresolved-line imports.
- Partial grocery fulfillment: buying two of six comparable units would retain
  four; meeting or exceeding the request would complete it; incompatible units
  would require clarification.
- Stable source, order, and original line IDs for purchase-import retries, with
  replay results and changed-payload conflicts.
- Historical purchase/delivery dates and choosing inventory facts according to
  the latest date. These require later discussion; no historical grocery-list
  eligibility rule was approved for this fix.
- Changes to `record_purchases`, `complete_grocery_purchase`, or the stock model.
- Retailer integration, service-side brand storage, receipt parsing, and automatic
  inference of uncertain unit conversions.

## Acceptance criteria

- [ ] Known exact products still receive absolute stock sets immediately.
- [ ] Unknown products in absolute sets enter explicit confirmation, preserving
      approved product facts, quantity, and unit.
- [ ] Approval creates the product and sets stock atomically; failure leaves no
      newly created product or partial stock effects.
- [ ] Declining causes no catalog or stock mutation for that line.
- [ ] Decrement, mark-out, and zero sets cannot create unknown products.
- [ ] Ambiguous identities and uncertain conversions cause no mutation until resolved.
- [ ] Mixed requests apply clear known lines, hold unresolved lines, bundle creation
      questions, and accurately report successes, failures, and remaining input.
- [ ] Concurrent product creation reuses only compatible exact products; identity
      or unit conflicts cause no mutation and require clarification.
- [ ] Identical confirmation retries return the original result without another
      event or stock write, including after a newer stock change.
- [ ] Changed payloads under an existing operation ID are rejected without mutation;
      concurrent identical confirmations apply at most once.
- [ ] All grocery-list entries remain unchanged throughout this flow.
- [ ] MCP descriptions and Hermes documentation include the agreed workflow and
      realistic mixed-stock-update example.
- [ ] Focused tests and integration coverage demonstrate atomic rollback, mixed
      known/unknown/ambiguous handling, compatibility conflicts, retry protection,
      and unchanged grocery entries, including matching pending products.
