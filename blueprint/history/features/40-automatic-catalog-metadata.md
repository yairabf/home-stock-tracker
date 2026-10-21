# Feature: Automatic catalog metadata and unit defaults

**From build-plan:** feature 40
**Status:** verified

## Goal

Complete the existing OpenAI identity and JEV metadata pipeline. Clients supply original names; the service selects catalog metadata and defaults unresolved measurement units to `item` without routine metadata questions.

## In scope

Standard unit choices alongside catalog units; generic unit fallback in assisted catalog preparation; distinct fallback provenance; all three assisted operations; generated Hermes/OpenClaw guidance and scenarios.

## Out of scope

Numeric quantity inference, package-size inference, schema migrations, bulk catalog changes, provider rollout, deployment, commits and merges. Purchase and stock quantities remain explicit. Unknown optional category/type/perishability remains null.

## Build loop

Implement the approved plan in small tested steps and present the final diff for review. No checkpoint commits.

## Build steps

- [x] Standard JEV unit choices. Done when sparse catalogs still offer all seed units, normalized duplicates retain catalog labels, and bounds remain enforced.
- [x] Assisted unit fallback. Done when absent/rejected/unavailable unit inference produces `item` with distinct policy provenance while preserving supplied/stored metadata and identity failures.
- [x] Cross-operation verification. Done when grocery, purchase and stock flows persist enrichment and preserve replay and stock-unit compatibility.
- [x] Agent guidance and final gates. Done when generated bundles explain server-owned metadata/defaults and focused checks plus npm run verify pass.

## Files / areas

Product choice vocabulary; assisted preparation and catalog writer; shared agent workflow/scenarios and generated bundles; focused unit and PostgreSQL integration tests.

## Data / contracts

No public API or database shape changes. Use existing typicalUnit and optional metadata. Internal fallback provenance is separate from model acceptance and persisted transactionally. Preserve transaction/replay/identity conflict checks. Existing stock units take precedence over catalog fallback; never convert quantities.

## Testing

Jest for vocabulary merge/bounds, accepted JEV metadata, fallback outcomes, explicit metadata and unknown identity. PostgreSQL assisted grocery/stock/writer tests for persistence, unit compatibility and replay. npm run contract:check and npm run verify as final gates. Update graph with graphify update . after code changes.

## Notes for the AI

Use existing injected provider selection; retain the OpenAI default and JEV opt-in until qualifying rollout. No new classifier pipeline. Generic item implies no weight or volume. Classifier deadlines still bound the whole operation; exhausted request deadlines do not authorize writes. Pre-existing graph changes belong to the user.

## Verification evidence

- Focused unit checks: 170 passed.
- npm run verify: 137 suites, 2,110 tests passed; production build passed.
- npm run contract:check: 136 executable scenarios validated, 86 tests passed; generated bundles current.
- Isolated PostgreSQL assisted writer/grocery/stock/REST/MCP: 4 suites, 48 tests passed. Includes configured JEV adapter following OpenAI identity, policy provenance persistence and rollback, existing stock-unit precedence and replay.
- git diff --check passed; graphify update . completed.
- Local branch: feature/automatic-catalog-metadata. No commit, merge, push or deployment. JEV live qualification and enablement remain 38f/38g.

## Review notes

Unit vocabulary is product-unit-v2. Agent skill is 2.1.1 with unchanged MCP 2.1.0 wire contract. Default provenance is transactionally stored in the existing inference-log table as a policy with no confidence, never as a successful JEV classification. No migration was added.

## Release verification (2026-10-21)

The user authorized integration/end-to-end testing, merge to main, and image
publication. Their server uses Watchtower to pull the new image; no SSH update
is required. No provider configuration change is part of this release.

Final gates rerun successfully: npm run verify (137 suites, 2,110 tests and build),
npm run contract:check (136 scenarios, 86 tests), and isolated PostgreSQL
assisted writer/grocery/stock/transport end-to-end tests (48 tests).

Bounded live JEV smoke test used three synthetic product names and the configured
jev-1.13.0 model. All categories, types and perishability answers matched the
fixtures. Rice accepted kg; liquid detergent accepted liter. Milk's unit abstained
(unknown), so the diagnostic's strict liter expectation did not pass. Replaying
that captured response through AssistedCatalogPreparation correctly persisted
metadata preparation with the generic item fallback; other units remained kg
and liter. This is expected fallback behavior, not evidence that milk always
classifies to liters. No threshold was lowered and no model response was changed.
Live OpenAI naming was not tested because a local key was unavailable. Its
integration and provider sequencing were tested with controlled responses.
These diagnostics do not replace the independent qualification gates in 38f/38g.

Root documentation, API reference, integration guide, both platform READMEs,
shared/generated skills and the JEV trial guide describe the behavior. Skill
bundle 2.1.1 retains MCP contract 2.1.0. Watchtower does not replace agent skills
installed separately; reinstall the complete platform bundle from this release.

## How to try

Send apply_household_items with operation grocery_add, a fresh UUID requestId,
and items containing only productName, e.g. Tnuva 3% milk. Inspect the returned
catalog identity and grocery receipt. Do not ask for category or unit first.
For purchase/stock_set, supply an explicit positive quantity. Unresolved units
use item, established stock units remain unchanged, and an identical requestId
replay returns the original receipt without new writes.
