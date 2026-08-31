# Fix: MCP-02 duplicate-safe grocery additions

**Type:** Fix
**Status:** Complete

## Completion record

**Completed:** 2026-08-30

Grocery additions now return a structured `confirmation_required` result when
the resolved canonical product already has pending lines. The default path uses
a PostgreSQL product-scoped advisory lock so concurrent adds cannot silently
create duplicates. Explicit separate lines remain available through
`create_separate`.

The application, REST API, and MCP now support safe pending quantity updates
through set and increment modes with optimistic concurrency and stable errors.
The Hermes skill asks before updating a duplicate, supports cancellation and
clarification branches, and never treats confirmation as a request for a
separate row. Stale MCP update errors preserve the current item state so the
skill can request a fresh decision.

Changed areas:

- `src/grocery/` - implements duplicate-safe additions, quantity updates,
  stable domain errors, validation, and service tests.
- `src/mcp/` - publishes the new add result and `grocery_update` contracts,
  preserves stale current state, and tests live MCP discovery and behavior.
- `test/grocery-add-duplicate.e2e-spec.ts` and
  `test/grocery-update.e2e-spec.ts` - verify REST, MCP, persistence, stale-state,
  and concurrent-add behavior against PostgreSQL.
- `integrations/hermes/home-stock-tracker/` - adds the confirmation,
  cancellation, update, ambiguity, unit, stale-state, and uncertain-write flows.
- `docs/`, `README.md`, and `blueprint/context/project-overview.md` - document
  the ten-tool public contract and safe duplicate workflow.
- `graphify-out/` - refreshes the project knowledge graph after code changes.

Verification:

- `npm run test -- --runInBand` - 32 suites and 358 tests passed.
- `npm run test:e2e -- --runInBand` - 11 suites and 67 tests passed.
- `npm run build` - NestJS build passed.
- `git diff --check` - passed.
- Persistence-backed tests proved canonical alias matching, explicit separate
  lines, completed-history behavior, exactly one row from concurrent default
  adds, safe quantity updates, and stale MCP errors containing current state
  without mutation.

**Deviations:** The final safety pass added the recorded MCP current-state repair;
there were no scope deviations.

## The problem

`GroceryService.addItem()` always inserts a new `GroceryListItem`. Repeating a request such as "add milk" therefore creates another pending row without telling the user that milk is already pending.

The required flow spans three layers that do not yet provide the necessary contract:

1. The application has no operation for updating a pending grocery item's quantity.
2. `grocery_add` does not check for an existing pending item or return a result that tells its caller confirmation is needed.
3. The checked-in Hermes skill cannot use that result to ask the user whether to add the requested quantity or cancel.

A skill-only read-before-write check would leave REST and other MCP clients unsafe and would race under concurrent requests.

## The fix

Implement the flow in application-to-agent order. The application owns safe state changes, MCP exposes those capabilities and structured outcomes, and the skill owns the conversation with the user.

- First add pending-item quantity updates to the shared application service, REST, and MCP as `grocery_update`. It must support optimistic concurrency, pending-only mutation, positive finite quantities, and unit safety.
- Make duplicate detection a shared service invariant used by `grocery_add`. Match pending items by resolved canonical `productId`, including alias matches.
- `grocery_add` defaults to `return_existing`. When one or more matching pending lines exist, it performs no mutation and returns a structured `confirmation_required` outcome with every matching line and the requested addition.
- `create_separate` remains an explicit low-level policy for a user who clearly asks for a separate grocery-list line. The phrase "add another" does not select this policy.
- Update the Hermes skill and scenarios so a `confirmation_required` outcome produces: "This item is already on the list. Do you want to add the requested quantity, or cancel?" The skill asks this question; the MCP tool only returns the structured outcome and does not attempt to conduct a conversation. No second write occurs until the user confirms.
- After confirmation, the skill calls `grocery_update` on the unambiguous existing item and increments it by the quantity from the original request. For example, "add one milk" followed by confirmation increments the existing milk line by one. A cancellation performs no mutation.
- If the existing quantity is unspecified, the requested quantity is missing, the units conflict, or multiple matching pending lines make the target ambiguous, the skill asks a focused clarification instead of guessing.
- Use a database-backed, product-scoped transaction/locking strategy for the default check-and-create path. A service-level read followed by create is insufficient. Preserve intentional separate lines and existing history, so do not impose a blanket unique constraint that would prohibit `create_separate`.
- A pending match that needs confirmation is an expected structured result, not an MCP transport error. Purchased and removed history must not prevent a new pending add.

Do not auto-retry an update after a stale-state or uncertain transport result. Do not overwrite creation provenance during updates. Keep presentation wording in the skill; the backend returns presentation-neutral data.

## Build steps

- [x] **Step 1: Add safe pending-item quantity updates.** Implement `grocery_update` through the shared service, REST, and MCP with set/increment quantity operations, unit validation, pending-state enforcement, and expected-value concurrency checks. **Done when:** numeric quantities can be incremented by the requested amount; null quantities, mismatched units, stale state, non-pending items, invalid values, and missing items return stable safe results/errors without mutation; service, REST, MCP, and live schema tests pass.

- [x] **Step 2: Make add duplicate-safe in the shared service and transports.** Add the duplicate policy and structured result DTO, implement canonical-product pending detection plus a database-backed concurrency guard, and adapt REST and `grocery_add` without duplicating business rules. **Done when:** the first add creates one row; a repeated canonical or alias add returns `confirmation_required`, the matching pending rows, and the requested addition without mutation; explicit `create_separate` creates one row; concurrent default adds cannot create unintended duplicates; completed history does not block a new add; service, REST, MCP, and live schema tests pass.

- [x] **Step 3: Teach the skill the confirmation flow.** Update the checked-in Hermes skill and executable/scenario coverage to branch on `confirmation_required`, ask whether to add the original requested quantity or cancel, retain that requested quantity while awaiting the answer, call `grocery_update` only after confirmation, clarify unsafe or ambiguous states, and reserve `create_separate` for an explicit separate-line request. **Done when:** scenarios cover create, cancellation, confirmed increment using the original quantity, unspecified-quantity clarification, multiple-match clarification, conflicting units, explicit separate line, stale update, and uncertain write outcomes; documented tool names and schemas match the runtime MCP contract.

- [x] **Repair: Preserve stale current state through MCP.** Keep the safe `GROCERY_ITEM_CHANGED` code, message, and `currentItem` in the MCP tool error so the skill can present the changed state before asking for a fresh decision. **Done when:** unit and persistence-backed MCP tests prove a stale update returns the current item without mutation, while errors without current state retain their concise text contract.

## Verify

- Run `npm run test`.
- Run `npm run test:e2e`.
- Run `npm run build`.
- Exercise the MCP server with a real client and verify that `grocery_add` and `grocery_update` publish the implemented schemas and structured results.
- Manually follow the Hermes scenario for "add one milk" when milk is already pending. Confirm that the skill asks whether to add one or cancel, cancellation performs no mutation, and confirmation increments one unambiguous numeric line by one rather than creating another row.
