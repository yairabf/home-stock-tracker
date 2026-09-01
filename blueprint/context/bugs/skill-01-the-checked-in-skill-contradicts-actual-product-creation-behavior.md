# Fix Brief: SKILL-01 — The checked-in skill contradicts actual product creation behavior

**Priority:** P0  
**Gap type:** See source brief  
**Repository baseline:** `4058dc2fdcb65a34c4ba0a9082b030d9ab4c7c96`

## Objective

Investigate and close **SKILL-01** in the actual repository. Treat the proposal in this file as a starting hypothesis, not as an instruction to blindly patch code. First verify the current implementation, contracts, tests, and surrounding architecture. If the repository supports a cleaner or safer solution, explain the alternative before implementing it.

## Source gap

**Priority:** P0

`GroceryService.addItem()` calls `findOrCreateByExactOrAliasMatch()` and can create a normalized product. The docs say grocery add accepts only a known product and does not create unknown products. The skill also treats unknown `get_product` results as a dead end even though a direct, explicit grocery add can create the product.

### Recommendation

Choose one product contract and document it consistently across service, REST, MCP, Hermes, and OpenClaw. For conversational usability, retain explicit auto-create through `grocery_add`, but make the behavior visible in the tool description/result and prevent duplicate canonical products through MCP-02, MCP-04, and MCP-05.

---

## Repository investigation

Before changing code:

1. Locate every service, controller, MCP registration, schema, DTO, test, skill, scenario, and documentation file affected by this gap.
2. Verify whether the gap still exists on the current branch and whether behavior differs from repository baseline `4058dc2fdcb65a34c4ba0a9082b030d9ab4c7c96`.
3. Identify the domain/service method that should own the behavior. Do not implement business rules only in an MCP handler or skill if REST or other clients require the same rule.
4. Check for existing conventions for errors, transactions, idempotency, optimistic concurrency, authentication, provenance, logging, and schema versioning.
5. Identify backward-compatibility consequences for REST, MCP, Hermes, OpenClaw, tests, and existing persisted data.
6. If the proposed solution below conflicts with current architecture, document the conflict and propose the smallest coherent alternative.

## Proposed direction

Choose one product contract and document it consistently across service, REST, MCP, Hermes, and OpenClaw. For conversational usability, retain explicit auto-create through `grocery_add`, but make the behavior visible in the tool description/result and prevent duplicate canonical products through MCP-02, MCP-04, and MCP-05.

---

## Implementation constraints

- Preserve a single NestJS deployable for the MVP unless this gap specifically proves a split is necessary.
- REST and MCP should call shared domain/application services rather than duplicating business logic.
- MCP schemas must be discoverable by a real MCP client, not merely valid as source-level Zod/TypeScript.
- Writes must fail safely on ambiguous or stale state.
- Do not invent user data or silently reinterpret household state.
- Keep product resolution consistent with the current MVP contract: normalized exact match; writes may resolve-or-create where applicable; reads never create as a side effect.
- Preserve generic MCP provenance rather than channel-specific assumptions.
- Add/update tests before considering the gap complete.

## Acceptance criteria

Use the acceptance criteria in the Source gap section above. Add regression coverage that proves the gap is closed through the real public contract.

## Agent discussion prompts

Use these questions while working with the repository:

- Does the proposed fix belong in the domain layer, transport layer, or skill layer?
- Is there already a utility/service that should be extended instead of adding a parallel path?
- Does this change require a database migration?
- Does this change alter the public REST or MCP contract?
- Does the MCP schema generated at runtime match what the source code appears to declare?
- What happens under concurrent or repeated requests?
- What happens after an uncertain transport failure?
- What stable domain error/result should the agent receive?
- Which Hermes/OpenClaw instructions become stale after this change?
- Can this be completed without adding infrastructure or abstractions that the MVP does not need?

## Expected implementation output

When completing this fix, produce:

1. A short repo findings note explaining the current behavior and root cause.
2. The chosen solution and why it is preferable to alternatives discovered in the repo.
3. Code changes.
4. Database migration, if required.
5. Unit/domain tests.
6. Real MCP contract/regression tests where applicable.
7. REST tests where the same domain behavior is exposed through REST.
8. Hermes/OpenClaw skill or scenario changes where the agent contract changes.
9. Documentation/version updates where public behavior changes.
10. A concise verification report mapping test evidence to each acceptance criterion.

## Out of scope

Do not use this gap as a reason to add unrelated features, a UI, store-specific integrations, multi-household support, a Python prediction service, Redis, or a second MCP deployment unless the repository demonstrates a concrete requirement.

## Resolution - 2026-09-01

Resolved by feature 30, Policy-aware grocery additions.

- Shared `GroceryService.addPolicyAwareItem()` now owns exact reuse,
  deterministic creation, proposal resolution, pending-line behavior, request
  echoes, and the successful result union.
- `create_if_missing` accepts complete product facts, invokes no LLM, and creates
  a missing product with its first grocery line atomically. Concurrent canonical
  creation converges on one product and stable pending-line behavior.
- `propose_if_missing` reuses exact identities or returns
  `product_resolution_required` with deterministic candidates, optional
  non-authoritative advice, and server-computed actions without domain mutation.
- REST defaults to `create_if_missing`; MCP defaults to `propose_if_missing` and
  publishes both policy branches and all result fields to a real MCP client.
- Hermes guidance and executable scenarios begin uncertain names in proposal
  mode, keep product and grocery facts separate, and forbid guessed identity or
  quantity.
- No schema migration was required. REST and MCP keep source attribution
  server-owned as `api` and `mcp`.

Passing evidence:

- REST E2E covers omission defaults, both explicit policies, all three result
  branches, invalid mixed shapes, authentication, atomic rollback, and stable
  conflict serialization.
- Real MCP E2E covers discovered policy fields, proposal-mode omission,
  deterministic override, runtime cross-branch rejection, successful resolution
  results, no proposal mutation, and `mcp` provenance.
- PostgreSQL-backed service E2E covers atomic commit and rollback, concurrent
  product convergence, pending-line convergence, exact proposal bypass, and
  provider-unavailable no-write behavior.
- Unit and guidance contract tests cover transport validation, deterministic
  allowed actions, request echoes, agent branching, and nested grocery inputs.
