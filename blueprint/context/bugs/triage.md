# MCP and skill gaps — triage

Reviewed against the repository on 2026-08-30. The briefs in this directory
are useful hypotheses, but they should not be treated as 19 independent bugs.
They mix confirmed correctness defects, product decisions, missing MVP
capabilities, and release-hardening work.

## Fix first: confirmed correctness defects

### MCP-01 — `get_product` publishes an unreliable input schema

Confirmed. `get_product` still uses a top-level Zod union. Runtime calls are
tested, but the tests do not establish that `tools/list` visibly publishes both
selector fields to a real MCP client.

This is small, high-impact, and should be fixed first.

### MCP-X01 — guard the `grocery_remove` pending-state transition

Confirmed and serious. `GroceryService.removeItem()` loads any existing row and
unconditionally changes it to `removed`. A purchased item can therefore be
rewritten as removed, and concurrent purchase/removal is unsafe.

This is a domain invariant and should be fixed immediately in the shared
service, not only in the MCP adapter.

### MCP-12 — source attribution is channel-specific and incorrect

Confirmed. `grocery_add` records `hermes_whatsapp`, while other MCP mutations
use `hermes_mcp`. Neither is truthful for every generic MCP client. The Prisma
enum currently permits only `hermes_whatsapp` or `api`, so the coherent fix will
probably include a small migration and consistent generic MCP provenance.

### SKILL-01 — the checked-in skill contradicts product creation behavior (resolved 2026-09-01)

Resolved by feature 30. `grocery_add` now has explicit `create_if_missing` and
`propose_if_missing` policies. REST defaults to deterministic creation from
complete product facts; MCP defaults uncertain names to a successful,
non-mutating `product_resolution_required` decision branch. The Hermes skill no
longer treats unknown names as a dead end or silently invents product facts.

## Relevant, but requiring a product decision

### MCP-02 — duplicate pending grocery items

Confirmed mechanically: every add creates a new row. Whether every duplicate is
a defect depends on the desired semantics because separate pending lines can be
intentional.

Recommended behavior:

- Default to returning the existing pending line without mutation.
- Require an explicit mode to create a separate line.
- Once `grocery_update` exists, allow an explicit request such as “add another”
  to increment the existing line when safe.

Concurrency safety likely requires database support rather than only a
service-level read-before-create.

### MCP-03 — update a pending grocery item

Confirmed missing and highly relevant. Neither REST nor MCP can update stored
quantity, unit, or note fields.

The proposed brief may be more elaborate than the MVP needs. Set, increment,
note editing, pending-only mutation, unit safety, and stale-state protection are
important, but a revision or timestamp token may be clearer than comparing
quantity and unit independently. Design this together with MCP-02.

### MCP-09 — purchase completion loses actual quantity details

Confirmed. `complete_grocery_purchase` accepts only grocery item IDs and cannot
record what was actually purchased.

This matters for learning quality, but is not a prerequisite for making the
current MCP safe. Implement it after duplicate/update behavior is settled and
preserve the existing ID-only contract through an explicit transition.

## Strong MVP capabilities, but not correctness bugs

### MCP-07 — prediction feedback

Strongly relevant. Prediction feedback is an explicit MVP feature and already
exists through REST. MCP only lacks an adapter for it. This is one of the
highest-value missing tools.

### MCP-06 — inventory event history

Relevant and comparatively cheap. The service already exposes bounded,
paginated, newest-first history. The remaining work is primarily an MCP adapter
and a privacy review of returned metadata.

### MCP-04 — product search (resolved 2026-09-01)

Resolved by feature 29. REST and MCP now share deterministic exact, token-prefix,
and literal substring search over the authoritative product-name namespace.
Search is capped, stable, read-only, provider-free, and includes
prediction-disabled identities as metadata. Hermes guidance requires explicit
user choice when multiple candidates remain.

### MCP-05 — controlled alias management

Relevant, but it reveals a deeper service issue: `addAlias()` checks for a
duplicate only on the target product and does not appear to reject an alias
already owned by another product. Fix that domain rule before exposing alias
management through MCP.

### MCP-08 — atomic multi-item additions

Useful, but it should wait until duplicate and update semantics are settled.
Otherwise a batch contract would freeze unresolved single-item behavior. It is
less urgent than its placement in the original execution order suggests.

### MCP-10 — read-only household context

Reasonable but low priority. It is mainly useful for setup verification and
prediction explanations. Prediction responses already include some household
context, so first decide whether a separate tool adds sufficient value.

## Combine into one integration-contract effort

The following are valid but should not be implemented as separate fixes:

- MCP-11 — contract/capability compatibility probe.
- SKILL-04 — installation and schema verification.
- SKILL-05 — release synchronization.
- SKILL-07 — executable scenarios.

They are four aspects of the same problem: the project has no authoritative,
machine-verifiable MCP contract. One coherent feature should establish:

- One source for the MCP contract version.
- A real `tools/list` snapshot or contract test.
- Machine-readable scenario fixtures.
- A read-only installation probe.
- Drift checks for skill documentation and expected tools.

Do this after the intended tool surface is finalized. A dedicated
`get_capabilities` tool may not be necessary initially; standard MCP server
metadata, `tools/list`, and a repository-owned compatibility manifest may be
enough.

## Conditional or deferrable

### SKILL-02 — workflows for tools that do not exist

This is an umbrella consequence rather than an independent fix. Close it as the
corresponding MCP capabilities are added.

### SKILL-03 — Hermes and OpenClaw instructions are mixed

Relevant only when OpenClaw is an active target. The checked-in repository
currently contains a Hermes bundle only. Defer unless portable OpenClaw support
is an immediate goal.

### SKILL-06 — narrow skill metadata and structure

Useful packaging polish for portable distribution, but unnecessary for the
current private Hermes deployment. Defer until cross-platform distribution is
required.

## Recommended sequence

1. MCP-01, MCP-X01, and MCP-12. SKILL-01 is resolved.
2. Joint design and implementation for MCP-02 and MCP-03.
3. MCP-07, followed by MCP-06.
4. MCP-05 (MCP-04 and the cross-product alias-conflict rule are complete).
5. MCP-09, then reconsider whether MCP-08 is still necessary.
6. MCP-10 if setup and explainability needs justify it.
7. Combine MCP-11 and SKILL-04, SKILL-05, and SKILL-07 into one contract and
   release feature.
8. Defer SKILL-03 and SKILL-06 unless portable OpenClaw distribution becomes an
   immediate goal.

## Verification note

At triage time, the targeted MCP, grocery, and prediction-feedback tests passed:
37 tests across two discovered Jest suites. That shows the current behavior is
internally consistent, but does not invalidate the findings above; several
unsafe or incomplete behaviors are what the existing tests currently expect.
