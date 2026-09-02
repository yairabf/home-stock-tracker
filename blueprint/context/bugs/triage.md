# MCP and skill gaps - current triage

Reviewed against the repository on 2026-09-02. The 20 briefs in this directory
are useful source hypotheses, but they are not 20 independent bugs. They mix
completed fixes, missing MCP adapters, product choices, documentation drift, and
release hardening.

This file records the current decision for every brief. Revalidate a deferred
item before implementation because the tool surface and integration targets may
change again.

## Decision summary

| Decision                 | Count | Briefs                                                                                                                                      |
| ------------------------ | ----: | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Resolved                 |    16 | MCP-01, MCP-02, MCP-03, MCP-04, MCP-06, MCP-07, MCP-09, MCP-11, MCP-12, MCP-X01, SKILL-01, SKILL-03, SKILL-04, SKILL-05, SKILL-06, SKILL-07 |
| Wait                     |     2 | MCP-05 remainder, MCP-10                                                                                                                    |
| Reject as a separate bug |     2 | MCP-08, SKILL-02                                                                                                                            |

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

## Resolved by Waves 1 and 2

These four fixes landed before the combined Wave 3 release-contract feature.

### SKILL-03 - correct the OpenClaw integration claim

Resolved by the archived
[`separate-hermes-openclaw-skill-instructions`](../../history/fixes/separate-hermes-openclaw-skill-instructions.md)
fix. Shared workflow sources now generate distinct Hermes and OpenClaw bundles;
Hermes cron, WhatsApp, and `[SILENT]` behavior cannot drift into OpenClaw.

### MCP-07 - prediction feedback MCP adapter

Resolved by the archived
[`mcp-07-prediction-feedback-tool`](../../history/fixes/mcp-07-prediction-feedback-tool.md)
fix. MCP now delegates accepted, rejected, and corrected feedback to the shared
service with stable repeated-feedback behavior and matching skill guidance.

### MCP-06 - inventory-event history MCP adapter

Resolved by the archived
[`mcp-06-no-inventory-event-history-tool`](../../history/fixes/mcp-06-no-inventory-event-history-tool.md)
fix. The bounded, read-only MCP adapter omits metadata and the generated skills
separate recorded history from estimated current state.

### MCP-09 - actual purchase measurements during grocery completion

Resolved by the archived
[`mcp-09-purchase-completion-actual-quantity-details`](../../history/fixes/mcp-09-purchase-completion-actual-quantity-details.md)
fix. Purchase completion accepts explicit actual measurements while preserving
the ID-only transition, atomicity, and the rule against copying requested values.

## Wait

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

## Resolved by Wave 3

### Wave 3 contract and release evidence

MCP-11 and SKILL-04 through SKILL-07 were intentionally implemented together by
feature 32 because they described one authoritative, machine-verifiable
integration contract. The delivered evidence is:

- **MCP-11:** `release-contract.json`, generated runtime server metadata, each
  bundle's `manifest.json`, and `agent:probe` reject incompatible server names,
  versions, required tools, and schemas before writes are enabled.
- **SKILL-04:** `scripts/agent-installation-probe.mjs` checks health, readiness,
  authentication, standard MCP initialization, exact `tools/list` schemas, tool
  visibility, and one read-only `grocery_list` call. Its tests cover both
  platforms, stable failures, redaction, and absence of mutation calls.
- **SKILL-05:** the shared release contract owns service, MCP, skill, feature,
  compatibility, and tool metadata. The immutable normalized fixture plus
  `skills:check`, scenario validation, documentation validation, and
  `contract:check` reject runtime, generated-bundle, instruction, version, and
  tool-contract drift.
- **SKILL-06:** the generator maps shared metadata into platform-supported skill
  frontmatter and complete Hermes/OpenClaw manifests. Generated release guides
  carry prerequisites, compatibility, the live probe command, and whole-bundle
  rollback without secrets or deployment identifiers.
- **SKILL-07:** `scenarios/grocery-catalog.json` is the executable source for the
  generated platform scenario matrices. Validation proves tool, argument, enum,
  ordering, confirmation, stale-state, domain-failure, uncertain-write, and
  platform-isolation invariants.

Operator installation, generic-client verification, diagnosis, version-bump,
and rollback procedures are published in `docs/agent-integrations.md`. The
publisher gate is `npm run contract:check`; live platform commands are generated
into each manifest and release guide.

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
