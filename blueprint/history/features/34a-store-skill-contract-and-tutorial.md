# Feature: Store-skill contract and tutorial

**From build-plan:** feature 34a
**Status:** verified

## Goal

Create a repository-owned tutorial and contract for a future online-grocery
store skill. It must let an agent or developer design an isolated, safe vendor
cart adapter that reads the existing Home Stock Tracker grocery contract without
changing service domain behavior or requiring the private Rami Levy integration.

## In scope

- A portable documentation bundle at
  `integrations/hermes/online-grocery-store-integration/` with `SKILL.md`,
  `README.md`, `references/build-tutorial.md`, and
  `references/adapter-contract.md`.
- The service/store-adapter boundary: Home Stock Tracker owns grocery and stock
  state; vendor authentication, browser sessions, catalog search, cart state,
  selectors, and checkout remain outside the NestJS service.
- Required preflight fields, per-store resource isolation, collision checks, and
  Rami Levy reference-integrity checks that use only placeholders and
  privacy-safe status information.
- Persistent authenticated browser design, localhost-only Selenium and noVNC,
  SSH-tunnel account-holder login/OTP handoff, direct session probing, and
  privacy restrictions.
- Read-only discovery guidance, DOM interaction rules, exact localized product
  resolution, non-secret preference ownership rules, and the `status`, `cart`,
  `search`, and idempotent `ensure` adapter contract.
- Home Stock Tracker grocery-list workflow, cross-channel authorization and
  privacy rules, required structured outcomes, and the live verification matrix.
- A link from `docs/agent-integrations.md` that identifies vendor fulfillment as
  a separate integration and points to the portable tutorial.

## Out of scope

- The scaffold generator, generated preference helper, preference registry, and
  its automated tests. Those belong to feature 34b.
- Any actual store adapter, Rami Levy modification, vendor selector, account,
  credential, browser profile, session state, port, product preference, or live
  browser/container operation.
- NestJS modules, Prisma schema, REST/MCP contract semantics, prediction logic,
  checkout, payment, address changes, order submission, substitutions, or
  marking a grocery line purchased when it is merely placed in a store cart.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan the next step before editing.
2. Implement only that step and show its diff for review.
3. Verify its observable done-when before proceeding.
4. Keep checkpoints optional; `/complete` makes the feature commit after all
   steps and final checks pass.

## Build steps

- [x] **Step 1 - Create the portable integration bundle boundary** - add the
  skill and README skeletons, define triggers and the strict Home Stock
  Tracker/vendor-adapter boundary, and state all prohibited operations. *Done
  when:* the bundle is self-contained, references only placeholders, and makes
  no runtime dependency on Rami Levy or the NestJS application.
- [x] **Step 2 - Document isolation and private authentication** - write the
  resource allocation, existing-integration integrity, persistent browser,
  liveness, localhost binding, and account-holder SSH-tunnel handoff guidance.
  *Done when:* a reader can provision an isolated browser without exposing
  noVNC/WebDriver or requesting secrets in chat, and knows when to stop after an
  unexpected reference-integrity change.
- [x] **Step 3 - Define the adapter and product-resolution contracts** - add
  `adapter-contract.md` covering privacy-safe `status`, exact localized
  `search`, verified read-only `cart`, idempotent `ensure`, result states,
  weighted quantities, DOM rules, and authorized exact-product preferences.
  *Done when:* the contract never allows first-result selection, inferred cart
  quantity, automatic retry after an uncertain mutation, or silent weighted
  rounding.
- [x] **Step 4 - Write the end-to-end build and verification tutorial** - add
  discovery, vendor-cart fulfillment, cross-channel privacy, and live test
  matrix guidance; link it from the repository integration guide. *Done when:*
  the tutorial keeps Home Stock Tracker lines pending until a real purchase is
  reported and the public guide clearly labels vendor fulfillment as separate.
- [x] **Step 5 - Validate the documentation surface** - check links, paths,
  command placeholders, prohibited-content boundaries, and repository checks.
  *Done when:* documentation references resolve, no committed tutorial text
  contains credentials or Rami-specific operational data, `npm run test`,
  `npm run build`, and `git diff --check` pass.

## Files / areas

- `integrations/hermes/online-grocery-store-integration/SKILL.md` - agent-facing
  operating workflow and safety rules.
- `integrations/hermes/online-grocery-store-integration/README.md` - installation
  and scope guide for the portable bundle.
- `integrations/hermes/online-grocery-store-integration/references/build-tutorial.md`
  - isolated setup, discovery, promotion, and live verification tutorial.
- `integrations/hermes/online-grocery-store-integration/references/adapter-contract.md`
  - load-bearing command, state, and product-resolution contract.
- `docs/agent-integrations.md` - link to the tutorial and the external-adapter
  boundary.

## Data / contracts

The following documentation contract is load-bearing for feature 34b and future
store implementations:

| Area | Contract |
| --- | --- |
| `status` | Directly probe the recorded WebDriver session and return only privacy-safe URL/title/authentication state with `ok`, `login_required`, `browser_unavailable`, or `error`. |
| `search` | Return live, visible, available results in deterministic DOM order with exact localized name, stable product ID, brand, package/weight, unit, and price when available. |
| `cart` | Read only verified cart items, quantities, units, and prices; distinguish a truly empty cart from parser failure. |
| `ensure` | Make the cart contain at least the target final quantity. It may add only a verified remaining delta, must re-read the final cart, and stops on unknown state. |
| Result states | `ok`, `login_required`, `not_found`, `already_satisfied`, `needs_user_choice`, `needs_fulfillment_choice`, `browser_unavailable`, `not_implemented`, and `error`. |
| Preference | A generic grocery name does not authorize a brand or package choice. Store an exact product only after an authorized person chooses a live result, and revalidate it before reuse. |
| Completion boundary | Adding to a vendor cart never completes a Home Stock Tracker grocery line or records an inventory purchase. |

## Testing

- This documentation-only feature adds no runtime logic, so it does not need a
  new unit test in 34a.
- Inspect every relative documentation link and command placeholder, and verify
  all required result states, no-secret rules, and live matrix cases are present.
- Run `npm run test`, `npm run build`, and `git diff --check` before completion.
- Feature 34b will add automated tests for scaffold validation, generated-file
  contents, fail-closed behavior, preference round trips, and sensitive-content
  exclusions.

## Notes for the AI

- Use placeholders only for store slugs, URLs, ports, SSH hosts, identities,
  product IDs, paths, and browser/session state. Never copy Rami Levy values or
  private operational details into the repository.
- Keep the NestJS service free of browser automation imports and avoid any
  Prisma, API, MCP, or product-domain change.
- Preserve exact source display text. Ask a user when product identity,
  package size, conversion, fulfillment choice, or weighted target cannot be
  represented reliably.
- Treat a Grid `ready: false` result as insufficient evidence of failure while
  its single Selenium slot may be occupied. Probe the recorded session directly
  before recreating it.
