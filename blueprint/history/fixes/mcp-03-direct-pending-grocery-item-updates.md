# Fix: MCP-03 direct pending grocery item updates

**Type:** Fix
**From bug brief:** `blueprint/context/bugs/mcp-03-no-tool-can-update-a-pending-grocery-item.md`
**Status:** complete

## Completion record

**Completed:** 2026-08-31

Pending grocery items now accept direct selected-field updates for final
`requestedQuantity`, `unit`, and `note` values. Every selected field requires its
matching expected old value, and the service applies only those fields through
one pending-state conditional update. Nullable unit and note values can be
cleared, omitted fields and creation provenance remain unchanged, and stale
requests return the latest item state without mutation.

REST and the `grocery_update` MCP tool expose the same shared-service behavior.
The operation-based quantity contract and service-side increment arithmetic were
removed. Hermes now explains the current pending quantity, asks for the desired
final result, calculates that result from the household member's answer, and
sends one direct update.

Changed areas:

- `src/grocery/` - defines and validates direct selected-field updates, performs
  atomic expected-value checks, returns stable errors, and covers service rules.
- `src/mcp/` - publishes the direct `grocery_update` schema, forwards selected
  fields to the shared service, and verifies discovery, errors, and Hermes
  contract guidance.
- `test/grocery-update.e2e-spec.ts` - proves REST and real MCP-client behavior
  against PostgreSQL, including clears, combined updates, stale values, invalid
  requests, pending-state enforcement, and stored-state preservation.
- `integrations/hermes/home-stock-tracker/` - assigns clarification and final
  quantity arithmetic to Hermes and documents no-change, final-total, stale, and
  uncertain-result paths.
- `docs/api-reference.md` - documents direct PATCH and MCP field semantics.
- `blueprint/context/bugs/` and `graphify-out/` - preserve the revised MCP-03
  brief and refresh the project knowledge graph.

Verification:

- `npm run test -- --runInBand` - 33 suites and 373 tests passed.
- `npm run test:e2e -- --runInBand grocery-update.e2e-spec.ts` - 1 suite and 21
  persistence-backed REST/MCP tests passed.
- `npm run build` - NestJS build passed.
- `npx eslint src/mcp/hermes-skill-contract.spec.ts test/grocery-update.e2e-spec.ts`
  - passed.
- `git diff --check` - passed.
- `graphify update .` - rebuilt the code graph with 3,787 nodes, 4,718 edges, and
  312 communities. It retained the existing Graphify version warning and skipped
  optional SQL extraction because `tree_sitter_sql` is not installed.
- Behavioral evidence: authenticated `PATCH /api/v1/grocery/items/:id` and a real
  Streamable HTTP MCP client both persisted final quantity, unit, and note
  values; cleared nullable fields; preserved omitted values and source; rejected
  stale, malformed, and non-pending updates without mutation; and returned
  current state for stale decisions.

**Deviations:** None. The branch name predates the approved broader direct-field
contract but the delivered behavior matches this completed spec.

## Goal

Let Hermes update the final requested quantity, unit, or note on one exact pending grocery item. Hermes owns conversation, clarification, and arithmetic; the service validates and atomically persists final field values.

## In scope

- Replace quantity operation modes with direct selected-field PATCH semantics.
- Update `requestedQuantity`, `unit`, and `note` independently or together.
- Require the matching expected old value for every selected field.
- Preserve omitted fields exactly.
- Allow `null` to clear unit or note, but not requested quantity.
- Keep pending-state enforcement, optimistic concurrency, current-state conflict responses, and source preservation.
- Migrate REST, MCP, tests, Hermes guidance/scenarios, and documentation from increments to final quantities.

## Out of scope

- Product identity, status, source, or creation-time edits.
- Service-side arithmetic or conversational interpretation.
- Automatic unit conversion.
- Generated or inferred note text.
- Database changes unless the existing nullable columns prove insufficient.
- Compatibility with the unshipped `quantityMode` MCP-02 contract. All in-repository clients migrate together.

## Build loop

Build one step at a time, never the whole fix at once.

1. Plan the step before code.
2. Implement only that step.
3. Show the diff and verification evidence.
4. Continue only after review and approval.

## Build steps

- [x] **Step 1 - Add direct shared field-update rules** - replace update modes with optional final `requestedQuantity`, `unit`, and `note` fields plus matching expected values; update the shared service and focused tests for selected writes, clearing nullable fields, preservation, combined updates, invalid shapes, stale state, pending state, and provenance. _Done when:_ the service performs no arithmetic, writes only selected fields, predicates atomically on matching expected values, invalid calls do not mutate, and the full unit suite and build pass.
- [x] **Step 2 - Expose and prove the REST contract** - extend persistence-backed endpoint coverage for direct quantity, unit, and note updates, nullable clearing, combined updates, omitted-field preservation, stale expected values, invalid shapes, and non-pending rejection. _Done when:_ authenticated `PATCH /api/v1/grocery/items/:id` exposes the direct contract and stored state matches each response.
- [x] **Step 3 - Extend and verify `grocery_update`** - replace the MCP runtime schema and handler contract, then add source-level discovery/handler tests and persistence-backed MCP tests for direct updates, clears, combinations, invalid shapes, and stale state. _Done when:_ a real MCP client discovers the direct fields, MCP matches REST behavior, and no `quantityMode` remains in the runtime contract.
- [x] **Step 4 - Update Hermes guidance and public documentation** - teach Hermes to clarify duplicate additions, calculate the final quantity after the user's reply, and send one direct update; update scenarios and REST/MCP docs. _Done when:_ no active documentation or Hermes instruction tells the service to increment, all checks pass, and `graphify update .` completes.

## Files / areas

- `src/grocery/dto/update-grocery-item.dto.ts`
- `src/grocery/grocery.service.ts`
- `src/grocery/grocery-operation.exception.ts`
- `src/grocery/grocery.service.spec.ts`
- `src/grocery/grocery.controller.spec.ts`
- `src/mcp/mcp-server.factory.ts`
- `src/mcp/mcp-server.factory.spec.ts`
- `test/grocery-update.e2e-spec.ts`
- `docs/api-reference.md`
- `integrations/hermes/home-stock-tracker/SKILL.md`
- `integrations/hermes/home-stock-tracker/scenarios.md`

## Data / contracts

The existing REST route and MCP tool remain:

- `PATCH /api/v1/grocery/items/:id`
- `grocery_update`

Direct request shape:

```json
{
  "id": "grocery-item UUID; MCP only",
  "requestedQuantity": 4,
  "expectedRequestedQuantity": 2,
  "unit": "cartons",
  "expectedUnit": "liters",
  "note": "lactose-free",
  "expectedNote": null
}
```

Contract rules:

- `requestedQuantity`, `unit`, and `note` are optional update fields.
- At least one update field must be present.
- `requestedQuantity` must be positive and finite.
- `unit` may be a non-empty trimmed string or `null`.
- `note` may be a non-empty trimmed string or `null`.
- Every present update field requires its matching `expected...` field, including when the old value is `null`.
- An expected field without its update field is invalid.
- Expected values are compared exactly to stored values and included in the atomic update predicate.
- Omitted update fields are absent from both the write data and concurrency predicate.
- A stale expected value returns `GROCERY_ITEM_CHANGED` with the latest `currentItem`.
- The response remains `GroceryItemResponseDto`.

This is load-bearing for REST, MCP, and Hermes. Do not reintroduce operation enums or increment arithmetic.

## Testing

- Service tests: direct quantity set, unit set/clear, note set/clear, trimmed strings, combined update, omitted-field preservation, empty update, missing expected values, orphan expected values, invalid quantity/unit/note, stale expected values, concurrent race, non-pending state, and source preservation.
- REST tests: authenticated persistence for direct fields, clears, combinations, preservation, validation, stale state, and non-pending state.
- MCP tests: runtime discovery, exact DTO forwarding, safe errors, and persistence parity with REST.
- Regression gate: `npm run test`, then `npm run build` because no umbrella Verify command exists.
- Run `graphify update .` after implementation.

## Notes for the AI

- This is a fix loaded from MCP-03. Do not edit `blueprint/build-plan.md`.
- The user rejected operation enums and assigned conversational arithmetic to Hermes.
- Continue on `fix/mcp-03-grocery-item-notes`; the branch name predates the broader direct-field contract.
- Step 1 is not approved. Replace its current mode-based working-tree implementation rather than layering on it.
- Keep controllers and MCP handlers thin.
- Keep atomic conditional `updateMany` behavior.
- Write only explicitly selected fields and never overwrite unrelated state.
- Do not use a top-level union in MCP.
- No em dash, en dash, or ellipsis characters in generated content.
