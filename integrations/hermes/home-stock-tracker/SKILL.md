---
name: home-stock-tracker
description: Use the household grocery and inventory MCP tools
version: 1.13.0
author: Home Stock Tracker
metadata:
  hermes:
    tags: [household, grocery, inventory, mcp]
---

# Home Stock Tracker

Use this skill for clear requests about the household grocery list, purchases,
recorded inventory history, observed stock state, estimated inventory, products,
current low-stock recommendations, or active household prediction configuration.
The connected `home-stock-tracker` MCP server owns household state and business
rules. Select and sequence its tools; do not recreate its logic in conversation.

## Responsibility boundary

- Use only facts the user supplied and structured values returned by tools.
- Do not infer an exact quantity from an inventory estimate.
- Do not calculate prediction confidence or override recommendation filtering.
- Do not create product IDs, grocery-item IDs, quantities, units, or event types.
- Do not fetch household context as a hidden prerequisite for routine inventory
  estimates or low-stock recommendations.
- Do not expose raw tool payloads as the final response. Summarize the confirmed
  result concisely.
- One clear request may require several ordered tool calls. Finish prerequisite
  reads before mutations, preserve the user's item boundaries, and stop after an
  uncertain mutation result instead of continuing or retrying.

## Tool selection

| Tool                            | Use when                                                                                                                                                                                                               | Do not use when                                                                                                                                                                       |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `grocery_add`                   | The user explicitly asks to add one named product. Begin uncertain names in proposal mode with `productName` and nested `groceryItem`; branch on `created`, `confirmation_required`, or `product_resolution_required`. | The user only reports low stock, asks what is needed, gives an invalid quantity, or has not supplied every product fact required for deterministic creation.                          |
| `grocery_confirm_new_product`   | The user explicitly approves complete final product facts from a resolution conversation. Send those facts and the original `groceryItem`; no proposal ID or source.                                                   | Any product fact is guessed, the user chose an existing product, cancelled, or has not approved the final payload.                                                                    |
| `grocery_confirm_product_alias` | The user explicitly confirms that the original phrase is an alias for one exact returned product ID. Send the approved alias and original `groceryItem`.                                                               | The target is ambiguous, the relationship was not explicitly approved, or generic catalog maintenance is requested outside a grocery addition.                                        |
| `grocery_set_quantity`          | The user selects an absolute final quantity for one exact pending line. Send its `itemId`, final quantity, and exact current quantity as `expectedRequestedQuantity`.                                                  | Unit or note also changes, the line is ambiguous, the final total is unclear, or the user chose no change.                                                                            |
| `grocery_update`                | The user selects unit, note, or an intentional combination of fields for one exact pending line. Pair every selected field with its returned old value.                                                                | Only quantity changes, the line is ambiguous, or the user has not confirmed every final value.                                                                                        |
| `grocery_remove`                | The user explicitly asks to remove one item and an exact grocery-item ID has been resolved through `grocery_list`.                                                                                                     | Only a product ID or unverified item name is available.                                                                                                                               |
| `grocery_list`                  | The user asks what is on the grocery list, or an item ID must be resolved before removal. Omit `status` for the pending list.                                                                                          | The user asks for predicted low-stock recommendations.                                                                                                                                |
| `get_household_context`         | The user explicitly asks which household is connected, how it is configured, or which household settings help explain prediction behavior.                                                                             | The user asks for a routine inventory estimate or recommendation without a setup, configuration, or explanation question.                                                             |
| `get_product`                   | Resolve an exact spoken product name or alias to a canonical product and UUID, or retrieve an already-known product ID.                                                                                                | Nearby or broad product discovery is required.                                                                                                                                        |
| `search_products`               | Discover exact or nearby catalog products when the phrase is unknown, broad, or ambiguous. Preserve returned order and present plausible candidates.                                                                   | The product UUID is already trusted, or the user is asking search to create, alias, or mutate a product.                                                                              |
| `product_add_alias`             | The user explicitly confirms that one alias identifies one exact trusted product ID outside a grocery-add workflow.                                                                                                    | The target is ambiguous, the relationship is inferred or only suggested, or the request also needs a grocery mutation.                                                                |
| `get_inventory`                 | The user asks for the latest materialized estimate and last explicit fact for one known product. Resolve its product ID first.                                                                                         | The user asks for an exact physical count, all household inventory, or all recommendations.                                                                                           |
| `list_inventory`                | The user asks what is probably available across the household. Preserve the separate `current` and `uncertain` groups.                                                                                                 | The user asks for committed grocery items, recorded history, or exact physical counts.                                                                                                |
| `list_inventory_events`         | The user asks what was recorded, when a purchase or signal happened, or wants evidence before deciding on a correction. Resolve a named product first.                                                                 | The user asks for estimated current stock, or the request itself is an unambiguous mutation.                                                                                          |
| `record_purchase`               | The user clearly reports purchasing or restocking one resolved product. Use `PURCHASED` for a purchase and `RESTOCKED` for an explicit restock.                                                                        | The user only plans to buy something, reports current stock, or asks to complete a compound grocery-list purchase.                                                                    |
| `record_purchases`              | The user reports a recently purchased list that is not a grocery-list completion. Resolve every product first, preserve item order and boundaries, and send one atomic batch.                                          | Any identity is unresolved, a product appears twice, the report is future intent, or the user refers to pending grocery rows.                                                         |
| `update_inventory`              | The user supplies an explicit absolute quantity, decrement amount, or says one exact product is out. Use `set`, `decrement`, or `mark_out` respectively.                                                               | Availability is vague, a required quantity is missing, the unit would need conversion, or the target is unresolved.                                                                   |
| `record_stock_signal`           | The user directly reports a qualitative low state or corrects recorded history without referring to a prediction and without an explicit stock quantity.                                                               | The statement supplies an exact quantity, says the product is out, confirms availability without a quantity, or refers to one specific prediction.                                    |
| `record_prediction_feedback`    | The user unambiguously accepts, rejects, or corrects one prediction whose non-null ID came from the active interaction or a fresh prediction read.                                                                     | The prediction reference is ambiguous, conversationally stale, unrelated, or has a null ID; or the user reports stock without referring to a prediction.                              |
| `complete_grocery_purchase`     | The user reports buying all or selected items from the current grocery list. Resolve current pending item IDs first and prefer `items`, adding actual measurements only from explicit user facts.                      | Any named item has zero or multiple exact pending matches, no selected items remain, duplicate-product measurements are incomplete or conflict, or the user only plans to shop later. |
| `get_low_stock_predictions`     | The user asks what the household needs or which products are confidently predicted low or out.                                                                                                                         | The user asks for the grocery list or one product's estimated state.                                                                                                                  |

## Household context

Call `get_household_context({})` only when the user explicitly asks about the
connected household, its prediction configuration, or how household settings
relate to prediction behavior. It is not a prerequisite for `get_inventory` or
`get_low_stock_predictions`; those service-owned operations already load the
context they need.

Preserve returned counts, age groups, preferences, threshold, policies, and
household ID exactly. Summarize only the fields relevant to the question. Do not
invent omitted settings, reinterpret policy payloads, expose a raw payload, or
turn the read into any mutation.

Treat `Household is not configured` as incomplete setup. State this and stop.
MCP does not create or update household configuration.

## Resolve identifiers first

Spoken product names are not IDs. Before `get_inventory`,
`list_inventory_events`, `product_add_alias`, `record_purchase`,
`record_purchases`, `update_inventory`, or `record_stock_signal`, call:

```json
{ "tool": "get_product", "arguments": { "productName": "milk" } }
```

Use the returned `id` in the next tool call. If the current interaction already
contains a product object returned by `get_product`, its ID may be reused. Never
invent or transform an ID.

If exact lookup fails, or the request asks which related products exist, call
`search_products`. An exact search result may be presented as the resolved
identity. With one non-exact candidate, present it and confirm that it is what the
user means before a mutation. With multiple candidates, list every plausible
candidate in returned order and ask the user to choose. Never silently select a
candidate. With no candidates, ask for another name or more detail.

`search_products` is read-only and provider-free. It never creates a product,
adds an alias, applies a proposal, or authorizes a write. Treat any future
advisory proposal as advice only and require the normal explicit mutation flow.

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

Omit optional fields that the user did not provide. Do not invent client-side
defaults. The service defaults omitted quantity to `1` only when it persists a
new grocery line. Every persisted grocery quantity returned by the service is a
finite positive number. One explicit request may produce its prerequisite lookup
followed by one mutation; that is still one intent.

`product_add_alias` always requires explicit confirmation that the approved
alias identifies the exact resolved product. A direct request such as "teach the
system that whole milk means milk" can supply that confirmation when `milk`
resolves uniquely. A search result or LLM suggestion alone never supplies it.

## Standalone product alias workflow

Use `product_add_alias` only for catalog teaching outside a grocery-add request:

1. Resolve the target with `get_product`, or use an already trusted product ID
   returned in the active interaction.
2. If exact lookup fails, use `search_products`, present every plausible
   candidate in returned order, and wait for the user to choose one.
3. Repeat the exact target and alias relationship when it is not already an
   explicit part of the user's request. Do not mutate until the user confirms.
4. Call `product_add_alias` once with only `productId` and `alias`.
5. Summarize the returned canonical product and saved aliases.

Treat `PRODUCT_NAME_CONFLICT` and a missing target as final for that decision.
Do not choose another product or retry automatically. After an uncertain
transport result, stop and report uncertainty; verify product state through a
fresh read before asking the user about any new write.

## Grocery conversation workflows

### Add one item and handle an existing line

For a clear request such as "add one milk," begin in proposal mode. MCP defaults
an omitted `unknownProductPolicy` to `propose_if_missing`, so call
`grocery_add({ productName: "milk", groceryItem: { requestedQuantity: 1 } })`
once and inspect its structured outcome. Keep product identity separate from the
nested grocery-line facts. Never invent either one.

- On `created`, summarize `createdItem`. Do not call another mutation.
- On `product_resolution_required`, make no further mutation. Present the
  returned deterministic candidates, optional proposal, and `allowedActions`,
  then ask the user to choose. Proposal advice is non-authoritative and never
  grants permission to select an identity, add an alias, or create a product.
  Continue only from the user's explicit decision:
  - If the user approves complete final product facts, call
    `grocery_confirm_new_product` once with those approved facts and the original
    `groceryItem`. Do not pass proposal state or call the LLM again.
  - If the user explicitly confirms that the original phrase is an alias for one
    exact candidate, call `grocery_confirm_product_alias` once with that returned
    product ID, the approved alias, and the original `groceryItem`.
  - If the user cancels, make no tool call.
  - If the answer does not fully define either final payload, ask one focused
    question and do not mutate.
- On `confirmation_required` with exactly one `existingItems` entry, do not
  mutate again yet. Preserve `requestedAddition`, explain the current quantity,
  and ask what the final quantity should be. For example: "Milk is already on
  the list with 2 cartons. Do you want 2, 3, or 4 cartons in total?"
- If the user chooses no change or cancels, make no tool call and confirm it.
- If the user selects an additional amount, calculate the final quantity from
  the returned current quantity and the user's answer. If the user gives a final
  total directly, use that total. Never ask the service to perform arithmetic.
- For a quantity-only change, call `grocery_set_quantity` once with the exact
  existing item `id` as `itemId`, the calculated final `requestedQuantity`, and
  the returned current quantity as `expectedRequestedQuantity`.
- If quantity changes together with unit or note, use `grocery_update` once and
  pair every selected field with its returned old value: `expectedRequestedQuantity`,
  `expectedUnit`, or `expectedNote`. Do not split one confirmed multi-field
  decision across tools.
- Never use `create_separate` as the meaning of "add another" or a yes answer.
  Use nested `groceryItem.ifPendingExists: "create_separate"` only when the user
  explicitly asks for a separate list line.

Use explicit `create_if_missing` only for a deliberate direct-client request
that already supplies all product facts: `canonicalName`, `aliases`, `category`,
`typicalUnit`, `productType`, and `isPerishable`. Send those under `product` and
send quantity, unit, note, and pending-line policy under `groceryItem`. This path
is deterministic and does not use proposal advice. Ordinary conversational names
do not provide these facts, so do not guess them to force creation.

Ask a focused question without mutating when the safe update is not fully
defined:

- If `requestedAddition.requestedQuantity` is null, ask how many to add or
  whether to cancel. Never interpret omission as adding one to the existing line.
- If multiple `existingItems` are returned, describe their positive quantities, units,
  notes, and dates as needed and ask which line to update. Do not choose one.
- If the requested and existing units conflict, explain the two units and ask
  for a compatible quantity and unit. Do not convert units.

Treat `GROCERY_ITEM_CHANGED`, `GROCERY_ITEM_NOT_PENDING`, and
`GROCERY_ITEM_NOT_FOUND` as final results for that decision. Present the safe
current state when returned and ask for a fresh decision; do not retry or
recalculate automatically. Treat `INVALID_QUANTITY`, `INVALID_UNIT`, `INVALID_NOTE`,
and `INVALID_UPDATE` as clarification branches, never as permission to guess.
After an uncertain mutation transport result, stop and report uncertainty
without retrying either tool.

The confirmation tools can themselves return `confirmation_required`. That
means the approved catalog identity was applied, but no existing grocery
quantity was changed. Preserve the returned request and resolve the final
quantity through the same separate quantity workflow above. Do not repeat the
catalog confirmation. Treat `PRODUCT_NAME_CONFLICT` and `PRODUCT_NOT_FOUND` as
stale final decisions: explain the catalog changed and ask for a fresh choice;
do not auto-retry, regenerate a proposal, or silently choose another target.

### Add several items

For a clear request such as "add milk and eggs," call `grocery_add` once for
each explicitly named item. Keep any quantity, unit, or note attached only to
the item the user attached it to. Do not copy a quantity or unit across items.

Run the additions in the user's order. After each `created` result, continue to
the next item. If an addition returns `confirmation_required` or
`product_resolution_required`, pause the sequence and complete the decision flow
for that item before attempting later items. If a mutation result is uncertain,
stop, report which additions
were confirmed and which later additions were not attempted, and do not retry.

### Read lists and recommendations

- "What's on the grocery list?" or "Show me the list" calls both
  `grocery_list({})` and `get_low_stock_predictions({})`. Present two clearly
  labeled groups: committed grocery items and suggested items. Preserve each
  result's order and say when either group is empty.
- "What do we need?" calls `get_low_stock_predictions({})` and summarizes only
  the returned recommendations.
- "What do we have?" calls `list_inventory({})`. Present `current` as estimated
  available stock and `uncertain` separately. Do not present omitted depleted or
  untracked products as known absent.

The combined list presentation does not merge the two backend contracts. Never
present a suggestion as already committed. If the user explicitly confirms one
suggestion, run the normal `grocery_add` workflow for its returned product name;
do not mutate from the recommendation read alone or assume confirmation for
other suggestions.

### Read recorded inventory history

For a history question about a named product, resolve the product first, then
call `list_inventory_events` with its returned `productId`. Add `eventType` only
when the user's wording clearly asks for one recorded event class. For example,
"When did we last buy milk?" uses `eventType: "PURCHASED"`; a broad question
about milk history omits the event filter.

Results are newest first. Use `total`, `limit`, and `offset` to explain whether
the response is a complete result or one page. Fetch another page only when the
user asks for more or the requested time range requires it, increasing `offset`
by the prior page's `limit`. Never skip or repeat offsets.

Summarize only the returned event fields. MCP history intentionally omits stored
`metadata`; do not reconstruct, expose, or guess it. A recorded event is evidence
of what the service stored at its timestamp, not proof of the exact current
physical quantity. If the user also asks about current stock, call
`get_inventory` separately and label that result as an estimate.

History reads never authorize a mutation. When the user asks to inspect evidence
before a possible correction, show the recorded events and wait. Call
`record_stock_signal` only after a separate explicit, unambiguous correction
request.

### Record prediction feedback

Use `record_prediction_feedback` only when the user refers unambiguously to one
prediction returned in the active interaction. The `predictionId` must be
non-null and must come directly from `get_inventory` or
`get_low_stock_predictions`. If the reference is ambiguous, conversationally
stale, or has a null ID, ask which prediction they mean or make a fresh
prediction read before any mutation. Never guess, transform, or reuse an
unrelated prediction ID.

- Use `accepted` when the user confirms that the referenced prediction was
  right.
- Use `rejected` when the user says the referenced prediction was wrong but does
  not provide a concrete corrected stock state.
- Use `corrected` only when the user supplies the concrete replacement state:
  `likely_available`, `probably_low`, or `probably_out`.

A corrected feedback call records its corresponding stock correction in the
same service operation. Do not also call `record_stock_signal`. A correction or
direct observation that is not about a specific prediction stays on
`record_stock_signal`.

Treat `Prediction feedback was already recorded` as final for that prediction.
After an uncertain transport result, do not retry or claim that feedback was
recorded.

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

### Record a recently purchased product list

Use `record_purchases` when the user reports a completed purchase containing
several products without referring to pending grocery rows:

1. Resolve every named product with `get_product`, one product at a time, unless
   its exact product ID is already trusted in the active interaction.
2. Stop before mutation if any name is unresolved or ambiguous. Do not record a
   partial prefix of the list.
3. Preserve the user's item order and keep each quantity, unit, and timestamp
   attached only to the item it described. Never copy measurements between
   items or convert units.
4. Reject duplicate resolved product IDs as ambiguous. Ask the user for one
   consolidated measurement for that product.
5. Call `record_purchases` once with one unique item per resolved product. Send
   `quantity`, `unit`, request-level `purchasedAt`, or per-item `purchasedAt`
   only when the user supplied that fact. An omitted quantity uses the service
   default; do not claim the user reported one.
6. Summarize the returned ordered receipts only after the complete batch
   succeeds.

The batch is all-or-nothing. A validation or domain error means no item was
recorded. After an uncertain transport result, stop, report that the entire
batch outcome is uncertain, and do not retry automatically.

### Update explicit stock

Resolve the exact product first, then map only explicit measurements:

- "We have 3 cartons of milk" uses `update_inventory` with `operation: "set"`,
  `quantity: 3`, and `unit: "cartons"`.
- "We used 2 cartons of milk" uses `operation: "decrement"` and the explicit
  measurement. Do not calculate or send a final balance.
- "We are out of milk" uses `operation: "mark_out"` with no quantity or unit.

For "we still have milk" or another quantity-free availability statement that
is not prediction feedback, ask how much remains. Call `set` only after the user
provides a positive quantity, with a unit only when supplied. Do not turn a
quantity-free `STOCK_CONFIRMED` signal into a known balance, invent a count, or
fall back to `record_stock_signal` to avoid the clarification.

If `set` would establish a different canonical unit, repeat the exact quantity
and unit and obtain explicit confirmation before the call. Never convert units.
Treat an untracked or quantity-unknown decrement as final for that attempt and
ask for an absolute current quantity before a new decision. After an uncertain
mutation result, do not retry or claim the balance changed.

### Complete a shopping trip

For "I bought everything," "I bought these items," or "I bought everything
except X":

1. Call `grocery_list({})` to obtain the current pending snapshot.
2. Identify included or excluded items only by exact `productName` matches in
   that result. Each named item must match exactly one pending item.
3. Ask a focused question without mutating when any name has zero or multiple
   exact matches, or when it is unclear whether the user bought an item.
4. Build the preferred inclusive `items` array in user order. Each object must
   contain one returned `groceryItemId`. For "everything except X," remove the
   exactly matched exceptions from the pending snapshot.
5. Add `actualQuantity` only when the user explicitly states the amount actually
   purchased. Add a trimmed `actualUnit` only with that actual quantity. Never
   copy `requestedQuantity`, the grocery item's requested `unit`, or the
   product's typical unit into these actual fields.
6. When selected rows share one product, supply measurements only if every row
   has an explicit actual quantity and their units match exactly after trimming,
   including all rows omitting a unit. If measurements are incomplete or units
   conflict, ask one focused question before mutation. Never convert units.
7. If the inclusive array is empty, explain that nothing was recorded and do
   not call a mutation.
8. Call `complete_grocery_purchase` once with `{ items }`. Summarize only the
   returned completed items and recorded actual measurements.

The legacy `{ groceryItemIds }` form remains available for transitional older
clients, but new agent calls must use `{ items }`.

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
- `STOCK_CORRECTED` - the user explicitly corrects an earlier stock record and
  provides enough information for this correction signal.

Use `update_inventory` `mark_out` for a direct out report. Ask for a quantity
before representing confirmed availability as a balance. `STOCK_OUT` and
`STOCK_CONFIRMED` remain accepted service event types for compatibility, but new
agent conversations should use the materialized stock workflow above.

If no mapping is clear, ask rather than choosing the closest enum.

## Results and failures

- An empty `grocery_list` means there are no matching list items.
- Empty `list_inventory.current` and `list_inventory.uncertain` groups mean no
  tracked non-depleted products were returned; they do not prove the household
  physically has nothing.
- An empty `list_inventory_events.items` array means there are no matching
  recorded events. It does not establish the product's current stock state.
- An empty `recommendations` array is a successful result: there are no
  actionable high-confidence recommendations now.
- An `uncertain` inventory estimate is not evidence that an item is low or out.
- If `get_product` reports no exact product, call `search_products`. Present its
  bounded candidates or ask for more detail when empty. Do not create a product,
  add an alias, or mutate state from search results alone.
- For a validation or not-found tool error, correct the request only from known
  user facts or ask a question.
- After a mutation transport failure with an uncertain outcome, do not retry
  automatically. Report that the result is uncertain so duplicate writes are
  avoided.

## Examples

**"Add two liters of milk."**

Call `grocery_add` with `productName: "milk"` and nested
`groceryItem: { requestedQuantity: 2, unit: "liters" }`. Omit
`unknownProductPolicy` to use proposal mode. On `created`, summarize
`createdItem`. On `product_resolution_required`, present the choices and wait
without mutating. On
`confirmation_required`, explain the current quantity and ask what final total
the user wants. Calculate that total from the answer before calling
`grocery_set_quantity` for a quantity-only change.

**"Remove milk from the list."**

Call `grocery_list`, find one exact pending `productName` match, then call
`grocery_remove` with that grocery item's `id`. Ask if the match is not unique.

**"Did we probably run out of milk?"**

Call `get_product` with `productName: "milk"`, then `get_inventory` with the
returned product `id`. Label the response as the latest materialized estimate,
keep the last explicit fact separate, and preserve uncertainty and the returned
reason.

**"Show me the list."**

Call `grocery_list({})` and `get_low_stock_predictions({})`. Present committed
grocery items first and suggested items second, with clear labels. Make no
mutation unless the user then explicitly confirms a suggestion through the
normal grocery-add workflow.

**"When did we last buy milk?"**

Call `get_product` with `productName: "milk"`, then call
`list_inventory_events` with the returned `productId`, `eventType: "PURCHASED"`,
and `limit: 1`. Report the returned timestamp as recorded purchase history, not
as evidence of the current quantity.

**"Teach the system that whole milk means milk."**

Resolve `milk` with `get_product`. If the result is exact and the user's request
clearly confirms the relationship, call `product_add_alias` with the returned
`productId` and `alias: "whole milk"`. Otherwise present candidates or ask for
confirmation without mutating.

**"Yes, that prediction was right."**

When one active prediction is unambiguously referenced and has a non-null
`predictionId`, call `record_prediction_feedback` with that ID and
`outcome: "accepted"`.

**"No, we still have milk."**

When this directly answers one active prediction, call
`record_prediction_feedback` with its non-null `predictionId`,
`outcome: "corrected"`, and `correctedState: "likely_available"`. Do not also
call `record_stock_signal`. Without a referenced prediction, resolve milk and
ask how much remains before using `update_inventory` with `operation: "set"`.

**"We're almost out of cereal."**

Call `get_product` with `productName: "cereal"`, then
`record_stock_signal` with `productId` set to the returned `id` and
`eventType: "STOCK_LOW"`.

**"I bought three cartons of milk."**

Call `get_product` with `productName: "milk"`, then `record_purchase` with the
`productId` set to the returned `id`, `eventType: "PURCHASED"`, `quantity: 3`,
and `unit: "cartons"`.

**"I bought milk and two cartons of eggs yesterday."**

Resolve both products, then call `record_purchases` once with the returned IDs
in user order. Omit milk's quantity and unit, attach `quantity: 2` and
`unit: "cartons"` only to eggs, and include yesterday's exact timestamp only if
the user or surrounding trusted context establishes it. Do not partially record
the list if either identity is unresolved.

**"What do we need?"**

Call `get_low_stock_predictions`. Report only returned recommendations. Do not
supplement an empty result with guesses.

**"I bought everything except toilet paper."**

Call `grocery_list`. Match "toilet paper" to exactly one pending
`productName`, remove that item from the pending snapshot, then call
`complete_grocery_purchase` once with
`{ items: [{ groceryItemId: <returned id> }, ...] }` for all remaining items.
Omit actual fields because the user supplied no actual measurements. Leave
toilet paper pending and summarize only the confirmed completed items.
