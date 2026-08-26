# Feature: Complete grocery items from a purchase

**From build-plan:** feature 4b
**Status:** not started

## Goal

Add a service flow that resolves pending grocery-list items as `purchased`, atomically links them to a newly created `PURCHASED` inventory event via `relatedInventoryEventId`, and returns both the event and the updated items. This closes the loop between the grocery list and the append-only inventory-event stream.

## In scope

- Add `relatedInventoryEventId` foreign-key column to `GroceryListItem` and run the Prisma migration.
- Add a request DTO for completing items from a purchase: product ID, optional quantity/unit, and pending grocery-item IDs to mark purchased.
- Add `POST /api/v1/inventory/purchases/complete` endpoint that accepts the above and returns the created event and resolved grocery items.
- Validate that all referenced grocery-item IDs exist, belong to the given product, and are in `pending` status; return HTTP 400 with clear per-item error detail for any that don't.
- Perform the inventory-event creation and grocery-item updates in a single Prisma transaction.
- Set `status = purchased` on each matching grocery item and populate `relatedInventoryEventId`.
- Server-generated timestamp on the event; no client-provided event timestamp.
- Add unit coverage for valid completion, missing items, wrong-status items, wrong-product items, and successful transaction rollback on validation failure.
- Add e2e coverage for the complete endpoint success path, 400 for invalid items, and 404 for unknown product.

## Out of scope

- **Partial grocery-list completion** (feature 4c) - handling "I bought everything *except* X" semantics, omission lists, and partial-match resolution.
- Derived stock state, consumption statistics, or prediction logic.
- Household profile, authentication, MCP exposure, and Hermes conversation behavior.
- Bulk operations across multiple products (one product per request).

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - Add `relatedInventoryEventId` foreign key to `GroceryListItem`** - add the optional FK column to Prisma schema and run migration. *Done when:* Prisma migration runs successfully, the column exists in the schema, generated types reflect the field, and existing tests pass.
- [x] **Step 2 - Extend `GroceryItemResponseDto` and add request/response DTOs** - add optional `relatedInventoryEventId` to the existing response DTO; define `CompletePurchaseDto` with product, quantity, unit, source, and grocery-item IDs; define `CompletePurchaseResponseDto` for event + updated items. *Done when:* all DTOs compile, validation rules (UUID product, non-empty IDs array) are enforced by `class-validator`, and the application builds.
- [x] **Step 3 - Implement complete-purchase service method** - add `completePurchase(dto)` to `InventoryService` that validates each grocery-item ID, checks product match and pending status, creates the inventory event, updates items in a single transaction, and returns both. *Done when:* valid requests persist an event and update grocery items atomically, invalid items return per-item errors without persistence, and existing purchase/restock behavior remains unchanged.
- [x] **Step 4 - Add controller endpoint** - expose `POST /api/v1/inventory/purchases/complete` using the new DTOs and service method. *Done when:* the route is discoverable, requests return HTTP 201 with the combined response shape, and malformed requests return HTTP 400 through the global `ValidationPipe`.
- [x] **Step 5 - Add unit and e2e coverage** - cover the service method and HTTP contract. *Done when:* `npm run test` and `npm run test:e2e` pass, including success, invalid item ID, wrong-status item, wrong-product item, and transaction rollback on validation failure.

## Files / areas

- `prisma/schema.prisma` - add `relatedInventoryEventId` column to `GroceryListItem` model.
- `src/inventory/dto/complete-purchase.dto.ts` - new request DTO.
- `src/inventory/dto/complete-purchase-response.dto.ts` - new response shape (event + grocery items).
- `src/inventory/inventory.service.ts` - add `completePurchase` method with validation and transactional logic.
- `src/inventory/inventory.controller.ts` - add `POST /purchases/complete` route.
- `src/inventory/inventory.service.spec.ts` - unit tests for the new method.
- `test/inventory.controller.e2e-spec.ts` - e2e tests for the complete endpoint.

## Data / contracts

### Schema change

Add to `GroceryListItem`:

```prisma
model GroceryListItem {
  id                String            @id @default(uuid())
  productId         String
  product           Product           @relation(fields: [productId], references: [id])
  requestedQuantity Float?
  unit              String?
  dateAdded         DateTime          @default(now())
  status            GroceryItemStatus @default(pending)
  note              String?
  source            GroceryItemSource @default(api)

  // NEW:
  relatedInventoryEventId String?
  relatedInventoryEvent   InventoryEvent? @relation(fields: [relatedInventoryEventId], references: [id])

  @@index([status])
}
```

### `POST /api/v1/inventory/purchases/complete`

Request:

```json
{
  "productId": "uuid",
  "eventType": "PURCHASED",
  "quantity": 6,
  "unit": "liter",
  "source": "hermes_whatsapp",
  "confidence": 1,
  "metadata": {},
  "groceryItemIds": ["uuid-1", "uuid-2"]
}
```

- `productId`: required UUID referring to an existing `Product`.
- `eventType`: required, restricted to `PURCHASED` (no RESTOCKED support for grocery completion).
- `quantity`: optional non-negative number.
- `unit`: optional string.
- `source`: required non-blank string, trimmed.
- `confidence`: optional number.
- `metadata`: optional JSON object.
- `groceryItemIds`: required non-empty array of UUIDs; each must reference an existing `GroceryListItem` that belongs to `productId` and has `status === 'pending'`. Duplicates are ignored (treated as a set).

Response: HTTP 201

```json
{
  "event": {
    "id": "event-uuid",
    "productId": "product-uuid",
    "eventType": "PURCHASED",
    "quantity": 6,
    "unit": "liter",
    "timestamp": "2026-08-26T12:34:56.789Z",
    "source": "hermes_whatsapp",
    "confidence": 1,
    "metadata": {}
  },
  "groceryItems": [
    {
      "id": "uuid-1",
      "productId": "product-uuid",
      "productName": "milk",
      "requestedQuantity": 2,
      "unit": "liter",
      "dateAdded": "2026-08-20T10:00:00Z",
      "status": "purchased",
      "note": null,
      "source": "hermes_whatsapp",
      "relatedInventoryEventId": "event-uuid"
    },
    {
      "id": "uuid-2",
      "productId": "product-uuid",
      "productName": "milk",
      "requestedQuantity": 4,
      "unit": "liter",
      "dateAdded": "2026-08-22T11:30:00Z",
      "status": "purchased",
      "note": null,
      "source": "api",
      "relatedInventoryEventId": "event-uuid"
    }
  ]
}
```

Errors:

- HTTP 400 for malformed input, empty `groceryItemIds`, or one or more invalid items (wrong status, wrong product, not found). Include a structured `errors` array with per-item detail when multiple IDs fail validation.
- HTTP 404 when `productId` does not reference an existing product.

## Testing

The project has Jest and Supertest configured. Logic-bearing service and DTO behavior must ship with tests.

- Unit tests mock `PrismaService` and `ProductService` to verify per-item validation, transactional behavior, correct status/foreign-key assignment, and rollback when any item fails validation.
- DTO tests verify required fields, non-empty grocery-item array, and UUID format.
- E2e tests create a fixture product and pending grocery items, call the complete endpoint, verify the inventory event and updated grocery items, and verify 400/404 cases.
- Run `npm run test` and `npm run test:e2e` as the automated gate.

## Notes for the AI

- Use `PrismaService.$transaction` for atomic event creation + grocery-item updates; do not perform the event-write outside the transaction. The transaction is intentionally kept together in Step 3 because transaction boundaries shouldn't be split across build steps.
- Reuse `ProductService.findOne` for product existence checks and preserve its `NotFoundException` behavior.
- Validate each grocery-item ID against `productId` match and `status === 'pending'` before any persistence. Return a structured error response with per-item detail if any fail. Deduplicate `groceryItemIds` before validation.
- Only `PURCHASED` event type is valid for grocery completion; reject `RESTOCKED` with HTTP 400.
- Reuse existing `InventoryEventResponseDto` and extend `GroceryItemResponseDto` to include `relatedInventoryEventId`; do not duplicate them.
- Preserve the append-only event model: once an event is created, it should not be modified.
- Keep the endpoint presentation-agnostic and do not add Hermes-specific formatting.
- Preserve existing API prefix conventions: controllers use relative paths and `main.ts` supplies `/api/v1`.
- No visual design reference applies because this is a backend-only feature.
