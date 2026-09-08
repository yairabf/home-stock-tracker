---
name: online-grocery-store-integration
description: Plan, build, or operate an isolated online grocery store cart adapter
metadata:
  hermes:
    tags: [grocery, cart, browser-automation, external-integration]
---

# Online grocery store integration

Use this skill when an authorized household member asks to set up, inspect, or
fulfill a vendor cart through a store-specific adapter. It is a portable guide,
not an adapter for any particular retailer.

## Responsibility boundary

Home Stock Tracker owns the pending grocery list, products, completed
purchases, inventory facts, and prediction policy. A separate store adapter
owns the vendor catalog, browser profile, authentication, store-specific
selectors, product preferences, and vendor cart.

The adapter may read the pending list through Home Stock Tracker MCP. It must
not be imported by the NestJS service, change a service contract, or become the
source of truth for household grocery or inventory state.

Adding an item to a vendor cart is not a purchase. Keep the Home Stock Tracker
line pending until an authorized person reports an actual completed purchase.

## Required operating rules

- Work only with one store-specific adapter and its isolated resources.
- Resolve every generic grocery item to an authorized exact live store product.
  A name such as `milk` does not authorize a brand, package, fat percentage,
  variety, certification, or substitution.
- Use a saved product preference only after it passes a fresh live search. Ask
  again when the exact product disappears or materially changes.
- Treat cart quantity as a final target. An adapter may add only the verified
  remaining amount and must read the cart again before reporting success.
- Stop after an uncertain mutation result. Never infer success from click count
  or retry an uncertain write automatically.
- Use read-only discovery before implementing a store mutation.
- Restrict access to explicitly authorized identities and keep their private
  conversation history separate from shared operational cart state.

## Forbidden actions

- Do not expose WebDriver or noVNC publicly, bind either to `0.0.0.0`, or share
  an unauthenticated browser URL.
- Do not ask for, receive, log, store, or type passwords, OTPs, CAPTCHAs,
  passkeys, cookies, tokens, payment data, full account identifiers, or session
  IDs in chat.
- Do not check out, pay, change delivery details, submit an order, accept a
  substitution, or alter an address.
- Do not select the first search result, silently substitute a product, round an
  unsupported weighted quantity, or infer an unavailable package conversion.
- Do not reuse a profile, session-state file, selector, product ID, preference,
  port, or container belonging to another store integration.
- Do not modify a reference integration while developing another one. If an
  integrity check changes unexpectedly, stop and investigate.

## Operating sequence

1. Read [the build tutorial](references/build-tutorial.md) before provisioning.
2. Record the store contract and allocate isolated resources.
3. Run read-only discovery and implement the store adapter behind
   [the adapter contract](references/adapter-contract.md).
4. Have the account holder authenticate in the shared browser through a private
   localhost SSH tunnel.
5. Resolve approved products, use idempotent cart operations, and verify the
   final cart without completing any Home Stock Tracker line.

## Inputs that require clarification

Ask before continuing when the store identity, authorized caller, account owner,
exact product, package size, weighted target, conversion, cart state, or a
fulfillment modal choice is unknown. Make no mutation until the uncertainty is
resolved.
