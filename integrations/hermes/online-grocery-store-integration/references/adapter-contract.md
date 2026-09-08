# Store adapter contract

A production store helper exposes only these commands:

```text
status
cart
search --query <localized-query>
ensure --query <localized-query> --product-id <exact-id> --quantity <target>
```

The helper preserves source display text and returns structured output suitable
for agent decisions. It never exposes credentials, cookies, tokens, full account
identifiers, or WebDriver session IDs.

## Common result states

| State | Meaning and required behavior |
| --- | --- |
| `ok` | The requested read or verified mutation completed. |
| `login_required` | The browser exists but requires account-holder login. Stop. |
| `not_found` | No exact requested product is available. Do not substitute. |
| `already_satisfied` | The cart already meets or exceeds the requested final target. |
| `needs_user_choice` | Product identity, package, preference, or quantity needs an authorized decision. |
| `needs_fulfillment_choice` | A delivery, address, or fulfillment modal blocks progress. Preserve verified quantity and ask. |
| `browser_unavailable` | The recorded browser session cannot be safely used. Do not create a duplicate before liveness checks. |
| `not_implemented` | A generated or incomplete adapter has no store-specific implementation. Exit non-zero. |
| `error` | A non-recoverable adapter error occurred. Preserve diagnostic context without secrets. |

An uncertain transport result after a mutation is not `ok`. Stop without retrying
and require a fresh, verified cart read before a new user decision.

## `status`

Probe the recorded WebDriver session directly. Return a privacy-safe URL, page
title, and authenticated state, distinguishing `ok`, `login_required`,
`browser_unavailable`, and `error`. Do not interpret Grid readiness alone as a
session failure when its single slot may be occupied.

## `search`

Search in the store's actual locale and return visible, available live results
in deterministic DOM order. Each result includes:

- Stable store product ID.
- Exact localized display name.
- Brand when available.
- Package size or weight and unit.
- Availability.
- Current price when available.

Exclude disabled products and hidden carousel clones, including nodes under
`aria-hidden=true`. Preserve exact display text and never choose a result because
it appears first.

## `cart`

This is read-only. Return verified item names, quantities, units, line prices,
and total where reliable. It must distinguish a truly empty cart from parser
failure. When semantic selectors fail but visible cart text contains products,
return an explicit parser warning rather than claiming the cart is empty.

## `ensure`

`ensure` means: make the cart contain at least the requested final quantity of
one approved exact product.

```text
current >= target  -> no mutation; return already_satisfied
current < target   -> apply only the verified remaining increment
current unknown    -> stop; never infer from click count
```

Before mutation, run a fresh search and verify the exact saved or requested
product still appears. Open the visible card with a real WebDriver element click,
read its current quantity, and increment by only the remaining amount. Detect a
blocking fulfillment modal after every increment. Read the final cart state
before returning `ok`.

If a modal interrupts the operation, preserve the verified quantity and return
`needs_fulfillment_choice`. After an authorized decision, resume only the
remaining delta. Never retry automatically after an uncertain mutation result.

## Quantity rules

Packaged and weighted products have separate semantics. Support the store's
actual increment for each product. Parse localized decimal commas while
preserving the displayed source text, compare weighted values with a documented
floating-point tolerance, and ask when an explicit target cannot be represented.
Never silently round a weighted quantity or invent a package conversion.

## DOM rules

- A product control can be `[role=button]`; do not require a literal `button`.
- Prefer WebDriver element clicks to injected JavaScript `click()` calls.
- Re-query after page changes instead of retaining stale references.
- Wait for checkable DOM conditions rather than arbitrary long sleeps.
- Do not rely solely on `offsetParent` for fixed or teleported modals.
- Identify a product dialog by product identity and controls, not its generic
  dialog role alone.

## Exact product preferences

Preferences are non-secret and store only the generic source-list name,
localized search query, exact stable store product ID, exact current product
name, confirming authorized person, and an optional explicitly approved recurring
target quantity.

Save a preference only after an authorized person selects one exact live result.
Verify its ID and name in a fresh current search before reuse. Ask again when it
disappears or materially changes. Keep identity separate from quantity, require
an explicit target for weighted products, and never use price as identity.

Never store cookies, credentials, tokens, account identifiers, or browser state
in preferences. Never silently substitute another product.
