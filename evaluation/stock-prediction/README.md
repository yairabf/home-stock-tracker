# Stock-prediction evaluation safety corpus

These 13 cases and their recorded answers are **authored fixtures**. No response
was captured from a paid model call, no historical stock data is included, and
no reviewer attestation is claimed. They validate the harness and shipped policy;
they cannot establish accuracy or qualify a stock-provider rollout.

From the repository root, create a report at a new path:

```sh
npm run eval:stock-prediction -- --recorded evaluation/stock-prediction/recorded-safety.v1.json --output /private/tmp/stock-safety-report.json
```

Expected summary: offline held-out, 13/13 completed, 5/13 accepted, accepted final
low/out precision 2/3 (66.67%), and `Launch evidence: inconclusive`. Diagnostics
contain 4 bypasses, 3 validated rejections and 1 provider failure. The missing
confirmation and intervening purchase are unscored. The intentionally incorrect
available confirmation demonstrates the false-prompt proxy; nothing sends a prompt.

Cases cover disabled prediction, zero history, authoritative stock facts, high
confidence, learned-history acceptance, a false positive, the fixed 0.9 gate,
uncertain advice, insufficient cold-start evidence, provider failure, absent
labels, mutation censoring and future/later-known evidence. Dataset and input
hashes bind recorded answers; editing a fixture requires regenerating those
bindings and reviewing the intended policy result.

Use `--dataset <file>` and `--split tuning|held_out` for a prepared dataset;
held-out is the default. Exactly one of `--recorded <file>` or `--live` is required.
Both input files must be regular files of at most 5 MiB, with no symlink inputs.
Schemas bound datasets to 1–200 cases and histories to 1,000 events; invalid or
oversized data is rejected before requests. The CLI never loads the application
or writes database rows.

Live execution requires privately supplied `TYPESAFE_API_KEY` and a pinned
`JEV_MODEL` (`jev-X.Y.Z`) in the process environment. It does not load `.env`
automatically. For an explicitly authorized connectivity test, use `--live
--smoke --output <new-file>`; it uses the separate one-case unscored authored
connectivity dataset and cannot take `--dataset` or `--split`. Live execution
can incur provider charges. It uses the shipped transport's deadline/retry policy,
without additional retries or fallback to another provider.

Reports include normalized transport observations, labels/review provenance and
metrics. Keep them private: output is exclusively created with permissions 0600;
existing files or symlinks are refused. Store repository-local reports under
`evaluation/stock-prediction/reports/` (git ignored), or outside the repository.
Use a new path for each run. Console output contains summary counts and reason
codes, not input events, labels or provider error bodies.

Exit codes: 0 means a report was produced (including inconclusive evidence), 2
means qualifying launch evidence failed, 130 means interruption, and 1 means
invalid input/configuration or another execution failure. SIGINT/SIGTERM stop
scheduling new cases; the current bounded request may finish before the partial
report is written. An unexpected fatal failure after reserving the path may leave
an empty output file; choose a new path after correcting it. Interrupted recordings
are partial and cannot be replayed as a complete selected run.

Live reports capture HEAD and dirty status for relevant source, configuration,
lockfile, scripts and corpus paths. Missing git provenance or relevant edits
make launch evidence inconclusive. A second check detects revision/dirty changes
at the end of the run. Eligibility remains a report result requiring operator
review; this command never changes runtime selectors.
