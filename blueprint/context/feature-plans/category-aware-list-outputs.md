```markdown
# Category-Aware Grocery List and Inventory Outputs Implementation Plan

> **For Hermes:** This is a plan only. Do not modify source code, deploy, or restart gateways while preparing or reviewing this plan.

**Goal:** Expose each product's canonical category in `grocery_list` and inventory read responses so Hermes/WhatsApp can group both outputs into Hebrew RTL-safe category sections.

**Architecture:** Reuse the existing nullable `Product.category` field. Add the category to the response DTOs and MCP output schemas at the service boundary; do not classify or infer categories in the agent. The messaging skill renders exact returned categories and uses a fallback `ללא קטגוריה` group only for null/empty values.

**Tech Stack:** NestJS, Prisma, TypeScript, Zod MCP schemas, Jest, Hermes/OpenClaw integration bundles.

---

## Current verified state

- `get_product` already exposes `category`.
- `list_inventory` currently returns inventory identity and projection fields but not `category`.
- `grocery_list` currently returns product identity and grocery-line fields but not `category`.
- The canonical product relation is already included by the grocery service, so this should not require one `get_product` call per list item.
- The bulk inventory query already selects product identity and can add the scalar category in the same query.
- Category values must be treated as authoritative service data. The agent must not infer a category from names.

## Contract decisions

1. `category` is a nullable string in all affected read/output DTOs and schemas.
2. Preserve the exact stored category string; do not translate or normalize it in the API.
3. Add the field additively; do not remove or rename existing fields.
4. Include the field in `grocery_list`, `list_inventory.current`, `list_inventory.uncertain`, and `get_inventory` so all inventory-facing reads are consistent.
5. The WhatsApp renderer groups by exact returned category, preserves service item order within each category, and uses `ללא קטגוריה` only when the returned value is null/empty.
6. `current` and `uncertain` remain separate top-level inventory groups; category grouping must not merge them.
7. No database migration is expected because `Product.category` already exists.
8. This feature requires an additive MCP contract-version bump according to the repository release policy. Do not overwrite the existing released fixture; create the next minor fixture version.

---

## Implementation tasks

### Task 1: Add failing DTO/service tests for category propagation

**Files:**
- Modify: `src/grocery/grocery.service.spec.ts`
- Modify: `src/inventory/inventory.service.spec.ts`
- Modify: `src/mcp/mcp-server.factory.spec.ts`

**Steps:**

1. Add `category: 'dairy'` or another explicit fixture value to a product used by a grocery-list test.
2. Assert that `service.listItems()` returns the exact category on the item.
3. Add category to an inventory product fixture and assert it is returned in `current` or `uncertain`.
4. Add `category: null` coverage for products without classification.
5. Add MCP assertions proving `grocery_list`, `get_inventory`, and `list_inventory` structured output includes category.
6. Run the focused tests and confirm they fail because the response objects do not yet expose the field.

Suggested command:

```bash
npm test -- --runInBand \
  src/grocery/grocery.service.spec.ts \
  src/inventory/inventory.service.spec.ts \
  src/mcp/mcp-server.factory.spec.ts
```

Expected RED result: category assertions fail while unrelated existing tests remain understandable.

### Task 2: Propagate category through grocery responses

**Files:**
- Modify: `src/grocery/dto/grocery-item-response.dto.ts`
- Modify: `src/grocery/grocery.service.ts`

**Steps:**

1. Add `category: string | null` to `GroceryItemResponseDto`.
2. Extend `GroceryItemResponseDto.fromEntity` to receive the product category.
3. In `listItems`, pass `item.product.category` from the already-loaded product relation.
4. Update other response-producing calls to pass the category when the product relation is available, so mutation/confirmation responses remain schema-consistent.
5. Do not perform extra product lookups in the list path.
6. Run the grocery-focused tests and verify GREEN.

### Task 3: Propagate category through inventory responses

**Files:**
- Modify: `src/inventory/dto/inventory-read-response.dto.ts`
- Modify: `src/inventory/inventory.service.ts`

**Steps:**

1. Add `category: string | null` to `InventoryReadEntity` and `InventoryItemResponseDto`.
2. Set the DTO field directly from `entity.category`.
3. Add `category: true` to the Prisma select in `getInventory`.
4. Add `category: true` to the Prisma select in `listInventory`.
5. Preserve existing depletion filtering, `current`/`uncertain` grouping, sorting, and quantity semantics.
6. Run the inventory-focused tests and verify GREEN.

### Task 4: Publish the additive MCP schema fields

**Files:**
- Modify: `src/mcp/mcp-server.factory.ts`
- Modify: `src/mcp/mcp-server.factory.spec.ts`

**Steps:**

1. Add `category: z.string().nullable()` to the shared grocery item output schema.
2. Add `category: z.string().nullable()` to the shared inventory item output schema.
3. Keep the schemas strict and preserve existing required fields.
4. Test the live in-memory MCP client, not only the source Zod declarations.
5. Confirm all tools reusing those shared schemas still serialize valid category values, including null.

### Task 5: Bump and capture the MCP contract fixture

**Files:**
- Modify: `integrations/shared/home-stock-tracker/release-contract.json`
- Generated: `src/mcp/agent-release-contract.generated.ts`
- Create: `integrations/shared/home-stock-tracker/contracts/<next-minor>/tools-list.json`
- Generated/validated: Hermes/OpenClaw integration bundle files as required by repository scripts

**Steps:**

1. Determine the next minor contract version from the current release contract; do not overwrite the existing `1.3.0` fixture.
2. Update `contractVersion` and `toolsFixture` in the shared release contract.
3. Run the repository generator so `src/mcp/agent-release-contract.generated.ts` and integration bundles remain synchronized.
4. Capture the new fixture using the repository-supported contract-capture workflow.
5. Verify the new fixture shows `category` in grocery and inventory output schemas.
6. Confirm the prior fixture remains unchanged for historical compatibility.

Suggested commands:

```bash
npm run skills:generate
MCP_CONTRACT_CAPTURE=1 npm test -- --runInBand src/mcp/mcp-contract-fixture.spec.ts
```

Use the repository's existing release-contract/version workflow if it requires a different command or fixture directory.

### Task 6: Update the agent rendering contract

**Files:**
- Modify: `integrations/hermes/home-stock-tracker/SKILL.md`
- Modify: `integrations/openclaw/home-stock-tracker/SKILL.md`
- Modify: shared scenarios/readmes generated by the repository workflow when applicable

**Required behavior:**

For a grocery-list response:

```text
🛒 *רשימת הקניות*

*🥬 פירות וירקות*
⬜ בננה — 1 קילו

*🥛 מוצרי חלב*
⬜ גבינה — 1 יחידה
```

For inventory:

```text
📦 *המלאי בבית*

*🥬 פירות וירקות*
• בננה — 0.96 קילו

⚠️ *פריטים עם אי-ודאות*
• מוצר — הכמות אינה ודאית
```

Rules:

- Group only by the exact returned `category`.
- Use `ללא קטגוריה` for null/empty category; never infer from product names.
- Preserve item order within each category.
- Keep committed grocery items, recommendations, `current`, and `uncertain` as separate concepts.
- Use one item per line; no Markdown tables or column padding.
- Keep quantity/unit at the end of the line for Hebrew RTL stability.
- Preserve mixed Hebrew/Latin product names, percentages, and numbers exactly.
- Do not add directional characters blindly; use them only when a mixed-direction value visibly reorders in WhatsApp.
- Inventory quantities are estimates, not physical counts.

### Task 7: Add end-to-end and channel verification

**Files:**
- Modify/add the relevant REST/MCP integration tests under `test/` or `src/**.spec.ts`.
- Update the feature/agent scenario contract if required.

**Checks:**

1. REST grocery list returns category.
2. REST inventory returns category in both groups.
3. MCP `grocery_list`, `get_inventory`, and `list_inventory` expose category in structured output.
4. Null category remains valid and renders under `ללא קטגוריה`.
5. A single list response does not trigger per-item `get_product` calls.
6. Existing empty-list, depleted-item, uncertain-item, and strict-schema behavior remains unchanged.
7. Test the actual WhatsApp-facing profile with a read-only request after the service deployment and skill reload.
8. Verify the transcript contains category-bearing tool results and the final response is RTL-safe.

Final commands:

```bash
npm run test -- --runInBand
npm run build
npm run contract:check
npm run test:e2e

git diff --check
```

## Deployment handoff (separate approval)

This plan does not authorize deployment. After implementation and review:

1. Build the release without wiping the database.
2. Back up the current deployment.
3. Deploy to the approved production LXC only after explicit approval.
4. Verify health/readiness, live MCP schemas, and category-bearing read responses.
5. Reload all relevant Hermes profiles, especially `default`/WhatsApp.
6. Test a genuine WhatsApp inventory/list request and inspect the exact transcript.
7. Keep the previous image/release available for rollback.

## Acceptance criteria

- `grocery_list` items contain `category: string | null`.
- `list_inventory.current` and `.uncertain` items contain `category: string | null`.
- `get_inventory` contains the same category field.
- MCP schemas publish the new fields and accept null.
- Existing released fixtures are not overwritten.
- Hebrew category grouping renders correctly in WhatsApp without tables or bidi reordering.
- No category is inferred or fabricated.
- Full project verification passes before deployment.

```

