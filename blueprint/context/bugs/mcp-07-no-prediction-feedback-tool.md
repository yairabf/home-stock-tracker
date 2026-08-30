# Fix Brief: MCP-07 — No prediction-feedback tool

**Priority:** P1 — closes the learning loop  
**Gap type:** Missing tool  
**Repository baseline:** `4058dc2fdcb65a34c4ba0a9082b030d9ab4c7c96`

## Objective

Investigate and close **MCP-07** in the actual repository. Treat the proposal in this file as a starting hypothesis, not as an instruction to blindly patch code. First verify the current implementation, contracts, tests, and surrounding architecture. If the repository supports a cleaner or safer solution, explain the alternative before implementing it.

## Source gap

**Priority:** P1 — closes the learning loop  
**Type:** Missing tool

REST exposes prediction feedback (`accepted`, `rejected`, or `corrected`), and predictions return `predictionId`, but MCP cannot submit feedback. The current skill maps user corrections to `STOCK_CORRECTED`, which records a stock event but does not necessarily mark the specific prediction accepted/rejected/corrected.

### Proposed tool

`record_prediction_feedback`

```json
{
  "predictionId": "UUID returned by get_inventory or get_low_stock_predictions",
  "outcome": "accepted | rejected | corrected",
  "correctedState": "likely_available | probably_low | probably_out"
}
```

`correctedState` is required only for `corrected`; use one object schema with runtime validation rather than a top-level union.

### Required workflow

- Feedback requires a trusted prediction ID from the active interaction or a fresh prediction read.
- “Yes, that was right” maps to accepted only when the referenced prediction is unambiguous.
- “No, we still have milk” should record prediction feedback and, if the domain requires it, one corresponding stock observation in a single domain operation or clearly documented ordered workflow.
- Never accept/reject an unrelated or stale prediction by guessing.

### Acceptance criteria

- Accepted, rejected, and corrected flows update the prediction deterministically.
- Repeated feedback has defined idempotency/conflict behavior.
- Skill scenarios distinguish general stock correction from feedback about a specific prediction.

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

Use the recommendation and constraints in the Source gap section above as the initial implementation direction.

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

- Accepted, rejected, and corrected flows update the prediction deterministically.
- Repeated feedback has defined idempotency/conflict behavior.
- Skill scenarios distinguish general stock correction from feedback about a specific prediction.

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
