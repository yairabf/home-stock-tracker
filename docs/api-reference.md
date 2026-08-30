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

| Method | Route | Result |
| --- | --- | --- |
| `GET` | `/health` | Process liveness: `{"status":"ok"}`. |
| `GET` | `/ready` | Database status. Returns `200` when PostgreSQL is up and `503` when down. |

Health checks never invoke the LLM or mutate household data.

## REST routes

### Products

| Method | Route | Purpose |
| --- | --- | --- |
| `POST` | `/api/v1/products` | Create a canonical product. |
| `GET` | `/api/v1/products` | List all products. |
| `GET` | `/api/v1/products/:id` | Get one product by UUID. |
| `POST` | `/api/v1/products/:id/aliases` | Add `{ "alias": "..." }`. |

Product creation requires `canonicalName`. Optional values are `aliases`,
`category`, and `typicalUnit`.

### Household

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/api/v1/household` | Get the profile, creating defaults when absent. |
| `POST` | `/api/v1/household` | Create the single household profile. |
| `PATCH` | `/api/v1/household/:id` | Update household settings. |

The default is two adults, three children, and a `0.7` recommendation
threshold. Counts must be non-negative integers and
`suggestionConfidenceThreshold` must be between `0` and `1`.

### Grocery list

| Method | Route | Purpose |
| --- | --- | --- |
| `POST` | `/api/v1/grocery/items` | Add a known product. |
| `GET` | `/api/v1/grocery/items` | List pending items or filter by `status`. |
| `DELETE` | `/api/v1/grocery/items/:id` | Remove one pending item. |

An add request requires `productName`. Optional values are a positive
`requestedQuantity`, `unit`, `note`, and `source`.

- Status: `pending`, `purchased`, or `removed`
- Source: `api` or `hermes_whatsapp`

Product names must match a canonical name or alias. The route does not create
unknown products.

`DELETE /api/v1/grocery/items/:id` changes only a pending item to `removed`.
An unknown ID returns `404` with `Grocery list item <id> not found`; a purchased,
removed, or concurrently completed item returns `409` with
`Grocery list item <id> is not pending`. These status codes and messages are the
stable machine-readable removal contract.

### Inventory and predictions

| Method | Route | Purpose |
| --- | --- | --- |
| `POST` | `/api/v1/inventory/events` | Record an inventory event. |
| `GET` | `/api/v1/inventory/events` | List events with filters and pagination. |
| `POST` | `/api/v1/inventory/purchases` | Record `PURCHASED` or `RESTOCKED`. |
| `POST` | `/api/v1/inventory/purchases/complete` | Complete grocery IDs for one product. |
| `POST` | `/api/v1/inventory/purchases/complete-partial` | Complete selected items or all except selected IDs. |
| `GET` | `/api/v1/inventory/estimate/:productId` | Estimate one product's stock state. |
| `GET` | `/api/v1/inventory/predictions/low-stock` | Return actionable recommendations. |
| `POST` | `/api/v1/inventory/predictions/:predictionId/feedback` | Accept, reject, or correct a prediction. |
| `POST` | `/api/v1/inventory/statistics/:productId/calculate` | Recalculate learned statistics. |

Event listing accepts optional `productId`, `eventType`, `limit` from 1 to 100,
and non-negative `offset`.

Inventory event types:

```text
GROCERY_ADDED, GROCERY_REMOVED, PURCHASED, RESTOCKED, STOCK_LOW, STOCK_OUT,
STOCK_CONFIRMED, STOCK_CORRECTED, PREDICTION_ACCEPTED, PREDICTION_REJECTED,
INFERRED_LOW_STOCK
```

Every event requires `productId`, `eventType`, and `source`. `quantity`, `unit`,
`confidence`, and `metadata` are optional. Prefer the focused purchase and stock
routes over directly creating internal prediction events.

Prediction feedback shapes:

```json
{ "outcome": "accepted", "source": "api" }
```

```json
{ "outcome": "rejected", "source": "api" }
```

```json
{
  "outcome": "corrected",
  "correctedState": "likely_available",
  "source": "api"
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
  -d '{"productName":"milk","requestedQuantity":2,"unit":"liters","source":"api"}' \
  "${HOME_STOCK_URL}/api/v1/grocery/items"
```

Record low stock and request an estimate, replacing `<PRODUCT_ID>`:

```bash
curl -sS -X POST \
  -H "Authorization: Bearer ${HOME_STOCK_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"productId":"<PRODUCT_ID>","eventType":"STOCK_LOW","source":"api"}' \
  "${HOME_STOCK_URL}/api/v1/inventory/events"

curl -sS \
  -H "Authorization: Bearer ${HOME_STOCK_TOKEN}" \
  "${HOME_STOCK_URL}/api/v1/inventory/estimate/<PRODUCT_ID>"
```

## MCP server

Home Stock Tracker exposes a stateless Streamable HTTP MCP server at `/mcp`.
Use an MCP SDK or native client, not ordinary REST calls.

### Tools

| Tool | Kind | Purpose |
| --- | --- | --- |
| `grocery_add` | Write | Add one known product by name with optional quantity, unit, and note. |
| `grocery_remove` | Write | Change one pending item to removed by grocery-item UUID. |
| `grocery_list` | Read | List pending items by default or filter by status. |
| `get_product` | Read | Resolve an exact product name/alias or known UUID. |
| `get_inventory` | Read | Estimate one product's stock state. |
| `record_purchase` | Write | Record `PURCHASED` or `RESTOCKED`. |
| `record_stock_signal` | Write | Record low, out, confirmed, or corrected stock. |
| `complete_grocery_purchase` | Write | Complete a non-empty unique list of pending item UUIDs atomically. |
| `get_low_stock_predictions` | Read | Return actionable high-confidence recommendations. |

Tool responses contain structured content plus JSON text. Domain failures become
safe MCP tool errors and unexpected errors are sanitized.

`grocery_remove` returns `Grocery list item <id> not found` for an unknown ID and
`Grocery list item <id> is not pending` when the item was purchased, removed, or
won by another concurrent terminal transition. Both are final domain results. Do
not retry them, and do not retry any write whose transport outcome is uncertain.

### Safe tool workflow

1. Resolve names with `get_product` before using a product UUID.
2. Call `grocery_list` before removing or completing grocery-item UUIDs.
3. Never guess IDs, quantities, units, event types, or stock state.
4. Write only when the mutation and target are unambiguous.
5. Never retry a write after a transport failure with an uncertain outcome.
6. Treat `uncertain` and empty recommendation lists as successful results.
7. Never turn a recommendation into a list mutation without a separate request.

For "I bought everything except toilet paper," list pending items, require one
exact match per named item, and call `complete_grocery_purchase` once with only
the IDs actually purchased.
