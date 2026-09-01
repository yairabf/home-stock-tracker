# Feature: Product search and resolution proposals

**From build-plan:** feature 29
**Status:** complete
**Depends on:** feature 27 (complete)
**Intended history file:** `blueprint/history/features/29-product-search-and-resolution-proposals.md`

## Completion record

**Completed:** 2026-09-01

Implemented deterministic, read-only product discovery across shared application, REST, and MCP boundaries. Search uses indexed exact namespace lookup followed by bounded PostgreSQL token-prefix and literal substring ranking, returns compact stable product projections, includes prediction-disabled identities, and never invokes an LLM or mutates state. Added a separate internal resolution service with strict create, alias, and user-choice proposal schemas, allowlisted context, a 16,384-byte budget, one-call timeout handling, candidate-ID revalidation, safe `proposal: null` degradation, and validated non-blocking inference logging. Updated API documentation, Hermes guidance and executable scenarios, and resolved MCP-04.

**Main changed areas:**

- `src/product/types/`, `product-search.service.ts`, and `product-resolution*.ts` - lock search, proposal, context, ranking, timeout, validation, and logging behavior.
- `src/product/dto/`, `product.controller.ts`, and `product.module.ts` - expose authenticated REST discovery and register shared internal services.
- `src/mcp/mcp-server.factory.ts` and MCP tests - expose provider-free `search_products` with a discoverable strict runtime schema.
- `test/product-search*.e2e-spec.ts` and `test/product-resolution.service.e2e-spec.ts` - prove PostgreSQL ranking, REST/MCP parity, authentication, limits, provider bypass, no mutation, and grocery compatibility.
- `docs/api-reference.md` and `integrations/hermes/home-stock-tracker/` - document deterministic discovery and require explicit user choice among multiple candidates.
- `blueprint/context/bugs/` - record MCP-04 acceptance evidence and resolution.
- `graphify-out/` - refresh the project knowledge graph after implementation.

**Verification:**

- `npm test -- --runInBand` - 513 tests passed across 42 suites.
- `DATABASE_URL='postgresql://home_stock:home_stock@localhost:55432/home_stock_tracker?schema=public' npm run test:e2e` - 131 tests passed across 17 suites against PostgreSQL 16 after `npm exec prisma migrate deploy`.
- `npm run build` - NestJS production build passed.
- ESLint on every affected source and test file passed during each reviewed step.
- `graphify update .` completed after the final changes.
- Behavioral evidence: authenticated REST, real Streamable HTTP MCP client, in-memory MCP runtime schema, PostgreSQL service, provider-bypass, no-write, byte-budget, timeout, logging allowlist, and legacy `GroceryService.addItem` compatibility tests all passed.
- Manual path: call `GET /api/v1/products/search?query=milk&limit=10` with the service bearer token, or call MCP `search_products` with the equivalent arguments.

**Material deviations:**

- Added a PostgreSQL `REPEATABLE READ` snapshot around exact lookup, candidate ranking, and hydration so concurrent namespace inserts cannot change an exact match into a candidate mid-search.
- Existing candidate aliases are not count-truncated; the complete ordered alias set is governed by the documented 16,384-byte context budget.
- No schema migration or new search index was needed.

## Goal

Provide deterministic, read-only product discovery and optional LLM-assisted resolution advice without mutating catalog or grocery state. REST, MCP, future UIs, and later grocery proposal flows must receive the same bounded product facts, while all database access remains inside the application.

## In scope

- Add a focused `ProductSearchService` over the authoritative `ProductName` namespace.
- Support indexed exact canonical and alias lookup plus deterministic token-prefix and literal substring candidates.
- Return one result per product, ranked by its best matching name, with a hard result cap.
- Add a provider-free REST product search endpoint.
- Add a provider-free, read-only MCP `search_products` tool.
- Return all products regardless of `predictionEnabled`; expose that field as product metadata rather than hiding valid catalog identities.
- Add a separate internal `ProductResolutionService` that combines deterministic facts with optional one-call LLM advice for feature 30.
- Add strict provider-neutral schemas for advisory create, alias, and user-choice proposals.
- Bound and allowlist all LLM context, revalidate provider output, and degrade safely to `proposal: null`.
- Persist only fully validated proposal output and provider metadata in the existing inference log.
- Update API documentation, MCP descriptions, Hermes guidance, scenarios, and MCP-04 tracking.

## Out of scope

- Any product, product-name, grocery, inventory, prediction, or household mutation.
- Replacing the current mutating `findOrCreateByExactOrAliasMatch` grocery path. Feature 30 owns that switchover so existing `grocery_add` behavior remains compatible meanwhile.
- Public proposal generation through `search_products`; public search is deterministic and provider-free.
- Applying a proposal, confirmation endpoints, or unknown-product add policies.
- LLM database access, tool calling, two-call retrieval, or whole-catalog prompting.
- Typo correction, `pg_trgm`, full-text search, vectors, embeddings, or semantic search.
- Product merge, rename, deletion, or alias removal.
- A new proposal table or durable proposal IDs.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff, not full files; you read and understand it.
4. You approve, then choose whether to commit a checkpoint or continue.
   Checkpoints are optional; `/complete` makes the feature-level commit.

Never accept a step you have not read. If a diff is too big to review, split the step.

## Build steps

- [x] **Step 1 - Lock search contracts and pure ranking** - define query validation, compact public product projections, internal match metadata, token-prefix semantics, best-name deduplication, stable ranking, and limits as focused types and pure tests. *Done when:* tests cover canonical and alias exact matches, canonical and alias token-prefix and substring matches, multi-token matching, literal `%`, `_`, and backslash input, best-name deduplication, every ranking tie-breaker, blank and overlong queries, default and maximum limits, and the hard cap.
- [x] **Step 2 - Implement bounded namespace search** - add `ProductSearchService` with indexed unique exact lookup, then one parameterized PostgreSQL query for token-prefix and literal substring candidates, ranking and deduplicating before loading complete product names. Keep prefix and substring scans as the documented small-catalog tradeoff; add no search migration or new infrastructure. *Done when:* service and database-backed tests prove authoritative namespace reads, exact-match short-circuiting, stable unique-product order, limit-before-hydration behavior, inclusion of prediction-disabled products, and no persistence mutation.
- [x] **Step 3 - Expose deterministic REST discovery** - add validated query DTOs, explicit response DTOs, and a static `GET /products/search` route declared before `GET /products/:id`. *Done when:* REST contract tests prove the documented defaults and errors, exact-match versus candidate response branches, stable fields and ordering, authentication behavior, no provider call, and no catalog or grocery mutation.
- [x] **Step 4 - Expose deterministic MCP discovery** - register `search_products` over the same service and update real MCP tool-list and schema coverage. Its description must require presenting multiple plausible candidates instead of silently choosing one. *Done when:* a real MCP client discovers the tool, receives the same product order and fields as REST, cannot exceed the cap, never invokes an LLM, and never writes state.
- [x] **Step 5 - Add bounded advisory product resolution** - define a strict discriminated proposal union and add a separate internal `ProductResolutionService`. Exact matches return without candidate search or an LLM call; unresolved input reuses deterministic candidates, constructs allowlisted bounded context, makes at most one structured provider call, validates and normalizes the result, revalidates all candidate IDs, and returns proposal facts separately. Leave the legacy mutating grocery resolver unchanged. *Done when:* tests prove valid create, alias, and user-choice advice; exact-match bypass; approved display-case preservation; candidate-ID checks; context byte and field bounds; low-confidence, malformed, refused, timed-out, unsafe, and unavailable degradation to `proposal: null`; and zero domain-state mutation.
- [x] **Step 6 - Add safe proposal logging and align guidance** - record only fully validated successful proposals plus provider, model, prompt version, confidence, and status in the existing inference log, without raw prompts or candidate context. Update API docs, MCP descriptions, Hermes skill/scenarios, and mark MCP-04 resolved once its acceptance tests pass. *Done when:* logging tests prove the allowlist and non-blocking behavior, public docs distinguish provider-free search from internal advisory resolution, and no guidance permits silent selection among multiple candidates or claims that a proposal performs a write.

## Files / areas

- `src/product/product-search.service.ts` and focused tests
- `src/product/product-resolution.service.ts` and focused tests
- `src/product/product-resolution-log.service.ts` and focused tests
- `src/product/types/` for search matches, public results, and proposal schemas
- `src/product/dto/` for REST query and response contracts
- `src/product/product.controller.ts`
- `src/product/product.module.ts`
- `src/product/product.service.ts` only where shared exact lookup needs a non-mutating boundary; do not replace the legacy grocery resolver
- `src/llm/` only if the existing provider-neutral structured-generation contract needs reusable limits or types
- `src/mcp/mcp-server.factory.ts` and real MCP contract tests
- Product search and resolution unit, service, database-backed, and E2E tests
- `integrations/hermes/home-stock-tracker/`
- `docs/api-reference.md`
- `blueprint/context/bugs/mcp-04-no-agent-safe-product-search-or-catalog-discovery.md`
- `blueprint/context/bugs/triage.md` if it still indexes MCP-04 as open

## Data / contracts

### Search request

REST uses query parameters and MCP uses the equivalent structured input:

```json
{
  "query": "milk",
  "limit": 10
}
```

- `query` is required, normalized with the existing product-name normalization, non-blank, and at most 200 characters after display normalization.
- `limit` defaults to `10`, must be an integer from `1` through `20`, and can never raise the server cap.
- Search includes prediction-enabled and prediction-disabled products. Identity discovery must not hide a catalog product because prediction is disabled.

### Deterministic search response

```json
{
  "exactMatch": null,
  "candidates": [
    {
      "id": "product-uuid",
      "canonicalName": "3% Milk",
      "aliases": ["Three Percent Milk"],
      "category": "dairy",
      "typicalUnit": "carton",
      "productType": "fast_consumable",
      "isPerishable": true,
      "predictionEnabled": true
    }
  ]
}
```

- Public REST and MCP search return only `exactMatch` and `candidates`. They never return `proposal` and never invoke the LLM.
- An exact canonical or alias match returns that product in `exactMatch` and returns `candidates: []`.
- If there is no exact match, `exactMatch` is `null` and candidates contain at most `limit` unique products.
- Public candidates do not expose internal matched-name or match-category metadata.
- Approved canonical and alias display spelling and deterministic alias ordering come from the feature 27 namespace projection.

### Match and ranking rules

- Search compares normalized names from `ProductName`.
- A token-prefix match means each normalized query token is a prefix of the corresponding token in one contiguous token sequence in the stored normalized name. A one-token query may match any stored-name token.
- Substring matching treats the normalized query as literal text, not a SQL wildcard pattern.
- Each product is represented by its best matching name.
- Candidate order is:
  1. Canonical token-prefix.
  2. Alias token-prefix.
  3. Canonical substring.
  4. Alias substring.
  5. Shorter matching normalized name using PostgreSQL `char_length`.
  6. Matching `normalizedName` in PostgreSQL `COLLATE "C"` order.
  7. Product ID in PostgreSQL `COLLATE "C"` order.
- The exact unique lookup uses the existing `ProductName.normalizedName` index. Token-prefix and substring search may scan the small household namespace in one bounded query. No claim is made that token-boundary or substring matching is index-backed.
- Ranking and unique-product limiting occur in the database before complete product projections are hydrated, so aliases from one product cannot crowd out other products.

### Internal resolution response

The internal service used by feature 30 returns deterministic facts plus separate advice:

```json
{
  "exactMatch": null,
  "candidates": [],
  "proposal": null
}
```

- Exact matches bypass candidate search and the LLM.
- Candidate facts remain usable when `proposal` is `null`.
- Proposal generation may add a validated `LlmInferenceLog`; "non-mutating" means it never changes product, name, grocery, inventory, prediction, or household domain state.

### Proposal union

`create_product`:

```json
{
  "recommendation": "create_product",
  "newProduct": {
    "canonicalName": "3% Milk",
    "aliases": ["Three Percent Milk"],
    "category": "dairy",
    "typicalUnit": "carton",
    "productType": "fast_consumable",
    "isPerishable": true
  },
  "confidence": 0.91,
  "reason": "The percentage may represent a separately tracked product."
}
```

`add_alias`:

```json
{
  "recommendation": "add_alias",
  "targetProductId": "product-uuid",
  "alias": "Three Percent Milk",
  "confidence": 0.88,
  "reason": "The phrase appears to identify the supplied product."
}
```

`ask_user_to_choose`:

```json
{
  "recommendation": "ask_user_to_choose",
  "candidateProductIds": ["product-a", "product-b"],
  "confidence": 0.72,
  "reason": "More than one supplied product is plausible."
}
```

- The union is strict and mutually exclusive. Extra fields or fields from another branch invalidate the result.
- `add_alias.targetProductId` and every `ask_user_to_choose.candidateProductIds` entry must be unique and present in the exact candidate set sent to the provider.
- `ask_user_to_choose` requires at least two supplied candidate IDs.
- Confidence is finite and between `0` and `1`; advice below the locked implementation threshold is discarded.
- Generated display names use NFKC, trim, and internal whitespace collapse while preserving approved case. Identity keys use the existing normalized-name utility.
- Generated strings, alias counts, arrays, and reasons have explicit schema maxima locked in focused tests. Invalid output is discarded, never partially repaired into another recommendation.
- The server computes later allowed actions independently. Advice neither authorizes nor restricts a write.

### LLM context and logging

- One provider call receives only the normalized requested phrase and at most 20 candidates with: product ID, canonical display name, alias display names, category, typical unit, product type, and perishability.
- Candidate aliases retain deterministic namespace order. Do not select a semantically convenient subset.
- The complete serialized structured input must not exceed `16,384` UTF-8 bytes. If complete allowlisted context does not fit, skip the provider call and return `proposal: null` rather than arbitrarily truncating facts.
- Provider code receives plain structured input only, with no Prisma client, database credentials, SQL, arbitrary query facility, grocery data, notes, inventory history, purchases, predictions, household profile, authentication data, logs, or internal configuration.
- Only fully server-validated successful proposal output plus provider, model, prompt version, confidence, and status may be persisted. Raw prompts and catalog context are never stored.
- There is no schema migration and no proposal ID. Advisory state remains client-held for a short confirmation conversation.

## Testing

- Pure unit tests cover normalization integration, tokenization, literal matching, every rank category and tie-breaker, best-name deduplication, query and limit boundaries, and deterministic ordering.
- Product search service tests cover indexed exact matching, exact bypass, database ranking, unique-product limiting before hydration, prediction-disabled products, and read-only behavior.
- REST E2E tests cover exact, candidate, unknown, invalid query, invalid limit, hard cap, response projection, and authentication.
- Real MCP tests cover tool discovery, runtime input schema, exact/candidate/unknown results, hard cap, tool ordering, no provider call, and no writes.
- Proposal schema and service tests cover all union branches, unknown or duplicate candidate IDs, output normalization, confidence threshold, context allowlist and byte budget, provider failure modes, and absence of domain mutations.
- Provider tests assert the exact input keys and prove no database or sensitive domain fields are supplied.
- Logging tests prove only validated successful output and allowlisted metadata are stored, and logging failure does not fail resolution.
- Regression tests prove `grocery_add` retains its existing behavior until feature 30 replaces the legacy mutating resolver.
- Run `npm test`, `npm run test:e2e`, and `npm run build` after each affected step because no `Verify` command is configured.

## Notes for the AI

- Keep controllers and MCP handlers thin. Search, ranking, context construction, proposal validation, and logging belong in focused injectable services.
- Do not expand the already large `ProductService` into search and advisory orchestration. Reuse only its namespace projection and exact-lookup boundaries where appropriate.
- Do not alter `GroceryService.addItem` or remove automatic classification/create behavior in this feature. That would break the active contract before feature 30 installs policy-aware addition.
- Prefer a parameterized PostgreSQL query for rank and product deduplication. Never interpolate query text, and do not use raw `LIKE` semantics that treat `%` or `_` as wildcards.
- Use explicit database collation in ordering. Do not use environment-dependent `localeCompare` for a public deterministic contract.
- Do not add a search index migration unless measured evidence disproves the documented small-catalog scan tradeoff.
- Preserve feature 27's approved display spelling, global identity uniqueness, stable alias order, conflict translation, and catalog-integrity behavior.
- The public search contract supersedes MCP-04's proposed `includePredictionDisabled` filter: all identities are discoverable and `predictionEnabled` is returned as metadata.
- Keep comments sparse and limited to non-obvious query, security, or compatibility decisions.
