# Feature: Hermes grocery conversations

**From build-plan:** feature 14
**Status:** complete

## Completion record

- **Completed:** 2026-08-28
- **Delivered:** Added atomic multi-product grocery completion and exposed it as
  the ninth MCP tool, `complete_grocery_purchase`. Updated the portable Hermes
  skill to sequence multi-item additions, grocery reads, and safe "everything
  except" purchase conversations using exact pending-item matches and one
  inclusive batch mutation.
- **Changed areas:** Added the completion contract under `src/inventory/types/`;
  extended `InventoryService` with validation, deterministic grouping, guarded
  transactional writes, and focused Jest coverage; extended the MCP factory and
  real HTTP protocol tests; updated the Hermes skill, installation guide, and
  conversation scenario matrix; refreshed `graphify-out/`.
- **Verification:** `npm run test -- --runInBand` passed 23 suites and 272 tests;
  `npm run test:e2e -- --runInBand` passed 7 suites and 45 tests;
  `npm run build` passed; `git diff --check` passed. A real Streamable HTTP MCP
  client discovered all nine tools and invoked `complete_grocery_purchase` with
  adapter-owned provenance. The manual review path verifies that Hermes first
  reads the pending list, uniquely matches exceptions, and proposes one
  inclusive completion call; no live Hermes runtime was available here.
- **Deviations:** The original spec allowed the contract under either
  `src/inventory/dto/` or `src/inventory/types/`; the implementation selected
  `src/inventory/types/` because it is an internal service contract and MCP owns
  transport validation. No material scope deviations.

## Goal

Support complete, safe Hermes grocery conversations over the existing MCP
surface, including multi-item requests and the compound purchase flow "I bought
everything except toilet paper." Hermes should translate natural requests into
validated tool sequences and return concise summaries without moving inventory
business rules into the agent skill.

## In scope

- Add an atomic, multi-product domain operation that completes an explicit set
  of pending grocery-item IDs and records one `PURCHASED` inventory event for
  each distinct product represented by those items.
- Expose that operation as a strict MCP tool for completing selected grocery
  items from a shopping trip. Hermes supplies only IDs returned by the current
  pending `grocery_list`; the service derives product IDs and fixes the source.
- Teach Hermes to handle clear multi-item grocery additions, list and
  recommendation questions, and compound purchase completion such as
  "everything except X."
- Define deterministic selection, confirmation, ambiguity, empty-result,
  partial-list, concurrent-change, and uncertain-mutation behavior for these
  conversations.
- Extend the scenario matrix and automated MCP coverage for the new workflow,
  while retaining all existing single-intent behavior.

## Out of scope

- WhatsApp transport setup, webhook handling, message delivery, or changes to a
  live external Hermes installation. This repository owns a portable Hermes
  skill, not the Hermes runtime.
- Scheduled prediction scans or proactive messages (feature 15).
- REST or MCP authentication (feature 16), health checks and logging (feature
  17), and deployment configuration (feature 18).
- Receipt parsing, barcode ingestion, fuzzy product matching, or product
  creation during purchase completion.
- Inferring quantities, units, item identity, or purchase status from ambiguous
  language.
- Treating recommendations as automatic grocery-list mutations. Hermes may add
  an item only after an explicit user request or confirmation.
- Changing or removing the existing single-product REST partial-completion
  endpoint. It remains backward-compatible.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - Lock the multi-product completion contract** - add focused
      request and response types for completing an explicit, non-empty set of
      grocery-item IDs, returning the created purchase events and completed items.
      Keep this internal domain boundary independent of MCP and leave the existing
      single-product DTOs unchanged. _Done when:_ the contract represents an
      inclusive list only, defines deterministic event and item ordering, exposes
      no product ID selector, reuses the existing response DTO shapes, and
      `npm run build` passes without changing runtime behavior.
- [x] **Step 2 - Complete selected grocery items atomically** - add an
      `InventoryService` operation that loads all referenced items with their
      products, requires every unique item to exist and still be pending and
      unlinked, groups them by product, creates one `PURCHASED` event per product,
      and links every item in one Prisma transaction. _Done when:_ unit tests prove
      mixed-product completion, one event per product, exact event-to-item links,
      empty/duplicate/unknown/already-resolved rejection before writes, transaction
      rollback on a concurrent state change, server-owned source propagation, and
      no change to existing purchase or partial-purchase behavior.
- [x] **Step 3 - Expose the compound completion MCP tool** - register
      `complete_grocery_purchase` with a strict UUID-array schema, delegate to the
      new domain operation with source fixed to `hermes_mcp`, and return matching
      text and structured output. _Done when:_ MCP tests discover the ninth tool,
      prove exact delegation and the stable output shape for multiple products,
      reject empty, duplicate, malformed, or extra inputs before service
      invocation, sanitize unexpected failures, and a real MCP client can invoke
      the tool successfully.
- [x] **Step 4 - Teach the Hermes conversation workflows** - revise the portable
      skill so one clear conversation may sequence multiple tools when required:
      multiple explicit `grocery_add` calls for a multi-item add; direct reads for
      grocery lists and recommendations; and `grocery_list` followed by one
      `complete_grocery_purchase` call for an explicit shopping result. _Done when:_
      the instructions deterministically exclude named exceptions by exact pending
      `productName`, ask when an exception has zero or multiple matches, never pass
      omitted items to the mutation, never retry an uncertain mutation, summarize
      only confirmed results, and preserve all existing identifier and mutation
      safeguards.
- [x] **Step 5 - Exercise the full conversation matrix** - expand the scenario
      matrix and integration evidence for multi-item additions, empty lists,
      "everything," "everything except X," multiple exceptions, unmatched and
      duplicate names, all-items-omitted, a list that changes before completion,
      domain rejection, and uncertain transport failure. _Done when:_ every expected
      sequence uses current tool names and schemas, no scenario silently mutates an
      ambiguous target, the existing single-intent cases still hold, and
      `npm run test -- --runInBand`, `npm run test:e2e -- --runInBand`, and
      `npm run build` pass.

## Files / areas

- `src/inventory/types/` - internal request and response
  contract for atomic multi-product grocery completion.
- `src/inventory/inventory.service.ts` and its colocated test - transactional
  validation, grouping, event creation, and item linking.
- `src/mcp/mcp-server.factory.ts` and its colocated test - ninth tool schema,
  delegation, output mapping, and safe errors.
- `test/` - real MCP protocol coverage for the compound completion call.
- `integrations/hermes/home-stock-tracker/SKILL.md` - conversational sequencing,
  exception matching, mutation safeguards, and concise response rules.
- `integrations/hermes/home-stock-tracker/scenarios.md` - manual conversation
  review matrix.
- `integrations/hermes/home-stock-tracker/README.md` - update the discoverable
  tool prerequisite and smoke path if needed.

## Data / contracts

- No Prisma schema or migration changes.
- Load-bearing domain input: `{ groceryItemIds: string[]; source: string }`.
  `groceryItemIds` is an inclusive snapshot of the items the user said were
  purchased. The operation does not accept omitted IDs or a product ID.
- Load-bearing MCP input:
  `complete_grocery_purchase({ groceryItemIds: UUID[] })`. The array must be
  non-empty and contain unique IDs. The adapter owns `source: "hermes_mcp"`.
- Load-bearing output:
  `{ events: InventoryEventResponseDto[]; completedItems: GroceryItemResponseDto[] }`.
  Events are ordered deterministically by the first occurrence of their product
  in `groceryItemIds`; completed items retain request order. Each completed item
  links to the event for its own product.
- The batch is all-or-nothing. Unknown, removed, purchased, already-linked, or
  concurrently changed items reject the operation without committing any event
  or item update. The response never reports partial success.
- Hermes implements "everything except X" by reading the current pending list,
  matching each named exception exactly against returned `productName` values,
  and sending only the remaining IDs. If no IDs remain, Hermes reports that
  nothing was recorded and does not call the mutation.
- Inclusive IDs are intentional: an item added after `grocery_list` must not be
  swept into the completed purchase. A stale selected item causes safe
  all-or-nothing rejection and a fresh read, not a blind mutation retry.
- Existing MCP tools, REST routes, Prisma models, and single-product completion
  contracts remain backward-compatible.

## Testing

- Jest service tests cover mixed products, grouping and deterministic order,
  exact event links, empty/duplicate/unknown/resolved IDs, transactional
  rollback, and concurrent status changes.
- MCP unit tests cover strict input validation, fixed source, delegation,
  serialization, expected domain errors, and sanitized unexpected errors.
- The existing Supertest/MCP client suite proves discovery and one real compound
  invocation over `/mcp` without regressing the REST prefix or disabled mode.
- The Hermes scenario matrix is manual evidence because natural-language
  routing runs in the external Hermes agent, which is not installed here.
- There is no configured `Verify` command. Each logic-bearing step runs
  `npm run test -- --runInBand` and `npm run build`; final integration evidence
  also runs `npm run test:e2e -- --runInBand`.

## Notes for the AI

- Keep natural-language interpretation and response wording in the Hermes skill.
  Keep validation, product derivation, transactional writes, and event semantics
  in `InventoryService`.
- Use the existing `GroceryItemResponseDto` and `InventoryEventResponseDto`
  shapes. Do not modify generated Prisma files.
- Preserve input order explicitly rather than relying on Prisma `findMany`
  ordering. Group events deterministically so protocol tests are stable.
- Validate every selected item before creating events. Inside the transaction,
  use guarded writes or equivalent checks so a stale pending item cannot produce
  a partially linked purchase.
- Do not implement the workflow as repeated `record_purchase`,
  `grocery_remove`, or single-product partial-completion calls. Those sequences
  cannot provide atomic mixed-product completion and can double-record events.
- Exact exception matching is against the pending list returned in the current
  interaction. Hermes asks a focused question when a name maps to zero or more
  than one pending item; it never guesses using fuzzy similarity.
- A multi-item explicit request may perform multiple mutations, but after an
  uncertain result Hermes stops and reports which later operations were not
  attempted. It never retries a mutation automatically.
- Keep feature 15's scheduler and proactive delivery concerns out of this spec.
