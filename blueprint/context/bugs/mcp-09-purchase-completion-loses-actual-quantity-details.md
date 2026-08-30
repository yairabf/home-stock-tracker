# Fix Brief: MCP-09 — Purchase completion loses actual quantity details

**Priority:** P1 — inventory-learning quality  
**Gap type:** Existing-tool contract limitation  
**Repository baseline:** `4058dc2fdcb65a34c4ba0a9082b030d9ab4c7c96`

## Objective

Investigate and close **MCP-09** in the actual repository. Treat the proposal in this file as a starting hypothesis, not as an instruction to blindly patch code. First verify the current implementation, contracts, tests, and surrounding architecture. If the repository supports a cleaner or safer solution, explain the alternative before implementing it.

## Source gap

**Priority:** P1 — inventory-learning quality  
**Type:** Existing-tool contract limitation

`complete_grocery_purchase` accepts only grocery item IDs. The service creates one `PURCHASED` event per product but does not carry actual purchased quantity/unit from each line or allow the user to correct what was bought. This weakens learned statistics and makes “I bought two cartons, not one” impossible to represent in the completion flow.

### Recommendation

Evolve the tool to accept selected items with optional actual measurements:

```json
{
  "items": [
    {
      "groceryItemId": "UUID",
      "actualQuantity": 2,
      "actualUnit": "cartons"
    }
  ]
}
```

If multiple grocery rows map to one product, define whether quantities are aggregated only when units match. Do not convert units automatically in the MVP.

### Acceptance criteria

- Existing ID-only behavior remains available during a versioned transition.
- Actual quantity/unit can be recorded when the user supplies them.
- Conflicting units remain separate or fail explicitly.
- Completion and inventory events remain atomic.
- Skill never invents actual quantities from requested quantities.

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

Evolve the tool to accept selected items with optional actual measurements:

```json
{
  "items": [
    {
      "groceryItemId": "UUID",
      "actualQuantity": 2,
      "actualUnit": "cartons"
    }
  ]
}
```

If multiple grocery rows map to one product, define whether quantities are aggregated only when units match. Do not convert units automatically in the MVP.

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

- Existing ID-only behavior remains available during a versioned transition.
- Actual quantity/unit can be recorded when the user supplies them.
- Conflicting units remain separate or fail explicitly.
- Completion and inventory events remain atomic.
- Skill never invents actual quantities from requested quantities.

---

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
