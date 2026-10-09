# Request to the server-side agent: original classification evidence

Please prepare a read-only export for JEV product-understanding evaluation. We
need original user requests, not catalog rows or later confirmation payloads.
Existing exports have zero reconstructible original requests. If the source does
not retain these fields, report them missing; do not reconstruct them from model
outputs. Propose collection separately rather than changing the server in this
export task. Make no paid model calls and export no credentials.

## Input file: original-product-understanding-requests.json

Aim for at least 100 fresh observed operations, with at least 30 Hebrew or mixed
requests. Preserve natural class frequencies and repeated-product group IDs;
do not cherry-pick easy or accepted results. The current gate also needs at least
50 scored accepted responses for each field, so 100 inputs may not be sufficient.
Include unknown/ambiguous cases and items from all common categories.

For each operation include:
- Stable anonymized operation ID, UTC request timestamp and trace reference.
- Exact original entered product name before inference, normalization or editing.
- Pre-inference category/productType/typicalUnit/isPerishable values. Use null
  only for values actually absent then, and document unavailable snapshots
  separately. Never fill these from later model or catalog output.
- Exact category and unit choices available at that request time, including their
  user-defined meanings if retained. Do not substitute today's choices.
- Language (he/en/mixed), semantic product-family ID and source provenance.
- User-confirmed outcome and edit history in a separate section, with timestamps
  and origin tags. Keep these out of the inference input.

## Independent reference file: reviewed-product-understanding-labels.json

For every operation, an actual label author and a different reviewer should check
expected category, productType, unit and perishability against product evidence.
Use accepted alternative values where warranted, expected abstention when the
input is insufficient, or explicitly unscored when ground truth is unavailable.
Do not use JEV/OpenAI outputs or unknown-origin stored values as truth.
Record author ID, distinct reviewer ID, review timestamp, evidence reference and
product evidence. Do not insert fake reviewer identities or approvals.
Review without seeing the new evaluation's predictions. Follow the app's type
and perishability definitions. Resolve custom category meanings with the owner.

## Manifest

Include extraction date, source tables/logs, date range, total eligible and
exported counts, selection rule, missing fields, truncation, privacy redactions
and SHA256 file hashes. Use stable anonymized IDs to join references. Do not export
auth tokens, database connection URLs, private keys or household identifiers.

Freeze and hash the reviewed dataset before evaluation. Return the files locally;
the receiving agent will validate and convert them into the existing version-1
evaluator schema and prepare a bounded paid-run proposal. This request does not
authorize deployment, inference calls or source/database changes.
