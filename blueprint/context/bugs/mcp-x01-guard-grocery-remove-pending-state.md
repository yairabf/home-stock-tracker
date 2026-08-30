# Fix Brief: MCP-X01 — Guard grocery_remove pending-state transition

**Priority:** P0  
**Gap type:** Existing-tool/service defect  
**Repository baseline:** `4058dc2fdcb65a34c4ba0a9082b030d9ab4c7c96`

## Objective

Verify and fix `grocery_remove` so the domain service only transitions a grocery item from `pending` to `removed`. The MCP layer must not be the only guard.

## Repository investigation

Inspect the grocery domain/service transition logic, REST endpoint, MCP handler, persistence model, concurrency behavior, and tests. Confirm whether already-purchased or already-removed rows can currently be transitioned incorrectly.

## Proposed direction

Implement the state guard in the shared grocery domain/application service used by both REST and MCP. Return stable machine-readable errors for not-found and non-pending items. Where the operation is based on a previously-read pending item, consider stale-state/concurrency behavior consistent with `grocery_update`.

## Acceptance criteria

- A pending grocery item can be removed.
- Purchased or already-removed items cannot transition to removed through REST or MCP.
- The service/domain layer owns the invariant.
- Concurrent purchase/removal produces one valid terminal state and a stable failure for the loser.
- MCP/REST tests cover the state transition through real persistence.
- Skill guidance does not retry uncertain writes automatically.

## Expected implementation output

Document findings, implement the domain guard, add regression tests, update stable error documentation, and verify both REST and MCP behavior.
