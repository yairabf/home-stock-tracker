# API and MCP Reference

This document is the reusable interface reference for Home Stock Tracker. For
installation, start with the [root README](../README.md). For client-specific
setup, see [Agent Integrations](agent-integrations.md).

## Authentication and base URLs

All business REST routes use this base URL:

```text
http://localhost:3000/api/v1
```

The MCP server is intentionally outside the REST prefix:

```text
http://localhost:3000/mcp
```

Both interfaces require exactly one header:

```http
Authorization: Bearer <API_AUTH_TOKEN>
```

Missing, malformed, duplicate, or incorrect authorization returns `401`.
Health routes are public. MCP additionally requires `MCP_ENABLED=true` and
returns `404` while disabled.

## Public health routes

| Method | Route     | Result                                                                    |
| ------ | --------- | ------------------------------------------------------------------------- |
| `GET`  | `/health` | Process liveness: `{"status":"ok"}`.                                      |
| `GET`  | `/ready`  | Database status. Returns `200` when PostgreSQL is up and `503` when down. |

Health checks never invoke the LLM or mutate household data.

## REST routes

### Products

| Method | Route                          | Purpose                                         |
| ------ | ------------------------------ | ----------------------------------------------- |
| `POST` | `/api/v1/products`             | Create a canonical product.                     |
| `GET`  | `/api/v1/products`             | List all products.                              |
| `GET`  | `/api/v1/products/search`      | Deterministically search the product namespace. |
| `GET`  | `/api/v1/products/:id`         | Get one product by UUID.                        |
| `POST` | `/api/v1/products/:id/aliases` | Add `{ "alias": "..." }`.                       |

Product creation requires `canonicalName`. Optional values are `aliases`,
`category`, and `typicalUnit`.

Canonical names and aliases share one globally unique namespace. Before storage,
all names use Unicode NFKC normalization, surrounding whitespace removal, and
internal whitespace collapse. Exact lookup applies locale-independent lowercase
to that display value. Approved case is preserved in responses, so `3% Milk`
can be displayed while `3% milk` resolves to the same product. Semantically
different phrases, such as `3% milk` and `three percent milk`, match only when
both are explicitly stored for that product.

Every product response derives `canonicalName` and deterministically ordered
`aliases` from the authoritative namespace:

```json
{
  "id": "product-uuid",
  "canonicalName": "3% Milk",
  "aliases": ["Three Percent Milk"],
  "category": "dairy",
  "typicalUnit": "carton"
}
```

Adding an alias that already belongs to the target product, including its
canonical name, is an idempotent success. A normalized name owned by another
product returns HTTP `409` without mutation:

```json
{
  "code": "PRODUCT_NAME_CONFLICT",
  "message": "A product name is already assigned to another product"
}
```

The conflict never includes database constraints, SQL, provider errors, or the
other product's identity.

`GET /api/v1/products/search` requires `query` and accepts `limit` from 1 through
20, defaulting to 10. An exact canonical or alias identity returns one
`exactMatch` and no candidates. Otherwise `exactMatch` is null and `candidates`
contains unique products in deterministic canonical-prefix, alias-prefix,
canonical-substring, then alias-substring order, followed by stable length, name,
and ID tie-breakers. `%`, `_`, and backslash are literal text, not wildcards.

Search returns compact identity and product metadata, including
`predictionEnabled`, and includes prediction-disabled products. It is provider-free
and read-only: it never invokes an LLM, returns a proposal, creates a product or
alias, or changes grocery or inventory state. When several candidates remain,
present them in returned order and ask the user to choose rather than silently
selecting one.

The policy-aware grocery flow also has an optional advisory resolution service.
Its validated proposal is advice only. It is not part of this product-search
endpoint, does not authorize a mutation, and never applies a write by itself.

### Household

| Method  | Route                   | Purpose                                         |
| ------- | ----------------------- | ----------------------------------------------- |
| `GET`   | `/api/v1/household`     | Get the profile, creating defaults when absent. |
| `POST`  | `/api/v1/household`     | Create the single household profile.            |
| `PATCH` | `/api/v1/household/:id` | Update household settings.                      |

The default is two adults, three children, and a `0.7` recommendation
threshold. Counts must be non-negative integers and
`suggestionConfidenceThreshold` must be between `0` and `1`.

### Grocery list

| Method   | Route                                         | Purpose                                                                    |
| -------- | --------------------------------------------- | -------------------------------------------------------------------------- |
| `POST`   | `/api/v1/grocery/items`                       | Add with an unknown-product policy or return a successful decision branch. |
| `POST`   | `/api/v1/grocery/items/confirm-new-product`   | Apply approved product facts and complete the original grocery addition.   |
| `POST`   | `/api/v1/grocery/items/confirm-product-alias` | Apply an approved alias to an exact product and complete the addition.     |
| `GET`    | `/api/v1/grocery/items`                       | List pending items or filter by `status`.                                  |
| `PATCH`  | `/api/v1/grocery/items/:id/quantity`          | Set one pending item's absolute final quantity.                            |
| `PATCH`  | `/api/v1/grocery/items/:id`                   | Update selected fields on one pending item.                                |
| `DELETE` | `/api/v1/grocery/items/:id`                   | Remove one pending item.                                                   |

An add request separates product identity from grocery-line facts. REST defaults
an omitted `unknownProductPolicy` to `create_if_missing`, so the default request
requires a complete `product` object:

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
    "unit": "cartons"
  }
}
```

Direct clients may explicitly use `create_if_missing` with the same complete
product facts. This deterministic path does not call an LLM. It reuses an exact
canonical or alias identity without overwriting its metadata, or atomically
creates the product and first grocery line.

Assisted clients may explicitly use `propose_if_missing` with `productName` and
must not also send `product`:

```json
{
  "unknownProductPolicy": "propose_if_missing",
  "productName": "three percent milk",
  "groceryItem": {
    "requestedQuantity": 2,
    "unit": "cartons"
  }
}
```

An exact match continues to the normal grocery result. An unresolved phrase
returns `product_resolution_required` as a successful 2xx result containing the
request echo, deterministic candidates, optional non-authoritative proposal
advice, and server-computed `allowedActions`. No product, alias, or grocery item
is changed. A client must present the choices and wait for a new user decision.

After the user approves complete final product facts, call
`POST /api/v1/grocery/items/confirm-new-product` with no proposal state:

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

After the user approves that the original phrase is an alias for one exact
candidate, call `POST /api/v1/grocery/items/confirm-product-alias`:

```json
{
  "targetProductId": "product-uuid",
  "alias": "Three Percent Milk",
  "groceryItem": {
    "requestedQuantity": 2,
    "unit": "cartons"
  }
}
```

These confirmation routes are deterministic and never invoke the LLM. They
accept the final approved payload, not a proposal ID or client-controlled
`source`. They always use duplicate-aware pending detection and do not accept
`ifPendingExists`: an existing line returns `confirmation_required` without a
quantity change. New-product creation and the first grocery line are atomic.
The alias route saves a same-owner-idempotent alias even when grocery quantity
still needs confirmation. `PRODUCT_NAME_CONFLICT` and `PRODUCT_NOT_FOUND` are
final for that decision; do not auto-retry stale decisions. A transport result
whose outcome is unknown must also not be retried.

`groceryItem` is required in both branches, even when empty. Its optional fields
are a positive `requestedQuantity`, `unit`, `note`, and `ifPendingExists`. When a
new line is created without a quantity, its persisted quantity defaults to `1`.
Every persisted grocery item has a finite positive quantity. The legacy flat add
body is rejected, and `source` is server-owned.

`ifPendingExists` defaults to `return_existing`. A canonical-product pending
match returns `confirmation_required`, the matching lines, and the requested
addition without mutation. If quantity was omitted, the request echo remains
`requestedAddition.requestedQuantity: null`; omission never means increment the
existing line by `1`. `create_separate` creates an intentional additional line
only when explicitly selected. Default concurrent adds are serialized by product.

Use the narrow quantity route for quantity-only changes:

```http
PATCH /api/v1/grocery/items/<ITEM_ID>/quantity
Content-Type: application/json

{
  "requestedQuantity": 5,
  "expectedRequestedQuantity": 3
}
```

Both values are required finite positive numbers. `requestedQuantity` is the
absolute final value, not an increment. Copy `expectedRequestedQuantity` exactly
from the latest item read. Relative requests must be calculated by the client
before calling; make no call when the chosen final value is unchanged. An unknown
ID returns `404` with `GROCERY_ITEM_NOT_FOUND`. A non-pending item or stale
expectation returns `409` with `GROCERY_ITEM_NOT_PENDING` or
`GROCERY_ITEM_CHANGED` and the latest `currentItem`. A stale result requires a
fresh user decision and must not be recalculated or retried automatically.

The general `PATCH /api/v1/grocery/items/:id` remains available for `unit`,
`note`, and intentional multi-field changes. It may include a final positive
`requestedQuantity`, but the narrow route is preferred when quantity is the only
field changing. Use `null` to clear `unit` or `note`; omit a field to preserve it.
Every selected field requires its matching old value:
`expectedRequestedQuantity`, `expectedUnit`, or `expectedNote`. Expected values
for unselected fields and requests with no selected fields are rejected without
mutation.

- Status: `pending`, `purchased`, or `removed`
- Source is server-owned: `api` for REST requests and `mcp` for MCP tool calls.

Update and removal routes operate only on existing grocery-item IDs. Unknown
product creation is available only through the explicit add and confirmed
new-product contracts described above.

`DELETE /api/v1/grocery/items/:id` changes only a pending item to `removed`.
An unknown ID returns `404` with `Grocery list item <id> not found`; a purchased,
removed, or concurrently completed item returns `409` with
`Grocery list item <id> is not pending`. These status codes and messages are the
stable machine-readable removal contract.

### Inventory and predictions

| Method | Route                                                  | Purpose                                             |
| ------ | ------------------------------------------------------ | --------------------------------------------------- |
| `POST` | `/api/v1/inventory/events`                             | Record an inventory event.                          |
| `GET`  | `/api/v1/inventory/events`                             | List events with filters and pagination.            |
| `POST` | `/api/v1/inventory/purchases`                          | Record `PURCHASED` or `RESTOCKED`.                  |
| `POST` | `/api/v1/inventory/purchases/complete`                 | Complete grocery IDs for one product.               |
| `POST` | `/api/v1/inventory/purchases/complete-partial`         | Complete selected items or all except selected IDs. |
| `GET`  | `/api/v1/inventory/estimate/:productId`                | Estimate one product's stock state.                 |
| `GET`  | `/api/v1/inventory/predictions/low-stock`              | Return actionable recommendations.                  |
| `POST` | `/api/v1/inventory/predictions/:predictionId/feedback` | Accept, reject, or correct a prediction.            |
| `POST` | `/api/v1/inventory/statistics/:productId/calculate`    | Recalculate learned statistics.                     |

Event listing accepts optional `productId`, `eventType`, `limit` from 1 to 100,
and non-negative `offset`.

Inventory event types:

```text
GROCERY_ADDED, GROCERY_REMOVED, PURCHASED, RESTOCKED, STOCK_LOW, STOCK_OUT,
STOCK_CONFIRMED, STOCK_CORRECTED, PREDICTION_ACCEPTED, PREDICTION_REJECTED,
INFERRED_LOW_STOCK
```

Every event requires `productId` and `eventType`. `quantity`, `unit`,
`confidence`, and `metadata` are optional. A focused purchase requires a finite
positive quantity and defaults an omitted quantity to `1`. A purchase or
restock replaces the materialized stock estimate rather than adding to it.
Prefer the focused purchase and stock routes over directly creating internal
prediction events.

Prediction feedback shapes:

```json
{ "outcome": "accepted" }
```

```json
{ "outcome": "rejected" }
```

```json
{
  "outcome": "corrected",
  "correctedState": "likely_available"
}
```

A correction must use `likely_available`, `probably_low`, or `probably_out`,
not `uncertain`.

## First-use example

Set reusable shell values:

```bash
export HOME_STOCK_URL="http://localhost:3000"
export HOME_STOCK_TOKEN="replace-with-your-token"
```

Read or create the default household:

```bash
curl -sS \
  -H "Authorization: Bearer ${HOME_STOCK_TOKEN}" \
  "${HOME_STOCK_URL}/api/v1/household"
```

Create milk and copy its returned `id`:

```bash
curl -sS -X POST \
  -H "Authorization: Bearer ${HOME_STOCK_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"canonicalName":"milk","aliases":["whole milk"],"category":"dairy","typicalUnit":"liter"}' \
  "${HOME_STOCK_URL}/api/v1/products"
```

Add it to the grocery list:

```bash
curl -sS -X POST \
  -H "Authorization: Bearer ${HOME_STOCK_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"product":{"canonicalName":"Milk","aliases":[],"category":"dairy","typicalUnit":"liter","productType":"fast_consumable","isPerishable":true},"groceryItem":{"requestedQuantity":2,"unit":"liters"}}' \
  "${HOME_STOCK_URL}/api/v1/grocery/items"
```

Record low stock and request an estimate, replacing `<PRODUCT_ID>`:

```bash
curl -sS -X POST \
  -H "Authorization: Bearer ${HOME_STOCK_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"productId":"<PRODUCT_ID>","eventType":"STOCK_LOW"}' \
  "${HOME_STOCK_URL}/api/v1/inventory/events"

curl -sS \
  -H "Authorization: Bearer ${HOME_STOCK_TOKEN}" \
  "${HOME_STOCK_URL}/api/v1/inventory/estimate/<PRODUCT_ID>"
```

## MCP server

Home Stock Tracker exposes a stateless Streamable HTTP MCP server at `/mcp`.
Use an MCP SDK or native client, not ordinary REST calls.

### Tools

| Tool                            | Kind  | Purpose                                                                                        |
| ------------------------------- | ----- | ---------------------------------------------------------------------------------------------- |
| `grocery_add`                   | Write | Add through proposal or deterministic creation policy, or return a successful decision branch. |
| `grocery_confirm_new_product`   | Write | Apply approved final product facts and complete the original grocery addition without LLM use. |
| `grocery_confirm_product_alias` | Write | Apply an approved alias to an exact product ID and complete the original grocery addition.     |
| `grocery_set_quantity`          | Write | Set one pending line's absolute final quantity using its latest expected quantity.             |
| `grocery_update`                | Write | Set unit, note, or intentional field combinations using matching expected old values.          |
| `grocery_remove`                | Write | Change one pending item to removed by grocery-item UUID.                                       |
| `grocery_list`                  | Read  | List pending items by default or filter by status.                                             |
| `get_household_context`         | Read  | Return the configured household's agent-safe prediction context without creating defaults.     |
| `get_product`                   | Read  | Resolve an exact product name/alias or known UUID.                                             |
| `search_products`               | Read  | Deterministically discover exact or nearby products without mutation or LLM use.               |
| `product_add_alias`             | Write | Add an explicitly confirmed alias to one exact product outside a grocery workflow.             |
| `get_inventory`                 | Read  | Estimate one product's stock state.                                                            |
| `list_inventory_events`         | Read  | List recorded inventory events with filters and bounded pagination.                            |
| `record_purchase`               | Write | Record `PURCHASED` or `RESTOCKED`.                                                             |
| `record_stock_signal`           | Write | Record low, out, confirmed, or corrected stock.                                                |
| `record_prediction_feedback`    | Write | Accept, reject, or correct one exact prediction returned by a trusted prediction read.         |
| `complete_grocery_purchase`     | Write | Complete pending rows atomically and optionally record explicit actual purchase measurements.  |
| `get_low_stock_predictions`     | Read  | Return actionable high-confidence recommendations.                                             |

Tool responses contain structured content plus JSON text. Domain failures become
safe MCP tool errors and unexpected errors are sanitized. `get_product` applies
the same exact normalized canonical-name and alias lookup as REST and returns the
same approved display spelling. `PRODUCT_NAME_CONFLICT` is the stable namespace
conflict for MCP and internal callers; it is final and should not be retried as a
name lookup or write without changing the requested ownership.

`get_household_context` accepts only `{}` and returns `id`, `adultsCount`,
`childrenCount`, `childAgeGroups`, `predictionPreferences`,
`suggestionConfidenceThreshold`, and `productPolicies`. Creation/update
timestamps and unrelated operator data are excluded by an explicit projection.
The read never creates a default household. When setup is absent it returns the
safe tool error `Household is not configured`. Use it for explicit household
identity, setup, configuration, or prediction-explanation questions, not as a
prerequisite for routine `get_inventory` or `get_low_stock_predictions` calls.

`product_add_alias` accepts only `{ productId, alias }`. Resolve one exact target
first and obtain explicit user confirmation that the alias identifies that
product. The tool delegates to the same namespace write as
`POST /api/v1/products/:id/aliases`, returns the updated canonical product, and
does not invoke the LLM or change the grocery list. Ambiguous targets make no
call. Treat `PRODUCT_NAME_CONFLICT`, a missing target, and uncertain transport
results as final for the current decision rather than retrying automatically.

`list_inventory_events` accepts optional UUID `productId` and
`InventoryEventType` `eventType` filters. `limit` defaults to `20` and accepts
integers from `1` through `100`; `offset` defaults to `0` and accepts
non-negative integers. Results are ordered by newest timestamp first, with event
ID as the stable descending tie-breaker, and return `{ items, total, limit,
offset }`. Agent-visible event items include `id`, `productId`, `eventType`,
`quantity`, `unit`, `timestamp`, `source`, and `confidence`. Stored event
`metadata` is intentionally omitted from this MCP response.

For a spoken product name, resolve its UUID with `get_product` or read-only
`search_products` before listing history. A history result describes recorded
evidence at its timestamps. It does not estimate current stock; use
`get_inventory` separately for that question and label its result as an
estimate. An empty history page means no matching recorded events, not that the
product is currently unavailable.

`grocery_remove` returns `Grocery list item <id> not found` for an unknown ID and
`Grocery list item <id> is not pending` when the item was purchased, removed, or
won by another concurrent terminal transition. Both are final domain results. Do
not retry them, and do not retry any write whose transport outcome is uncertain.

`complete_grocery_purchase` prefers a non-empty `items` array whose strict item
objects contain `groceryItemId` plus optional `actualQuantity` and `actualUnit`.
Quantity must be finite and positive. A unit must be trimmed, non-empty, and
accompanied by quantity. Use actual fields only for measurements the user
explicitly reported; never copy a grocery row's requested quantity or unit, or
a product's typical unit. For example:

```json
{
  "items": [
    {
      "groceryItemId": "0f5b898d-a917-4e34-95cc-4d275075fbf1",
      "actualQuantity": 2,
      "actualUnit": "cartons"
    },
    { "groceryItemId": "ef98843f-1c26-4f46-86ab-b111a6405e45" }
  ]
}
```

Selected rows for the same product produce one purchase event. Their explicit
actual quantities are summed only when every selected row for that product has
a quantity and all trimmed units match exactly, including every row omitting a
unit. Partial measurements or conflicting units reject the entire operation;
clients must ask for clarification and must not convert units. Rows without
actual measurements create purchase events using the selected rows' stored
positive requested quantities and their shared grocery unit. If no grocery unit
is stored, the ledger resolves the product's typical unit and then `item`.

The legacy `{ "groceryItemIds": ["..."] }` shape remains supported for
transitional clients. It records the selected rows' requested quantities and
shared grocery unit because no actual measurement was supplied. Supply exactly
one of `items` or `groceryItemIds`. Completion preserves the all-or-nothing
transaction and uncertain-write guidance described below.

`record_prediction_feedback` accepts one strict object with `predictionId` and
`outcome`. The outcome is `accepted`, `rejected`, or `corrected`.
`correctedState` is required only for `corrected` and accepts
`likely_available`, `probably_low`, or `probably_out`. Use only a non-null ID
from the active interaction or a fresh `get_inventory` or
`get_low_stock_predictions` result. Corrected feedback records one linked
`STOCK_CORRECTED` event in the same transaction, so do not send a second stock
signal. Any repeated or concurrent submission returns
`Prediction feedback was already recorded`; do not retry after an uncertain
transport result.

`grocery_add` defaults to `propose_if_missing`. Begin an uncertain spoken name
with `{ productName, groceryItem }`; if resolution is required, present the
deterministic candidates, optional non-authoritative proposal, and
`allowedActions`, then wait for the user's decision without mutating. Do not
guess a product identity or quantity. Use explicit `create_if_missing` only when
the client deliberately has every required product fact and sends
`{ unknownProductPolicy, product, groceryItem }`; that path is deterministic and
does not invoke an LLM.

When the user approves a create decision, call
`grocery_confirm_new_product` with the final `product` and original
`groceryItem`; never pass proposal state. When the user explicitly confirms an
alias relationship, call `grocery_confirm_product_alias` with the exact returned
candidate ID, approved alias, and original `groceryItem`. Both tools are
deterministic and force MCP-owned provenance. A cancellation makes no mutation.
If either tool returns `confirmation_required`, the catalog decision succeeded
but the existing grocery quantity did not change. Resolve that quantity as a
separate user decision. Treat `PRODUCT_NAME_CONFLICT` and `PRODUCT_NOT_FOUND` as
stale final decisions and do not auto-retry.

When `grocery_add` returns `confirmation_required`, do not mutate again until
the user selects the desired final state. Explain the current line and clarify
how many items should be on it. An omitted request quantity remains `null` in the
request echo and is ambiguous, not an increment. Calculate relative requests in
the client, then use `grocery_set_quantity` with the existing line's `id` as
`itemId`, the selected final `requestedQuantity`, and the returned current
quantity as `expectedRequestedQuantity`. Make no call for no change. Use
`grocery_update` only when quantity changes together with unit or note. Use
`create_separate` only for an explicitly separate line. Treat
`GROCERY_ITEM_CHANGED`, `GROCERY_ITEM_NOT_PENDING`, and
`GROCERY_ITEM_NOT_FOUND` as final for that decision and ask again using the
latest state without retrying or recalculating automatically.

### Safe tool workflow

1. Resolve exact names with `get_product`; use `search_products` for nearby or ambiguous catalog discovery.
2. Present multiple search candidates in returned order and require the user's choice before using one ID.
3. Treat proposals as advisory; apply only a final user-approved create or alias payload.
4. Call `grocery_list` before removing or completing grocery-item UUIDs; prefer
   completion `items` and add actual fields only from explicit user facts.
5. Resolve named products before history reads and distinguish recorded events from estimated current stock.
6. Use prediction feedback only with one non-null prediction ID from active context or a fresh prediction read.
7. Never guess IDs, quantities, units, event types, metadata, or stock state.
8. Write only when the mutation and target are unambiguous.
9. Never retry a stale decision or a write after a transport failure with an uncertain outcome.
10. Treat `uncertain`, empty history, and empty recommendation lists as successful results.
11. Never turn a recommendation into a list mutation without a separate request.
12. Read household context only for an explicit setup, configuration, identity,
    or explanation question; never create defaults or call it before every prediction.

For "I bought everything except toilet paper," list pending items, require one
exact match per named item, and call `complete_grocery_purchase` once with
`items: [{ groceryItemId: <returned id> }, ...]` for only the rows actually
purchased.
