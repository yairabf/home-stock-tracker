# Home Stock Tracker — Jev Integration PRD

Date: 2026-09-30. Status: proposed implementation plan.
Repository: https://github.com/yairabf/home-stock-tracker
Baseline: current main inspected during this conversation; refresh before implementation.
Jev refers to TypeSafe AI's hosted decision model.

## 1. Outcome

Use Jev for bounded decisions where the backend already supplies structured evidence and allowed outcomes. Retain OpenAI for canonical-name generation, aliases, open-ended category labels, and shelf-life inference. Preserve deterministic stock calculations, confirmed user data, catalog confirmation, REST/MCP contracts, and Hermes presentation.

The recommended completed architecture routes product candidate matching and stock-state decisions to Jev; product creation/classification and shelf-life generation remain with OpenAI. Begin with matching and introduce stock prediction only after evaluation. This is a backend feature, not a general model-provider replacement.

## 2. Evidence from the current service

| Component | Current behavior | Integration implication |
| --- | --- | --- |
| ProductResolutionService | Exact matches bypass AI; up to 20 catalog candidates; advice only | Strong first Jev use |
| ProductClassifier | Generates canonicalName, aliases, category, unit, type, perishability | Retain OpenAI initially |
| PredictionReasoner | Generates stock state, confidence, explanation, action | Jev chooses state; code constructs text |
| EstimationService | Skips AI for confident non-uncertain candidates; protects authoritative/non-uncertain state; blends confidence 70/30 | Preserve precedence; explicitly evaluate confidence policy |
| ShelfLifeReasoner | Generates finite days or nonperishable plus rationale | Retain OpenAI; avoid arbitrary duration discretization |
| LlmProvider | Generic generateStructured<T>() API | Do not pretend Jev supports arbitrary generation |
| Configuration/module | openai-only validation and registry; module also reads process.env | Add validated task selection and consistent wiring |

Product resolution currently accepts proposals at confidence ≥0.7, classification ≥0.8, and prediction reasoning ≥0.65. These are existing values, not transferable Jev accuracy guarantees.

## 3. Scope and exclusions

Required: TypeSafe transport, task-specific decision ports/adapters, configuration, validated mappings, existing confirmation preservation, provenance, targeted tests, evaluation, setup and rollback instructions.

Excluded: UI for credentials; changes to purchase/stock event semantics; automatic alias/product writes; changes to expiration arithmetic; new notifications; new scheduler; bank/finance functionality; automatic historical replay; hidden fallback calls to OpenAI.

No dependency on finance-service code is required. Keep the two projects independently deployable.

## 4. Configuration

Keep LLM_PROVIDER=openai and LLM_MODEL for existing generative tasks. Add two task selectors and a separate Jev model/key:

```dotenv
LLM_PROVIDER=openai
LLM_MODEL=<existing-openai-model>
OPENAI_API_KEY=<existing-private-key>
TYPESAFE_API_KEY=<private-typesafe-key>
JEV_MODEL=jev-1.13.0
PRODUCT_RESOLUTION_PROVIDER=typesafe
STOCK_PREDICTION_PROVIDER=openai
```

After stock evaluation, change STOCK_PREDICTION_PROVIDER to typesafe. Both task selectors accept openai or typesafe and default to openai for compatibility. Jev configuration is required only when selected for a task. Existing OpenAI requirements remain because generative tasks still use it.

Validate once through application-config.ts and inject the resulting configuration consistently; remove divergent environment interpretation from the affected module factories. Do not introduce a generic configuration framework.

Use a pinned supported Jev model; jev-1.13.0 is listed in the documentation checked during assessment. Recheck before implementation. Persist the resolved response model. Secrets remain server-side and absent from committed examples, API responses, logs, and browser bundles.

## 5. Architecture

Leave LlmProvider and OpenAiLlmProvider responsible for generation. Add a small JevDecisionClient for authenticated HTTP, timeout, retry, response validation, and model metadata.

Introduce two narrow injectable ports:

- ProductResolutionAdvisor: receives the existing bounded context and returns an existing valid proposal or null.
- StockPredictionAdvisor: receives validated reasoning evidence and returns the existing reasoning-result shape or an unavailable result.

OpenAI implementations wrap existing generation behavior. Jev implementations translate decisions into validated existing results. Select implementations through Nest factories using the task selectors. Keep ProductClassifier and ShelfLifeReasoner on LLM_PROVIDER.

Suggested additions: src/llm/typesafe/jev-decision.client.ts; src/product/product-resolution-advisor.ts and jev-product-resolution-advisor.service.ts; src/estimation/stock-prediction-advisor.ts and jev-stock-prediction-advisor.service.ts. Follow existing naming conventions when implementing.

## 6. Product resolution — first release

1. Run existing ProductSearchService. Preserve exact-match bypass and existing candidate/context limits.
2. Supply requestedPhrase and candidate facts to Jev. Choice options are opaque tokens mapped locally to candidate IDs, plus ambiguous and no_match. Tokens prevent collisions between catalog IDs and reserved outcomes.
3. Ask whether the requested phrase names the same catalog item, accounting for brand, size, variant, category, and units when supplied. A semantically related item is not automatically the same item.
4. Accept a candidate selection only when validated and Jev confidence ≥0.9. This is a provisional service policy; tune only from held-out evaluation.
5. Translate an accepted candidate into the existing add_alias advisory proposal: known target ID, normalized requested phrase as alias, and a fixed explanation identifying the candidate. This remains a proposal requiring the existing confirmation flow.
6. For ambiguous: return ask_user_to_choose only when there are at least two candidates; use the search's existing bounded candidates in deterministic order. Otherwise return null.
7. For no_match, insufficient confidence, no candidates, or failure: return null proposal while preserving search results. Do not manufacture create_product metadata or start an implicit OpenAI call.

Existing explicit product creation and OpenAI classification remain available through their current workflows. Confirm by tracing the grocery and stock confirmation paths that a null proposal retains a usable clarification/create path.

Do not rename products, add aliases, mutate stock, or place purchases based on a Jev decision alone. Preserve candidate-reference validation and log accepted advice with typesafe provenance.

## 7. Stock prediction — second release

Keep buildDeterministicCandidate and all date/interval calculations in code. Pass the existing sanitized reasoning evidence to Jev. Its choice set is generated from the actual PredictedState enum, including uncertain.

Skip Jev when prediction is disabled, eventCount is zero, a direct signal is authoritative, or the deterministic result is non-uncertain with confidence ≥0.8. With zero events, return uncertain with confidence 0 and no action. This last guard is an explicit change from current cold-start behavior and needs its own acceptance tests.

For nonzero cold-start history, require additional sufficient evidence for any non-uncertain result; otherwise preserve uncertainty. Do not infer actual quantities from household composition.

An accepted Jev answer requires confidence ≥0.9 and valid state/probabilities. Preserve an existing non-uncertain deterministic state; only a non-authoritative uncertain state may receive Jev's proposed state.

For the Jev path, use min(deterministic confidence, Jev confidence) as a conservative provisional final score, without confidence uplift. Keep OpenAI's existing 70/30 behavior on the OpenAI path. Neither resulting score is a calibrated probability of real stock availability. Evaluate this policy using confirmed stock outcomes before relaxing it.

Build reason text in code using the actual deterministic signals and state. When Jev differs from a preserved deterministic state, the explanation must describe the final state rather than the rejected choice. Set recommendedAction to null in the first prediction release; existing recommendation services continue to decide eligibility. Hermes can compose user-facing wording.

Unavailable/uncertain/rejected results preserve the deterministic fallback. Do not reset predictionEnabled, overwrite stock ledger values, or automatically create grocery entries.

## 8. TypeSafe protocol and validation

Use native fetch to POST https://api.typesafe.ai/v1/systemone with Bearer authentication. Build state and Choice questions explicitly for each task; do not translate arbitrary Zod schemas into questions.

Validate unknown response data: resolved model, expected answer type/key, selected option membership, finite confidence and probabilities within [0,1], exact option coverage, and probability sum within 0.001 of one. Require the selected option to be a maximum-probability entry, permitting ties. Then validate the mapped domain result with the existing Zod schema.

Task deadlines: resolution 10 seconds overall, matching its existing caller limit; prediction 15 seconds overall as a proposed bounded budget. Abort actual network requests when deadlines expire. At most one retry for 429/529/transient 5xx, with jitter/backoff and Retry-After only if time remains. No retries for authentication, validation, or malformed successful answers. Never let provider exceptions escape through mutation workflows.

Do not log authorization headers, raw prompts, full household preferences, or raw provider errors. Send only fields needed by each decision; sanitize preference fields instead of forwarding arbitrary JSON.

## 9. Provenance and persistence

Use provider=typesafe, resolved model, and task-specific versions jev-product-resolution-v1 and jev-stock-prediction-v1. Preserve old OpenAI records.

Existing result metadata uses provider/model strings, and inference logs already persist them. Inspect Prisma schema and migrations before adding any columns. Update logging APIs that currently hardcode the OpenAI-era prompt-version constants so they record the actual task adapter's version. Ensure mixed-provider runs do not misattribute OpenAI classifications to Jev.

Reuse inference logging for accepted/rejected prediction attempts as appropriate. Operational metrics may contain latency, status, model, task, and token counts without raw content. A new persisted shadow-results subsystem is outside scope.

## 10. Evaluation and launch

Add a bounded local evaluation script using confirmed fixtures; no production writes, automatic catalog edits, or full DB export. First run synthetic connectivity tests after the operator adds the key.

Matching evaluation: at least 100 independently labeled cases, including ≥30 Hebrew/mixed-language phrases, typos, aliases, different brands/sizes, ambiguous candidates, and missing candidates. Separate catalog-product groups between tuning and held-out samples.

Proposed launch target: ≥98% precision among accepted candidate matches at the selected gate, with coverage and denominators reported. Ambiguous/no-match examples must demonstrate clarification behavior. A small sample does not establish a universal error rate.

Prediction evaluation: replay historical evidence as it existed before later stock confirmations; use those confirmations as ground truth. Report precision of accepted low/out predictions, coverage, uncertainty, false prompts, and performance by cold-start/learned-history group. Avoid leaking future events into inputs. Begin in evaluation-only mode through the script; do not switch runtime prediction routing until results are reviewed.

Suggested prediction target: ≥95% precision among accepted low/out outcomes, with at least 50 evaluated accepted outcomes for a meaningful initial assessment. If insufficient evidence is available, keep OpenAI or deterministic behavior and leave Jev prediction disabled. Report latency/failure/token metrics for both tasks; do not promise vendor benchmark speedups.

## 11. Implementation sequence

1. Refresh main; read AGENTS.md, coding standards, build plan, active feature and existing confirmation/MCP contracts. Allocate an appropriate feature ID without overwriting unrelated active work.
2. Implement validated configuration and TypeSafe transport with tests; keep task defaults on OpenAI.
3. Extract resolution advisor boundary, implement Jev mapping, and verify confirmation semantics end to end.
4. Add evaluation script and fixtures; operator sets key and reviews matching results.
5. Enable Jev matching. Implement stock advisor, zero-history guard, conservative confidence composition, and deterministic explanations as the second bounded feature.
6. Evaluate stock predictions before switching the second selector. Keep metadata generation and shelf life on OpenAI.
7. Produce implementation review and verification evidence; merge/deploy through the repository's normal workflow.

## 12. Acceptance criteria

- [ ] Existing configuration and OpenAI-only behavior remain compatible.
- [ ] Selecting Jev requires its key/model, without changing generative task routing.
- [ ] Exact product matches make no Jev request.
- [ ] Candidate selection produces only a validated advisory proposal referencing known candidates.
- [ ] Wrong brand/variant and ambiguous phrases do not silently add aliases.
- [ ] No-match, empty candidates, low confidence and failures retain a usable existing clarification path.
- [ ] All writes still require the existing confirmed catalog/stock flow.
- [ ] Zero-event prediction remains uncertain, confidence 0, action null, with no AI call.
- [ ] Disabled prediction and authoritative direct signals bypass Jev.
- [ ] Existing non-uncertain deterministic states cannot be replaced.
- [ ] Jev confidence cannot uplift deterministic confidence.
- [ ] Generated explanations describe final accepted state and actual evidence.
- [ ] Provider failures abort within deadline and preserve existing fallbacks.
- [ ] Accepted/rejected results retain correct provider/model/task-version provenance.
- [ ] Keys and sensitive request content stay out of logs and public interfaces.
- [ ] Evaluation reports precision, coverage, sample sizes, Hebrew slices, latency and failures.

## 13. Tests and verification

Unit tests: configuration, routing, candidate tokens, abstention, ambiguity, invalid IDs/probabilities, confidence boundaries, deadline abortion and retry limits.

Service tests: exact-match bypass, advisory-only resolution, zero-event/cold-start behavior, authoritative precedence, confidence composition, final-state explanations, and fallback.

Integration tests: existing grocery and stock confirmation paths, REST/MCP schema compatibility, Prisma provenance round-trip, and scheduled stock workflow with mixed providers. Preserve existing scheduler timing and avoid duplicate evaluations.

Discover and run the repository's real lint/typecheck/test/build commands; do not invent scripts. Run contract and integration checks affected by refactoring and log metadata changes. Smoke-test the real API only after the operator supplies credentials. No live evaluation was run in preparing this plan.

## 14. Rollback and later extensions

Set PRODUCT_RESOLUTION_PROVIDER=openai and STOCK_PREDICTION_PROVIDER=openai, restart the backend, and retain stored TypeSafe provenance. No data deletion or historical reclassification is required.

Later extensions require separate evidence: Jev metadata classification from controlled vocabularies, perishable-policy choices from approved rules, and cost-aware explicit fallback. Do not discretize shelf-life days or generate product names merely to remove OpenAI.

## 15. References

Repository paths inspected: src/product/product-resolution.service.ts and types/product-resolution.ts; product-classifier.service.ts and types/product-classification.ts; src/estimation/estimation.service.ts, prediction-reasoner.service.ts and types/prediction-reasoning.ts; src/inventory/shelf-life-reasoner.service.ts, shelf-life-inference.service.ts and types/shelf-life-inference.ts; src/llm/llm-provider.ts, llm-provider.registry.ts, llm.module.ts and types/structured-generation.ts; src/config/application-config.ts; product-classification-log.service.ts.

Official documentation:
- https://docs.typesafe.ai/introduction
- https://docs.typesafe.ai/api
- https://docs.typesafe.ai/confidence
- https://docs.typesafe.ai/models

Jev supplies bounded decisions rather than generated prose. Non-English performance requires domain evaluation. Thresholds, retry budgets, rollout targets and routing rules in this PRD are proposed service policies, not verified model-performance claims.
