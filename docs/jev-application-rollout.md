# JEV application evaluation and rollout

The selectors exist and remain opt-in. Passing unit/contract/E2E tests proves local
wiring and safety behavior, not live accuracy. The authored evaluation corpus is
inconclusive. No task has been enabled by the 38e implementation.

The user-approved scope split tracks evaluation tooling and the perishability
repair in 38e, qualifying independently reviewed evidence in 38f, and separately
approved runtime enablement and rollback verification in 38g. Completing 38e
does not satisfy the launch gates below or authorize enablement.

## 38f source readiness

The 38f source inventory has reviewed the committed corpora and the named local
38e diagnostic artifacts. No qualifying source or independent reviewer has been
identified in that scope. The committed datasets remain authored safety fixtures;
the prior live comparisons are tuning diagnostics. A current catalog export has
no independently confirmed fields and cannot supply historical stock outcomes.

Qualifying collection remains pending new observed held-out operations,
independently supported shelf-life labels and cutoff-safe historical episodes.
The private intake checklist records semantic exclusions from prior tuning and
the missing source/reviewer prerequisites for each route. No additional live call
or runtime change is authorized by that preparation.

Use the existing 37c matching corpus minimum: 100 total cases, 60 held-out,
30 Hebrew/mixed across the corpus, required scenarios in both splits and
50 accepted held-out matches. An older private readiness note incorrectly stated
100 held-out matching cases; it does not change the shipped policy. Understanding
retains its separate 100 observed held-out requirement.

## Synthetic classification diagnostic (2026-10-07)

After the user approved the concrete bounded run, actual `jev-1.13.0` evaluated
240 authored cases through the shipped product-understanding adapter. All three
80-case batches completed with 928 TypeSafe physical requests and zero OpenAI
calls. Five responses failed validation; they remain in the evidence. All reports
were reparsed through recorded-response runtime replay and metric recomputation.

| Field | Correct accepted / scored accepted | Correct accepted / answerable targets |
| --- | --- | --- |
| Category | 116/116 | 116/224 |
| Product type | No accepted answers | 0/224 |
| Unit | 209/209 | 209/224 |
| Perishability | 205/205 | 205/206 |

Product type was withheld for every classification case: 178 unknown outcomes,
53 low-confidence rejections and one unavailable response. Category had 105
low-confidence rejections; raw scored choices matched references in 227/229 cases
(including must-abstain controls). The observed category bottleneck is acceptance,
whereas product type also frequently selects unknown. This does not establish
the cause; review the type definitions/question separately before any repair.

Eight unidentified controls abstained and eight supplied-field controls preserved
all values without model calls. No accepted disagreement with the frozen references
was observed. Results are agreement with author-generated answers, not independently
verified accuracy: 216 cases are language variants of 72 core families, unit clues
are explicit, some product types allow alternatives, and 18 frozen-food perishability
targets are unscored. The diagnostic exposes useful limitations but leaves the
existing observed/historical launch gates inconclusive. No prompt, threshold,
selector, runtime configuration or production data changed.

## Evidence packet

Before enabling a route, retain its exact dataset/version/hash, independent source
review records, frozen split/groups, policy/adapter/vocabulary versions, clean code
revision, configured and resolved model identities, complete private live report,
validated denominators/slices and a named operator decision. Keep failed and
inconclusive reports. Review recall, abstention, coverage and household concentration,
not only precision. Changes to shared JEV pin or relevant rules invalidate evidence.

| Route | Evidence required |
| --- | --- |
| Matching | Existing independently reviewed 37c live held-out gate |
| Understanding | Application evaluator: >=100 observed held-out cases, >=30 Hebrew/mixed and >=50 scored accepted inferred values per field; >=95% precision in all four fields |
| Shelf-life | Application evaluator: >=50 scored accepted policy selections, >=98% correct applicable identity, independently reviewed duration/storage assumptions and zero unsafe applications; generation safety reviewed separately |
| Internal stock | Existing 37e historical live held-out gate, >=50 accepted low/out outcomes and >=95% precision |
| Daily/manual stock advice | Eligible 37e report plus real workflow evidence with >=50 scored surfaced recommendations, >=95% need precision, no paired baseline precision regression and zero unsafe publication/provider failures |

See [application evaluator](../evaluation/application-inference/README.md),
[matching evaluation](../evaluation/product-matching/README.md),
[stock historical review](../evaluation/stock-prediction/review-guide.md) and
[workflow evidence](../evaluation/stock-prediction/workflow-review-guide.md).
Reports recompute summaries; workflow outputs need isolated runtime replay to
verify them independently. Hashes do not prove that a reviewer or provider acted.

## Bounded paid-run authorization

Specify the private dataset path/hash/split, exact task/model pins, relevant clean
revision, worst-case requests per provider including retries, total deadline and
new private output path. Understanding can dispatch twice per missing field;
policy selection and stock twice per operation; required policy generation once
with SDK retries disabled. Name generation/comparison calls explicitly. The prior
two-case connectivity smoke does not authorize a larger run. CLI budgets enforce
limits but are not operator permission. Measure tokens and unknown usage; savings
claims require an explicitly versioned price table, not assumptions.

## Concrete runtime change packet

After qualifying evidence is reviewed, show the operator the named deployment,
current configuration, exact proposed selectors/advice flag/model pin, restart
command, readiness probes, representative authorized operations and rollback
configuration. Obtain separate runtime/deployment approval. Preserve private keys
in the deployment's secret store; never put their values in the packet or logs.
Use the existing deployment process; evaluator commands perform no remote edits.

| Route | Enable | Rollback |
| --- | --- | --- |
| Nonexact matching | `PRODUCT_RESOLUTION_PROVIDER=typesafe` | Change only this selector to `openai` |
| Product understanding | `PRODUCT_UNDERSTANDING_PROVIDER=typesafe` | Change only this selector to `openai` |
| Shelf-life policy | `SHELF_LIFE_POLICY_PROVIDER=typesafe` | Change only this selector to `openai` |
| Internal stock advisor | `STOCK_PREDICTION_PROVIDER=typesafe` | Change only this selector to `openai`; workflow advice becomes inactive |
| Daily/manual advice | TypeSafe stock selector and `STOCK_WORKFLOW_ADVICE_ENABLED=true` | Set advice flag `false`, restart, then separately authorized reevaluation restores deterministic estimates |

Retain `LLM_PROVIDER=openai`, its private credential/configured model, and the exact
reviewed private TypeSafe pin/key. Generation supplies only unsupported required
policy information in JEV mode; low confidence/failure is not generation fallback.
Understanding currently has no automatic unsupported-field generation. Explicit
metadata, names, dates and stored policies remain authoritative; reads never infer.

Rollback restores legacy OpenAI assisted behavior for its selected task, including
legacy whole-product classification/name/alias behavior where applicable. Review
that behavior with the operator. Stored policies are not regenerated, historical
predictions/events/provenance are not deleted, and selector rollback needs no schema
change. Disabling advice does not immediately rewrite already saved estimates;
reevaluation is necessary before recommendation output reflects the baseline.

After restart, use read-only health/readiness and REST/MCP materialized reads.
Paid or mutating representative flows require explicit bounded authorization.
Record observed model provenance and rollback readiness for the enabled tasks;
leave each unqualified route disabled with its reason. No default-JEV switch or
automatic dual-provider comparison is part of ordinary production operation.
