# Perishability diagnostic contract

The decision concerns the identified product's normal purchased form, not a
package's present condition, safety or exact remaining shelf life. Definitions
live in `src/product/perishability-definition.ts`; the production perishability question uses these definitions.

`perishability-comparison-v1` is separate from the existing application report.
It binds the dataset, inputs, labels, selected split and externally supplied
request definitions. Every variant has exactly the same selected cases when
complete. Partial variants retain `complete: false`; missing results are not
silently dropped from the comparison.

Each row retains the normalized request, ordered choice IDs, order-sensitive
request hash, validated transport and application outcome. Response distributions
and resolved pins are validated. `captured` and `reconstructed` describe request
provenance, not whether a provider call was authentic. Dataset review records and
separate private label approvals remain the evidence; this schema cannot create
an independent reviewer attestation. Hashes are consistency checks.

The comparison command validates requests against an externally frozen request
plan, replays the recorded transport through the shipped acceptance policy and
recomputes metrics. Historical requests retain their original versions; replay
reapplies current unchanged acceptance gates without presenting a v1 request as
a v2 dispatch. For v2, a plan must match the actual production request builder;
only criterion order may differ. No question or household facts can be changed
under the same production version.

## Baseline preservation

Before changing the production question, retain private read-only copies of the
pilot dataset and report. Reconstruct requests with the matching original adapter
and verify every recorded request hash. Record the exact source revision, model,
question version, original file hashes and ordered criteria. Do not label these
reconstructed requests as original wire captures. Reject old bindings against a
revised adapter; do not rewrite their task version to make replay pass.

The original 49-product pilot is tuning evidence. User-approved labels and
purchase-form clarifications are separate from facts actually available in model
inputs. Do not add those clarifications only to the revised comparison input.
Keep originals immutable; a reviewed label change creates a new dataset version.

`perishability-diagnostic-cases.v1.json` contains authored clear and ambiguous
examples with no invented review records. They are proposed robustness fixtures,
not real household observations or independently reviewed live accuracy evidence.
Review their labels before using them in a paid comparison. Keep semantic aliases
and language variants together when making any later held-out split.

## Review locally

```sh
npm run test -- --runInBand src/evaluation/application-inference/perishability-comparison-contract.spec.ts
```

The tests are offline. Comparison artifacts always declare launch evidence
inconclusive. Paid-run approval and reviewed diagnostic labels are a separate
Step 7e gate; having a live command does not authorize provider requests.

## Capture and compare

Freeze `perishability-request-plan-v1` before responses. Its `binding` is the
comparison binding, and `variants` each contain a frozen `definition` plus one
request per case (`caseId`, `inputHash`, `request`, `orderedChoiceIds`,
`orderedRequestHash`). Keep the plan and its authorization hash separately from
response artifacts. A hash proves consistency, not authenticity. Reconstructed
baseline plans must come from the preserved matching source/captures.

Offline validation and recomputed reporting:

```sh
npm run eval:perishability-comparison -- --dataset /private/path/dataset.json --split tuning --plan /private/path/plan.json --recorded /private/path/comparison.json --output /private/path/new-report.json
```

The output is exclusively created with mode 0600. Inputs use the existing
bounded regular-file reader. Stdout contains only variant/case counts and run
status. The report includes the full private comparison, frozen plan hash,
source revision, dirty paths and content hashes of runtime TypeScript and build
inputs before/after execution. Never commit household reports or response text.
The command accepts comparison captures, not a report wrapper. Report consumers
can use `parseComparisonReport` to validate bindings and recompute metrics again.

After separate bounded approval, replace `--recorded` with `--live` and add
`--max-requests N --max-duration-ms M`. Credentials are read from the environment;
the `JEV_MODEL` pin must match every variant. Each new case reserves up to two
physical TypeSafe calls for the shipped client's retry; one global ceiling and
deadline cover all variants, with zero OpenAI calls. Cancellation/deadline/budget
exhaustion writes an explicit partial inconclusive report. Validation completes
before networking. Live definitions must identify the current adapter/revision
and captured requests; no historical adapter is executed through live mode.

Optional `--baseline /private/path/baseline-comparison.json` reuses complete
frozen variants. This file must contain every planned variant in the same order,
with empty `complete: false` placeholders for new variants. Reused variants
retain their evidence mode and versions. Partial nonempty variants cannot be
resumed and mixed with fresh live calls. The request ceiling counts only new
variants, including their retries. This does not renew the old pilot budget.

## Metrics and denominators

Raw correct/wrong counts include substantive choices regardless of acceptance.
A substantive choice on a must-abstain label counts as raw wrong; unscored labels
stay in a separate bucket. Unknowns, low-confidence rejections and provider
failures are separate counts, with failure reasons. Accepted precision excludes
unscored acceptances and includes incorrect acceptance on must-abstain labels.
Accepted coverage uses all selected value-labeled cases, including missing rows,
unknowns and failures. Ambiguous abstention requires a successful explicit unknown;
a provider failure does not earn abstention credit. Zero denominators stay null.

Paired metrics name the first variant as baseline and count paired/unpaired cases,
both-successful responses, raw and accepted disagreements, and correct gains/losses.
A failure or unknown may count as loss of a correct result, but response-choice
disagreement is counted only when both transports succeeded. Partial variants
retain full expected denominators. These diagnostic numbers cannot establish
launch eligibility or create independent review evidence.
