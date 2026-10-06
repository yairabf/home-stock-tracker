# Materialized recommendation evidence

The workflow evaluator extends the existing stock history dataset with cutoff-known
projection, stored policy, pending-list and recommendation threshold snapshots.
It executes actual Nest daily materialization, advice publication and recommendation
selection. Stock-only replay freezes shelf-life inference unresolved when policy is
missing, and forbids generation. This separates stock evidence from policy rollout.

Use a fresh, empty, migrated PostgreSQL database on loopback, named
`home_stock_eval_<run>_test`. Set its full private URL in `EVALUATION_DATABASE_URL`.
The evaluator refuses remote, differently named and nonempty databases. It does not
reset, delete or modify production data, and retains its fixture rows for review.
A repeat CLI run needs another empty database; repeated evaluation within one case
is part of the duplicate-inference check. Never repurpose a real household database.

Build first. This CLI runs the compiled application, including generated Prisma
imports, and requires the existing development dependencies used by the Nest test
fixture harness. It opens no listener. Runtime stock services and guarded database
writes are unchanged. Authentication is private to the unopened fixture app.

```sh
npm run build
npm run eval:stock-workflow -- --task stock_workflow --dataset /private/path/frozen-workflow.v1.json --recorded /private/path/workflow-recorded.v1.json --split held_out --output /private/path/new-workflow-report.json
```

For the committed authored safety corpus, use
`evaluation/stock-prediction/workflow-safety-cases.v1.json` and
`evaluation/stock-prediction/workflow-recorded-safety.v1.json` as dataset/recording.
Its eight cases cover accepted advice, pending groceries, a high threshold,
uncertain advice, provider failure, explicit out, expiration and zero history.
It reconstructs five mocked calls and deliberately includes future events which
must never become provider input. These examples test wiring, not accuracy.

Live mode is separately authorized and requires `--live`, exact private TypeSafe
credentials/model, `--max-requests` and `--max-duration-ms` instead of `--recorded`.
Plan two possible HTTP dispatches per selected case for JEV retry accounting.
The shared limits are 1-1000 requests and 1-1800000 ms. Generation is disabled.
Signals/deadlines cancel provider work and prevent new cases. Output uses exclusive
creation and mode 0600. Stdout has only aggregate counts; exit codes match the
application-inference evaluator.

## Review and freeze

Follow the [historical review guide](review-guide.md): direct next-24-hour stock
confirmations, cutoff snapshots, complete timelines, censoring, semantic/product
group isolation and independent real reviewers. Each projection snapshot also
attests its known time, recorded event/time/quantity, previous evaluation time,
estimated quantity, revision, unit, policy, pending grocery and confidence threshold.
Review these facts independently before the immutable dataset freeze time. Future
events and confirmations participate only in ground truth, never provider inputs.

The replay rebuilds statistics from cutoff-known events using runtime formulas.
It seeds only cutoff-known facts, without historical materialized cache guesses.
Equal-time event ordering follows the runtime descending ID order; opaque event IDs
are mapped with order preserved. This is version `stock-workflow-replay-v1`, distinct
from the existing 37e replay contract. It does not change that report or its gate.

Reports distinguish deterministic baseline, accepted advice, publication outcome
and final surfaced recommendation. Pending groceries and threshold filters can
suppress accepted advice. Report final/baseline need precision, recall, confusion,
coverage, confirmation/censoring reasons and scenario/product-type denominators.
Descriptive intervals do not establish household generalization. Empty denominators
mean null. Authored or offline evidence is always launch-inconclusive.

Workflow eligibility additionally requires at least 50 scored surfaced recommendations,
95% need precision, no paired precision regression, zero unsafe publications/provider
failures, complete reviewed live historical evidence and an exact resolved pin.
Set `EVALUATION_ADVISOR_REPORT` to a separately reviewed eligible 37e report for the
same history dataset, split, model and clean revision. Its existing validator and
launch policy remain authoritative. Without it workflow evidence is inconclusive.
Human review still examines slice coverage, recall, clustering and safety before rollout.

`validateWorkflowReport(report, dataset)` recomputes summaries and bindings, but does
not alone prove that recorded application outputs came from runtime.
`replayWorkflowReport(report, dataset, newEmptyDatabaseUrl)` independently reexecutes
the recorded calls in another isolated database and rejects altered observations.
It makes zero provider calls and also retains its fixture rows. Hashes are consistency
checks, not authentication of historical observations or real provider execution.

No command enables a provider, rewrites user-owned plans, runs a deployment or deletes
provenance. Evidence review and runtime enablement remain separate authorized steps.
