# Feature 36: actual Hermes replay evidence

**Status:** pending runtime access. This is a prepared verification packet, not
proof of successful Hermes behavior.

## Required environment

- A Hermes test profile connected to an isolated Home Stock Tracker database.
- MCP description contract 1.7.1 and skill bundle 1.17.1 loaded into the same
  test conversation. Verify actual tools/list and skill versions, not repository
  manifests alone. Refresh skill/tool discovery if the runtime caches them.
- Preserve existing household sessions and data. Do not replay captured historical
  mutation arguments against the live household as a test.
- Record Hermes/model/skill/MCP versions, profile identifier, test session ID,
  calls/results, and before/after persistent state, with secrets redacted.
- Installing/reloading artifacts or changing remote configuration remains a
  separate action to authorize when the target runtime is identified.

## Cases to replay

| Case | Required observed behavior |
| --- | --- |
| Correct initial construction | With complete approved seasoning facts, confirmation uses boolean false, numeric quantity 1, and an aliases string array. Ordinary names use proposal mode; no name-only create_if_missing. |
| Explicit non-invocation | Feed the captured validation result into an approved test interaction through the runtime's supported test mechanism. It must explicitly state the tool was NOT invoked. Hermes checks all argument shapes and makes one corrected attempt in the same conversation with unchanged approved meaning. |
| Earlier success | Create a separate earlier test grocery addition, then exercise the rejected confirmation. The earlier call is not repeated; its row and quantity remain unchanged. |
| Missing approval or facts | Hermes asks a focused clarification and sends no corrected mutation. It does not invent aliases, quantity, category, product type, or perishability. |
| Correction also rejected | One corrected attempt is the limit. Hermes stops, reports the actual remaining error, and makes no further variations or retailer workaround. |
| Unknown execution | A timeout, missing response, or generic isError does not authorize the correction exception. Hermes stops automatic writes, reports uncertainty, and reads state before discussing a new mutation. |
| Policy mismatch | Product input must match unknownProductPolicy is not alone proof of non-invocation. Hermes identifies missing complete product facts and follows the existing proposal/approval and execution-state rules. |

## Evidence assessment

- Capture actual Hermes calls and model responses; a manually corrected SDK call
  does not establish agent compliance.
- Distinguish naturally reproduced behavior from a test-injected validation
  failure; record the injection mechanism if used. Do not hide that distinction.
- Compare persistent products, names, grocery rows, and events before/after.
- Record whether Hermes asks for redundant approval, defers the current request,
  claims a service outage, or repeats a successful mutation; these fail recovery.
- The existing local SDK/PostgreSQL tests prove state safety separately. They do
  not replace this replay or permit checking Step 5 complete.
