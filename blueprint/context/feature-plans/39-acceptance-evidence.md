# Feature 39 acceptance evidence

Verified locally on 2026-10-21 on feature/ai-catalog-enrichment. External provider
responses were controlled; these checks establish application behavior, not
real-model classification accuracy or production deployment readiness.

## Final commands and results

| Gate | Result |
| --- | --- |
| npm run verify | 137 suites, 2100 tests; production build passed |
| npm run contract:check | 6 suites, 86 tests; 136 executable scenarios; generated bundle and documentation checks passed |
| npm run test:e2e -- --runInBand 'assisted-\|stock-ledger.e2e\|policy-aware-grocery.e2e' | 5 suites, 54 tests; all assisted suites plus existing stock ledger |
| npm run test:e2e -- --runInBand 'policy-aware-grocery' | 3 suites, 36 tests; existing grocery service, REST and MCP |
| npx eslint test/assisted-transport.e2e-spec.ts | Passed |
| graphify update . | AST graph refreshed |
| git diff --check | Passed |

Both E2E commands set ASSISTED_CATALOG_TEST_DATABASE_URL and DATABASE_URL to the
same dedicated PostgreSQL database at localhost:55439/feature39_test. All 17
migrations applied. A temporary postgres:16-alpine container supplied the database
and was stopped/removed after the run. Existing databases were not used.
The authenticated transport suite starts the actual Nest application and talks
to its REST route and MCP HTTP transport on an ephemeral loopback port.

## Acceptance matrix

Paths below are repository-relative. Unit evidence is included in Verify;
PostgreSQL/HTTP evidence is included in the two E2E commands above.

| Acceptance case | Evidence |
| --- | --- |
| Generic milk identity, original alias, missing metadata and unit | src/assisted-action/assisted-catalog-preparation.service.spec.ts tests the literal milk phrase; test/assisted-transport.e2e-spec.ts classifies an isolated milk fixture through the provider boundaries, persists both names and metadata, and commits stock through one authenticated request |
| Existing generic product reused for a new phrase | Preparation rechecks the generated name; test/assisted-catalog-writer.e2e-spec.ts reuses a compatible owner and preserves its aliases |
| Complete ID/exact alias bypasses AI | Preparation tests assert no naming or metadata calls; mixed known/new grocery and stock integration tests count provider calls |
| Hebrew/mixed input and meaningful product distinctions | Preparation tests retain multilingual aliases and distinct controlled identities for oat milk, infant formula and dish detergent |
| Explicit false and stored/supplied metadata precedence | Preparation and catalog policy unit tests; catalog writer integration fills missing fields, retains false and rejects conflicting snapshots |
| Optional metadata remains unknown | Transport integration commits a named grocery with four unresolved metadata fields and no follow-up confirmation |
| Ambiguity or missing required unit | Transport and stock integration return consolidated indexed needs_input and prove no product/receipt writes |
| Provider unavailable, invalid output, injection or deadline | Identity/preparation tests validate shape, confidence, membership, bounded candidates, prompt-data separation and deadlines; transport tests prove no-write unavailable responses |
| Later item fails | Grocery, stock and catalog writer integration verify rollback of products/aliases, domain writes and receipts |
| Alias ownership races | Catalog writer integration synchronizes competing creations and proves ownership never transfers |
| Two inputs resolve to one product | Batch preparation, grocery and stock tests reject duplicates without quantity aggregation or writes |
| Lost response, fresh service and cross-transport replay | Grocery integration replays persisted receipts from a new service instance; transport replays REST actions through MCP and vice versa; provider calls and writes are not repeated |
| Concurrent identical request or canonical creation | Catalog, grocery and stock integration prove one identity and one committed action per requestId; statistics run only for the winning commit |
| Pending grocery policy | Grocery integration preserves existing quantity by default and permits an explicitly separate line; agent scenarios require truthful returned_existing summaries |
| Stock versus purchase semantics | Stock integration proves PURCHASED versus STOCK_SET, purchase reset semantics, historical timestamps and preservation of newer stock |
| Authentication and provenance | Transport tests reject missing/wrong credentials before inference and reject client-supplied source on REST/MCP |
| Malformed, empty, oversized or mixed operation input | Request/schema unit tests, MCP object-schema tests and authenticated transport validation |
| Routine agent success and exceptional failure | 12 new scripted scenarios and validator mutation tests reject extra confirmation tools, missing replay identities, agent naming and success claims on failure |
| Compatibility | Existing stock ledger and grocery REST/MCP/service suites pass; fixture test proves all prior MCP tool definitions remain unchanged |

## Review and limits

- No open or fixed P0/P1 findings are recorded. The findings ledger's old audit
  concerns feature 38f, not this feature. No new audit or independent review was run.
- Regular Audit, Check and Try policies are manual. Independent review was not
  requested and has no receipt. This is implementation acceptance evidence.
- Prior broad lint attempts found untouched inventory unbound-method errors and
  MCP test formatting errors, recorded in Steps 5 and 6. No suppressions added.
- Real-model semantic accuracy, paid provider evaluation and live Hermes/OpenClaw
  deployment were not tested. No commit, merge, push, agent installation or
  deployment was performed. The receipt migration must accompany deployment.
- Manual entry points and payload rules are documented in docs/api-reference.md
  under Assisted household actions and the generated agent bundles. Real calls
  mutate household state and may use the configured model.
