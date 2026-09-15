# Feature: Category-aware grocery list and inventory outputs

**From build-plan:** feature 35
**Status:** verified

## Goal

Expose each product's stored nullable `category` in grocery and materialized inventory read responses, then teach generated Hermes and OpenClaw bundles to render those returned values as Hebrew RTL-safe category sections. The service remains the authority for categories; an agent must never classify, translate, or infer one.

## In scope

- Add exact `category: string | null` propagation to grocery item responses and inventory read/estimate responses.
- Publish it in the strict MCP schemas used by `grocery_list`, `get_inventory`, and `list_inventory`.
- Keep every tool reusing the shared grocery-item schema schema-valid by returning the field consistently.
- Create the next additive MCP fixture and regenerate checked-in integration artifacts.
- Update canonical shared agent workflow/scenarios so Hermes and OpenClaw group returned values by category, with `ללא קטגוריה` only for null or empty values.

## Out of scope

- Product-category creation, classification, normalization, translation, or database migrations.
- Changing inventory inclusion, depletion filtering, ordering, estimates, quantities, or the separate `current` and `uncertain` groups.
- Reordering grocery or inventory items in the service.
- Deployment, gateway reloads, or live WhatsApp requests. These need separate approval after implementation.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan the next unchecked step before changing code.
2. Implement only that step, including focused tests.
3. Show the diff and passing evidence for review.
4. Wait for approval before a checkpoint or the next step. `/complete` makes the feature-level commit.

## Build steps

- [x] **Step 1 - Establish category propagation coverage** - extend grocery, inventory DTO/service, and in-memory MCP tests with classified and null-category fixtures. Cover `grocery_list`, `get_inventory`, and both `list_inventory` groups, plus a representative mutation result that uses the shared grocery-item schema. *Done when:* focused tests demonstrate exact category and `null` response behavior before implementation changes.

- [x] **Step 2 - Propagate category through grocery responses** - add `category: string | null` to `GroceryItemResponseDto` and thread `Product.category` through every `fromEntity` path. Reuse already-loaded product data for list, update, remove, confirmation, and completion paths, with no per-item lookup in `listItems`. *Done when:* the grocery list returns stored category in existing item order, null remains null, and shared grocery DTO consumers satisfy strict schemas.

- [x] **Step 3 - Propagate category through inventory reads** - add the field to `InventoryReadEntity` and `InventoryItemResponseDto`, select it in `getInventory` and `listInventory`, and map it unchanged into standard and estimate DTOs. *Done when:* reads expose category for a tracked item, retain null without substitution, and preserve depleted filtering plus separate sorted `current` and `uncertain` arrays.

- [x] **Step 4 - Publish and version the MCP contract** - add nullable category properties to shared grocery and inventory output schemas, then update the release contract from MCP `1.6.0` to additive `1.7.0` with fixture `contracts/1.7.0/tools-list.json`. Generate the runtime contract and bundles, and capture the new fixture without modifying historical fixtures. *Done when:* live in-memory MCP tool calls serialize exact strings and null; the `1.7.0` fixture contains the fields; `1.6.0` is unchanged.

- [x] **Step 5 - Define category-aware agent presentation** - update shared workflow/scenario sources, not generated platform copies directly, to group grocery and inventory results only by exact returned category; use `ללא קטגוריה` for null/empty; preserve per-category item order; keep commitments, recommendations, `current`, and `uncertain` separate; and render one RTL-safe line per item without Markdown tables or padding. Regenerate Hermes and OpenClaw outputs. *Done when:* generated skills give both platforms source-derived category rules and examples, including a null fallback and an uncertainty section not merged into `current`.

- [x] **Step 6 - Verify the release boundary** - run focused and full test suites, production build, and contract verification; inspect fixture and bundle drift checks. *Done when:* `npm run verify`, `npm run contract:check`, and `git diff --check` pass, with a documented post-deploy WhatsApp check.

## Files / areas

- `src/grocery/dto/grocery-item-response.dto.ts`, `src/grocery/grocery.service.ts`, and specs.
- `src/inventory/dto/inventory-read-response.dto.ts`, `src/inventory/inventory.service.ts`, and specs.
- `src/mcp/mcp-server.factory.ts` and MCP factory/fixture specs.
- `integrations/shared/home-stock-tracker/release-contract.json` and new `contracts/1.7.0/tools-list.json`.
- Shared workflow/scenario sources, generated `src/mcp/agent-release-contract.generated.ts`, and generated Hermes/OpenClaw bundles.

## Data / contracts

- **Load-bearing response field:** affected grocery and inventory items expose `category: string | null`. It is additive and preserves the exact persisted value. Empty external values are rendered by agents as the fallback group; this feature does not normalize them.
- `grocery_list.items[*]`, `get_inventory`, `list_inventory.current[*]`, and `list_inventory.uncertain[*]` publish it. The shared grocery schema also serves mutation responses, so those responses must include it rather than weakening strict schemas.
- REST DTOs and MCP output schemas remain explicit and strict. No input contract changes or migration are expected because `Product.category` already exists.
- The MCP release is `1.7.0`; preserve existing fixtures. Derive runtime/skill versions with the repository generator, not hand edits.
- Agent grouping is presentation-only: no extra `get_product` calls, category inference, service sorting, or merging inventory top-level groups.

## Testing

- Jest is configured, so propagation changes ship with focused Jest coverage using `npm test -- --runInBand` for grocery, inventory, and MCP specs.
- Assert exact non-null and null propagation, strict MCP structured output, no grocery-list N+1 product lookup, and unchanged current/uncertain and depleted behavior.
- After the `1.7.0` contract edit, use `npm run contract:capture`, then `npm run contract:check` to validate fixtures, artifacts, scenarios, and docs.
- Final gates: `npm run verify`, `npm run contract:check`, and `git diff --check`.
- Separately approved manual evidence after deployment: reload the WhatsApp profile, make read-only grocery/inventory requests, and confirm category-bearing tool output with legible RTL rendering. This is not authorized by this spec.

## Notes for the AI

- NestJS services own data access; keep controllers and MCP handlers thin. Preserve Prisma select/include conventions.
- `Product.category` is nullable in Prisma despite older overview wording. Do not coerce null to a label in DTOs or MCP output.
- Modify canonical shared integration sources, then run `npm run skills:generate`; platform copies and `agent-release-contract.generated.ts` are outputs.
- Do not deploy, restart gateways, reload profiles, commit, or alter user-owned plans during `/implement`.
- Keep diffs narrow. No em dashes in generated documentation or specs.
