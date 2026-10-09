# Backend capture installation and export

The prospective collector is implemented in ProductUnderstandingRunner. With
`PRODUCT_UNDERSTANDING_CAPTURE_ENABLED=true`, it saves the exact adapter input
after category/unit lookup and before the selected provider is called. Its
existing LlmInferenceLog row has `modelProvider=input_capture`,
`modelVersion=not_applicable` and
`promptVersion=product-understanding-input-capture-v1`. This row represents an
input snapshot, not a model response or successful classification.

Capture is disabled by default. It uses the existing table, needs no migration
and does not select JEV. It retains product names and metadata in the private
database. Capture persistence is awaited before inference. A failed capture
emits a fixed warning without input or database details, then classification
continues. Failed provider requests retain their already-saved input. Complete
supplied metadata bypasses inference and capture; failed vocabulary lookup has
no complete snapshot and is not captured. Capture counts therefore are not
counts of all HTTP requests or product operations.

## Installation handoff

The backend endpoint is reachable from Hermes, but the attempted existing SSH
identity cannot authenticate to its host. The prepared patch is local only.
An administrator with access to the actual home-stock backend must install the
reviewed build and enable the flag in that service's environment. Keep all
provider selectors and advice flags at their current values. Restart only the
backend service through its established deployment procedure. Do not create
artificial grocery requests to inflate the sample.

Collect ordinary household activity. Aim for 100 fresh held-out inference
requests, including at least 30 Hebrew/mixed. Counts alone do not qualify the
corpus; previously tuned product families must be excluded and every label needs
actual independent review. After the collection window, disable the flag and
export the window. Retain the private source and its checksum until review and
evaluation finish. Apply the household's retention policy afterward; the
collector does not automatically delete private evidence.

## Private read-only export

Use the service's established PostgreSQL connection privately. Do not print its
connection string or credentials. Run the following in psql using a read-only
account when available. Substitute the actual UTC collection boundaries and
write the single JSON value to a new file outside the repository with mode 0600.
Run psql with `-X -q -t -A -v ON_ERROR_STOP=1` to exclude formatting and startup
configuration; redirect output privately. Do not paste the raw result into chat.

```sql
BEGIN READ ONLY;
SET LOCAL statement_timeout = '30s';
SET LOCAL TIME ZONE 'UTC';
WITH selected AS (
  SELECT id, timestamp, "structuredResponse"
  FROM "LlmInferenceLog"
  WHERE "modelProvider" = 'input_capture'
    AND "promptVersion" = 'product-understanding-input-capture-v1'
    AND timestamp >= :'start_utc'::timestamptz
    AND timestamp < :'end_utc'::timestamptz
  ORDER BY timestamp, id
  LIMIT 10001
), retained AS (
  SELECT * FROM selected ORDER BY timestamp, id LIMIT 10000
)
SELECT jsonb_build_object(
  'schemaVersion', 'product-understanding-input-export-v1',
  'exportedAt', to_char(clock_timestamp() AT TIME ZONE 'UTC',
                       'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
  'truncated', (SELECT count(*) > 10000 FROM selected),
  'records', coalesce((SELECT jsonb_agg(jsonb_build_object(
    'sourceReference', 'LlmInferenceLog:' || id,
    'snapshot', "structuredResponse"
  ) ORDER BY timestamp, id) FROM retained), '[]'::jsonb)
);
COMMIT;
```

Record the actual deployment revision, flag-enabled interval, UTC export window,
SQL selection, captured count, capture-warning count and SHA-256 of the raw file
in a separate private manifest. Mark truncation explicitly. Do not treat a
missing capture as an empty vocabulary or null metadata.

This raw input export intentionally has no labels, language assignments or
semantic groups. The local evidence preparation step supplies those from actual
review, checks contamination, converts to request-snapshot.schema.json and then
freezes the evaluator dataset. `capturedAt` is the pre-inference boundary time,
not a reconstructed HTTP receipt time. Supplied values remain supplied evidence;
they cannot be scored as inferred answers. Capture IDs and source references
connect the export to its source; independently reviewed labels are still
required before a separately authorized evaluation run.
