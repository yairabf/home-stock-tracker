# Feature: Hermes inventory skill

**From build-plan:** feature 13
**Status:** complete

## Completion record

- **Completed:** 2026-08-27
- **Delivered:** Added a portable Hermes Agent skill that maps clear household
  grocery and inventory requests to all eight Home Stock Tracker MCP tools, with
  identifier-resolution sequences, mutation safeguards, ambiguity and failure
  handling, and a 24-case review matrix. Extended `get_product` with an exclusive
  ID-or-exact-name selector backed by non-mutating canonical and alias lookup.
- **Changed areas:** Added the Hermes bundle under
  `integrations/hermes/home-stock-tracker/`; extended `ProductService` and the MCP
  adapter for read-only product-name resolution; expanded their Jest coverage;
  and refreshed `graphify-out/`.
- **Verification:** `npm run test -- --runInBand` passed 23 suites and 258 tests;
  `npm run test:e2e -- --runInBand` passed 7 suites and 45 tests;
  `npm run build` passed; `git diff --check` passed. The scenario review covered
  every registered MCP tool, exact schema arguments and event enums, empty and
  error results, ambiguity, uncertain mutation outcomes, and the deferred
  compound-purchase flow. The README provides a read-only live Hermes smoke
  path, but no live Hermes instance was available in this workspace.
- **Deviations:** None.

## Goal

Provide a portable Hermes skill that teaches the agent how to select and sequence
the inventory service's eight MCP tools for clear household inventory requests.
Close the existing name-to-ID lookup gap so Hermes can resolve spoken product
names without creating products as a side effect.

## In scope

- Add a read-only exact canonical-name or alias lookup in `ProductService`.
- Let `get_product` accept exactly one of `id` or `productName`, preserving its
  existing output contract.
- Add a repository-owned Hermes skill with tool-selection guidance, required
  identifier-resolution sequences, ambiguity handling, safe mutation rules,
  error handling, and concise mapping examples.
- Define when Hermes may call a read tool immediately, when it must resolve an
  identifier first, and when it must ask the user instead of guessing.
- Add a scenario matrix covering each tool, empty results, malformed or unknown
  products, ambiguous intent, and failed mutations.
- Document how to install or copy the skill into Hermes without coupling the
  NestJS service to Hermes.

## Out of scope

- Full WhatsApp conversation orchestration, response copy, compound utterances,
  and flows such as "I bought everything except toilet paper" (feature 14).
- Scheduled checks or proactive notifications (feature 15).
- MCP authentication, networking, deployment, or Hermes runtime configuration
  (features 16 and 18).
- Fuzzy product matching, automatic disambiguation, or new product business
  rules. Name lookup is normalized but exact against canonical names and aliases.
- Adding, removing, or changing the meaning of inventory domain operations.
- Installing the skill into a live Hermes instance or changing an external
  Hermes repository.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - Add non-mutating product-name resolution** - add a
  `ProductService` lookup that normalizes a nonblank name and finds an exact
  canonical-name or alias match without classification, alias creation, or
  product creation. Extend `get_product` to accept exactly one selector: `id`
  or `productName`. *Done when:* unit and MCP tests prove canonical and alias
  matches return the existing product shape, unknown and blank names return
  safe tool errors, supplying neither or both selectors is rejected before
  service invocation, ID lookup remains backward-compatible, no write or LLM
  path runs, and `npm run test` plus `npm run build` pass.
- [x] **Step 2 - Author the Hermes tool-selection skill** - create the portable
  Hermes skill and installation note. Define the responsibility boundary,
  tool-selection matrix, required arguments, name-to-ID lookup flow, read versus
  mutation behavior, confirmation and ambiguity rules, safe error handling, and
  single-intent examples. *Done when:* every one of the eight MCP tools appears
  in the matrix with a clear trigger and prohibited use, every UUID-requiring
  flow begins with `get_product({ productName })` unless an ID is already known,
  mutations never invent quantities, units, event types, or IDs, and the skill
  contains no backend business rules or WhatsApp-specific implementation.
- [x] **Step 3 - Add and exercise the mapping scenario matrix** - add a compact
  set of representative prompts with expected tool calls, arguments, sequencing,
  ask-user outcomes, and no-call outcomes, then manually evaluate the finished
  skill against it. *Done when:* the matrix covers all eight tools plus empty
  lists, unknown products, ambiguous stock wording, malformed quantities,
  tool failures, and unsupported compound purchase completion; each expected
  sequence follows the published MCP schemas, unsupported feature-14 cases are
  deferred rather than approximated, and `npm run test`, `npm run test:e2e`,
  and `npm run build` pass.

## Files / areas

- `src/product/product.service.ts` and its colocated test - read-only normalized
  product lookup.
- `src/mcp/mcp-server.factory.ts` and its colocated test - `get_product`
  selector schema and delegation.
- `integrations/hermes/home-stock-tracker/SKILL.md` - portable Hermes skill owned
  by this repository.
- `integrations/hermes/home-stock-tracker/README.md` - installation/configuration
  boundary, without secrets or live deployment changes.
- `integrations/hermes/home-stock-tracker/scenarios.md` - reviewable mapping
  examples and manual evaluation evidence.

## Data / contracts

- No Prisma schema or migration changes.
- Load-bearing: `ProductService.findByExactOrAliasName(rawName: string)` performs
  normalized, case-insensitive exact canonical/alias lookup and throws a safe
  validation or not-found exception. It never calls the classifier and never
  creates or updates a product.
- Load-bearing: `get_product` accepts the exclusive union `{ id: UUID }` or
  `{ productName: nonblank string }`; both and neither are invalid. Its
  `ProductResponseDto` output is unchanged.
- All other MCP tool schemas remain unchanged. Hermes resolves a spoken product
  name with `get_product({ productName })`, then passes the returned `id` to
  `get_inventory`, `record_purchase`, or `record_stock_signal`.
- `grocery_remove` continues to require a grocery-item ID, so Hermes first calls
  `grocery_list` and selects an exact listed item. It asks when zero or multiple
  plausible items remain.
- The skill is an instruction artifact only. The NestJS application does not
  import it and remains presentation-agnostic.

## Testing

- Jest covers normalized canonical/alias lookup, blank and unknown names, no
  persistence mutation or classifier call, the exclusive selector schema, ID
  backward compatibility, and safe MCP errors.
- Existing MCP and REST suites guard all eight tool contracts against regression.
- The scenario matrix is reviewed manually because prompt-to-tool behavior lives
  in the external Hermes agent, not an executable runtime in this repository.
- There is no configured `Verify` command. Logic-bearing work runs
  `npm run test` and `npm run build`; final integration evidence also runs
  `npm run test:e2e`.

## Notes for the AI

- Keep the Hermes artifact under `integrations/`; do not place it in `.agents/`,
  `.claude/`, or `.codex/`, which contain the repository's development workflow
  skills rather than deployable product integration material.
- Reuse `normalizeProductName` and the existing exact canonical/alias semantics.
  Do not call `findOrCreateByExactOrAliasMatch` for a read operation.
- Keep all business decisions, validation, state, and prediction logic in the
  inventory service. The Hermes skill only selects tools, sequences prerequisite
  lookups, preserves user-supplied facts, and summarizes structured outcomes.
- Reads may run without confirmation. Mutations may run for clear, explicit
  single intents, but ambiguous targets or missing material facts require a
  question. Never retry a mutation blindly after an uncertain transport result.
- Treat `get_inventory` as an estimate, not an exact count. Treat an empty
  recommendation list as a valid result, and do not turn uncertain predictions
  into recommendations.
- Examples must use current enum values and exact MCP argument names. Do not
  imply that `record_purchase` completes grocery-list items; feature 14 owns
  that orchestration.
- Do not modify generated Prisma files, add Hermes dependencies, or include
  credentials and endpoint secrets in the repository.
