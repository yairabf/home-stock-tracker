# Hermes installation

This directory is a portable Hermes Agent skill bundle. `SKILL.md` contains only
tool-selection instructions. The NestJS service remains independent from Hermes.

## Prerequisite

Configure Hermes separately with a trusted MCP connection to the Home Stock
Tracker `/mcp` endpoint and confirm that these tools are discoverable:

`grocery_add`, `grocery_remove`, `grocery_list`, `get_product`, `get_inventory`,
`record_purchase`, `record_stock_signal`, and `get_low_stock_predictions`.

MCP endpoint configuration, authentication, and credentials do not belong in
this skill bundle. Do not store service tokens here.

## Install locally

Review `SKILL.md`, then copy this whole `home-stock-tracker` directory into the
active Hermes profile's skills directory:

```text
~/.hermes/skills/home-stock-tracker/
```

Restart or reload Hermes skills, then confirm `home-stock-tracker` appears in
the skills list. The checked-in bundle remains the source of truth; repeat the
review and copy when it changes.

Hermes also supports project skill discovery, external skill directories, and
GitHub/URL installation. Those deployment choices are intentionally left to the
Hermes operator rather than encoded in this repository.

## Smoke check

In a trusted test household, ask Hermes to use the skill for one read-only
request such as "What is on the grocery list?" Verify that it selects
`grocery_list` and summarizes the structured result. Test mutations only after
the MCP connection and target household are confirmed.
