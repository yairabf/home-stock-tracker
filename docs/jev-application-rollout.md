# JEV application evaluation and rollout

The selectors exist and remain opt-in. Passing unit/contract/E2E tests proves local
wiring and safety behavior, not live accuracy. The authored evaluation corpus is
inconclusive. No task has been enabled by the 38e implementation.

The user-approved scope split tracks evaluation tooling and the perishability
repair in 38e, qualifying independently reviewed evidence in 38f, and separately
approved runtime enablement and rollback verification in 38g. Completing 38e
does not satisfy the launch gates below or authorize enablement.

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
