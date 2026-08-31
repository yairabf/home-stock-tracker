---
name: home-stock-tracker
description: Use the household grocery and inventory MCP tools
version: 1.3.0
author: Home Stock Tracker
metadata:
  hermes:
    tags: [household, grocery, inventory, mcp]
---

# Home Stock Tracker

Use this skill for clear requests about the household grocery list, purchases,
observed stock state, estimated inventory, products, or current low-stock
recommendations. The connected `home-stock-tracker` MCP server owns household
state and business rules. Select and sequence its tools; do not recreate its
logic in conversation.

## Responsibility boundary

- Use only facts the user supplied and structured values returned by tools.
- Do not infer an exact quantity from an inventory estimate.
- Do not calculate prediction confidence or override recommendation filtering.
- Do not create product IDs, grocery-item IDs, quantities, units, or event types.
- Do not expose raw tool payloads as the final response. Summarize the confirmed
  result concisely.
- One clear request may require several ordered tool calls. Finish prerequisite
  reads before mutations, preserve the user's item boundaries, and stop after an
  uncertain mutation result instead of continuing or retrying.

## Tool selection

| Tool | Use when | Do not use when |
| --- | --- | --- |
| `grocery_add` | The user explicitly asks to add one named product to the grocery list. Preserve an explicitly supplied positive quantity, unit, and note. Branch on its `created` or `confirmation_required` outcome. | The user only reports low stock, asks what is needed, or gives an invalid or unclear quantity. |
| `grocery_update` | The user confirms adding a known quantity to one exact pending line returned by `grocery_add`, or supplies a clarified target quantity for that line. Pass the returned quantity and unit back as expected values. | The pending line is ambiguous, its quantity is unspecified for an increment, units conflict, or the user has not confirmed the update. |
| `grocery_remove` | The user explicitly asks to remove one item and an exact grocery-item ID has been resolved through `grocery_list`. | Only a product ID or unverified item name is available. |
| `grocery_list` | The user asks what is on the grocery list, or an item ID must be resolved before removal. Omit `status` for the pending list. | The user asks for predicted low-stock recommendations. |
| `get_product` | Resolve an exact spoken product name or alias to a canonical product and UUID, or retrieve an already-known product ID. | Fuzzy guessing, broad product search, or product creation is required. |
| `get_inventory` | The user asks whether one known product is probably available, low, or out. Resolve its product ID first. | The user asks for an exact physical count or for all recommendations. |
| `record_purchase` | The user clearly reports purchasing or restocking one resolved product. Use `PURCHASED` for a purchase and `RESTOCKED` for an explicit restock. | The user only plans to buy something, reports current stock, or asks to complete a compound grocery-list purchase. |
| `record_stock_signal` | The user directly reports one resolved product as low, out, confirmed available, or corrected. | The statement is only a prediction or is too vague to map to an allowed event type. |
| `complete_grocery_purchase` | The user reports buying all or selected items from the current grocery list. Resolve the current pending item IDs with `grocery_list` first. | Any named included or excluded item has zero or multiple exact pending matches, no selected items remain, or the user only plans to shop later. |
| `get_low_stock_predictions` | The user asks what the household needs or which products are confidently predicted low or out. | The user asks for the grocery list or one product's estimated state. |

## Resolve identifiers first

Spoken product names are not IDs. Before `get_inventory`, `record_purchase`, or
`record_stock_signal`, call:

```json
{ "tool": "get_product", "arguments": { "productName": "milk" } }
```

Use the returned `id` in the next tool call. If the current interaction already
contains a product object returned by `get_product`, its ID may be reused. Never
invent or transform an ID.

To remove a grocery item, call `grocery_list` first. Match the requested name
against returned `productName` values. Call `grocery_remove` only when one exact
pending item is identified. If none or more than one match, explain briefly and
ask the user to clarify.

Treat `Grocery list item <id> not found` and `Grocery list item <id> is not
pending` from `grocery_remove` as final domain results. Refresh the list only for
a new user decision; do not retry the removal. If the transport result is
uncertain, stop and report that uncertainty without retrying.

## Read and mutation rules

Read tools may run immediately for a clear request. A mutation may run without
an extra confirmation when the user explicitly requests that exact mutation and
the target and material facts are unambiguous.

Ask a focused question before mutation when:

- the target could refer to multiple grocery items or products;
- a quantity is malformed, zero, negative, or conflicts with its unit;
- stock wording does not map clearly to an allowed event type;
- the user describes a future plan rather than a completed purchase;
- a named included or excluded grocery item has no unique exact pending match.

Omit optional fields that the user did not provide. Do not fill them with
defaults. One explicit request may produce its prerequisite lookup followed by
one mutation; that is still one intent.

## Grocery conversation workflows

### Add one item and handle an existing line

For a clear request such as "add one milk," call `grocery_add` once and inspect
its structured outcome.

- On `created`, summarize `createdItem`. Do not call another mutation.
- On `confirmation_required` with exactly one `existingItems` entry, do not
  mutate again yet. Preserve `requestedAddition` and ask: "This item is already
  on the list. Do you want to add the requested quantity, or cancel?"
- If the user cancels or declines, make no tool call and confirm cancellation.
- If the user confirms, call `grocery_update` for that exact existing item.
  Use `quantityMode: "increment"`, the original `requestedAddition.requestedQuantity`,
  and the existing item's `requestedQuantity` and `unit` as
  `expectedRequestedQuantity` and `expectedUnit`. Include the requested unit
  only when the user supplied it and it matches the existing unit.
- Never use `create_separate` as the meaning of "add another" or a yes answer.
  Use `grocery_add` with `ifPendingExists: "create_separate"` only when the user
  explicitly asks for a separate list line.

Ask a focused question without mutating when the safe update is not fully
defined:

- If `requestedAddition.requestedQuantity` is null, ask how many to add or
  whether to cancel.
- If the existing item's `requestedQuantity` is null, ask for the desired new
  total quantity. After the user supplies it, use `quantityMode: "set"` with
  `expectedRequestedQuantity: null`.
- If multiple `existingItems` are returned, describe their quantities, units,
  notes, and dates as needed and ask which line to update. Do not choose one.
- If the requested and existing units conflict, explain the two units and ask
  for a compatible quantity and unit. Do not convert units.

Treat `GROCERY_ITEM_CHANGED`, `GROCERY_ITEM_NOT_PENDING`, and
`GROCERY_ITEM_NOT_FOUND` as final results for that confirmation. Present the
safe current state when returned and ask for a fresh decision; do not retry the
update automatically. Treat `QUANTITY_UNSPECIFIED`, `UNIT_MISMATCH`,
`INVALID_QUANTITY`, and `INVALID_UNIT` as clarification branches, never as
permission to guess. After an uncertain mutation transport result, stop and
report uncertainty without retrying either tool.

### Add several items

For a clear request such as "add milk and eggs," call `grocery_add` once for
each explicitly named item. Keep any quantity, unit, or note attached only to
the item the user attached it to. Do not copy a quantity or unit across items.

Run the additions in the user's order. After each `created` result, continue to
the next item. If an addition returns `confirmation_required`, pause the
sequence and complete the confirmation flow for that item before attempting
later items. If a mutation result is uncertain, stop, report which additions
were confirmed and which later additions were not attempted, and do not retry.

### Read lists and recommendations

- "What's on the grocery list?" calls `grocery_list({})` and summarizes only
  the returned pending items.
- "What do we need?" calls `get_low_stock_predictions({})` and summarizes only
  the returned recommendations.

Do not merge these answers or turn a recommendation into a grocery-list change
unless the user explicitly requests that mutation.

### Run a scheduled proactive stock check

When a scheduled task explicitly asks for a proactive stock check:

1. Call `get_low_stock_predictions({})` exactly once.
2. If `recommendations` is empty, respond with exactly `[SILENT]`. Do not add an
   explanation, because Hermes cron uses this marker to suppress delivery.
3. If recommendations are present, write one concise household-facing message
   covering all of them in the returned order. Preserve each returned product
   name, predicted state, confidence, reason, and non-null recommended action.
   Do not recalculate confidence, reprioritize items, or add guesses.
4. Do not call a mutation, including `grocery_add`, unless a household member
   later makes an explicit request in conversation.

If the tool or its authenticated connection fails, do not return `[SILENT]`,
retry, or claim that no products need attention. Briefly report that the
scheduled stock check could not be completed so the failure remains observable
through Hermes cron delivery and run history.

These rules apply only to an explicitly scheduled proactive check. For a direct
question such as "What do we need?", follow the interactive behavior above and
tell the user when the recommendation list is empty.

### Complete a shopping trip

For "I bought everything," "I bought these items," or "I bought everything
except X":

1. Call `grocery_list({})` to obtain the current pending snapshot.
2. Identify included or excluded items only by exact `productName` matches in
   that result. Each named item must match exactly one pending item.
3. Ask a focused question without mutating when any name has zero or multiple
   exact matches, or when it is unclear whether the user bought an item.
4. Build an inclusive `groceryItemIds` array containing only items the user said
   were purchased. For "everything except X," remove the exactly matched
   exceptions from the pending snapshot.
5. If the inclusive array is empty, explain that nothing was recorded and do
   not call a mutation.
6. Call `complete_grocery_purchase` once with the inclusive IDs. Summarize only
   the returned completed items.

Never pass omitted item IDs to `complete_grocery_purchase`. Never approximate
this flow with `record_purchase`, `grocery_remove`, or repeated partial
completion calls. If the service rejects a stale item because the list changed,
read the list again and explain the change; do not repeat the mutation without
fresh user confirmation. If the mutation transport result is uncertain, do not
retry or claim that any item was completed.

## Event mapping

For `record_purchase`, use only:

- `PURCHASED` - the user says they bought or purchased the product.
- `RESTOCKED` - the user explicitly says they restocked or replenished it.

For `record_stock_signal`, use only:

- `STOCK_LOW` - clearly low, nearly out, or almost out.
- `STOCK_OUT` - clearly none left or out.
- `STOCK_CONFIRMED` - clearly still available or plenty remains.
- `STOCK_CORRECTED` - the user explicitly corrects an earlier stock record and
  provides enough information for this correction signal.

If no mapping is clear, ask rather than choosing the closest enum.

## Results and failures

- An empty `grocery_list` means there are no matching list items.
- An empty `recommendations` array is a successful result: there are no
  actionable high-confidence recommendations now.
- An `uncertain` inventory estimate is not evidence that an item is low or out.
- If `get_product` reports no exact product, say it could not find that product
  and ask for another canonical name or known alias. Do not create it indirectly.
- For a validation or not-found tool error, correct the request only from known
  user facts or ask a question.
- After a mutation transport failure with an uncertain outcome, do not retry
  automatically. Report that the result is uncertain so duplicate writes are
  avoided.

## Examples

**"Add two liters of milk."**

Call `grocery_add` with `productName: "milk"`, `requestedQuantity: 2`, and
`unit: "liters"`. On `created`, summarize `createdItem`. On
`confirmation_required`, ask whether to add two liters or cancel and wait before
calling `grocery_update`.

**"Remove milk from the list."**

Call `grocery_list`, find one exact pending `productName` match, then call
`grocery_remove` with that grocery item's `id`. Ask if the match is not unique.

**"Did we probably run out of milk?"**

Call `get_product` with `productName: "milk"`, then `get_inventory` with the
returned product `id`. Preserve uncertainty and the returned reason.

**"We're almost out of cereal."**

Call `get_product` with `productName: "cereal"`, then
`record_stock_signal` with `productId` set to the returned `id` and
`eventType: "STOCK_LOW"`.

**"I bought three cartons of milk."**

Call `get_product` with `productName: "milk"`, then `record_purchase` with the
`productId` set to the returned `id`, `eventType: "PURCHASED"`, `quantity: 3`,
and `unit: "cartons"`.

**"What do we need?"**

Call `get_low_stock_predictions`. Report only returned recommendations. Do not
supplement an empty result with guesses.

**"I bought everything except toilet paper."**

Call `grocery_list`. Match "toilet paper" to exactly one pending
`productName`, remove that item from the pending snapshot, then call
`complete_grocery_purchase` once with all remaining item IDs. Leave toilet paper
pending and summarize only the confirmed completed items.
