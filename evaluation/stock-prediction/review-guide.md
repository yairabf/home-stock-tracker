# Historical evidence review and stock rollout

## Evidence available now

The committed safety corpus and recorded answers are authored fixtures. Tests
also inject mock HTTP responses through the shipped adapter. No independently
reviewed historical corpus or real live held-out report has been collected for
37e. Harness completion does not establish stock accuracy or authorize rollout.
Keep stock routing on its existing OpenAI default until a separate decision.

## Prepare and freeze a historical dataset

1. Obtain authorized historical observations and minimize them privately into
   the version-1 shape shown by `safety-cases.v1.json`. Use opaque case, product
   group, episode, event and evidence-reference IDs. Exclude real household or
   product IDs, free-text metadata, conversations, preferences, child ages and
   secrets. Source is `historical` only for actual evidence, never copied fixtures.
2. Reconstruct the product and household fields that were known at `asOf`.
   Attest prediction-enabled status, product type/perishability/strategy and
   household counts. A present-day snapshot is insufficient without evidence
   that it applied at the cutoff. Record `knownAt` for snapshots and events.
   Input events must both occur and become known no later than `asOf`.
3. Keep a complete episode timeline, including outcome-side balance mutations.
   Assign the first unambiguous direct stock confirmation strictly after `asOf`
   and within 24 hours: confirmed available, low or out. Corrections need an
   independently supported explicit state. An intervening purchase, restock,
   stock correction/set or consumption censors the comparison. Missing, late,
   conflicting or incomplete evidence stays unscored; never infer a missing label.
4. Allow at most one case per episode and one use of a confirmation reference.
   Keep every product/semantic group in one split. An independent reviewer must
   check semantic duplicates, household clustering and hidden shared evidence;
   opaque IDs alone cannot establish independence.
5. Use tuning cases for preparation only. Choose the held-out set before exposing
   its model responses. A distinct real reviewer verifies labels, cutoff
   snapshots, complete timelines and grouping, then records their opaque reviewer
   ID, review time and evidence reference, with `episodeComplete: true` only
   when supported. Schema checks enforce field consistency, not reviewer identity
   or the truth of an attestation. Never fabricate reviewers.
6. Freeze the reviewed dataset under a new immutable version before starting the
   held-out run. Preserve its full SHA-256 hash and the underlying private review
   record. Record any exclusion decision before seeing held-out answers. Changes
   to labels, input facts, split/grouping, policy, model pin, prompt/adapter or
   code invalidate the earlier assessment and require a fresh frozen evaluation.

`stock-history-replay-v1` recomputes statistics from cutoff-safe observations
using the runtime formulas and limits. It does not reproduce the historical
materialized statistics cache. Candidates use the runtime latest-20 relevant
history window with an explicit cutoff clock; equal-time rows order opaque event
IDs lexically. Post-cutoff rows, labels, reviews and group IDs stay out of Jev
inputs. Full dataset and reconstructed input hashes are separate bindings.

## Run and inspect evidence

See [CLI instructions](README.md) for offline validation, bounds, private output,
interruption and exit codes. Finish reviewing and committing relevant sources
before collecting launch evidence: the report captures HEAD, dirty relevant
paths, task/replay versions, dataset/input hashes, configured pin, actual resolved
models and start/end times. Missing revision or dirty sources are inconclusive.

With privately supplied credentials and separate authorization for paid calls:

```sh
npm run eval:stock-prediction -- --live --dataset /private/path/frozen-stock-held-out.v1.json --split held_out --output /private/path/stock-held-out-report.v1.json
```

Use a new output path. Keep datasets, reports and review records private. A
report contains normalized recorded transports that can be saved as an offline
replay envelope; replay validates the exact selected dataset, inputs, split,
case IDs, task and policy versions. Offline replay never becomes live evidence.
For programmatic validation, `parseEvaluationReport(report, dataset)` recalculates
metrics and slices from the bound dataset and completed observations. Do not
trust an edited summary or launch verdict without that validation and provenance
review. Hashes detect inconsistencies; they are not signatures proving real calls.

Read raw choices, accepted advice, deterministic baseline and final states
separately. Accepted advice can preserve a non-uncertain baseline state; acceptance
alone does not establish model benefit. Final confidence is conservative and is
not calibrated probability. Rejections, bypasses and provider failures are
separate outcomes. Coverage uses all selected cases, including unfinished cases;
latency uses calls only and failed-call token usage remains unknown.

The primary gate is binary accepted-final-low/out precision: correct low/out
confirmations divided by scored accepted advice with final low/out. Exact low
versus out precision is secondary. Available confirmations count as false-prompt
proxies; missing/censored labels do not enter precision. Report final and baseline
precision, need recall, uncertainty, confusion, lag and unscored reasons too.
Ratios retain counts; no denominator means null accuracy. Wilson 95% intervals
are descriptive because episodes may cluster within households. The 24-hour
confirmation is a near-term proxy, not proof of exact state at the cutoff.

`eligible` requires all of these: complete live evaluation, held-out historical
cases, independent review frozen before the run, valid clean revision, a single
resolved model matching its pin, at least 50 scored accepted low/out episodes,
precision at least 95%, and zero provider failures. Observation validation rejects
unsafe contribution/confidence states rather than issuing an eligible report.
Missing prerequisites or insufficient sample are `inconclusive`; otherwise
precision below 95% or provider failures are `failed`. Exit 0 can be inconclusive.
The fixed 0.9 acceptance gate and cold-start evidence predicate are not tuned here.

Inspect cold-start, learned-history, scenario and product-type slices with their
own denominators. Overlapping slices cannot be summed. Aggregate eligibility does
not establish slice accuracy, household generalization, or improvement over the
baseline. Review sample concentration and low coverage before any rollout decision.

## Stock-only rollout and rollback

After reviewing qualifying evidence, request a separate deployment decision.
An authorized operator may set only `STOCK_PREDICTION_PROVIDER=typesafe` with the
reviewed private model pin/key and restart through the existing deployment
process. Preserve the independent product-matching selector and OpenAI generation.
Check readiness and existing read-only materialized-stock REST/MCP behavior;
do not trigger stock writes as a health check. Only the internal on-demand
prediction engine uses this advisor. Daily materialization stays deterministic.

To roll back, an authorized operator sets `STOCK_PREDICTION_PROVIDER=openai` and
restarts through that process. Preserve matching configuration, all historical
predictions, inference provenance, events and stock records. No migration,
delete, historical reclassification or threshold adjustment is required. The
evaluator performs none of these rollout or rollback actions automatically.
