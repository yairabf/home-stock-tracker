# Feature: Confidence-aware expiration recommendations

**From build-plan:** feature 19c, under expiration tracking item 19
**Status:** verified
**Planned branch:** `feature/expiring-soon-recommendations`

## Goal

When a household member asks for groceries or current inventory, append concise
advice about products that may expire soon or may already have expired. Derive it
from existing purchase dates, explicit expiry records, AI-inferred shelf-life
policies, and materialized consumption/stock estimates. Preserve committed
grocery items, low-stock suggestions, and inventory as distinct information.

## Planning and confirmed decisions

- Grillme ran before loading the feature plan. The user confirmed the design
  tree through Q1-Q15 before this spec was drafted.
- Add separate `About to expire` and `Possibly expired` groups at the end of
  both grocery-list and household-inventory replies. Omit empty groups.
- The upcoming window is the existing seven-day inclusive status window.
  Include policy-derived dates with an explicit estimate label; use existing
  estimates and persisted AI-derived policy, never an LLM call per read.
- One recommendation per product uses the earliest relevant purchase-event
  expiry date. Even after a newer purchase, an older potentially expired event
  remains a possibility. Say to check which batch remains; do not assert it is
  present. Suggest using or checking the item soon and show the date.
- Require a materialized stock projection that is not `probably_out` and does
  not have a numeric estimated quantity at or below zero. An `uncertain` state
  with unknown quantity may appear with an uncertainty label. No projection
  means no recommendation.
- Zero-stock products stay out of expiry advice. The existing low-stock path
  may suggest adding them to groceries, but this read never writes a list item.
  Do not add low-stock suggestions to the inventory reply as part of 19c.
- The user confirmed this shared understanding. No new product direction or
  build-plan split is needed; item 19c is already a bounded sub-feature.

## In scope

- A separate, read-only, product-level expiration-recommendation service and
  REST/MCP read contracts, built from existing event and projection data.
- Both reply paths call the new read and append its two groups after their
  current sections. Preserve grocery category grouping and the current versus
  uncertain inventory grouping.
- Explicit source, numerical confidence, and a batch-presence caveat in the
  recommendation contract and natural-language rendering.
- Regression tests for eligibility, ordering, confidence, safety, contract
  versioning, and Hermes/OpenClaw conversation routing.

## Out of scope

- New expiry storage, per-batch consumption allocation, exact remaining-batch
  claims, a new LLM call, changes to the daily estimation pipeline, or a
  database migration.
- Changes to the existing `grocery_list`, `list_inventory`,
  `list_expiration_status`, or low-stock response schemas or selection logic.
- Automated grocery addition, proactive notifications, retailer actions,
  product-specific automation policies (feature 21), or a dashboard.

## Build loop

Build one reviewable step at a time. Before each step, describe its scope; after
it, show the diff and the observable evidence. Wait for the user's step review
before proceeding. Checkpoint commits are optional; `$complete` owns archival.

## Build steps

- [x] **Step 1 - Pure recommendation selection.** Define the domain input and
  output types and a deterministic selector from 19b expiry evaluations plus
  per-product stock projections and policy confidence. Test explicit and
  policy-derived dates, seven-day boundary, expired versus upcoming, no
  projection, zero/out stock, uncertain stock, multiple purchases, and stable
  earliest-date ordering. *Done when:* focused unit tests prove one correctly
  classified recommendation per eligible product without writes or LLM calls.
- [x] **Step 2 - Service and REST read.** Query existing purchase/restock events,
  exact batch expirations, canonical names/categories, shelf-life policy
  confidence, and stock projections through an injected service with bounded
  selects and no per-event database query. Reuse 19b's date/status evaluator.
  Expose `GET /inventory/expiration/recommendations` as a read-only endpoint.
  *Done when:* service/controller tests show the declared response on empty,
  mixed, and stale-event histories, with no mutation or extra model call;
  existing reads remain unchanged.
- [x] **Step 3 - Additive MCP contract.** Add read-only
  `get_expiration_recommendations({})` backed by the same service. Capture a new
  immutable tool-discovery fixture and bump the MCP contract from 1.7.1 to
  1.8.0 under the repository's additive-version rule. *Done when:* discovered
  input/output schemas match REST data, historical fixtures remain untouched,
  and factory/contract tests pass.
- [x] **Step 4 - Agent conversation guidance.** Update the shared workflow and
  executable scenarios so grocery replies call `grocery_list`, the existing
  low-stock read, and the new expiry read; inventory replies call
  `list_inventory` and the expiry read. Append populated expiry groups after
  existing categorized sections, preserve read order, omit empty groups, and
  label source/confidence/batch uncertainty. On expiry-read failure, show the
  successful grocery/inventory result and say expiry advice is unavailable,
  not that nothing is expiring. Regenerate complete Hermes and OpenClaw bundles
  and bump the skill version compatibly. *Done when:* scenario and generated
  skill contract tests prove both paths and prevent a read from causing a
  grocery mutation.
- [x] **Step 5 - Integrated proof and final gates.** Exercise the new REST and
  MCP reads against an isolated PostgreSQL fixture containing multiple events
  for one product, a depleted product, an uncertain product, an explicit batch
  date, and a policy-derived date. Verify no database changes from the reads;
  run `npm run contract:check`, `npm run verify`, and `graphify update .` after
  code changes. Review the generated bundle with the user. *Done when:* one
  product entry uses the earliest eligible event, both groups are correct,
  existing low-stock output is unchanged, and all named gates pass.

## Files / areas

- `src/inventory/expiration-status.ts`, a focused recommendation selector and
  service, `src/inventory/dto/`, `src/inventory/inventory.controller.ts`, and
  `src/inventory/inventory.module.ts`.
- `src/mcp/mcp-server.factory.ts`, its tests, and new immutable discovery
  fixtures under `integrations/shared/home-stock-tracker/contracts/`.
- `integrations/shared/home-stock-tracker/workflow.md`, executable scenarios,
  release contract, generated `integrations/hermes/home-stock-tracker/` and
  `integrations/openclaw/home-stock-tracker/` bundles, and matching tests.
- Isolated integration tests under `test/` if the existing harness can exercise
  REST and MCP reads without changing application code.

## Data / contracts

- No schema migration. This read uses `ExpirationBatch` per purchase/restock
  event, `ProductShelfLifePolicy`, and one `StockProjection` per product.
- REST and MCP return the same additive shape:
  `{ evaluatedAt, expiringSoon: ExpirationRecommendation[],
  possiblyExpired: ExpirationRecommendation[] }`.
- Each `ExpirationRecommendation` contains `productId`, `productName`,
  `category`, `purchaseEventId`, `purchasedAt`, `expiresAt`, `expirySource`
  (`explicit` or `shelf_life_policy`), `stockConfidence`,
  `stockEvaluatedAt`, `expiryConfidence`, `confidenceScore`, and
  `batchPresenceUnconfirmed: true`.
  Dates are ISO timestamps on the wire; scores are finite numbers in `[0,1]`.
- `expiryConfidence` is 1 for an explicit date (confidence in the recorded
  date, not in batch presence) and the persisted policy confidence for an
  inferred date. `confidenceScore` is the lesser of expiry and stock confidence,
  without implying that the batch itself is confirmed. Skip and log an
  invalid/nonfinite candidate rather than emit an invalid contract or fail the
  entire read. The user-facing label states
  `recorded expiry` or `estimated from shelf life`, never `definitely on hand`.
- Consider only 19b `expired` and `expiring_soon` statuses after excluding
  depleted products. Deduplicate by `productId` within each response, choosing
  the earliest `expiresAt` across eligible events. A product appears in only
  one group: the earliest event decides its group. Sort by `expiresAt`, then
  canonical name, then product ID for deterministic results.
- Preserve the underlying event ID and purchase date so a client can explain
  that a newer purchase does not prove the older batch remains. Do not emit a
  quantity or imply batch allocation. The existing raw batch-status read stays
  available for explicit history questions.

## Testing

- Jest selector tests: empty/unknown/nonperishable evidence; exact seven-day
  boundary; expired and upcoming classifications; explicit date overriding
  policy; old and new events for one product; out/zero and uncertain estimates;
  confidence propagation; deterministic ties.
- Service/controller/MCP tests: no writes or LLM calls, identical REST/MCP
  recommendation data, strict empty MCP input, read-only annotations, and old
  contracts unchanged.
- Agent scenario tests: both request phrasings, all three grocery reads, two
  inventory reads, two separated expiry groups, no empty headings, failure
  disclosure, no automatic grocery write, and low-stock behavior preserved.
- `npm run contract:check`, `npm run verify`, focused isolated PostgreSQL
  integration coverage, and a manual Hermes try path after installation. The
  local tests prove contract and domain behavior; live Hermes wording needs a
  real conversation before claiming its deployed behavior.

## Notes for the AI

- Reuse 19b status semantics and 19a explicit batch link; do not reinterpret
  individual purchases as confirmed remaining stock. Daily stock projection
  already incorporates consumption history and persisted AI shelf-life policy.
- Keep domain selection in NestJS, transport adapters thin, and WhatsApp
  formatting only in agent guidance. Preserve the exact returned product
  category when grouping existing lists.
- A low-confidence or uncertain on-hand estimate may be shown in an on-demand
  reply only with a clear caveat and its evaluation date; no proactive push is
  introduced. Existing daily materialization may classify a policy-expired
  product as out of stock, so a `possiblyExpired` group can be empty even when
  raw 19b batch status contains expired events. The zero-stock exclusion wins.
- Current `list_inventory` omits depleted products. Existing grocery flow
  already separates committed items from low-stock suggestions. Do not alter
  either contract to attach expiry fields.
- The main checkout is clean apart from workflow activity and Graphify query
  stamps. A separate earlier feature worktree contains unrelated uncommitted
  changes; do not merge or stage them into 19c.
