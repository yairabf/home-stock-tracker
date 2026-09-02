# Active bug context

This directory contains only bug work that may still influence a future build.
Completed implementations live under `blueprint/history/`; rejected proposals
are summarized in [triage.md](triage.md) without retaining obsolete fix briefs.

## Deferred candidates

- [MCP-05 — Standalone alias administration](mcp-05-no-controlled-alias-management-tool.md)
  — the grocery-specific confirmation path is delivered; generic catalog
  maintenance waits for a concrete workflow.
- [MCP-10 — Read-only household context](mcp-10-no-read-only-household-context-tool.md)
  — optional setup and explanation support, deferred until existing responses
  prove insufficient.

Neither item is scheduled implementation work. Revalidate the need and current
contracts before loading either through `/fix` or promoting it into the build
plan through `/feature`.

## Completed work

The compact resolution-to-archive map is maintained in
[triage.md](triage.md#archived-resolutions). The archived feature or fix is the
durable source for what was shipped and how it was verified.
