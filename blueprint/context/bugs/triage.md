# MCP and skill gaps - current triage

Reviewed against the repository on 2026-09-01. The 20 briefs in this directory
are useful source hypotheses, but they are not 20 independent bugs. They mix
completed fixes, missing MCP adapters, product choices, documentation drift, and
release hardening.

This file records the current decision for every brief. Revalidate a deferred
item before implementation because the tool surface and integration targets may
change again.

## Decision summary

| Decision | Count | Briefs |
| --- | ---: | --- |
| Resolved | 7 | MCP-01, MCP-02, MCP-03, MCP-04, MCP-12, MCP-X01, SKILL-01 |
| Fix next | 4 | MCP-06, MCP-07, MCP-09, SKILL-03 |
| Wait or combine | 7 | MCP-05 remainder, MCP-10, MCP-11, SKILL-04, SKILL-05, SKILL-06, SKILL-07 |
| Reject as a separate bug | 2 | MCP-08, SKILL-02 |

## Resolved

### MCP-01 - reliable `get_product` input schema

Resolved on 2026-08-30. `get_product` publishes one strict object schema with
visible `id` and `productName` selectors and enforces exactly one selector at
runtime. Real MCP discovery coverage is archived in
[`blueprint/history/fixes/reliable-get-product-schema.md`](../../history/fixes/reliable-get-product-schema.md).

### MCP-02 - duplicate-safe grocery additions

Resolved on 2026-08-31. The shared service now returns a structured
`confirmation_required` result for an existing pending line, supports explicit
separate-line creation, and protects the default path against concurrent
duplicates. The completed fix is archived in
[`blueprint/history/fixes/mcp-02-duplicate-safe-grocery-additions.md`](../../history/fixes/mcp-02-duplicate-safe-grocery-additions.md).

### MCP-03 - direct pending grocery-item updates

Resolved on 2026-08-31. REST and MCP expose pending-only, selected-field updates
for quantity, unit, and note with matching expected old values and stable stale
state handling. The completed fix is archived in
[`blueprint/history/fixes/mcp-03-direct-pending-grocery-item-updates.md`](../../history/fixes/mcp-03-direct-pending-grocery-item-updates.md).

### MCP-04 - product search and catalog discovery

Resolved by feature 29 on 2026-09-01. REST and MCP share deterministic exact,
token-prefix, and literal-substring search over the authoritative product-name
namespace. Search is bounded, stable, read-only, and provider-free. The feature
is archived in
[`blueprint/history/features/29-product-search-and-resolution-proposals.md`](../../history/features/29-product-search-and-resolution-proposals.md).

### MCP-12 - generic MCP source attribution

Resolved on 2026-08-30. MCP adapters assign generic `mcp` provenance, REST
controllers assign `api`, and public inputs cannot select their own source. The
completed fix is archived in
[`blueprint/history/fixes/mcp-source-attribution.md`](../../history/fixes/mcp-source-attribution.md).

### MCP-X01 - pending-only grocery removal

Resolved on 2026-08-30. Grocery removal uses an atomic pending-state predicate;
unknown, non-pending, and stale concurrent attempts return stable failures. The
completed fix is archived in
[`blueprint/history/fixes/guard-grocery-remove-pending-state.md`](../../history/fixes/guard-grocery-remove-pending-state.md).

### SKILL-01 - policy-aware unknown-product behavior

Resolved by feature 30 on 2026-09-01. `grocery_add` now has explicit
`create_if_missing` and `propose_if_missing` policies. Uncertain MCP names use a
successful, non-mutating `product_resolution_required` branch, and the skill no
longer invents missing product facts. The feature is archived in
[`blueprint/history/features/30-policy-aware-grocery-additions.md`](../../history/features/30-policy-aware-grocery-additions.md).

## Fix next

These are the remaining gaps that affect truthful documentation or implemented
MVP behavior. They should be handled one at a time through the normal Blueprint
workflow.

### SKILL-03 - correct the OpenClaw integration claim

Confirmed documentation defect. The repository contains only
`integrations/hermes/home-stock-tracker/`, and its skill includes Hermes cron,
WhatsApp, and `[SILENT]` behavior. `docs/agent-integrations.md` nevertheless says
the same body is agent-neutral and tells OpenClaw to install it directly.

The immediate fix is to make the documentation truthful. Either describe
OpenClaw as a manual adaptation target or add a real platform-specific adapter.
Do not claim that the Hermes bundle is portable unchanged. A broader portable
manifest belongs with the later contract and release effort.

### MCP-07 - prediction feedback MCP adapter

Confirmed missing MCP capability and an explicit MVP gap. REST already exposes
accepted, rejected, and corrected prediction feedback through the shared
`PredictionFeedbackService`, while predictions return stable IDs. Add a thin MCP
adapter over the existing service, define repeated-feedback conflict behavior,
and teach the skill to distinguish feedback about a specific prediction from a
general stock correction.

### MCP-06 - inventory-event history MCP adapter

Confirmed missing MCP capability. `InventoryService.listEvents()` already
provides bounded, paginated, newest-first history with product and event filters.
The remaining work is a read-only MCP adapter, a privacy review that omits or
allowlists metadata, real discovery coverage, and skill guidance that separates
recorded history from estimated current state.

### MCP-09 - actual purchase measurements during grocery completion

Confirmed data-quality defect. `complete_grocery_purchase` still accepts only
grocery-item IDs and creates `PURCHASED` events without actual quantity or unit.
Evolve the shared domain contract before the MCP schema. Preserve an explicit
transition for existing ID-only callers, keep completion and event creation
atomic, and never copy requested measurements into actual measurements unless
the user supplied them as actual values.

## Wait or combine

### MCP-05 - standalone alias administration

The grocery-specific acceptance path is delivered by feature 31 through
`grocery_confirm_product_alias`. It requires an exact product ID and explicit
user approval, is same-owner idempotent, and rejects cross-owner namespace
conflicts. A generic `product_add_alias` administration tool remains a product
choice, not an active correctness bug. Wait until there is a concrete need for
catalog maintenance outside a grocery-add decision.

### MCP-10 - read-only household context

Reasonable but low priority. It mainly supports setup verification and detailed
prediction explanations. Add it only when those workflows demonstrate that
existing prediction responses and operator checks are insufficient.

### MCP-11, SKILL-04, SKILL-05, SKILL-06, and SKILL-07 - one contract and release feature

Do not implement these as five separate fixes. Together they describe the lack
of one authoritative, machine-verifiable integration contract. After MCP-06,
MCP-07, and MCP-09 settle the intended tool surface, create one feature that
owns:

- one source for service, MCP contract, and compatible skill versions;
- a real `tools/list` schema snapshot or equivalent contract fixture;
- drift checks for tool tables, arguments, enums, documentation, and bundles;
- machine-readable workflow scenarios and safety invariants;
- a read-only installation and compatibility probe;
- platform-specific manifests, prerequisites, verification, and rollback;
- no secrets or deployment-specific household identifiers.

Standard MCP initialization metadata and `tools/list` may be sufficient. Add a
custom `get_capabilities` tool only if a real client or installer cannot verify
compatibility through standard metadata plus a repository-owned manifest.

## Reject as separate bugs

### MCP-08 - universal atomic multi-item additions

Reject the current `grocery_add_many` brief as a correctness bug. Policy-aware
single-item additions can legitimately return independent
`product_resolution_required` or `confirmation_required` decisions that need
user input. A universal all-or-nothing batch would either hide those decisions
or create a complex, long-lived transaction contract.

Keep the current honest per-item workflow and never auto-retry an uncertain
write. Reconsider batching later as a product feature only if real usage shows
that partial multi-item progress is unacceptable and the interaction contract
is designed explicitly.

### SKILL-02 - workflows for tools that do not exist

Close this as an umbrella observation, not an implementation unit. Update the
skill alongside each delivered MCP capability. MCP-06 and MCP-07 own their new
read and feedback workflows; MCP-08 is rejected in its current form; and the
remaining optional tools keep their own product decisions.

## Recommended execution order

The remaining fixes do not all have functional dependencies. Some can be
implemented concurrently when each has its own Git branch and worktree. Do not
run concurrent implementations in one working tree because Blueprint has one
shared `blueprint/context/current-feature.md` and the agents would overwrite
each other's workflow state.

### Parallel wave 1

Run these three fixes concurrently in separate worktrees:

- SKILL-03: correct the OpenClaw portability claim. Keep this lane limited to
  platform documentation or a clearly isolated adapter so it does not rewrite
  the shared Hermes workflows owned by the MCP lanes.
- MCP-07: add prediction feedback through the existing shared service.
- MCP-06: add inventory-event history through the existing shared service.

MCP-06 and MCP-07 are functionally independent. They will still overlap in
`src/mcp/mcp-server.factory.ts`, MCP registration tests, API documentation, and
Hermes guidance. That overlap is a merge and review concern, not a reason to
serialize all implementation. Give each lane a separate worktree, keep commits
focused, merge one lane at a time, rebase the next lane onto the updated `main`,
resolve the central registry and documentation conflicts deliberately, and rerun
the full verification gate after every merge.

### Sequential wave 2

Implement MCP-09 after parallel wave 1 lands. MCP-09 has no hard dependency on
MCP-06 or MCP-07, but it changes the broader purchase-completion domain contract
and overlaps `InventoryService`, the MCP registry, tests, public documentation,
and Hermes guidance. Keeping it in the next wave reduces simultaneous contract
changes and makes its backward-compatibility review clearer.

### Dependent wave 3

After MCP-06, MCP-07, and MCP-09 finalize the tool surface, implement MCP-11 and
SKILL-04 through SKILL-07 as one contract and release feature. This is the only
group with a real sequencing dependency on the earlier fixes.

Reconsider MCP-05 and MCP-10 only when a concrete user workflow justifies them.
Keep MCP-08 and SKILL-02 closed unless new evidence changes their framing.

## Documentation drift found during triage

- [`blueprint/context/bugs/README.md`](README.md) still shows every report as
  unchecked and should be reconciled with this decision ledger.
- [`blueprint/history/fixes/README.md`](../../history/fixes/README.md) still says
  the directory is empty despite five archived fixes.
- [`docs/agent-integrations.md`](../../../docs/agent-integrations.md) overstates
  the portability of the Hermes bundle for OpenClaw.

These documentation corrections do not change the classifications above.

## Verification basis

This triage was checked against the current MCP registrations, shared grocery,
inventory, product, and prediction-feedback services, archived fix and feature
specs, public documentation, and the checked-in Hermes bundle. On 2026-09-01,
the full configured unit suite passed: 46 suites and 613 tests. That confirms the
current behavior is internally consistent; it does not make the remaining
missing adapters or contract limitations complete.
