# Home Stock Tracker OpenClaw release contract

This generated release metadata belongs to the `openclaw` bundle. Keep
`manifest.json`, `SKILL.md`, `scenarios.md`, and the `contracts/1.2.0/tools-list.json`
fixture from the same generated release.

## Compatibility

- Skill version: `1.12.0`
- MCP server: `home-stock-tracker`
- MCP contract: `1.2.0`
- Compatible MCP range: `>=1.0.0 <2.0.0`

## Prerequisites

- Supply the service base address at verification time through
  `HOME_STOCK_TRACKER_BASE_URL`.
- Supply authentication at verification time through
  `HOME_STOCK_TRACKER_API_AUTH_TOKEN` using the `bearer` scheme.
- Permit network access to `/health`, `/ready`, and
  `/mcp` over `streamable-http`.
- Keep environment values outside this bundle and out of command arguments,
  generated files, screenshots, and shared logs.

## Required MCP tools

- `grocery_add`
- `grocery_confirm_new_product`
- `grocery_confirm_product_alias`
- `grocery_set_quantity`
- `grocery_update`
- `grocery_remove`
- `grocery_list`
- `get_household_context`
- `get_product`
- `search_products`
- `get_inventory`
- `list_inventory_events`
- `product_add_alias`
- `record_purchase`
- `record_stock_signal`
- `record_prediction_feedback`
- `complete_grocery_purchase`
- `get_low_stock_predictions`

## Verification

From the project checkout, run:

```bash
npm run agent:probe -- --platform openclaw
```

This verifies health, readiness, authentication, MCP identity and compatibility,
the exact normalized tool schemas, the required tool set, and one read-only
`get_household_context` call that identifies the configured household. It never
invokes a mutation. Run `npm run contract:check`
before publishing from a project checkout to reject stale generated artifacts.

## Rollback

Strategy: `replace-complete-bundle`.

Restore the previous verified bundle as a complete directory; do not mix generated files from different versions.
