---
name: home-stock-tracker
description: Use the household grocery and inventory MCP tools
version: 1.0.0
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
- This skill handles one clear intent at a time. Compound purchase completion,
  such as "I bought everything except toilet paper," requires the separate
  grocery-conversation workflow.

## Tool selection

| Tool | Use when | Do not use when |
| --- | --- | --- |
| `grocery_add` | The user explicitly asks to add one named product to the grocery list. Preserve an explicitly supplied positive quantity, unit, and note. | The user only reports low stock, asks what is needed, or gives an invalid or unclear quantity. |
| `grocery_remove` | The user explicitly asks to remove one item and an exact grocery-item ID has been resolved through `grocery_list`. | Only a product ID or unverified item name is available. |
| `grocery_list` | The user asks what is on the grocery list, or an item ID must be resolved before removal. Omit `status` for the pending list. | The user asks for predicted low-stock recommendations. |
| `get_product` | Resolve an exact spoken product name or alias to a canonical product and UUID, or retrieve an already-known product ID. | Fuzzy guessing, broad product search, or product creation is required. |
| `get_inventory` | The user asks whether one known product is probably available, low, or out. Resolve its product ID first. | The user asks for an exact physical count or for all recommendations. |
| `record_purchase` | The user clearly reports purchasing or restocking one resolved product. Use `PURCHASED` for a purchase and `RESTOCKED` for an explicit restock. | The user only plans to buy something, reports current stock, or asks to complete a compound grocery-list purchase. |
| `record_stock_signal` | The user directly reports one resolved product as low, out, confirmed available, or corrected. | The statement is only a prediction or is too vague to map to an allowed event type. |
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

## Read and mutation rules

Read tools may run immediately for a clear request. A mutation may run without
an extra confirmation when the user explicitly requests that exact mutation and
the target and material facts are unambiguous.

Ask a focused question before mutation when:

- the target could refer to multiple grocery items or products;
- a quantity is malformed, zero, negative, or conflicts with its unit;
- stock wording does not map clearly to an allowed event type;
- the user describes a future plan rather than a completed purchase;
- fulfilling the request would require an unsupported compound workflow.

Omit optional fields that the user did not provide. Do not fill them with
defaults. One explicit request may produce its prerequisite lookup followed by
one mutation; that is still one intent.

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
`unit: "liters"`. Summarize the returned grocery item.

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

Do not approximate this with the available single-product tools. Explain that
the compound grocery-completion flow is not available in this skill.
