# Feature: Product search and resolution proposals

**Proposed build-plan:** feature 29
**Status:** queued design
**Depends on:** feature 27
**Intended history file:** `blueprint/history/features/29-product-search-and-resolution-proposals.md`

## Goal

Provide deterministic, read-only product discovery and optional LLM-assisted
resolution proposals without mutating the catalog. Give REST, MCP, UIs, and agents
the same bounded candidates and keep all database access inside the application.

## Locked design decisions

- Exact canonical and alias lookup uses the authoritative `ProductName` namespace.
- Unresolved phrases use deterministic token-prefix and substring candidate search.
- Candidate ranking is stable:
  1. Canonical token-prefix match.
  2. Alias token-prefix match.
  3. Canonical substring match.
  4. Alias substring match.
  5. Shorter matching name.
  6. Normalized name alphabetically.
  7. Product ID as final tie-breaker.
- Return at most 20 unique products.
- Candidates are server facts and are returned separately from LLM advice.
- The optional LLM receives only bounded, allowlisted catalog fields selected by
  application code. It has no database connection, credentials, Prisma access,
  arbitrary query facility, or write capability.
- Use one structured LLM call after deterministic candidate retrieval.
- The LLM may recommend creating a product, adding an alias to a supplied candidate,
  or asking the user to choose. It may suggest canonical name, aliases, category,
  typical unit, product type, and perishability.
- Candidate product IDs returned by the LLM must have been supplied in the request
  and must be revalidated by the server.
- Malformed, unsafe, unavailable, refused, timed-out, or low-confidence advice is
  discarded. Deterministic candidates still return successfully with
  `proposal: null`.
- Proposals are stateless, advisory, non-mutating, and client-neutral.
- Logs retain only allowlisted validated proposal output and provider metadata, not
  raw prompts or catalog context.

## In scope

- A shared read-only product search service or repository method.
- Exact, alias, token-prefix, and normalized substring matching.
- Exact and supported prefix lookup use namespace indexes. Substring matching may
  use a bounded database scan for the small household catalog until typo-tolerant or
  trigram infrastructure is justified.
- Stable candidate ranking and hard limits.
- Read-only REST product search endpoint.
- `search_products` read-only MCP tool that never invokes the LLM.
- A separate shared resolution method, used by proposal-mode grocery addition, that
  can request optional LLM advice after deterministic candidate retrieval.
- A provider-neutral product resolution proposal schema.
- Optional classifier integration using one bounded candidate set.
- Structured outcomes that distinguish exact match, candidates, unknown, and
  advisory proposal availability.
- Focused MCP descriptions and API docs that forbid auto-selection when several
  plausible products remain.
- Resolution of the tracked MCP-04 product discovery gap.
- Refactoring feature 8's product classifier so it proposes identity changes rather
  than applying aliases or creating products automatically.

## Out of scope

- Any catalog or grocery-list mutation.
- LLM database or provider-native tool access.
- Two-call LLM retrieval.
- Whole-catalog prompting.
- Typo correction, `pg_trgm`, vector search, embeddings, or semantic search.
- Confirmation endpoints and unknown-product add policies.
- Product merge, rename, or alias removal.

## Public contracts

Read-only search example:

```json
{
  "query": "milk",
  "limit": 10
}
```

Response:

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
      "isPerishable": true
    }
  ],
  "proposal": {
    "recommendation": "create_product",
    "newProduct": {
      "canonicalName": "3% Milk",
      "aliases": ["Three Percent Milk"],
      "category": "dairy",
      "typicalUnit": "carton",
      "productType": "fast_consumable",
      "isPerishable": true
    },
    "targetProductId": null,
    "confidence": 0.91,
    "reason": "The percentage may represent a separately tracked product."
  }
}
```

An alias recommendation identifies only a validated supplied candidate:

```json
{
  "recommendation": "add_alias",
  "targetProductId": "product-uuid",
  "alias": "Three Percent Milk",
  "confidence": 0.88,
  "reason": "The phrase appears to identify the supplied product."
}
```

## Domain and security rules

- Exact unique matches do not require an LLM call.
- Candidate search returns each product once even if several of its names match.
- The application supplies only product ID, canonical display name, alias display
  names, category, typical unit, product type, and perishability.
- Do not supply grocery lines, notes, inventory history, purchases, predictions,
  household profile, authentication data, logs, or internal configuration.
- Provider adapters receive plain structured input only. They never receive a
  database client or generated SQL.
- The server computes valid actions independently of the recommendation.
- A recommendation never restricts the user's options or authorizes a write.
- Any selected candidate ID is reloaded before later mutation by another feature.
- If safe candidate retrieval cannot produce a bounded result, skip the LLM rather
  than truncate arbitrarily.

## Build steps

- [ ] **Step 1 - Lock deterministic search contracts** - define query validation,
      candidate DTOs, match categories, ranking, deduplication, and the maximum of 20.
      **Done when:** focused tests prove exact, alias, prefix, substring, stable tie
      ordering, deduplication, blank-query handling, and hard-cap behavior.
- [ ] **Step 2 - Implement shared indexed product search** - query the namespace and
      assemble compact unique product candidates without loading the whole catalog.
      **Done when:** service tests prove deterministic results from the authoritative
      names and no write occurs.
- [ ] **Step 3 - Expose deterministic REST and MCP discovery** - add thin read-only
      `search_products` transports over the shared search service without invoking
      the LLM. **Done when:** REST and real MCP contract tests return the same
      ordering and fields, enforce limits, and never create a product or call a
      provider.
- [ ] **Step 4 - Lock advisory proposal schemas and context allowlist** - define strict
      proposal input/output and logging shapes. **Done when:** tests reject unknown
      candidate IDs, extra sensitive fields, invalid actions, malformed metadata, and
      out-of-range confidence.
- [ ] **Step 5 - Integrate optional one-call LLM advice** - add a shared resolution
      method that sends bounded candidates to the provider-neutral classifier,
      validates its result, and returns it separately from candidates. Keep public
      `search_products` deterministic and provider-free. **Done when:** exact matches
      bypass the LLM, valid advice is returned without mutation through resolution,
      and every provider failure degrades to `proposal: null` without failing the
      caller.
- [ ] **Step 6 - Align logs, docs, and agent guidance** - store only validated proposal
      output and provider metadata; update API docs, MCP descriptions, Hermes skill,
      and scenarios. **Done when:** MCP-04 acceptance criteria are covered and no
      guidance permits an agent to silently select among multiple candidates.

## Files / areas

- `src/product/` search, proposal types, classifier, and tests
- `src/llm/` provider-neutral structured schemas where required
- `src/mcp/mcp-server.factory.ts`
- Product controller and DTOs
- `src/product/product-classification-log.service.ts`
- REST, MCP, and E2E tests
- `integrations/hermes/home-stock-tracker/`
- `docs/api-reference.md`
- `blueprint/context/bugs/mcp-04-no-agent-safe-product-search-or-catalog-discovery.md`

## Data / contracts

- No new proposal table. Proposal state remains with the client for the short
  confirmation conversation.
- Existing inference logs may store validated results, provider/model, confidence,
  prompt version, and status only.
- The LLM provider interface remains one-shot structured generation.
- Search reads from the indexed `ProductName` namespace introduced by feature 27.

## Testing

- Unit tests for ranking, normalization integration, limits, and candidate
  deduplication.
- Service tests proving read-only behavior and exact-match bypass.
- Strict schema tests for safe proposal results and selected-ID validation.
- Provider-adapter tests proving only allowlisted candidate context is sent.
- REST and MCP contract tests for deterministic ordering and unavailable LLM.
- Regression tests proving proposal generation never creates products or aliases.
- Run `npm test`, `npm run test:e2e`, and `npm run build`.

## Acceptance criteria

- Clients can discover exact and nearby products without guessing or mutating data.
- The same input and catalog state produce the same bounded candidate order.
- The optional LLM sees only allowlisted candidates and returns advice only.
- LLM failure never becomes a search or grocery API failure.
- Candidate facts remain usable when no proposal exists.
- MCP-04 is fully absorbed by the implemented public contract and guidance.

## Handoff notes

When activating this plan, verify feature 27 is complete and reconcile the tracked
MCP-04 brief with current source. Copy the final spec into `current-feature.md`
through `/feature`. Do not add confirmation writes in this feature.
