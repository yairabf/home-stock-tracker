# Home Stock Tracker Hermes release contract

This generated release metadata belongs to the `hermes` bundle. Keep
`manifest.json`, `SKILL.md`, `scenarios.md`, and the `contracts/1.0.0/tools-list.json`
fixture from the same generated release.

## Compatibility

- Skill version: `1.10.0`
- MCP server: `home-stock-tracker`
- MCP contract: `1.0.0`
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
- `get_product`
- `search_products`
- `get_inventory`
- `list_inventory_events`
- `record_purchase`
- `record_stock_signal`
- `record_prediction_feedback`
- `complete_grocery_purchase`
- `get_low_stock_predictions`

## Verification

From the project checkout, run:

```bash
npm run agent:probe -- --platform hermes
```

This verifies health, readiness, authentication, MCP identity and compatibility,
the exact normalized tool schemas, the required tool set, and one read-only
`grocery_list` call. It never invokes a mutation. Run `npm run contract:check`
before publishing from a project checkout to reject stale generated artifacts.

## Rollback

Strategy: `replace-complete-bundle`.

Restore the previous verified bundle as a complete directory; do not mix generated files from different versions.
