# Feature: Partial grocery-list completion

**From build-plan:** 4c. Partial grocery-list completion
**Status:** not started

## Goal

Extend the existing purchase completion flow to support Hermes conversations like "I bought everything except toilet paper" - completing selected grocery items while leaving omitted items pending, with clear handling for unknown or already-resolved items.

## In scope

- New endpoint `POST /inventory/purchases/complete-partial` accepting a list of grocery item IDs to complete OR omit
- Same transactional semantics as existing `completePurchase`: create one `PURCHASED` inventory event and link it to the resolved grocery items
- Clear per-item error categorization in responses: completed, skipped (not found, wrong product, already resolved), and pending (explicitly omitted)
- Support both inclusive mode (complete these items) and exclusive mode (complete all except these items)
- Structured error response when all requested items fail validation

## Out of scope

- Product creation or lookup by name (already handled by existing services)
- Inventory state estimation from purchase patterns (feature 6)
- Hermes WhatsApp conversation parsing (feature 13-14)
- MCP tool interface updates (feature 12) - this feature extends REST only

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - Add DTOs for partial completion** - Create `CompletePartialPurchaseDto` and `CompletePartialPurchaseResponseDto` with validation for both inclusive and exclusive modes. *Done when:* DTOs exist in `src/inventory/dto/`, validation tests pass (at least the new fields tested).
- [x] **Step 2 - Implement service method** - Add `completePartialPurchase` to `InventoryService` with per-item validation, mode handling, transactional event creation, and structured result. *Done when:* Method exists, unit tests cover happy path, validation edge cases, inclusive/exclusive modes, and partial-success scenarios.
- [x] **Step 3 - Add controller endpoint** - Expose `POST /inventory/purchases/complete-partial` in `InventoryController`. *Done when:* Endpoint wired, returns correct response shape, e2e-style request validation test passes (or manual curl against running dev server shows expected behavior).
- [x] **Step 4 - Integration and manual verification** - Run full test suite, verify existing `completePurchase` still works, and test partial completion via `curl` against dev server. *Done when:* All tests pass, manual verification shows correct behavior for both modes.

## Files / areas

- `src/inventory/dto/complete-partial-purchase.dto.ts` (new)
- `src/inventory/dto/complete-partial-purchase-response.dto.ts` (new)
- `src/inventory/inventory.service.ts` (extend with `completePartialPurchase`)
- `src/inventory/inventory.service.spec.ts` (extend tests)
- `src/inventory/inventory.controller.ts` (add endpoint)

## Data / contracts

### Request: `CompletePartialPurchaseDto`

```typescript
{
  productId: string;           // UUID
  quantity?: number;           // optional
  unit?: string;               // optional
  source: string;              // required, trimmed
  confidence?: number;         // optional
  metadata?: Record<string, unknown>;  // optional

  // One of these must be provided, but not both:
  completeItemIds?: string[];   // inclusive mode: complete these items only
  omitItemIds?: string[];       // exclusive mode: complete all pending except these
}
```

Validation rules:
- `completeItemIds` XOR `omitItemIds` required (exactly one must be present with at least one item)
- All item IDs must be valid UUIDs
- Arrays cannot be empty when present

### Response: `CompletePartialPurchaseResponseDto`

```typescript
{
  event: InventoryEventResponseDto;  // the PURCHASED event created

  completed: Array<{
    id: string;
    productName: string;
    status: GroceryItemStatus;
  }>;

  skipped: Array<{
    id: string;
    reason: 'not_found' | 'wrong_product' | 'already_resolved';
  }>;

  pending: Array<{
    id: string;
    reason: 'explicitly_omitted';
  }>;
}
```

## Testing

**Test runner:** Jest (configured per `AGENTS.md`)

**In-scope logic to test:**
- DTO validation: exactly one of `completeItemIds` or `omitItemIds` required, UUID validation per item, non-empty arrays
- Service method:
  - inclusive mode: completes exactly the specified items, validates each, returns correct `completed`/`skipped` split
  - exclusive mode: fetches all pending items for the product, completes those not in `omitItemIds`, returns correct `completed`/`pending` split
  - per-item validation: not found, wrong product, already resolved (purchased/removed), already linked to event
  - transactional: event created atomically with grocery-item updates
  - error when all requested items fail validation (no partial write)
  - tolerance check: requesting items for wrong product should fail per-item, not at service boundary

**Not in scope for unit tests:** HTTP layer integration, database connectivity (mock Prisma)

## Notes for the AI

- **Match existing patterns:** Follow the structure of `completePurchase` in `inventory.service.ts` - same transactional pattern, same product validation, same optimistic locking with status guard in the WHERE clause.
- **Exclusive-mode query:** When `omitItemIds` is provided, fetch all pending grocery items for the `productId`, filter out the omitted IDs, and complete the rest. This mirrors Hermes saying "I bought everything except toilet paper."
- **Per-item validation responses:** Don't throw `BadRequestException` for a subset of invalid items - categorize them in the response. Only throw if **all** items fail (nothing to complete).
- **No changes to existing `completePurchase`:** This feature adds a new endpoint; it doesn't modify the existing one.
- **No Hermes integration:** The service layer doesn't parse natural language - it receives structured grocery item IDs. Hermes conversation parsing happens later (feature 13-14).
