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

| Method | Route                          | Purpose                     |
| ------ | ------------------------------ | --------------------------- |
| `POST` | `/api/v1/products`             | Create a canonical product.                    |
| `GET`  | `/api/v1/products`             | List all products.                             |
| `GET`  | `/api/v1/products/search`      | Deterministically search the product namespace. |
| `GET`  | `/api/v1/products/:id`         | Get one product by UUID.                       |
| `POST` | `/api/v1/products/:id/aliases` | Add `{ "alias": "..." }`.                      |

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

The application also has an internal optional advisory resolution service for a
future policy-aware grocery flow. Its validated proposal is advice only. It is
not part of this REST endpoint, does not authorize a mutation, and never applies
a write by itself.

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

| Method   | Route                                | Purpose                                                          |
| -------- | ------------------------------------ | ---------------------------------------------------------------- |
| `POST`   | `/api/v1/grocery/items`              | Add a product or return matching pending lines for confirmation. |
| `GET`    | `/api/v1/grocery/items`              | List pending items or filter by `status`.                        |
| `PATCH`  | `/api/v1/grocery/items/:id/quantity` | Set one pending item's absolute final quantity.                  |
| `PATCH`  | `/api/v1/grocery/items/:id`          | Update selected fields on one pending item.                      |
| `DELETE` | `/api/v1/grocery/items/:id`          | Remove one pending item.                                         |

An add request requires `productName`. Optional values are a positive
`requestedQuantity`, `unit`, `note`, and `ifPendingExists`. When a new line is
created without a quantity, its persisted quantity defaults to `1`. Every
persisted grocery item has a finite positive quantity.

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

Product names must match a canonical name or alias. The route does not create
unknown products.

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
`confidence`, and `metadata` are optional. Prefer the focused purchase and stock
routes over directly creating internal prediction events.

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
  -d '{"productName":"milk","requestedQuantity":2,"unit":"liters"}' \
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

| Tool                        | Kind  | Purpose                                                                                          |
| --------------------------- | ----- | ------------------------------------------------------------------------------------------------ |
| `grocery_add`               | Write | Add one product or return `confirmation_required` with matching pending lines.                   |
| `grocery_set_quantity`      | Write | Set one pending line's absolute final quantity using its latest expected quantity.               |
| `grocery_update`            | Write | Set unit, note, or intentional field combinations using matching expected old values.            |
| `grocery_remove`            | Write | Change one pending item to removed by grocery-item UUID.                                         |
| `grocery_list`              | Read  | List pending items by default or filter by status.                                               |
| `get_product`               | Read  | Resolve an exact product name/alias or known UUID.                                               |
| `search_products`           | Read  | Deterministically discover exact or nearby products without mutation or LLM use.                 |
| `get_inventory`             | Read  | Estimate one product's stock state.                                                              |
| `record_purchase`           | Write | Record `PURCHASED` or `RESTOCKED`.                                                               |
| `record_stock_signal`       | Write | Record low, out, confirmed, or corrected stock.                                                  |
| `complete_grocery_purchase` | Write | Complete a non-empty unique list of pending item UUIDs atomically.                               |
| `get_low_stock_predictions` | Read  | Return actionable high-confidence recommendations.                                               |

Tool responses contain structured content plus JSON text. Domain failures become
safe MCP tool errors and unexpected errors are sanitized. `get_product` applies
the same exact normalized canonical-name and alias lookup as REST and returns the
same approved display spelling. `PRODUCT_NAME_CONFLICT` is the stable namespace
conflict for MCP and internal callers; it is final and should not be retried as a
name lookup or write without changing the requested ownership.

`grocery_remove` returns `Grocery list item <id> not found` for an unknown ID and
`Grocery list item <id> is not pending` when the item was purchased, removed, or
won by another concurrent terminal transition. Both are final domain results. Do
not retry them, and do not retry any write whose transport outcome is uncertain.

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
3. Call `grocery_list` before removing or completing grocery-item UUIDs.
4. Never guess IDs, quantities, units, event types, or stock state.
5. Write only when the mutation and target are unambiguous.
6. Never retry a write after a transport failure with an uncertain outcome.
7. Treat `uncertain` and empty recommendation lists as successful results.
8. Never turn a recommendation into a list mutation without a separate request.

For "I bought everything except toilet paper," list pending items, require one
exact match per named item, and call `complete_grocery_purchase` once with only
the IDs actually purchased.
