# Queued Feature Plans

These files capture the agreed product-catalog and grocery-list design as a
reviewable implementation queue. They are design inputs, not active Blueprint
specs.

Only one feature may be active at a time. To begin one:

1. Select the next uncompleted plan whose dependencies are complete.
2. Reconcile it with the current repository state.
3. Copy it into `blueprint/context/current-feature.md` through `/feature`.
4. Implement and complete it through the normal Blueprint workflow.

Do not implement directly from several files in this directory at once.

## Recommended order

| Order | Plan | Depends on | Intended history filename |
|---|---|---|---|
| 27 | [Product name namespace](27-product-name-namespace.md) | None | `27-product-name-namespace.md` |
| 28 | [Grocery quantity contract](28-grocery-quantity-contract.md) | None | `28-grocery-quantity-contract.md` |
| 29 | [Product search and resolution proposals](29-product-search-and-resolution-proposals.md) | 27 | `29-product-search-and-resolution-proposals.md` |
| 30 | [Policy-aware grocery additions](30-policy-aware-grocery-additions.md) | 27, 28, 29 | `30-policy-aware-grocery-additions.md` |
| 31 | [Confirmed grocery catalog decisions](31-confirmed-grocery-catalog-decisions.md) | 30 | `31-confirmed-grocery-catalog-decisions.md` |

The sequential implementation order is `27 -> 28 -> 29 -> 30 -> 31`.

## Deferred work

The design discussion identified these later capabilities, but they are not
implementation-ready plans in this queue:

- Merge multiple pending grocery lines.
- Rename a canonical product name.
- Remove an alias.
- Merge or delete products.
- Per-household catalogs and multi-household catalog governance.
- LLM tool calling or a two-call catalog retrieval flow.
- Typo-tolerant, trigram, vector, or semantic product search.

## Shared decisions

- `ProductService` owns catalog identity and metadata.
- `GroceryService` owns grocery-list behavior and coordinates catalog work when
  adding an item is the primary use case.
- Canonical names and aliases are strict identity terms. Similar products remain
  separate products.
- The application, not the LLM, owns all database access.
- The LLM receives only allowlisted catalog context and returns advisory,
  structured proposals. It never writes or queries the database directly.
- User-approved confirmation payloads are deterministic and do not invoke the
  LLM again.
- REST, MCP, and future clients use shared application services. MCP descriptions
  contain correctness-critical protocol rules; an agent-specific skill adds only
  conversational guidance.
- Existing pending grocery items are never incremented or replaced implicitly.
  The service returns `confirmation_required`, and clients resolve quantity intent
  before sending a final absolute value.
