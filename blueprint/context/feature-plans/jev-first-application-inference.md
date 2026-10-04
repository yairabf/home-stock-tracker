# JEV-first application inference plan

Status: approved planning scope on 2026-10-04. Implementation follows the active sub-feature spec and review gates; provider rollout and deployment remain separate. "Gem" is interpreted as TypeSafe JEV from the preceding conversation, not Google Gemini.

## Goal

Use deterministic application logic whenever it has sufficient information. For work requiring a model, prefer JEV whenever the answer can be selected from validated options. Use OpenAI only for required information that cannot be represented adequately as a bounded decision. Enable both providers after the relevant integrations and evaluation pass.

## Current evidence

- Exact canonical names and saved aliases resolve without model calls. Deterministic partial search supplies candidates; optional resolution advice follows nonexact matches.
- Explicit product creation saves supplied names and metadata without invoking the classifier. The separate assisted creation path uses OpenAI classification and can generate and persist aliases.
- Product.category is a nullable string, not an enforced category vocabulary. Product type is an enum; typical unit is currently free text.
- OpenAI classification currently returns canonical name, aliases, category, unit, product type, perishability, and confidence as one generated result.
- Shelf-life inference currently uses OpenAI to produce finite days or nonperishable, plus rationale and confidence.
- JEV product-resolution and stock advisors exist, but the internal prediction engine has no application caller. The daily stock workflow independently updates projections using deterministic consumption and expiration calculations.
- Recommendations read StockProjection, so changing the internal stock advisor selector alone does not change recommendations.
- Live smoke: matching selected the correct supplied candidate; stock returned uncertain at 0.81 and was rejected by the existing 0.90 gate. These two requests prove connectivity, not rollout accuracy.

## Routing contract

| Work | Primary behavior | OpenAI use |
| --- | --- | --- |
| Normalize a name; match canonical name or saved alias | Deterministic, no model | None |
| Resolve nonexact candidates | Existing JEV advisor; retain user confirmation | None for ambiguity, no-match, or low confidence |
| Category assignment | Supplied category first; otherwise JEV chooses from versioned allowed categories plus unknown | Required new category text only when no allowed option fits |
| Product type and perishability | Supplied validated values first; otherwise JEV choices with unknown | None for uncertainty alone |
| Typical unit | Supplied valid unit first; otherwise JEV chooses from approved units plus unknown | Required unsupported unit detail only |
| Canonical name and aliases | Preserve entered canonical spelling and deterministic normalization; learn aliases through explicit confirmation | No default generation of names or aliases |
| Shelf-life policy | Explicit dates and stored policy first; JEV chooses among reviewed, applicable policies plus unknown | Generate a missing finite-days policy only when the required policy is outside the supported set |
| Stock state | Deterministic precedence, then JEV for eligible evidence | None for uncertainty or provider failure |
| Quantities, expiration arithmetic, recommendation filters and explanations | Application calculation and templates | None |

JEV unknown, low confidence, ambiguity, and transport failure are distinct outcomes. Unknown is an unsupported-task fallback only if additional generated information is necessary to complete the task. Low confidence or stock uncertainty remains uncertain; it does not automatically escalate to OpenAI. Provider failure retains deterministic results or missing metadata and records a safe diagnostic. There is no automatic dual-provider comparison in normal operation.

OpenAI fallback receives only unresolved fields and necessary context. Previously supplied or accepted fields are not regenerated. Bound fallback to one logical generation attempt per operation, within the task deadline. Account for SDK-level retries in the budget. Store provider, resolved model, task/prompt version, accepted/rejected status, usage when validated, and a local routing reason; do not log secrets or raw provider errors. Measure usage and call counts; monetary estimates require an explicit versioned price table, not hardcoded assumptions.

## Tracked build-plan feature

Feature 38 and sub-features 38a through 38e are tracked in [the build plan](../../build-plan.md). Completed feature 37 remains unchanged.

This is incremental scope; no project-plan direction change is proposed. 38a is complete; build 38b next on its own branch and spec. Each sub-feature has its own review and verification cycle.

## Implementation and acceptance details

### 38a: routing and vocabularies

Define typed outcomes for deterministic answer, accepted JEV answer, uncertainty, unsupported choice space, and unavailable provider. Extend the current two-task JEV allowlist for new adapters. Keep generation behind the existing OpenAI boundary. Define task-specific configuration and explicit startup errors for selected but incomplete provider setup. Do not switch current defaults before evaluation.

Inventory distinct stored categories and unit conventions without printing private catalog contents into logs. Propose a versioned category seed list for an empty catalog, canonical category mapping, approved units, and unknown outcomes. Keep existing labels intact until an explicit migration is approved. Bound option counts and context bytes; never silently truncate a taxonomy and treat an omitted category as nonexistent. Missing choices permit unknown or supported generation fallback.

Done when routing tests prove exact matching issues zero model calls, valid JEV answers issue zero OpenAI calls, unresolved generation calls OpenAI only for missing fields, and low confidence/failure does not silently spend on OpenAI. Existing OpenAI-only settings still work for rollback.

### 38b: product understanding

Introduce a task-specific product-understanding port and JEV adapter rather than treating JEV as a generic text generator. Classify fields independently with per-field confidence and unknown values; do not collapse missing boolean evidence into false. Reuse nullable stored fields where possible and design internal result types before implementation. Keep explicit creation behavior compatible, and offer deliberate enrichment for new/incomplete products through the assisted flow. Do not classify existing products on every read or reprocess the catalog automatically.

Audit the legacy assisted creation path that can add generated aliases. New JEV-first behavior preserves the requested name and creates no inferred aliases by default. Any existing-product alias proposal follows the existing explicit confirmation transaction. Preserve namespace uniqueness and concurrent-write handling. No hidden generation fallback restores automatic aliases.

Done when representative Hebrew/English names map to allowed categories, per-field unknowns persist safely, existing explicit metadata is preserved, category output remains compatible, alias confirmations remain required, and no provider call occurs on exact matches or list reads.

### 38c: shelf-life policies

Define a small reviewed registry of applicable finite-day policies and a nonperishable policy, with applicability facts and storage assumptions. JEV selects a policy identity; code supplies its days and rationale. Do not invent shelf-life durations by rounding a generated number into arbitrary buckets. Unknown policy can use OpenAI for required missing numeric/text details, validated against the existing schema and evidence requirements. Explicit expiration dates remain authoritative. Missing context can remain unknown instead of producing false precision.

Done when explicit/stored policy bypasses both models, known policy selection bypasses OpenAI, unsupported policy invokes a bounded validated fallback, and unavailable or invalid results leave policy missing rather than extending usable life without evidence.

### 38d: predictions and recommendations

Integrate an explicit stock-advice phase into the existing scheduled/manual evaluation workflow after deterministic materialization. Use existing relevant history guards and acceptance policy. Reuse shared candidate/advisor logic rather than running the unused prediction service and discarding its saved result. Define how accepted state and conservative confidence attach to the projection and Prediction atomically. Keep deterministic estimated quantity, recorded quantities/events, direct state signals, and expiration precedence intact.

Use a projection version or existing optimistic concurrency predicate so a purchase or manual correction during inference invalidates the stale proposal. Bound products/calls per run, isolate per-product failures, and avoid repeated calls when relevant evidence is unchanged. Inventory and recommendation GET/MCP reads remain free of inference. Recommendations use saved state/confidence, suppress products already pending on the grocery list, and keep expiration suggestions separate. This phase does not automatically send WhatsApp messages or mutate groceries.

Done when scheduled/manual evaluation exercises real Nest routing, saved accepted/rejected provenance is observable, accepted eligible advice is visible to recommendation selection, zero history makes no call, uncertain outputs remain suppressed, and concurrency tests prove newer explicit stock cannot be overwritten by stale inference.

### 38e: evaluation and enablement

Extend the existing CLI evaluation approach for category/type/unit/perishability and shelf-life selection. Review labels independently and include Hebrew, English, mixed names, unknown categories, ambiguous variants, unsupported policies, and provider failures. Freeze tuning and held-out inputs separately. Reuse the existing matching and cutoff-safe historical stock review gates; proposed thresholds are not measured accuracy. Evaluate end-to-end recommendation false positives, recall, acceptance/abstention and model-call coverage, not only raw decision accuracy.

Run focused tests, npm run verify, npm run contract:check, and affected PostgreSQL REST/MCP end-to-end suites against an isolated migrated database. Public output/tool changes require the existing versioned contract and generated bundle workflow. Additional paid evaluations need a separately specified bounded case budget; the two-case smoke authorization does not authorize an unlimited corpus run.

After evidence review, enable JEV for validated bounded tasks and retain OpenAI for generation fallback. Validate private credentials and pinned models, restart the approved runtime, then check readiness and representative flows. Keep independent task rollback to OpenAI or deterministic-only behavior and retain provenance. Deployment/remote changes require separate approval.

## Critique incorporated

- Split the work into five reviewable features rather than a single global provider switch.
- Added vocabulary/bootstrap handling because current categories and units are free text.
- Replaced whole-object classification with per-field outcomes so unknown perishability is not incorrectly stored as false.
- Included the stock projection connection and race protection; selector-only rollout would not affect recommendations.
- Distinguished unsupported tasks from valid uncertainty and provider failures to avoid unnecessary OpenAI spending.
- Included shelf-life coverage, legacy alias behavior, empty catalogs, contract compatibility, and usage measurement.
- Kept model cost advantage as the user's routing preference; exact savings must be measured using actual usage and configured pricing.
