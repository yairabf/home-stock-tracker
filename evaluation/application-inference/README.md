# Application inference evidence

The committed cases are authored safety fixtures. Expected abstention deliberately
tests conservative behavior. They are neither accuracy labels for real household
operations nor independent reviews and can never qualify a route for launch.
Authored duration bounds demonstrate scoring only, not food safety evidence.

## Prepare evidence

Minimize authorized observations into the strict version-1 dataset shape. Assign
opaque case, semantic-group and evidence-reference IDs. Keep product names and
necessary storage facts private; exclude real household IDs, conversations and
secrets. Categories/units must be the exact vocabulary known for that operation.

Author per-field acceptable values or explicit abstention/unscored labels before
model responses. For shelf life, label applicable policy identities and separately
review the duration and storage assumptions against evidence; generation labels
need independently justified minimum/maximum days. Do not use the model's answer
or the registry's own days as ground truth. Review equivalent values in advance.

A distinct real reviewer checks source authenticity, labels, semantic duplicates
and groups, then records identity, time and a private evidence reference. Never
fabricate attestations. Entire semantic/product groups belong to one split.
Freeze independent reviews before the immutable dataset's freeze time, and freeze
held-out inputs before live execution. Tuning responses must not tune held-out
cases. Changes to labels, input, groups, code, pin or policy invalidate evidence.

## Initial policy

Policy `application-launch-v1` retains runtime 0.90 acceptance gates. Understanding
needs 100 observed held-out cases, 30 Hebrew/mixed and at least 50 scored accepted
inferred values per field with 95% precision each. All four fields must qualify
because one selector controls them. Shelf life needs 50 scored accepted policy
selections, 98% identity precision and zero unsafe applications, with independent
duration review. Generation correctness and failures are reported separately.

Both need complete independently reviewed live evidence, clean relevant sources,
exact resolved JEV pins and zero operational failures. Authored, offline, tuning,
partial, unreviewed or insufficient evidence is inconclusive. Ratios always show
counts; missing denominators and usage are unknown. Review slices and concentration
before enablement; confidence is not calibrated probability.

Paid calls need separate authorization naming dataset/hash/split, exact models,
worst-case provider requests including retries, deadline and private output path.
Evaluation performs no runtime switch or production write. Actual enablement is a
separate evidence review and deployment approval.

## Run the CLI

Use a new output path. Outputs use mode 0600 and never overwrite files. Input must
be a regular nonsymlink file no larger than 5 MiB with at most 200 cases. Stdout
contains only aggregate counts.

```sh
npm run eval:application-inference -- --task product_understanding --dataset evaluation/application-inference/safety-cases.v1.json --recorded evaluation/application-inference/product_understanding-recorded.v2.json --output /private/tmp/understanding-review.json
npm run eval:application-inference -- --task shelf_life_policy --dataset evaluation/application-inference/safety-cases.v1.json --recorded evaluation/application-inference/shelf_life_policy-recorded.v1.json --output /private/tmp/policy-review.json
```

These commands replay authored responses through runtime adapters, with no network
or credentials. They should produce inconclusive launch evidence. Use a new output
filename each time. Unknown and injected invalid responses exercise safe failure;
selection and generation examples exercise acceptance without proving accuracy.

The v2 understanding recording is newly generated mocked evidence for
`jev-product-understanding-v2` and its dedicated perishability question. The old
v1 fixture is preserved for historical binding checks and is rejected by the
current adapter. Neither fixture is a measured live before/after result.

After separate paid-run authorization, live mode requires exact private JEV
credentials and explicit request/time bounds. Required-generation cases also need
private OpenAI credentials. Its configured model comes from `LLM_MODEL` or the
application default; resolved identity and usage stay unknown in current envelopes.

```sh
npm run eval:application-inference -- --live --task product_understanding --dataset /private/path/frozen-held-out.v1.json --split held_out --max-requests 800 --max-duration-ms 1200000 --output /private/path/new-held-out-report.json
```

Example limits are not authorization. Limits are 1-1000 requests and 1-1800000 ms.
Preflight refuses a batch whose maximum possible dispatch exceeds its ceiling:
up to two HTTP dispatches per missing understanding field or policy selection,
one for required generation. OpenAI retries are disabled. Deadline and cancellation
apply to all dispatches; cancellation stops new cases and retains available results.
Failures never spend on the other provider. No automatic production comparison.

Exit 0 means execution succeeded, and may be inconclusive; 1 indicates invalid input
or execution; 2 indicates failed qualifying evidence or deadline interruption;
130 indicates operator cancellation. Always inspect the report's launch status.

`parseReport(report, dataset)` replays normalized calls against exact request hashes
and recomputes outcomes, counts, slices and verdicts. Hashes do not authenticate
provider calls or reviewer identity. Retain private review records separately.
Offline replay remains offline evidence. Inspect all slice denominators and sample
concentration before enablement. Missing usage is unknown; no cost claim is made.
