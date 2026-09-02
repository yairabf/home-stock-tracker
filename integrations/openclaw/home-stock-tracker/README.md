# OpenClaw installation

This directory is a portable OpenClaw skill bundle. Its generated `SKILL.md`
contains the platform-neutral Home Stock Tracker workflow without scheduling or
delivery conventions. The NestJS service remains independent from OpenClaw.

Do not edit `SKILL.md`, `scenarios.md`, `manifest.json`, `release/README.md`, or
the bundled contract fixture directly. Update the canonical sources under
`integrations/shared/home-stock-tracker/`, then run
`npm run skills:generate`. Use `npm run skills:check` to detect drift.

## Prerequisite

Register Home Stock Tracker as a trusted Streamable HTTP MCP server, then prove
the live connection and tool discovery:

```bash
openclaw mcp set home-stock-tracker \
  '{"url":"<HOME_STOCK_TRACKER_BASE_URL>/mcp","transport":"streamable-http","headers":{"Authorization":"Bearer <HOME_STOCK_TRACKER_API_AUTH_TOKEN>"}}'

openclaw mcp status --verbose
openclaw mcp doctor home-stock-tracker --probe
openclaw mcp show home-stock-tracker --json
```

Confirm every tool in `manifest.json.requiredTools` is discoverable before
enabling writes. The generated `release/README.md` lists the same required set
for human review. Keep the token outside this repository, screenshots, and
shared logs. Prefer the secret mechanism supported by the deployment over a
literal sensitive header.

The MCP server must be enabled for the runtime that will use the skill. Normal
`coding` and `messaging` tool profiles expose configured MCP tools. A `minimal`
profile or a policy that denies `bundle-mcp` hides them even when the standalone
probe succeeds. Apply the narrowest tool filter and agent allowlist that still
permits the required household operations.

## Install locally

Review the generated bundle, then install it into the selected agent workspace:

```bash
openclaw skills install \
  ./integrations/openclaw/home-stock-tracker \
  --as home-stock-tracker
```

Local installs target the active workspace by default. Use `--agent <id>` to
select one configured agent, or `--global` only when every local agent should
see the skill. Confirm eligibility and prerequisites:

```bash
openclaw skills info home-stock-tracker
openclaw skills check
```

The skills watcher normally notices the installation on the next agent turn.
Start a fresh session when the active runtime still holds an older skill or MCP
catalog. Reload the MCP registry or restart the owning process when its cached
tool catalog remains stale.

With the service base URL and bearer token set in the environment variables
named by `manifest.json`, verify the live bundle from the project checkout:

```bash
npm run agent:probe -- --platform openclaw
```

The repository probe is read-only and complements `openclaw mcp doctor`: it
checks the exact bundle contract, while the OpenClaw command checks runtime tool
visibility. Follow `release/README.md` for compatibility and complete-bundle
rollback, and do not enable writes until both checks succeed.

## Smoke check

In a trusted test household, start with "What is on the grocery list?" The agent
should call `grocery_list` and summarize the structured result. Test mutations
only after confirming the MCP endpoint and target household.

For product discovery, ask "Which milk products exist?" The agent should call
`search_products`, preserve returned order, and ask for a choice when several
candidates remain. Search is read-only and never creates or aliases a product.

For a history smoke check, ask "When did we last buy milk?" The agent should
resolve milk with `get_product`, then call `list_inventory_events` with the
returned product ID, `eventType: "PURCHASED"`, and `limit: 1`. It should describe
the result as recorded history, not estimated current stock, and must not expose
or invent event metadata.

For an unfamiliar product, the agent should call `grocery_add` in proposal mode
with `productName` and nested `groceryItem`. A `product_resolution_required`
result is non-authoritative and must not cause a write until the user approves
complete product facts or one exact alias relationship. The follow-up uses
`grocery_confirm_new_product` or `grocery_confirm_product_alias` without
inventing facts or retrying an uncertain write.

For duplicate confirmation, the agent should ask for the desired final total
after `confirmation_required`, calculate the total from the returned current
quantity and the user's answer, then call `grocery_set_quantity` once with the
item ID, final quantity, and expected old quantity. A decline or unchanged total
makes no second tool call.

For a purchase-completion smoke check, ask what the agent would do for "I bought
everything except toilet paper." It should read the pending list, resolve the
exception exactly, and propose one preferred
`complete_grocery_purchase({ items: [{ groceryItemId: ... }] })` call. Actual
quantity and unit fields belong only to explicit user facts and must never be
copied from requested values. Incomplete or conflicting measurements across
duplicate-product rows require a focused question before mutation.

For a prediction-feedback smoke check, first ask for one product estimate and
retain its non-null returned `predictionId`. Then say that the prediction was
right, wrong, or provide a concrete corrected state. The agent should call
`record_prediction_feedback` exactly once with that trusted ID. It must ask or
make a fresh prediction read when the reference is ambiguous or the ID is null,
must keep general stock corrections on `record_stock_signal`, and must not retry
an uncertain or repeated feedback write.

## Scheduling boundary

This bundle defines interactive inventory workflows only. Recurring automation,
delivery targets, quiet-result tokens, execution sessions, and lifecycle commands
belong to the OpenClaw deployment and are intentionally not supplied here. Add
automation only after reviewing the current OpenClaw automation and delivery
contracts for the target gateway.
