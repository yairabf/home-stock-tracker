# Real-request collection package

The opt-in backend collector and private PostgreSQL export procedure are
documented in [backend-capture.md](backend-capture.md). The prepared patch must
be installed on the actual backend before prospective capture begins.

Give server-agent-task.md and request-snapshot.schema.json to the agent with
access to the server. The task is a read-only export of exact pre-inference
snapshots. When those snapshots are unavailable, return an explicit missing-field
report and propose a prospective collector patch for owner review; do not infer
inputs from current catalog or confirmation data. Deployment or server changes
require separate authorization. No model calls are needed for collection.

request-snapshots.empty.json is an empty scaffold, not observed evidence. Replace
its timestamp and missing-field notes only with actual extraction facts. Validate
all collected records against request-snapshot.schema.json. Empty category/unit
lists mean genuinely empty vocabularies at request time (runtime seeds apply),
not unknown history. Null metadata means explicitly absent before inference,
not an unavailable snapshot. Keep unavailable records outside the scored file.

Store completed exports privately outside the repository; do not commit raw
requests, household identifiers, inference responses or review records. Redact
personal identifiers without removing product facts. Record extraction rule,
coverage, missing records and file hashes in a separate manifest. Capture exact
custom category meanings if the owner supplies them; do not invent definitions.

## Review worksheet

label-review.csv contains headers only. Create one row per field for every
case: category, productType, typicalUnit and isPerishable. The labels must be
checked against the actual product evidence, without seeing evaluation outputs.

- expectedKind is values, abstain or unscored.
- acceptedValuesJson is a JSON array for values, including boolean values for
  isPerishable, or an empty array for abstain/unscored. Quote CSV cells correctly.
- Use alternatives only when each is justified. Unknown product identity calls
  for abstention; missing ground truth is unscored, not a fabricated correct value.
- authorId identifies the real label author; reviewerId identifies a different
  actual person who checked it. Leave review fields blank until review occurred.
- reviewedAt is the actual UTC ISO timestamp. evidenceReference points to retained
  product evidence or a review record. Never invent identities or confirmations.

Use docs/jev-integration.md for product-type and perishability definitions. For
category, respect the actual supplied choices and their owner-defined meanings.
A reviewer may correct labels before the held-out dataset is frozen; afterward
retain a new version and disclose any corrections. Separate repeated product
families across tuning and held-out evaluation to avoid contamination.

## Qualification and handoff

Aim for at least 100 fresh observed requests, with at least 30 Hebrew/mixed.
The existing gate also needs at least 50 scored accepted responses in each field;
100 input records alone may not qualify, especially when values were supplied.
Preserve natural frequencies, rejected cases and failures; do not select only
successful or easy operations. Existing synthetic examples and exposed catalog
records remain diagnostics, not fresh held-out evidence.

Return private snapshot JSON, review CSV and source manifest to the local agent.
The agent will validate provenance, schema and independent review, convert to the
existing evaluator dataset format, freeze/hash inputs and references before
any comparison, and prepare a separate bounded live-run approval packet.
