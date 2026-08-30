# MCP and Agent Skill Development Brief

**Repository baseline:** `4058dc2fdcb65a34c4ba0a9082b030d9ab4c7c96`  
**Scope:** Home Stock Tracker MCP, Hermes Agent skill, OpenClaw installation, and agent-facing documentation  
**Purpose:** A repo-level development brief for an agentic implementation workflow  
**Out of scope:** Rami Levy or any specific online grocery-store integration

## Executive summary

The repository already exposes a useful nine-tool MCP surface and a substantial Hermes skill, but the agent integration is not yet complete enough for a clean third-party install. The highest-priority work is not to add many unrelated tools. It is to make the current contracts reliable, then add the small set of missing tools needed for normal conversation: safe duplicate handling, grocery-item updates, product discovery, inventory history, prediction feedback, and atomic multi-item operations.

The checked-in agent bundle also needs to stop claiming that one Hermes-oriented skill is automatically agent-neutral. Hermes and OpenClaw should share the same business workflow rules, while each receives installation and runtime instructions appropriate to that platform.

## Current repository baseline

### Current MCP tools

The server currently registers nine tools in `src/mcp/mcp-server.factory.ts`:

1. `grocery_add`
2. `grocery_remove`
3. `grocery_list`
4. `get_product`
5. `get_inventory`
6. `record_purchase`
7. `record_stock_signal`
8. `complete_grocery_purchase`
9. `get_low_stock_predictions`

### Current agent integration files

The repo has one agent bundle:

```text
integrations/hermes/home-stock-tracker/
├── README.md
├── SKILL.md
└── scenarios.md
```

`docs/agent-integrations.md` instructs both Hermes and OpenClaw users to reuse that bundle. There is no dedicated OpenClaw bundle, no compatibility manifest tying the skill version to the MCP contract, and no automated installer/probe that checks the tool schemas before enabling writes.

### Important scope rule

Online-store fulfillment is not part of this brief. The Home Stock Tracker should expose a clean household grocery/inventory contract that any future store adapter can consume. Store-specific credentials, product catalogs, carts, checkout flows, and vendor skills should remain separate integrations.

---

# Prioritized gaps

## MCP-01 — `get_product` publishes an unreliable input schema

**Priority:** P0 — prerequisite for every product-based workflow  
**Type:** Existing-tool defect, not a new tool

`get_product` uses a top-level Zod union:

```ts
z.union([
  z.object({ id: z.uuid() }).strict(),
  z.object({ productName: z.string().trim().min(1) }).strict(),
])
```

The deployed MCP SDK converted this to an empty object schema during testing. An agent could not discover the accepted arguments and guessed the wrong field.

### Recommendation

Replace the top-level union with one strict object whose schema visibly publishes both properties:

```json
{
  "id": "optional UUID",
  "productName": "optional non-empty string"
}
```

Enforce exactly one of the two fields at runtime. If the SDK still cannot express the contract reliably, split it into `get_product_by_id` and `get_product_by_name`.

### Acceptance criteria

- `tools/list` visibly exposes `id` and `productName`.
- Valid ID lookup and exact name/alias lookup succeed.
- Neither field and both fields fail with stable domain errors.
- A real MCP client regression test inspects the published JSON Schema, not only the source Zod object.

---

## MCP-02 — `grocery_add` silently permits duplicate pending items

**Priority:** P0 — core conversational correctness  
**Type:** Existing-tool contract defect

`GroceryService.addItem()` always creates a new grocery row after resolving or creating a product. Repeating “add milk” can silently create duplicate pending lines. The service, not the skill, should enforce safe behavior so Hermes, OpenClaw, REST clients, and future store adapters behave consistently.

### Recommendation

Extend `grocery_add` with an explicit duplicate policy:

```json
{
  "productName": "milk",
  "requestedQuantity": 2,
  "unit": "liters",
  "note": null,
  "ifPendingExists": "return_existing"
}
```

Allowed values:

- `return_existing` — default; do not mutate and return all matching pending lines.
- `create_separate` — explicitly create a separate line.

Match duplicates by resolved canonical `productId`, not raw text, so aliases identify the same product. Duplicate detection and insertion must be concurrency-safe.

### Suggested result

```json
{
  "outcome": "created | duplicate",
  "createdItem": null,
  "existingItems": []
}
```

A duplicate is an expected conversational branch, not an MCP transport error.

### Acceptance criteria

- First add creates one pending row.
- Repeating the same canonical product or alias performs no mutation by default.
- `create_separate` creates one additional row.
- Concurrent default adds cannot create unintended duplicates.
- Purchased and removed history does not block a new pending add.

---

## MCP-03 — No tool can update a pending grocery item

**Priority:** P0 — the largest missing MCP capability  
**Type:** Missing tool

The data model stores `requestedQuantity`, `unit`, and `note`, but neither REST nor MCP can update them. When an item already exists, an agent cannot execute “make that two,” “add one more,” “change it to cartons,” or “add a note.”

### Proposed tool

`grocery_update`

```json
{
  "id": "grocery-item UUID",
  "quantityMode": "set | increment | unchanged",
  "quantity": 2,
  "unit": "liters",
  "noteMode": "set | clear | unchanged",
  "note": "low-fat",
  "expectedRequestedQuantity": 1,
  "expectedUnit": "liters"
}
```

The final schema may separate quantity and note operations if that produces a clearer MCP contract. Do not use a top-level union.

### Required behavior

- Only `pending` items are mutable.
- `set` works when current quantity is null or numeric.
- `increment` is invalid when current quantity is null.
- Quantity must be positive and finite.
- No automatic unit conversion in the MVP.
- An explicit increment unit must match the normalized current unit.
- Expected quantity/unit provide optimistic concurrency protection.
- Creation provenance is not overwritten by an update.

### Stable errors

- `GROCERY_ITEM_NOT_FOUND`
- `GROCERY_ITEM_NOT_PENDING`
- `GROCERY_ITEM_CHANGED`
- `QUANTITY_UNSPECIFIED`
- `UNIT_MISMATCH`
- `INVALID_QUANTITY`
- `INVALID_UNIT`

### Acceptance criteria

- Set and increment quantity safely.
- Set, clear, or preserve a note explicitly.
- Stale updates return current state and do not retry automatically.
- MCP and REST expose the same behavior.
- Skill scenarios cover null quantity, numeric quantity, conflicting units, stale state, and multiple duplicate lines.

---

## MCP-04 — No agent-safe product search or catalog discovery

**Priority:** P1 — needed for ambiguity and multilingual aliases  
**Type:** Missing tool

`get_product` performs only an exact canonical-name/alias lookup or UUID lookup. The agent cannot safely answer “which milk products exist?”, inspect nearby candidates after a not-found result, or resolve an ambiguous user phrase without guessing.

### Proposed tool

`search_products`

```json
{
  "query": "milk",
  "limit": 10,
  "includePredictionDisabled": false
}
```

Return compact candidates with `id`, `canonicalName`, `aliases`, `category`, `typicalUnit`, and prediction status. Matching should be deterministic and documented. The first version can use normalized substring/prefix matching; semantic or LLM search is not required.

### Boundaries

- Read-only.
- Never auto-select when multiple plausible products remain.
- Never create a product.
- Results should have a stable order.

### Acceptance criteria

- Exact, alias, prefix, and substring cases are deterministic.
- Empty query is rejected or explicitly defined as bounded catalog listing.
- Result count is capped.
- Skill instructs the agent to present candidates and ask when the match is not unique.

---

## MCP-05 — No controlled alias-management tool

**Priority:** P1 — data quality and language continuity  
**Type:** Missing tool

REST exposes `POST /api/v1/products/:id/aliases`, but MCP exposes no equivalent. A household member cannot teach the system that two names identify the same product. This increases duplicate canonical products, particularly across languages or common nicknames.

### Proposed tool

`product_add_alias`

```json
{
  "productId": "UUID returned by get_product/search_products",
  "alias": "whole milk"
}
```

### Safety requirements

- The user must explicitly confirm the alias relationship.
- Resolve and show both the target product and conflicting matches before mutation.
- Reject an alias already owned by another canonical product.
- Do not expose product merge/delete through MCP in the MVP; those are higher-risk administrative operations.

### Acceptance criteria

- Adds one normalized alias to one confirmed product.
- Duplicate alias on the same product is idempotent or returns a stable non-destructive result.
- Cross-product alias conflict is rejected.
- Skill scenarios cover explicit teaching, ambiguous target, and conflicting alias ownership.

---

## MCP-06 — No inventory-event history tool

**Priority:** P1 — explainability, correction, and household questions  
**Type:** Missing tool

REST can list inventory events with product/event filters and pagination, but MCP cannot. The agent therefore cannot answer “when did we last buy milk?”, “what did I tell you yesterday?”, or inspect recent evidence before recording a correction.

### Proposed tool

`list_inventory_events`

```json
{
  "productId": "optional UUID",
  "eventType": "optional enum",
  "limit": 20,
  "offset": 0
}
```

For name-based conversation, the skill should resolve the product with `get_product` or `search_products` first.

### Acceptance criteria

- Read-only, paginated, bounded, newest-first.
- Returns total, limit, offset, and structured events.
- Does not expose sensitive metadata by default; metadata should be allowlisted or omitted from agent output.
- Skill distinguishes recorded history from estimated current state.

---

## MCP-07 — No prediction-feedback tool

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

## MCP-08 — Multi-item additions are non-atomic

**Priority:** P1 — common grocery-list workflow  
**Type:** Missing tool

The skill currently tells the agent to call `grocery_add` once per named item. A network failure midway leaves a partially applied request, and retrying is unsafe. This is especially common for “add milk, eggs, bread, and tomatoes.”

### Proposed tool

`grocery_add_many`

```json
{
  "items": [
    {
      "productName": "milk",
      "requestedQuantity": 2,
      "unit": "liters",
      "note": null,
      "ifPendingExists": "return_existing"
    }
  ],
  "atomic": true
}
```

### Recommendation

Default to atomic behavior. Return one result per input item, in input order. If product classification/creation occurs, all product and grocery mutations must participate in the transaction or the service must document why full atomicity is impossible.

### Acceptance criteria

- Input order is preserved.
- Each item retains only its own quantity/unit/note.
- Duplicate results are structured per item.
- Atomic mode leaves no partial grocery changes on domain failure.
- Uncertain transport results are never automatically retried by the skill.

---

## MCP-09 — Purchase completion loses actual quantity details

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

## MCP-10 — No read-only household context tool

**Priority:** P2 — explainability and setup verification  
**Type:** Missing tool

Prediction behavior depends on household settings and confidence thresholds, but MCP cannot read them. An agent cannot explain which household context is active or verify that it is connected to the intended household.

### Proposed tool

`get_household_context`

No arguments. Return only agent-safe fields needed to explain predictions and verify the household configuration. Do not return credentials or unrelated operator metadata.

### Recommendation

Keep household mutation outside MCP initially. Changing household size, thresholds, or product policies is an administrative operation and deserves a separate design/authorization review.

### Acceptance criteria

- Read-only response is stable and privacy-reviewed.
- Skill uses it only for explicit setup/context questions, not before every prediction.
- Installer smoke test can verify that the intended household is reached without mutating data.

---

## MCP-11 — No contract/capability compatibility probe

**Priority:** P1 — installation and upgrade safety  
**Type:** Missing read tool or deployment metadata

MCP initialization publishes a server name/version and `tools/list` publishes tools, but the repo provides no single compatibility contract tying together:

- service release,
- MCP contract version,
- enabled features,
- expected tool set,
- Hermes skill version,
- OpenClaw skill version.

The MCP server currently hardcodes version `1.0.0`, while the skill says `1.2.0`. A new installer cannot tell whether the checked-in skill matches the deployed server.

### Recommendation

Prefer standard MCP metadata where clients expose it reliably. If it is insufficient, add a read-only `get_capabilities` tool:

```json
{
  "serviceVersion": "...",
  "mcpContractVersion": "...",
  "features": ["grocery-update", "prediction-feedback"],
  "toolNames": [],
  "compatibleSkillMajor": 2
}
```

Generate these values from one release source rather than maintaining them manually in multiple files.

### Acceptance criteria

- A fresh install can fail early on an incompatible skill/server pair.
- The value is covered by release tests.
- Documentation gives one command/probe for Hermes and one for OpenClaw.
- No secret or environment detail is returned.

---

## MCP-12 — Source attribution is channel-specific and incorrect

**Priority:** P1 — provenance correctness  
**Type:** Existing-tool/service defect

`grocery_add` hardcodes `GroceryItemSource.hermes_whatsapp`, even when the MCP call comes from Telegram, OpenClaw, CLI, or another client. Inventory tools use the more accurate generic string `hermes_mcp`.

### Recommendation

Use a generic trusted source such as `agent_mcp` or `mcp` for MCP-originated mutations. Do not accept arbitrary user-controlled channel/source text. If per-client provenance is needed later, derive it from authenticated server-side client metadata.

### Acceptance criteria

- All MCP clients produce truthful generic provenance.
- REST remains `api` unless trusted server-side metadata says otherwise.
- Migration preserves historical values.
- Tests no longer assert WhatsApp for generic MCP calls.

---

# Skill and installation gaps

## SKILL-01 — The checked-in skill contradicts actual product creation behavior

**Priority:** P0

`GroceryService.addItem()` calls `findOrCreateByExactOrAliasMatch()` and can create a normalized product. The docs say grocery add accepts only a known product and does not create unknown products. The skill also treats unknown `get_product` results as a dead end even though a direct, explicit grocery add can create the product.

### Recommendation

Choose one product contract and document it consistently across service, REST, MCP, Hermes, and OpenClaw. For conversational usability, retain explicit auto-create through `grocery_add`, but make the behavior visible in the tool description/result and prevent duplicate canonical products through MCP-02, MCP-04, and MCP-05.

---

## SKILL-02 — The skill cannot describe workflows for tools that do not exist

**Priority:** P0

The current skill handles simple add/list/remove/purchase flows well, but cannot complete common intents because MCP lacks `grocery_update`, `search_products`, `product_add_alias`, `list_inventory_events`, `record_prediction_feedback`, and `grocery_add_many`.

### Recommendation

Update `SKILL.md` and `scenarios.md` only after the corresponding service/MCP contracts are finalized. Each new write tool needs ambiguity, stale-state, domain-failure, and uncertain-transport scenarios. Each read tool needs empty and multi-match scenarios.

---

## SKILL-03 — Hermes-specific and OpenClaw-specific instructions are mixed

**Priority:** P1

The repo claims the skill body is agent-neutral, but the bundle contains Hermes-specific behavior and documentation:

- Hermes profile path (`~/.hermes/skills/...`)
- Hermes cron commands
- Hermes `[SILENT]` delivery convention
- WhatsApp home-channel assumptions

OpenClaw is told to install the same directory, although it has different loading, sandbox, lifecycle, and scheduling behavior.

### Recommendation

Use a shared workflow specification with platform-specific install/runtime adapters. One practical layout is:

```text
integrations/
├── shared/home-stock-tracker/
│   ├── workflow.md
│   └── scenarios.md
├── hermes/home-stock-tracker/
│   ├── SKILL.md
│   └── README.md
└── openclaw/home-stock-tracker/
    ├── SKILL.md
    └── README.md
```

If duplicated SKILL bodies are required by each platform, generate them from one source and add a drift test. Do not make OpenClaw inherit Hermes cron or `[SILENT]` semantics unless OpenClaw explicitly supports an equivalent contract.

---

## SKILL-04 — Installation is manual and does not verify schemas

**Priority:** P1

The current process copies files, configures MCP separately, and asks the operator to confirm nine tools. It does not automatically check:

- authentication,
- server identity,
- tool count,
- published input/output schemas,
- skill/server compatibility,
- safe read call,
- platform tool allowlists/sandbox visibility.

### Recommendation

Add a repository-owned, non-secret installer/probe script that accepts URL/token through environment variables and performs:

1. health/readiness check,
2. MCP initialize,
3. `tools/list`,
4. expected tool and schema assertions,
5. capability/contract-version comparison,
6. read-only `grocery_list`,
7. platform-specific instructions for installing the skill bundle,
8. explicit opt-in before any mutation smoke test.

Never write the token into the repo or generated skill files.

---

## SKILL-05 — No release synchronization between MCP and skills

**Priority:** P1

The MCP server version is hardcoded as `1.0.0`; the skill version is `1.2.0`; docs hardcode “nine tools.” Tool additions or schema changes can therefore leave installed agents with stale instructions.

### Recommendation

Define one MCP contract version and compatibility policy. CI should fail when:

- the tool registry changes without a contract-version bump,
- the skill’s tool table does not match `tools/list`,
- scenarios reference missing tools/arguments/enums,
- generated Hermes/OpenClaw bundles drift,
- docs retain stale tool counts.

---

## SKILL-06 — The skill metadata and structure are too narrowly Hermes-shaped

**Priority:** P2

The current `SKILL.md` has minimal frontmatter and no platform declaration, license, prerequisites, verification section, or explicit dependency/capability version. Those omissions make portable installation harder and prevent installers from preflighting requirements.

### Recommendation

Define a repo-owned portable skill manifest, then map it to each platform’s required frontmatter. Keep workflow rules in the body and installation/runtime details in the platform README. Include:

- name and concise trigger description,
- semantic version,
- supported agent/platform list,
- MCP server name and minimum contract version,
- required tool names,
- authentication/network prerequisites,
- verification and rollback steps.

Do not put tokens, URLs tied to one household, recipient IDs, or store-specific integrations in the skill.

---

## SKILL-07 — Scenario coverage is prose-only and not executable

**Priority:** P1

`scenarios.md` is useful but manually reviewed. It does not prove that published MCP schemas, service behavior, and skill instructions still agree.

### Recommendation

Turn the scenario matrix into machine-readable fixtures (JSON/YAML) or tests that validate:

- every referenced tool exists,
- every argument and enum exists in the published schema,
- read-before-write prerequisites are represented,
- uncertain mutations are not retried,
- duplicate/update/alias/feedback flows match stable service results,
- both Hermes and OpenClaw bundles contain the required workflow rules.

Agent-output wording does not need brittle exact-string tests; validate selected tool sequences, arguments, and safety invariants.

---

# Recommended MCP target surface

## Core interactive tools — recommended for the next release

| Tool | Status | Purpose |
| --- | --- | --- |
| `grocery_add` | Enhance | Duplicate-safe single-item add with structured outcome. |
| `grocery_add_many` | Add | Atomic multi-item add in user order. |
| `grocery_update` | Add | Set/increment quantity and set/clear note on one pending item. |
| `grocery_remove` | Fix service guard | Remove only a pending item with stale-state protection. |
| `grocery_list` | Keep | List by status; pending by default. |
| `get_product` | Fix schema | Exact ID or exact name/alias lookup. |
| `search_products` | Add | Bounded deterministic candidate discovery. |
| `product_add_alias` | Add | Explicitly teach one alias for one confirmed product. |
| `get_inventory` | Keep | Estimate one product’s current state. |
| `list_inventory_events` | Add | Read bounded product/event history. |
| `record_purchase` | Keep | Record explicit purchase/restock outside list completion. |
| `record_stock_signal` | Keep | Record direct stock observations. |
| `complete_grocery_purchase` | Enhance | Complete selected pending items with optional actual measurements. |
| `get_low_stock_predictions` | Keep | Return actionable recommendations. |
| `record_prediction_feedback` | Add | Accept, reject, or correct a specific prediction. |
| `get_household_context` | Add, read-only | Verify/explain prediction context. |
| `get_capabilities` | Add or replace with standard metadata | Verify contract/skill compatibility. |

This target has **17 tools** if `get_capabilities` is implemented as a tool. It has **16 tools** if equivalent standard MCP metadata is reliable and validated.

## Intentionally excluded from the initial agent surface

Keep these REST/operator-only until separately designed:

- deleting or merging canonical products,
- arbitrary inventory-event creation,
- household configuration mutations,
- statistics recalculation,
- prediction-policy administration,
- database/maintenance operations,
- online grocery-store catalog/cart/checkout operations.

The principle is: expose normal household conversation, not every administrative REST endpoint.

---

# Recommended implementation phases

## Phase 1 — Make the current MCP trustworthy

1. Fix `get_product` published schema (MCP-01).
2. Replace `hermes_whatsapp` with generic MCP provenance (MCP-12).
3. Guard `grocery_remove` so only pending items transition to removed.
4. Add live `initialize` + `tools/list` + schema regression tests.
5. Reconcile docs with actual auto-create behavior (SKILL-01).

## Phase 2 — Complete grocery-list conversation

1. Implement duplicate-safe `grocery_add` (MCP-02).
2. Implement REST/domain support and `grocery_update` (MCP-03).
3. Implement atomic `grocery_add_many` (MCP-08).
4. Enhance completion with optional actual measurements (MCP-09).
5. Update both platform skill workflows and scenarios.

## Phase 3 — Product discovery and learning loop

1. Add `search_products` (MCP-04).
2. Add controlled `product_add_alias` (MCP-05).
3. Add `list_inventory_events` (MCP-06).
4. Add `record_prediction_feedback` (MCP-07).
5. Add read-only `get_household_context` (MCP-10).

## Phase 4 — Make third-party installation reliable

1. Define contract/version metadata (MCP-11, SKILL-05).
2. Split shared workflows from Hermes/OpenClaw adapters (SKILL-03).
3. Add repository-owned install/probe tooling (SKILL-04).
4. Convert scenarios into executable contract tests (SKILL-07).
5. Publish upgrade and rollback instructions.

---

# Cross-cutting service requirements

The missing MCP tools should not be implemented as thin wrappers around unsafe service methods. The domain layer must first provide:

- atomic state transitions,
- optimistic concurrency where users edit a prior snapshot,
- stable machine-readable domain error codes,
- idempotency or explicit conflict behavior,
- generic trusted provenance,
- privacy-safe operational logs,
- no automatic retry after uncertain write outcomes,
- transaction boundaries spanning product creation, grocery mutation, and inventory events where required.

Every MCP write tool should return a complete structured result sufficient for the skill to summarize success without rereading or inventing state.

---

# Testing and CI requirements

## MCP contract tests

- Start the built application with PostgreSQL.
- Authenticate through real Streamable HTTP MCP.
- Assert every intended tool name.
- Inspect every published input and output schema.
- Assert that every argument-taking tool has non-empty properties and documented required fields.
- Execute safe read tools against real persistence.
- Execute writes only in an isolated test database and verify rollback/cleanup.

## Domain and concurrency tests

- Concurrent duplicate adds.
- Concurrent quantity increments.
- Stale update versus purchase/removal.
- Alias conflicts across products.
- Repeated prediction feedback.
- Multi-item atomic add failure.
- Completion with same and conflicting units.

## Skill contract tests

- Tool table equals `tools/list`.
- Tool arguments and enum values match published schemas.
- Every mutation has ambiguous, domain-failure, and uncertain-transport scenarios.
- Hermes-only scheduling semantics do not leak into OpenClaw instructions.
- Platform bundles are generated from or validated against one canonical workflow source.
- Skill/MCP incompatibility fails during installation rather than during a household mutation.

---

# Definition of done for a future installer

A person cloning this repository should be able to:

1. deploy the service,
2. configure a bearer token outside the repo,
3. run one probe that verifies health, MCP discovery, schemas, and contract compatibility,
4. install either the Hermes or OpenClaw skill bundle,
5. confirm the intended household context with read-only calls,
6. run a read-only grocery-list smoke test,
7. opt in explicitly to an isolated write test,
8. receive a clear failure if their deployed server and installed skill do not match.

No step should require copying undocumented local patches from an existing Hermes installation.
